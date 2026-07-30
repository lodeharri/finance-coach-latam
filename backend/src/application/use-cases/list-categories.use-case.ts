import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';

export class ListCategoriesUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly categoryTableRef: TableRef<Category>,
  ) {}

  async execute(): Promise<Category[]> {
    return this.database.select(this.categoryTableRef, {
      orderBy: { field: 'name', direction: 'asc' },
    });
  }
}
