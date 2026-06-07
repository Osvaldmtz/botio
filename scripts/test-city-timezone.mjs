#!/usr/bin/env node
/**
 * Valida detección de ciudad → timezone.
 * Uso: node scripts/test-city-timezone.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const proc = spawnSync('npx', ['--yes', 'tsx', 'scripts/test-city-timezone-run.ts'], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(proc.status ?? 1);
