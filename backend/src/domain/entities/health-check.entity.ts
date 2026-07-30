export interface HealthCheck {
  readonly id: number;
  readonly name: string;
  readonly createdAt: Date;
}

export interface HealthCheckInput {
  readonly name: string;
}
