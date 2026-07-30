import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { HealthCheck } from '../../domain/entities/health-check.entity';

export class ListHealthChecksUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly healthCheckTableRef: TableRef<HealthCheck>,
  ) {}

  async execute(): Promise<HealthCheck[]> {
    return this.database.select<HealthCheck>(this.healthCheckTableRef);
  }
}
