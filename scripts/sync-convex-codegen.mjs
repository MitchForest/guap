#!/usr/bin/env node

/**
 * Copies Convex code-generation artifacts from the backend app into the
 * shared API package so callers don't rely on relative ../../ paths.
 *
 * Run after `pnpm --filter @guap/backend generate`.
 */

import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'apps/backend/convex/_generated');
const targetDir = path.join(rootDir, 'packages/api/codegen');

async function main() {
  try {
    await rm(targetDir, { recursive: true, force: true });
  } catch (error) {
    if ((error?.code ?? '') !== 'ENOENT') {
      console.warn('Warning: unable to clean old codegen output', error);
    }
  }

  await cp(sourceDir, targetDir, { recursive: true });
  console.log(`Copied Convex codegen → packages/api/codegen`);
}

main().catch((error) => {
  console.error('Failed to sync Convex codegen artifacts');
  console.error(error);
  process.exit(1);
});
