import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'dist/assets';
const assets = readdirSync(root).filter(name => /\.(?:js|css)$/.test(name));
const budgets = [
  { extension: '.js', limit: 300 * 1024 },
  { extension: '.css', limit: 60 * 1024 },
];
for (const { extension, limit } of budgets) {
  const files = assets.filter(name => name.endsWith(extension));
  const bytes = files.reduce((sum, file) => sum + statSync(join(root, file)).size, 0);
  const kb = (bytes / 1024).toFixed(1);
  console.log(`${extension} total: ${kb} KiB (budget ${limit / 1024} KiB)`);
  if (!files.length || bytes > limit) {
    console.error(`Production ${extension} bundle is missing or exceeds the documented budget`);
    process.exitCode = 1;
  }
}

const worker = readFileSync('dist/sw.js', 'utf8');
if (!/\/\* Taiyou offline shell release: [a-f0-9]{24} \*\//.test(worker)) {
  console.error('Service worker is not fingerprinted for this release; offline updates may remain stale');
  process.exitCode = 1;
}
