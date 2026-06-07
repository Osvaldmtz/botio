#!/usr/bin/env node
/**
 * Valida interceptor de confirmación demo y response guard.
 * Uso: node scripts/test-demo-flow-interceptor.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const proc = spawnSync(
  'npx',
  ['--yes', 'tsx', 'scripts/test-demo-flow-interceptor-run.ts'],
  { cwd: root, stdio: 'inherit' },
);

process.exit(proc.status ?? 1);
