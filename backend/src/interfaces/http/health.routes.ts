import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { healthHandler } from './health.handler';
import type { RecordHealthCheckUseCase } from '../../application/use-cases/record-health-check.use-case';
import type { ListHealthChecksUseCase } from '../../application/use-cases/list-health-checks.use-case';

export interface HealthRoutes {
  recordHealthCheckUseCase: RecordHealthCheckUseCase;
  listHealthChecksUseCase: ListHealthChecksUseCase;
}

export function createHealthRoutes(deps: HealthRoutes): APIGatewayProxyHandlerV2 {
  return healthHandler(deps);
}
