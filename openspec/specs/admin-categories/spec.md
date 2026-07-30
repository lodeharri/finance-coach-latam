# Admin Categories Specification

## Purpose

Runtime category management by admin actors. Admins MUST be able to create categories without redeploying; the embedding for similarity search is computed asynchronously after the response returns so user-facing latency stays low.

## Requirements

### Requirement: Only admin can create categories

The system SHALL permit `POST /categories` only when `actor.role === 'admin'`. Non-admin actors MUST receive a `ForbiddenError` (HTTP 403). `CreateCategoryUseCase` MUST call `assertIsAdmin(actor)` before any database or LLM call.

#### Scenario: admin creates a category

- GIVEN an admin actor and a valid payload (`slug`, `name`, `color`, `icon`)
- WHEN `CreateCategoryUseCase.execute(input)` runs
- THEN the row is inserted with `embedding = null` and the use case returns it

#### Scenario: non-admin is rejected

- GIVEN an actor with `role === 'user'`
- WHEN `CreateCategoryUseCase.execute(input)` runs
- THEN it throws an `Error` whose message contains `'Forbidden'` and no row is inserted

#### Scenario: HTTP route rejects non-admin

- GIVEN a non-admin JWT at `POST /categories`
- WHEN the route handler runs
- THEN it responds 403 and persists nothing

### Requirement: Slug uniqueness is enforced

The system SHALL reject creation when a row with the same `slug` exists. The pre-check SHALL `SELECT` from the categories table and throw an `Error` whose message identifies the duplicated slug.

#### Scenario: duplicate slug rejected

- GIVEN an existing category with `slug === 'transporte'`
- WHEN `CreateCategoryUseCase.execute({ slug: 'transporte', ... })` runs
- THEN it throws an `Error` whose message contains the duplicated slug and no row is inserted

#### Scenario: HTTP route returns 409

- GIVEN an existing `'transporte'` slug and an admin actor
- WHEN the admin posts a new category with that slug
- THEN the route responds 409 and persists no duplicate

### Requirement: Category persists when embedding fails

The system SHALL keep the inserted row even when the asynchronous embedding fails. A `WARN` log entry SHALL carry the category id and the underlying error; the failure SHALL NOT roll back the insert.

#### Scenario: embedding failure does not roll back

- GIVEN an admin actor, a valid payload, and an `llm.embed` that throws
- WHEN `CreateCategoryUseCase.execute(input)` runs
- THEN the row remains, a `WARN` log references the category id and error, and the use case returns the category

### Requirement: Embedding is computed asynchronously

The system SHALL return the 201 BEFORE the embedding completes. The embedding computation MUST update the row in place after the insert; concurrent reads SHALL tolerate `embedding = null`.

#### Scenario: response sent before embedding completes

- GIVEN an admin actor, a valid payload, and an `llm.embed` resolving after 500 ms
- WHEN `CreateCategoryUseCase.execute(input)` runs
- THEN the promise resolves within the synchronous insert window (no await on `llm.embed`) and the embedding update lands afterwards

#### Scenario: similarity queries tolerate null embedding

- GIVEN a freshly created category with `embedding IS NULL`
- WHEN the categorizer runs the pgvector similarity query
- THEN the null-embedding row is excluded and no error is raised

### Requirement: Color is validated as hex

The system SHALL validate `color` against `^#[0-9A-Fa-f]{6}$`. Invalid colors MUST throw an `Error` whose message references the `color` field; no row is inserted.

#### Scenario: valid hex accepted

- GIVEN a payload with `color === '#AABBCC'`
- WHEN `CreateCategoryUseCase.execute(input)` runs
- THEN the category is inserted

#### Scenario: invalid color rejected

- GIVEN a payload with `color === 'red'` or `'#FFF'`
- WHEN `CreateCategoryUseCase.execute(input)` runs
- THEN it throws an `Error` referencing `color` and inserts nothing