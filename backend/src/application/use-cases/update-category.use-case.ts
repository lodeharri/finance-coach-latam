import type { Category } from '../../domain/entities/category.entity';
import type { DatabasePort, TableRef } from '../../domain/ports/database.port';
import type { LLMPort } from '../../domain/ports/llm.port';
import type { MerchantCachePort } from '../../domain/ports/merchant-cache.port';
import { assertIsAdmin, type Actor } from './authorization';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const UPDATE_EMBEDDING_SQL =
  'UPDATE categories SET embedding = $1::vector WHERE id = $2';

export interface UpdateCategoryPatch {
  readonly name?: string;
  readonly color?: string;
  // slug is intentionally NOT updatable (REQ-AC-006 + proposal Locked Decision)
}

export interface UpdateCategoryInput {
  readonly actor: Actor;
  readonly id: string;
  readonly patch: UpdateCategoryPatch;
}

export class UpdateCategoryUseCase {
  constructor(
    private readonly database: DatabasePort,
    private readonly categoryTableRef: TableRef<Category>,
    private readonly llm: LLMPort,
    private readonly merchantCache: MerchantCachePort,
  ) {}

  async execute(input: UpdateCategoryInput): Promise<Category> {
    assertIsAdmin(input.actor); // REQ-AC-006
    if (input.patch.name !== undefined && !input.patch.name.trim()) {
      // Defense-in-depth: route handler validates first and returns 400 before
      // reaching this branch (see categories.routes.ts).
      throw new Error('Field "name" must be a non-empty string');
    }
    if (input.patch.color !== undefined && !HEX_COLOR.test(input.patch.color)) {
      // Defense-in-depth: route handler validates first and returns 400 before
      // reaching this branch (see categories.routes.ts).
      throw new Error('Field "color" must be a hex color like #AABBCC');
    }

    const existing = await this.database.select(this.categoryTableRef, {
      where: { id: input.id },
      limit: 1,
    });
    if (existing.length === 0) {
      // routeError maps 'not found' substring to 404.
      throw new Error('Category not found');
    }
    const current = existing[0]!;

    const updates: Partial<Category> = {
      ...(input.patch.name !== undefined ? { name: input.patch.name } : {}),
      ...(input.patch.color !== undefined ? { color: input.patch.color } : {}),
    };

    const updated = await this.database.update(
      this.categoryTableRef,
      { id: input.id },
      updates,
    );

    // REQ-AC-008: cache invalidation is best-effort. The next categorization
    // cycle re-derives cache rows from scratch, so a failed DELETE is logged
    // and swallowed.
    try {
      await this.merchantCache.invalidateByCategoryId(input.id);
    } catch (err) {
      console.warn('category cache invalidation failed', { id: input.id, err });
    }

    // REQ-AC-006: embedding recompute fires only when the name changed. Same
    // shape as CreateCategoryUseCase.persistEmbedding — fire-and-forget so the
    // caller observes the update before the LLM responds.
    if (input.patch.name !== undefined) {
      void this.persistEmbedding(updated.id, updated.name, current.slug);
    }

    return updated;
  }

  private async persistEmbedding(id: string, name: string, slug: string): Promise<void> {
    try {
      const embedding = await this.llm.embed(`${name} ${slug}`);
      if (!this.database.query) {
        throw new Error('UpdateCategoryUseCase: database adapter does not support raw queries');
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
