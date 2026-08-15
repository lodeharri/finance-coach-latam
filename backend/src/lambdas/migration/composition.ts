import { resolve } from 'node:path';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SSMClient } from '@aws-sdk/client-ssm';
import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  getConfig,
  resolveDemoPasswordParamName,
} from '../../infrastructure/config/env.config';
import { createLLMProvider } from '../../infrastructure/llm/llm.factory';
import { CognitoDemoUsersBootstrap } from './cognito-bootstrap';
import { buildMigrationHandler } from './handler';

export function buildComposition() {
  const config = getConfig();
  if (!config.cognito.userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID is required for the migration Lambda');
  }
  const sql = neon(config.databaseUrl);
  const db: NeonHttpDatabase = drizzle(sql);
  const migrationsFolder = resolve(__dirname, 'drizzle');
  const cognitoClient = new CognitoIdentityProviderClient({
    region: config.cognito.region,
  });
  const ssmClient = new SSMClient({
    region: config.cognito.region,
  });
  const demoPasswordParamName = resolveDemoPasswordParamName(
    config.cognito.demoPasswordParamName,
  );
  const demoUsersBootstrap = new CognitoDemoUsersBootstrap(
    cognitoClient,
    ssmClient,
    config.cognito.userPoolId,
    demoPasswordParamName,
  );
  const llm = createLLMProvider(config.llm);
  return buildMigrationHandler({ db, migrationsFolder, demoUsersBootstrap, llm });
}

export const handler = buildComposition();
