import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type {
  HealthCheck,
  HealthCheckInput,
} from '../../domain/entities/health-check.entity';

export class RecordHealthCheckUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly healthCheckTableRef: TableRef<HealthCheck>,
  ) {}

  async execute(input: HealthCheckInput): Promise<HealthCheck> {
    const trimmed = input.name?.trim();

    if (!trimmed) {
      throw new Error('RecordHealthCheckUseCase: name must be a non-empty string');
    }

    return this.database.insert<HealthCheck, { name: string }>(this.healthCheckTableRef, {
      name: trimmed,
    });
  }
}
