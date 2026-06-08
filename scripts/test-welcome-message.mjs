import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['tsx', 'scripts/test-welcome-message-run.ts'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
