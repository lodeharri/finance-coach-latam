import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname;

const distDir = resolve(root, 'dist');
const healthOutDir = resolve(root, 'dist/health');
const apiOutDir = resolve(root, 'dist/api');
const migrationOutDir = resolve(root, 'dist/migration');
const categorizerOutDir = resolve(root, 'dist/categorizer');
const drizzleSourceDir = resolve(root, 'drizzle');
const drizzleDestDir = resolve(migrationOutDir, 'drizzle');

await rm(distDir, { recursive: true, force: true });
await mkdir(healthOutDir, { recursive: true });
await mkdir(apiOutDir, { recursive: true });
await mkdir(migrationOutDir, { recursive: true });
await mkdir(categorizerOutDir, { recursive: true });

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
};

const healthOptions = {
  ...sharedOptions,
  entryPoints: [resolve(root, 'src/main.ts')],
  outfile: resolve(healthOutDir, 'handler.js'),
};

const apiOptions = {
  ...sharedOptions,
  entryPoints: [resolve(root, 'src/lambdas/api/composition.ts')],
  outfile: resolve(apiOutDir, 'handler.js'),
};

const migrationOptions = {
  ...sharedOptions,
  entryPoints: [resolve(root, 'src/lambdas/migration/composition.ts')],
  outfile: resolve(migrationOutDir, 'handler.js'),
};

const categorizerOptions = {
  ...sharedOptions,
  entryPoints: [resolve(root, 'src/lambdas/categorizer/composition.ts')],
  outfile: resolve(categorizerOutDir, 'handler.js'),
};

try {
  const args = process.argv.slice(2);
  if (args.includes('--watch')) {
    const ctx = await context(healthOptions);
    await ctx.watch();
    console.log(`esbuild watching: ${healthOutDir}/handler.js`);
  } else {
    await build(healthOptions);
    console.log(`Built: ${healthOutDir}/handler.js`);
    await build(apiOptions);
    console.log(`Built: ${apiOutDir}/handler.js`);
    await build(migrationOptions);
    console.log(`Built: ${migrationOutDir}/handler.js`);
    await build(categorizerOptions);
    console.log(`Built: ${categorizerOutDir}/handler.js`);
    await cp(drizzleSourceDir, drizzleDestDir, { recursive: true });
    console.log(`Copied migrations to: ${drizzleDestDir}`);
  }
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
