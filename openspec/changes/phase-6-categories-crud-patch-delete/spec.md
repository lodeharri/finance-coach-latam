# Spec Delta: phase-6-categories-crud-patch-delete

> Change: close the admin `/categories` CRUD loop with `PATCH` (edit name/color, re-embed, invalidate cache) and `DELETE` (remove row, invalidate cache).

## Modified Capabilities

### admin-categories

The existing `admin-categories` capability is extended by appending three new requirements. No existing requirement is altered — the change adds behavior, it does not modify prior behavior.

Added requirements:

| ID | Title | Summary |
|----|-------|---------|
| REQ-AC-006 | Only admin can update a category | `PATCH /categories/{id}` is admin-only; body must include `name` and/or `color`; embedding recomputed async; `slug` not updatable |
| REQ-AC-007 | Only admin can delete a category | `DELETE /categories/{id}` is admin-only; returns `204` on success, `404` if missing, `409` if referenced by transactions |
| REQ-AC-008 | Cache is invalidated on category update and delete | `merchant_category_cache` rows for the affected `category_id` are deleted on update/delete; best-effort (failure non-blocking, WARN logged) |

Full requirement text and scenarios live in `openspec/specs/admin-categories/spec.md` (appended at the end of the Requirements section).

## Added Capabilities

None. This change extends the existing `admin-categories` capability only. `authorization` and `transaction-categorization` specs remain untouched.

## Cross-Capability Notes

- The authorization gate (`assertIsAdmin`) is reused from `authorization`; no change there.
- The `merchant_category_cache` table is owned by `transaction-categorization`; only the read-side cleanup on this change affects it. No write contract change in `transaction-categorization`.
- `MerchantCachePort` gains one new method (`invalidateByCategoryId`). This is an additive port change and does not break existing consumers.