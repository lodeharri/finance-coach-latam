# shared-layer

This directory is the landing pad for cross-cutting code that every future
per-domain Lambda will need. Today it is empty on purpose. Its only job is
to exist so the future split does not have to invent the directory and
negotiate the pattern in the same PR.

## What goes here

Anything the per-domain Lambdas must agree on to keep their boundaries
clean:

- **Auth helpers** — JWT decoding, role resolution, the `authenticate`
  function and `VerifiedToken` / `Actor` types. Today these live in
  `interfaces/http/http.utils.ts`; they would move here the day we cut
  the first non-`api` Lambda that needs to read a token.
- **HTTP utilities** — `HttpError`, `jsonResponse`, `parseBody`,
  `requiredString`, `routeError`, `corsHeadersFor`. Same story: shared
  by every handler, so they belong in the shared layer.
- **Domain types** — the cross-domain DTOs and ports that handlers see
  (`VerifiedToken`, error shapes, common request/response envelopes).
  Domain-internal types stay in `domain/`.
- **DB client factory** — building a `NeonDatabaseAdapter` from config.
  Each Lambda will need exactly one of these; building it once in the
  shared layer keeps the connection-pool math in one place.
- **Config loader** — `getConfig()` from `infrastructure/config/env.config.ts`.
  Every Lambda needs it; every Lambda should call it the same way.
- **Composition helpers** — small factories that wire the use cases a
  Lambda actually needs. Today `buildApiComposition` lives inline in
  `lambdas/api/composition.ts`; the per-Lambda variants will need a
  shared shape.

## Why a layer, not just imports

When the API splits into `usersFunction`, `accountsFunction`,
`categoriesFunction`, `transactionsFunction`, the deployment units
will overlap on the code above. Shipping that code in each Lambda
zip costs cold-start time and bundle size. AWS Lambda Layers let
each function pull a single shared `nodejs/shared-layer/` directory
out of `/opt` at runtime — one copy, many functions.

The first version of this refactor skips the layer. The directory
exists, the contract is documented, the first per-domain Lambda
will fill it. Until then the API bundle inlines everything it needs
the way it always has.

## Build

`esbuild.config.mjs` will gain a `shared-layer` entry that bundles this
directory to `backend/dist/shared-layer/`. Until the directory has an
`index.ts` to bundle from, there is nothing to build and the esbuild
config does not reference it. The first move into this directory adds
both the code and the esbuild entry in the same commit.

```js
// esbuild.config.mjs (future)
const sharedLayerOptions = {
  ...sharedOptions,
  entryPoints: [resolve(root, 'src/shared-layer/index.ts')],
  outdir: resolve(root, 'dist/shared-layer'),
};
```

The Layer is published as a CDK asset and attached to each function:

```ts
const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
  code: lambda.Code.fromAsset(path.join(__dirname, '..', 'backend', 'dist', 'shared-layer')),
  compatibleRuntimes: [lambda.Runtime.NODEJS_24_X],
});

// in each per-domain Function:
fn.addLayers(sharedLayer);
```

## How to add code here

1. Move the source from its current location. Keep the import path
   shape the same (relative or absolute) so callers do not have to
   change in the same commit.
2. Add a re-export shim at the old location if anything outside the
   shared layer still references it. The shim keeps the move
   non-breaking.
3. Extend `shared-layer/index.ts` to re-export the public surface of
   the moved module. Future Lambdas import from the layer; existing
   Lambdas keep working through the shim until they are next touched.
4. If the esbuild entry does not exist yet, add it in the same commit.
5. Verify: `cd backend && npm test` (must stay green), `npx tsc --noEmit`
   (must stay clean), `npm run build` (must produce
   `dist/shared-layer/` alongside the existing bundles).
