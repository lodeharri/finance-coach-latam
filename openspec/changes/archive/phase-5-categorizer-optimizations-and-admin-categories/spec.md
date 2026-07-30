# Delta Spec — phase-5-categorizer-optimizations-and-admin-categories

> Change: `phase-5-categorizer-optimizations-and-admin-categories`
> Baseline: `openspec/specs/` is empty — every capability listed below is introduced by this change.

This delta references the three new capability specs that this change establishes. Because no baseline specs exist yet, the capability files under `openspec/specs/{capability}/spec.md` ARE the initial specs, not modifications of existing ones. This document is the index and the contract the archive step will use to merge or maintain those specs.

## Added Capabilities

### admin-categories

Source spec: `openspec/specs/admin-categories/spec.md`

New capability covering runtime category creation by admin actors. Backed by `CreateCategoryUseCase` and `POST /categories`. Embedding is computed asynchronously after the 201 response so the user-facing latency stays low.

Requirements introduced:
- REQ-AC-001 — Only admin can create categories
- REQ-AC-002 — Slug uniqueness is enforced
- REQ-AC-003 — Category persists when embedding fails (warning logged)
- REQ-AC-004 — Embedding is computed asynchronously after the response is returned
- REQ-AC-005 — Color is validated as hex

## Modified Capabilities

### transaction-categorization

Source spec: `openspec/specs/transaction-categorization/spec.md`

The capability was previously undocumented. This change introduces it as the initial spec for the categorizer use case.

Requirements introduced (all `ADDED` — no prior baseline to modify):
- REQ-TC-001 — Keyword pre-match short-circuits the LLM
- REQ-TC-002 — Merchant cache lookup short-circuits the LLM
- REQ-TC-003 — Embedding and similarity search when no earlier layer hits
- REQ-TC-004 — Auto-accept threshold avoids the LLM call
- REQ-TC-005 — generateText resolves genuine ambiguity
- REQ-TC-006 — Cache write after successful categorization
- REQ-TC-007 — Embedding failure falls back to PENDING (no `'otros'` auto-assign)
- REQ-TC-008 — Cache write failure is non-fatal (warn and continue)
- REQ-TC-009 — Merchant normalization (LOWER + TRIM + collapse whitespace) before cache I/O

### authorization

Source spec: `openspec/specs/authorization/spec.md`

The capability was previously undocumented. This change introduces it as the initial spec for the authorization helpers.

Requirements introduced:
- REQ-AZ-001 — `assertCanActAs` permits admin override (documents the existing contract)
- REQ-AZ-002 — `assertIsAdmin(actor)` throws when `actor.role !== 'admin'` (NEW)
- REQ-AZ-003 — `assertIsAdmin(actor)` returns `void` when `actor.role === 'admin'` (NEW)

Inline admin checks in `CreateUserUseCase` and `ListUsersUseCase` are refactored to call `assertIsAdmin(actor)`. Their use-case tests MUST be updated to match the unified error message; the *semantic* contract (non-admin rejected, admin accepted) is preserved.

## Locked Design Decisions (do not re-debate in design phase)

1. **Embedding failure + no keyword match → status=`'PENDING'`.** Admin runs retry. The system MUST NOT auto-assign `'otros'`.
2. **Cache invalidation on category rename is deferred.** `CreateCategoryUseCase` carries a `TODO` comment; no invalidation port is introduced now.
3. **Merchant normalization lives in `CategorizeTransactionUseCase`** before any cache read/write. `LOWER` + `TRIM` + collapse whitespace. Defensive — no throw on already-normalized input.

## Out of Scope (re-confirmed)

- Frontend (Phase 6).
- `DELETE /categories`, `PATCH /categories`.
- LLM provider switch.
- Free-tier upgrade (Cognito, Gemini tier change).
- Any change to the `users` table schema, `cognito-bootstrap`, or `JwtVerifierAdapter`. Role remains Cognito-only.

## Archive Notes

When `sdd-archive` runs, every requirement listed above should be carried forward verbatim into `openspec/specs/{capability}/spec.md` (which already exists). No requirement blocks require MODIFIED treatment — there are no prior blocks to replace.