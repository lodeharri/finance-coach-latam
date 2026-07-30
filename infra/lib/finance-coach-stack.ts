import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
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

    const healthFunction = new lambda.Function(this, 'HealthHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/dist/health'),
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        DATABASE_URL: databaseUrl,
        LLM_PROVIDER: llmProvider,
        GEMINI_API_KEY: geminiApiKey,
        OPENAI_API_KEY: openaiApiKey,
      },
      description: 'Finance Coach LATAM health check using Neon Postgres through Drizzle HTTP.',
    });

    const apiFunction = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/dist/api'),
      memorySize: 512,
      timeout: Duration.seconds(30),
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

    const categorizerFunction = new lambda.Function(this, 'CategorizerFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/dist/categorizer'),
      memorySize: 512,
      timeout: Duration.minutes(2),
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
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

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
      path: '/accounts',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/categories',
      methods: [apigwv2.HttpMethod.GET],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/transactions',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: apiIntegration,
    });
    httpApi.addRoutes({
      path: '/transactions/{id}/categorize',
      methods: [apigwv2.HttpMethod.POST],
      integration: apiIntegration,
    });

    const migrationFunction = new lambda.Function(this, 'MigrationFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/dist/migration'),
      memorySize: 512,
      timeout: Duration.minutes(2),
      environment: {
        DATABASE_URL: databaseUrl,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_REGION: this.region,
        LLM_PROVIDER: llmProvider,
        GEMINI_API_KEY: geminiApiKey,
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

    const migrationProvider = new cr.Provider(this, 'MigrationProvider', {
      onEventHandler: migrationFunction,
      logRetention: logs.RetentionDays.ONE_DAY,
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
