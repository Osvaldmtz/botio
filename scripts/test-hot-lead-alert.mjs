#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const proc = spawnSync('npx', ['--yes', 'tsx', 'scripts/test-hot-lead-alert-run.ts'], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(proc.status ?? 1);
