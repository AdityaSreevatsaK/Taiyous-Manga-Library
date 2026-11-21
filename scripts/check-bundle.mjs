import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = 'dist/assets';
const assets = readdirSync(root).filter(name => /\.(?:js|css)$/.test(name));
const budgets = [
  // The 21 November Manga Master workspace adds private usage tracking,
  // per-title analytics and protected catalogue administration. Its components
  // are now loaded on demand; only the reader tracker ships on the home route.
  // These are aggregate all-route budgets, not the first-load transfer weight.
  // 21 Nov measured before route splitting: 352.1 KiB JS and 156.1 KiB CSS,
  // 27.6 KiB gzipped CSS. Retain a small bounded regression allowance.
  { extension: '.js', limit: 365 * 1024 },
  // Rolling day/month labels add under 0.25 KiB of compressed CSS to the
  // measured 29 KiB baseline. Keep the limit tightly bounded.
  { extension: '.css', limit: 163 * 1024, gzipLimit: 29.25 * 1024 },
];
for (const { extension, limit, gzipLimit } of budgets) {
  const files = assets.filter(name => name.endsWith(extension));
  const bytes = files.reduce((sum, file) => sum + statSync(join(root, file)).size, 0);
  const kb = (bytes / 1024).toFixed(1);
  console.log(`${extension} total: ${kb} KiB (budget ${limit / 1024} KiB)`);
  if (gzipLimit) {
    const compressed = files.reduce((sum, file) =>
      sum + gzipSync(readFileSync(join(root,file))).byteLength, 0);
    console.log(`${extension} gzip total: ${(compressed / 1024).toFixed(1)} KiB (budget ${gzipLimit / 1024} KiB)`);
    if (compressed > gzipLimit) {
      console.error('Compressed stylesheet exceeds the network transfer budget');
      process.exitCode = 1;
    }
  }
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
