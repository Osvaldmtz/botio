#!/usr/bin/env node
/**
 * Valida generación y formato de slots en timezone del host/cliente.
 * Uso: node scripts/test-calendar-slots.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const proc = spawnSync('npx', ['--yes', 'tsx', 'scripts/test-calendar-slots-run.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TZ: 'UTC' },
});

process.exit(proc.status ?? 1);
