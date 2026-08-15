import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export class FinanceCoachStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const databaseUrl = process.env.DATABASE_URL ?? 'PLACEHOLDER_SET_VIA_DATABASE_URL';
    const llmProvider = process.env.LLM_PROVIDER ?? 'gemini';
    const geminiApiKey = process.env.GEMINI_API_KEY ?? '';
    const openaiApiKey = process.env.OPENAI_API_KEY ?? '';

    // ── CORS allowed origins ────────────────────────────────────────────────
    // Wildcard (`*`) is incompatible with the `Authorization` header that
    // every authenticated request carries: any third-party site running in a
    // user's browser could call the API with a stolen token. We mirror the
    // backend Lambda allow-list at the gateway edge so the OPTIONS preflight
    // and the actual response carry the same origin policy.
    //
    // Override per environment with CDK context, e.g.:
    //   npx cdk deploy -c allowedOrigins=https://staging.example.com,https://prod.example.com
    //
    // Defaults match the values in `backend/src/infrastructure/config/env.config.ts`
    // (`DEFAULT_ALLOWED_ORIGINS`) so local dev, Cloudflare Pages preview, and
    // production agree on the same list without manual configuration.
    const DEFAULT_ALLOWED_ORIGINS = [
      'https://finance-coach-latam.pages.dev',
      'http://localhost:5173',
    ];
    const allowedOriginsCsv =
      (this.node.tryGetContext('allowedOrigins') as string | undefined) ?? '';
    const allowedOrigins = (
      allowedOriginsCsv
        ? allowedOriginsCsv.split(',').map((o) => o.trim()).filter((o) => o.length > 0)
        : DEFAULT_ALLOWED_ORIGINS
    );
    if (allowedOrigins.length === 0) {
      throw new Error(
        'No CORS allowed origins resolved from CDK context. Set `-c allowedOrigins=...` or accept the defaults.',
      );
    }

    const userPool = new cognito.UserPool(this, 'FinanceCoachUserPool', {
      userPoolName: 'finance-coach-latam',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireSymbols: true,
        requireLowercase: false,
        requireUppercase: false,
      },
    });

    const userPoolClient = new cognito.UserPoolClient(
      this,
      'FinanceCoachUserPoolClient',
      {
        userPool,
        generateSecret: false,
        disableOAuth: true,
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
      },
    );

    const adminsGroup = new cognito.CfnUserPoolGroup(this, 'UserPoolGroupadmins', {
      groupName: 'admins',
      description: 'Finance Coach administrators.',
      userPoolId: userPool.userPoolId,
    });
    const usersGroup = new cognito.CfnUserPoolGroup(this, 'UserPoolGroupusers', {
      groupName: 'users',
      description: 'Finance Coach regular users.',
      userPoolId: userPool.userPoolId,
    });

    const issuer = `https://cognito-idp.${this.region}.${this.urlSuffix}/${userPool.userPoolId}`;
    const cognitoAuthorizer = new HttpJwtAuthorizer(
      'FinanceCoachCognitoAuthorizer',
      issuer,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );

    const healthLogGroup = new logs.LogGroup(this, 'HealthHandlerLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    const healthFunction = new lambda.Function(this, 'HealthHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/dist/health'),
      memorySize: 512,
      timeout: Duration.seconds(10),
      logGroup: healthLogGroup,
      environment: {
        DATABASE_URL: databaseUrl,
        LLM_PROVIDER: llmProvider,
        GEMINI_API_KEY: geminiApiKey,
        OPENAI_API_KEY: openaiApiKey,
      },
      description: 'Finance Coach LATAM health check using Neon Postgres through Drizzle HTTP.',
    });

    const apiLogGroup = new logs.LogGroup(this, 'ApiHandlerLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    const apiFunction = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/dist/api'),
      memorySize: 512,
      timeout: Duration.seconds(30),
      logGroup: apiLogGroup,
      environment: {
        DATABASE_URL: databaseUrl,
        LLM_PROVIDER: llmProvider,
        GEMINI_API_KEY: geminiApiKey,
        OPENAI_API_KEY: openaiApiKey,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_REGION: this.region,
      },
      description: 'Finance Coach LATAM authenticated domain API.',
    });

    const categorizerDlq = new sqs.Queue(this, 'CategorizerDlq', {
      retentionPeriod: Duration.days(14),
    });
    cdk.Tags.of(categorizerDlq).add(
      'Description',
      'Dead-letter queue for failed transaction categorization messages.',
    );

    const categorizerQueue = new sqs.Queue(this, 'CategorizerQueue', {
      visibilityTimeout: Duration.seconds(180),
      retentionPeriod: Duration.days(14),
      deadLetterQueue: {
        queue: categorizerDlq,
        maxReceiveCount: 3,
      },
    });
    cdk.Tags.of(categorizerQueue).add(
      'Description',
      'Queue of pending transactions awaiting asynchronous categorization.',
    );

    const categorizerLogGroup = new logs.LogGroup(this, 'CategorizerFunctionLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    const categorizerFunction = new lambda.Function(this, 'CategorizerFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/dist/categorizer'),
      memorySize: 512,
      timeout: Duration.minutes(2),
      logGroup: categorizerLogGroup,
      environment: {
        DATABASE_URL: databaseUrl,
        LLM_PROVIDER: llmProvider,
        GEMINI_API_KEY: geminiApiKey,
        OPENAI_API_KEY: openaiApiKey,
      },
      description: 'Worker that categorizes pending transactions asynchronously via SQS.',
    });

    categorizerFunction.addEventSource(
      new SqsEventSource(categorizerQueue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      }),
    );

    userPool.grant(
      apiFunction,
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:ListUsers',
      'cognito-idp:AdminListGroupsForUser',
    );

    apiFunction.addEnvironment('CATEGORIZER_QUEUE_URL', categorizerQueue.queueUrl);
    categorizerQueue.grantSendMessages(apiFunction);

    const httpApi = new apigwv2.HttpApi(this, 'FinanceCoachHttpApi', {
      description: 'Finance Coach LATAM HTTP API v2.',
      defaultAuthorizer: cognitoAuthorizer,
      corsPreflight: {
        // SPECIFIC origins — never `*`. See `allowedOrigins` resolution above.
        allowOrigins: allowedOrigins,
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Override API Gateway's default throttling (10,000 RPS sustained /
    // 5,000 burst) with a portfolio-appropriate limit. 100 RPS sustained
    // with a 200 burst is more than enough for a demo API and protects
    // downstream Lambdas from accidental traffic spikes.
    const stage = httpApi.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    stage.defaultRouteSettings = {
      throttlingBurstLimit: 200,
      throttlingRateLimit: 100,
    };

    // Per-route throttle overrides — tighter limits on routes that are
    // expensive (writes) or sensitive (admin, LLM-backed). These are the
    // safety floor for free-tier cost: a DoS that races the gateway
    // accounting to 10,000 RPS would burn real money on Lambda + Neon.
    // A normal user doing 5 req/sec for 5 seconds (25 req burst) is well
    // under every limit below. The contract is pinned by
    // `infra/test/finance-coach-stack.test.ts`.
    //
    // NOTE: keys MUST be PascalCase. `CfnStage.routeSettings` is typed as
    // `any | IResolvable` (map values), so CDK does NOT run its automatic
    // camelCase→PascalCase translation on each entry. Passing
    // `throttlingRateLimit` here produces `throttlingRateLimit` in the
    // synthesized CloudFormation, which AWS silently ignores. PascalCase
    // passes through to CloudFormation unchanged.
    // Ensure the Stage is updated AFTER any new Route is created. Without this,
    // AWS processes the Stage UPDATE before the Route CREATE, and RouteSettings referencing a not-yet-existing route key fail with
    // "Unable to find Route by key GET /transactions/{id}".
    // Note: httpApi.addRoutes() returns the CfnRoute in some versions; in L2 CDK it returns void.
    // Using httpApi itself as the dependency target is the safe pattern — the Stage will wait for all of httpApi's resources to settle.
    stage.node.addDependency(httpApi);
    stage.routeSettings = {
      'GET /transactions': { ThrottlingRateLimit: 100, ThrottlingBurstLimit: 50 },
      'GET /accounts': { ThrottlingRateLimit: 50, ThrottlingBurstLimit: 20 },
      'GET /categories': { ThrottlingRateLimit: 50, ThrottlingBurstLimit: 20 },
      'GET /users': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
      'POST /transactions': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
      'POST /accounts': { ThrottlingRateLimit: 15, ThrottlingBurstLimit: 5 },
      'POST /categories': { ThrottlingRateLimit: 15, ThrottlingBurstLimit: 5 },
      'PATCH /transactions/{id}': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
      'GET /transactions/{id}': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
      'DELETE /categories/{id}': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
      'DELETE /users/{id}': { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 3 },
      'PATCH /categories/{id}': { ThrottlingRateLimit: 30, ThrottlingBurstLimit: 10 },
      'PATCH /accounts/{id}': { ThrottlingRateLimit: 15, ThrottlingBurstLimit: 5 },
      'POST /transactions/{id}/categorize': { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 3 },
    };

    const healthIntegration = new HttpLambdaIntegration('HealthIntegration', healthFunction);
    const publicAuthorizer = new apigwv2.HttpNoneAuthorizer();

    httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.POST],
      integration: healthIntegration,
      authorizer: publicAuthorizer,
    });

    httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: healthIntegration,
      authorizer: publicAuthorizer,
    });

    const apiIntegration = new HttpLambdaIntegration('ApiIntegration', apiFunction);

    httpApi.addRoutes({
      path: '/users',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/users/{id}',
      methods: [apigwv2.HttpMethod.PATCH, apigwv2.HttpMethod.DELETE],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/accounts',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/accounts/{id}',
      methods: [apigwv2.HttpMethod.PATCH, apigwv2.HttpMethod.DELETE],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/categories',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/categories/{id}',
      methods: [apigwv2.HttpMethod.PATCH, apigwv2.HttpMethod.DELETE],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/transactions',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/transactions/{id}',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PATCH],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/transactions/{id}/categorize',
      methods: [apigwv2.HttpMethod.POST],
      integration: apiIntegration,
    });

    const migrationLogGroup = new logs.LogGroup(this, 'MigrationFunctionLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    const migrationFunction = new lambda.Function(this, 'MigrationFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/dist/migration'),
      memorySize: 512,
      timeout: Duration.minutes(2),
      logGroup: migrationLogGroup,
      environment: {
        DATABASE_URL: databaseUrl,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_REGION: this.region,
        LLM_PROVIDER: llmProvider,
        GEMINI_API_KEY: geminiApiKey,
        DEMO_PASSWORD_PARAM_NAME: '/finance-coach-latam/demo-password',
      },
      description: 'Runs Drizzle migrations, Cognito bootstrap, and idempotent seed on every deploy.',
    });

    userPool.grant(
      migrationFunction,
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminGetUser',
      'cognito-idp:AdminSetUserPassword',
      'cognito-idp:AdminAddUserToGroup',
    );

    // The demo password lives in SSM Parameter Store (SecureString, standard
    // tier, aws/ssm key); only its NAME is in the Lambda environment. Grant
    // least-privilege read + decrypt access on exactly that parameter to the
    // migration Lambda role ONLY — no other Lambda can read it.
    migrationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/finance-coach-latam/demo-password`,
        ],
      }),
    );
    migrationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Decrypt'],
        resources: [`arn:aws:kms:${this.region}:${this.account}:alias/aws/ssm`],
      }),
    );

    const migrationProviderLogGroup = new logs.LogGroup(this, 'MigrationProviderLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    const migrationProvider = new cr.Provider(this, 'MigrationProvider', {
      onEventHandler: migrationFunction,
      logGroup: migrationProviderLogGroup,
    });

    const migrateAndSeed = new cdk.CustomResource(this, 'MigrateAndSeed', {
      serviceToken: migrationProvider.serviceToken,
      properties: {
        ForceUpdate: new Date().toISOString(),
      },
    });

    migrateAndSeed.node.addDependency(adminsGroup, usersGroup);
    healthFunction.node.addDependency(migrateAndSeed);
    apiFunction.node.addDependency(migrateAndSeed);
    categorizerFunction.node.addDependency(migrateAndSeed);
    httpApi.node.addDependency(migrateAndSeed);

    new CfnOutput(this, 'FinanceCoachApiUrl', {
      value: httpApi.url ?? 'NO_URL',
      description: 'Finance Coach API URL — test with: curl <url>/health',
      exportName: 'FinanceCoachApiUrl',
    });
    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito user pool ID.',
    });
    new CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Public Cognito app client ID for direct API authentication.',
    });
    new CfnOutput(this, 'CognitoAuthDomain', {
      value: issuer,
      description: 'Cognito token issuer and JWKS base URL.',
    });
    new CfnOutput(this, 'CategorizerQueueUrl', {
      value: categorizerQueue.queueUrl,
      description: 'SQS queue URL that holds pending categorization jobs.',
    });
    new CfnOutput(this, 'CategorizerDlqUrl', {
      value: categorizerDlq.queueUrl,
      description: 'SQS dead-letter queue for failed categorization jobs.',
    });
  }
}
