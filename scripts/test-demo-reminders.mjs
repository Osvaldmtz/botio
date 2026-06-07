#!/usr/bin/env node
/**
 * Valida cron de recordatorios demo + respuestas del cliente.
 * Uso: node scripts/test-demo-reminders.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const proc = spawnSync('npx', ['--yes', 'tsx', 'scripts/test-demo-reminders-run.ts'], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(proc.status ?? 1);
