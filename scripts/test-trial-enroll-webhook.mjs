import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['tsx', 'scripts/test-trial-enroll-webhook-run.ts'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
