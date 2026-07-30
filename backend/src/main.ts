import { getConfig } from './infrastructure/config/env.config';
import { NeonDatabaseAdapter } from './infrastructure/database/neon-database.adapter';
import { healthCheckTableRef } from './infrastructure/database/drizzle/schema';
import { RecordHealthCheckUseCase } from './application/use-cases/record-health-check.use-case';
import { ListHealthChecksUseCase } from './application/use-cases/list-health-checks.use-case';
import { createHealthRoutes } from './interfaces/http/health.routes';

function bootstrap() {
  const config = getConfig();

  const database = new NeonDatabaseAdapter(config.databaseUrl);
  // LLM provider will be wired when categorizer use case lands (Phase 2).

  const recordHealthCheckUseCase = new RecordHealthCheckUseCase(database, healthCheckTableRef);
  const listHealthChecksUseCase = new ListHealthChecksUseCase(database, healthCheckTableRef);

  const handler = createHealthRoutes({
    recordHealthCheckUseCase,
    listHealthChecksUseCase,
  });

  return handler;
}

export const handler = bootstrap();
