#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FinanceCoachStack } from '../lib/finance-coach-stack';

const app = new cdk.App();

new FinanceCoachStack(app, 'FinanceCoachStack', {
  description: 'Finance Coach LATAM: Lambda + API Gateway HTTP API + Neon Postgres via Drizzle HTTP.',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
