#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(process.cwd());
const pnpmStore = path.join(rootDir, 'node_modules', '.pnpm');

const entries = fs.existsSync(pnpmStore) ? fs.readdirSync(pnpmStore) : [];
const betterAuthEntry =
  entries.find((entry) => entry.startsWith('better-auth@')) ?? null;

if (!betterAuthEntry) {
  console.error('Unable to locate better-auth package in node_modules/.pnpm');
  process.exit(1);
}

const modulePath = path.join(
  pnpmStore,
  betterAuthEntry,
  'node_modules',
  'better-auth',
  'dist',
  'plugins',
  'organization',
  'access',
  'index.mjs'
);

if (!fs.existsSync(modulePath)) {
  console.error('Unable to locate better-auth organization plugin bundle:', modulePath);
  process.exit(1);
}

const mod = await import(pathToFileURL(modulePath).href);
const roles = Object.keys(mod.defaultRoles ?? {});

if (roles.length === 0) {
  console.error('defaultRoles not found in Better Auth plugin output');
  process.exit(1);
}

const outDir = path.join(rootDir, 'packages', 'types', 'src', 'generated');
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, 'betterAuthRoles.ts');
const fileContent = `export const BetterAuthRoleValues = ${JSON.stringify(roles, null, 2)} as const;\n`;

fs.writeFileSync(outFile, fileContent);
console.log(`Generated Better Auth roles -> ${path.relative(rootDir, outFile)}`);
