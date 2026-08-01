# Authorization Specification

## Purpose

Authorization guards for the application layer. Defines the canonical helpers every use case and HTTP handler MUST consult before touching user-scoped resources or admin-scoped operations. The role remains Cognito-only (out-of-band provisioning); this spec defines only the in-process contract.

## Requirements

### Requirement: assertCanActAs permits admin override

The system SHALL allow an actor with `role === 'admin'` to act on any `targetUserId` via `assertCanActAs(actor, targetUserId)`. A non-admin actor SHALL only act on `actor.userId`. Otherwise the system MUST throw an `Error` whose message contains `'Forbidden'`.

#### Scenario: admin acts on another user

- GIVEN an actor with `role === 'admin'` and `targetUserId !== actor.userId`
- WHEN `assertCanActAs(actor, targetUserId)` is called
- THEN it returns `void` without throwing

#### Scenario: user acts on their own resource

- GIVEN an actor with `role === 'user'` and `targetUserId === actor.userId`
- WHEN `assertCanActAs(actor, targetUserId)` is called
- THEN it returns `void` without throwing

#### Scenario: user is forbidden from another user's resource

- GIVEN an actor with `role === 'user'` and `targetUserId !== actor.userId`
- WHEN `assertCanActAs(actor, targetUserId)` is called
- THEN it throws an `Error` whose message contains `'Forbidden'`

### Requirement: assertIsAdmin rejects non-admin actors

The system SHALL provide `assertIsAdmin(actor)` that throws an `Error` whose message contains `'Forbidden'` when `actor.role !== 'admin'`. The helper MUST NOT mutate the `actor` argument and MUST NOT invoke any side-effecting dependency.

#### Scenario: non-admin actor is rejected

- GIVEN an actor with `role === 'user'`
- WHEN `assertIsAdmin(actor)` is called
- THEN it throws an `Error` whose message contains `'Forbidden'`

#### Scenario: admin actor is accepted

- GIVEN an actor with `role === 'admin'`
- WHEN `assertIsAdmin(actor)` is called
- THEN it returns `void` without throwing

#### Scenario: refactored callers preserve rejection

- GIVEN `CreateUserUseCase`, `ListUsersUseCase`, or `CreateCategoryUseCase` invoked with `actor.role === 'user'`
- WHEN the use case's `execute` runs
- THEN it throws an `Error` whose message contains `'Forbidden'`
- AND no `database`, `auth`, or `llm` dependency is invoked before the throw

### Requirement: PATCH /transactions/{id} authorizes against the loaded row

The system SHALL authorize `PATCH /transactions/{id}` by loading the transaction first, then calling `assertCanActAs(actor, transaction.userId)` against the loaded row's `userId`. The route-level `userId` from the request body or query MUST NOT be trusted for authorization — only the row's `userId` is consulted. A missing transaction MUST surface as `404` before any authorization check; a non-owner non-admin actor MUST receive `403` with `{ error: "forbidden" }`.

#### Scenario: owner overrides category

- GIVEN an authenticated owner with a `CATEGORIZED` transaction
- WHEN `PATCH /transactions/{id}` is called with `{ categoryId: "<new>" }`
- THEN the row's `categoryId` is updated, `status` stays `CATEGORIZED`, and the route returns 200 with the updated transaction

#### Scenario: admin overrides another user's category

- GIVEN an admin actor and a transaction owned by a different user
- WHEN `PATCH /transactions/{id}` is called
- THEN the route returns 200 and the row is updated (admin override)

#### Scenario: non-owner non-admin is rejected

- GIVEN a `user` actor and a transaction owned by another `user`
- WHEN `PATCH /transactions/{id}` is called
- THEN the route returns 403 with `{ error: "forbidden" }` and no DB write occurs

#### Scenario: unknown transaction id

- GIVEN an authenticated actor and `id` that does not exist
- WHEN `PATCH /transactions/{id}` is called
- THEN the route returns 404 with `{ error: "transaction not found" }`

#### Scenario: spoofed userId in body

- GIVEN a `user` actor and a transaction owned by user `B`
- WHEN `PATCH /transactions/{id}` is called with body `{ categoryId, userId: "<self>" }`
- THEN the use case still loads the transaction, sees `userId = B`, and rejects with `Forbidden`