#!/usr/bin/env node
/**
 * Integration tests for lib/kalyo-account-creator.ts
 *
 * Usage: node scripts/test-account-creator.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const proc = spawnSync('npx', ['--yes', 'tsx', 'scripts/test-account-creator-run.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(proc.status ?? 1);
