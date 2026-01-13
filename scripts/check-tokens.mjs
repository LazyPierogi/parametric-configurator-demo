import { execSync, execFileSync } from 'node:child_process';

try {
  execSync('npm run generate:tokens', { stdio: 'inherit' });

  const output = execFileSync('git', ['status', '--porcelain', 'packages/ui/tokens/generated'], {
    encoding: 'utf-8',
  }).trim();

  const dirtyLines = output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('??'));

  if (dirtyLines.length > 0) {
    console.error('Design token outputs are out of date. Run `npm run generate:tokens` and commit the changes.');
    process.exit(1);
  }

  console.log('Design token outputs are up to date.');
} catch (error) {
  console.error('[check:tokens] failed', error);
  process.exit(1);
}
