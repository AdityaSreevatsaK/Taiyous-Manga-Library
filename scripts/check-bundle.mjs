import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = 'dist/assets';
const assets = readdirSync(root).filter(name => /\.(?:js|css)$/.test(name));
const budgets = [
  // The private synopsis editor and shared cloud status control add a small
  // measured payload. Retain strict caps, including compressed CSS transfer.
  // The dedicated owner workspace is part of the production app. Keep
  // aggregate JS and compressed CSS bounded at the new measured baseline.
  { extension: '.js', limit: 306 * 1024 },
  { extension: '.css', limit: 104 * 1024, gzipLimit: 19.5 * 1024 },
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
