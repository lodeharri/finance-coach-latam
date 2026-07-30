import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { LLMPort } from '../../domain/ports/llm.port';
import { assertIsAdmin, type Actor } from './authorization';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const UPDATE_EMBEDDING_SQL =
  'UPDATE categories SET embedding = $1::vector WHERE id = $2';

export interface CreateCategoryInput {
  readonly actor: Actor;
  readonly slug: string;
  readonly name: string;
  readonly color: string;
}

export class CreateCategoryUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly categoryTableRef: TableRef<Category>,
    private readonly llm: LLMPort,
  ) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    assertIsAdmin(input.actor); // REQ-AC-001
    if (!HEX_COLOR.test(input.color)) {
      // Defense-in-depth: the route handler also validates and returns 400
      // before reaching this branch (see categories.routes.ts).
      throw new Error('Field "color" must be a hex color like #AABBCC');
    }
    const existing = await this.database.select(this.categoryTableRef, {
      where: { slug: input.slug },
      limit: 1,
    });
    if (existing.length > 0) {
      // REQ-AC-002: the route handler catches this prefix and re-throws
      // HttpError(409) so the response status is correct.
      throw new Error(`Category slug already exists: ${input.slug}`);
    }
    const inserted = await this.database.insert(this.categoryTableRef, {
      slug: input.slug,
      name: input.name,
      color: input.color,
    });
    // REQ-AC-004: fire-and-forget embedding. Do NOT await — the response
    // returns before the embedding resolves. The async task is voided so
    // unhandled rejections are caught inside `persistEmbedding`.
    void this.persistEmbedding(inserted.id, input.name, input.slug);
    // TODO(spec Locked Decision 2): invalidate merchant_category_cache entries
    // that point at this slug if/when category renames are introduced. Out of
    // scope for this slice (no rename endpoint exists yet).
    return inserted;
  }

  private async persistEmbedding(id: string, name: string, slug: string): Promise<void> {
    try {
      // REQ-AC-003: only the name+slug are embedded. Other merchants that
      // share the slug's category will match against this vector.
      const embedding = await this.llm.embed(`${name} ${slug}`);
      // The `embedding` column lives on the categories table but is absent
      // from the `Category` entity (same situation as the keyword lookup in
      // CategorizeTransactionUseCase), so reach for the raw-SQL escape hatch
      // to update it instead of `database.update`.
      if (!this.database.query) {
        throw new Error('CreateCategoryUseCase: database adapter does not support raw queries');
      }
      await this.database.query(UPDATE_EMBEDDING_SQL, [
        JSON.stringify(embedding),
        id,
      ]);
    } catch (err) {
      console.warn('category embedding failed', { id, slug, err });
    }
  }
}