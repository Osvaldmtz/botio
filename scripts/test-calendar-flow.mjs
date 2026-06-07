#!/usr/bin/env node
/**
 * Prueba el flujo de Google Calendar (requiere OAuth conectado).
 *
 * Uso: node scripts/test-calendar-flow.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const proc = spawnSync('npx', ['--yes', 'tsx', 'scripts/test-calendar-flow-run.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(proc.status ?? 1);
