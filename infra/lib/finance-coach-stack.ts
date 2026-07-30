import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';

export class FinanceCoachStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const databaseUrl = process.env.DATABASE_URL ?? 'PLACEHOLDER_SET_VIA_DATABASE_URL';
    const llmProvider = process.env.LLM_PROVIDER ?? 'gemini';
    const geminiApiKey = process.env.GEMINI_API_KEY ?? '';
    const openaiApiKey = process.env.OPENAI_API_KEY ?? '';

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

    const httpApi = new apigwv2.HttpApi(this, 'FinanceCoachHttpApi', {
      description: 'Finance Coach LATAM HTTP API v2.',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const healthIntegration = new HttpLambdaIntegration('HealthIntegration', healthFunction);

    httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.POST],
      integration: healthIntegration,
    });

    httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: healthIntegration,
    });

    const migrationFunction = new lambda.Function(this, 'MigrationFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/dist/migration'),
      memorySize: 512,
      timeout: Duration.minutes(2),
      environment: {
        DATABASE_URL: databaseUrl,
      },
      description: 'Runs Drizzle migrations and idempotent seed on every deploy via CloudFormation Custom Resource.',
    });

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

    healthFunction.node.addDependency(migrateAndSeed);
    httpApi.node.addDependency(migrateAndSeed);

    new CfnOutput(this, 'FinanceCoachApiUrl', {
      value: httpApi.url ?? 'NO_URL',
      description: 'Finance Coach API URL — test with: curl <url>/health',
      exportName: 'FinanceCoachApiUrl',
    });
  }
}
