# Transaction Categorization Specification

## Purpose

Assigns a single category to a pending transaction by combining four layers in order: keyword pre-match, merchant cache, embedding similarity with auto-accept, and an LLM ambiguity resolver. Layers exist to keep Gemini API usage near zero on the steady-state path while preserving correctness on the cold path.

## Requirements

### Requirement: Keyword pre-match short-circuits the LLM

The system SHALL attempt a case-insensitive substring match of `matchKeyword(merchant)` before any database query or LLM call. On match the system SHALL assign the mapped category slug, set `status` to `'CATEGORIZED'`, and MUST NOT invoke `llm.embed` or `llm.generateText`.

#### Scenario: known keyword matches

- GIVEN `merchant === 'Shell'` and `KEYWORDS` maps `'shell'` to `'transporte'`
- WHEN the use case runs
- THEN `database.update` writes `{ categoryId, status: 'CATEGORIZED' }` and no LLM call happens

#### Scenario: unknown merchant skips keyword layer

- GIVEN `merchant === 'PedidosYa'` with no matching keyword
- WHEN the use case runs
- THEN the keyword layer returns `null` and execution proceeds to the cache layer

### Requirement: Merchant cache lookup short-circuits the LLM

The system SHALL look up `merchant_category_cache` by the normalized merchant before `llm.embed`. On hit the system SHALL write the cached `categoryId` with `status: 'CATEGORIZED'`; `llm.embed` and `llm.generateText` MUST NOT be called.

#### Scenario: cache hit writes cached category

- GIVEN the cache contains `{ merchant: 'shell', categoryId: 'X' }`
- WHEN the use case runs for `merchant === 'Shell'`
- THEN `database.update` writes `categoryId: 'X'` with `status: 'CATEGORIZED'` and no LLM call happens

#### Scenario: cache miss proceeds to embedding

- GIVEN the cache has no entry for the normalized merchant
- WHEN the use case runs
- THEN execution proceeds to the embedding layer

### Requirement: Embedding and similarity search

The system SHALL call `llm.embed(merchant + ' ' + notes)` and run the pgvector `<=>` query against categories whose `embedding IS NOT NULL`. When the query returns zero rows the system MUST throw an `Error` whose message identifies the missing categories.

#### Scenario: similarity query returns ranked rows

- GIVEN no keyword match, no cache hit, and `llm.embed` returning a vector
- WHEN the use case runs
- THEN `llm.embed` is called exactly once and `database.query` runs the `<=> $1::vector` SELECT

#### Scenario: no categories with embeddings

- GIVEN the similarity query returns zero rows
- WHEN the use case runs
- THEN it throws an `Error` containing `'No categories'` and `database.update` is not called

### Requirement: Auto-accept threshold avoids the LLM

The system SHALL auto-accept `ranked[0]` without `llm.generateText` when `ranked.length === 1` OR `ranked[0].distance < ranked[1].distance * AUTO_ACCEPT_THRESHOLD` (default `0.5`).

#### Scenario: only one ranked category

- GIVEN the similarity query returns a single row
- WHEN the use case runs
- THEN `llm.generateText` is never called and `database.update` writes that row's `categoryId`

#### Scenario: top-1 dominates top-2 by more than 2x

- GIVEN distances `[0.10, 0.40]` (ratio `0.25`, below `0.5`)
- WHEN the use case runs
- THEN `llm.generateText` is never called and `database.update` writes `ranked[0].id`

### Requirement: generateText resolves genuine ambiguity

The system SHALL call `llm.generateText` only when `ranked.length >= 2` AND `ranked[0].distance >= ranked[1].distance * AUTO_ACCEPT_THRESHOLD`. The prompt SHALL list the ranked candidates and SHALL instruct the model to return only the category UUID.

#### Scenario: ambiguous ranking invokes the LLM

- GIVEN distances `[0.30, 0.40]` (ratio `0.75`, above `0.5`)
- WHEN the use case runs
- THEN `llm.generateText` runs once and `database.update` writes the LLM's selection

#### Scenario: LLM returns an unknown id

- GIVEN the LLM returns a UUID matching no ranked row
- WHEN the use case runs
- THEN it throws an `Error` containing `'unknown category'` and `database.update` is not called

### Requirement: Cache write after successful categorization

After any successful path (keyword, cache hit, auto-accept, or LLM) the system SHALL write the resolved merchant and `categoryId` to `merchant_category_cache` using the normalized merchant key.

#### Scenario: cache is populated

- GIVEN any successful path produces `categoryId === 'X'`
- WHEN the use case resolves
- THEN the cache write adapter is called with the normalized merchant and `categoryId: 'X'`

### Requirement: Embedding failure falls back to PENDING

When `llm.embed` throws AND no keyword match exists the system SHALL keep `status` as `'PENDING'`. The system MUST NOT auto-assign `'otros'`. An admin MUST trigger retry.

#### Scenario: embedding fails with no keyword match

- GIVEN `merchant === 'PedidosYa'` (no keyword) and `llm.embed` rejects
- WHEN the use case runs
- THEN `database.update` writes `{ status: 'PENDING' }` only, called once, and the use case does not throw

#### Scenario: embedding fails but keyword matches

- GIVEN `merchant === 'Shell'` and `llm.embed` rejects
- WHEN the use case runs
- THEN the keyword layer assigns the category with zero API calls

### Requirement: Cache write failure is non-fatal

When the cache write throws the system SHALL log a `WARN` entry with merchant and error and SHALL still resolve the use case with the categorized transaction.

#### Scenario: cache write rejects

- GIVEN a successful categorization and a cache `save` that rejects
- WHEN the use case runs
- THEN a `WARN` log references merchant and error, the use case resolves, and no exception propagates

### Requirement: Merchant normalization before cache I/O

The system SHALL normalize `merchant` by trimming whitespace, collapsing internal whitespace runs to one space, and lower-casing. Normalization SHALL run BEFORE cache read and BEFORE cache write; it MUST be defensive (no throw on already-normalized input).

#### Scenario: mixed casing and extra whitespace

- GIVEN `merchant === '  Shell   OIL '`
- WHEN the use case runs
- THEN both cache lookup and write use the key `'shell oil'`

#### Scenario: already normalized merchant

- GIVEN `merchant === 'spotify'`
- WHEN the normalization step runs
- THEN the output equals `'spotify'` and no exception is raised

### Requirement: Manual override path skips the categorization pipeline

The system SHALL expose a `PATCH /transactions/{id}` path that resolves the actor's authority against the loaded row, validates the requested `categoryId`, writes the row, and returns the updated transaction. The override path SHALL NOT invoke the keyword, cache, embedding, or `generateText` layers — it is the explicit user decision and bypasses the entire categorization pipeline. The override MAY upsert `merchant_category_cache` as a learned merchant so future auto-categorization of the same merchant reflects the user's intent.

#### Scenario: override skips the LLM

- GIVEN any transaction state
- WHEN `PATCH /transactions/{id}` is called with a valid `categoryId`
- THEN the keyword, cache, embedding, and `generateText` layers are NOT invoked

#### Scenario: explicit override updates the cache

- GIVEN a transaction with `merchant="Shell"` and `categoryId=<transporte>`
- WHEN the owner PATCHes `categoryId=<compras>`
- THEN the transactions row is updated AND the cache row for normalized `"shell"` now points to `<compras>`

#### Scenario: subsequent categorize call uses the new cache row

- GIVEN the cache now maps `"shell"` → `<compras>`
- WHEN `POST /transactions/{id}/categorize` runs for a fresh transaction with `merchant="Shell"`
- THEN the cache layer short-circuits and assigns `<compras>` without invoking the LLM