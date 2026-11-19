import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAMP_PREFIX = '/* Taiyou offline shell release: ';
const STAMP_PATTERN = /\/\* Taiyou offline shell release: ([a-f0-9]{24}) \*\//;
const VALID_ASSET = /^\/(?:[a-zA-Z0-9_-]+\/)*assets\/[a-zA-Z0-9._-]+\.(?:js|css)$/;

/** Identical builds produce identical SW bytes; any changed app shell forces a new install. */
export function computeReleaseFingerprint(html, readAsset) {
  const paths = [...new Set(
    [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
      .map(match => match[1]).filter(path => VALID_ASSET.test(path)),
  )].sort();
  if (!paths.some(path => path.endsWith('.js')) || !paths.some(path => path.endsWith('.css')))
    throw new Error('Production shell must reference local JavaScript and CSS assets');
  const hash = createHash('sha256').update(html);
  for (const path of paths) {
    // Only the asset filename beneath dist/assets is used; no absolute input paths.
    const filename = path.slice(path.lastIndexOf('/assets/') + 1);
    hash.update(path).update(readAsset(filename));
  }
  return hash.digest('hex').slice(0, 24);
}

export function stampServiceWorker(dist = 'dist') {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const fingerprint = computeReleaseFingerprint(html, path => readFileSync(join(dist, path)));
  const target = join(dist, 'sw.js');
  const source = readFileSync(target, 'utf8');
  if (!source.includes("self.addEventListener('install'"))
    throw new Error('Production service worker is missing its install handler');
  const withoutPreviousStamp = source.replace(/\n?\/\* Taiyou offline shell release: [a-f0-9]{24} \*\/\s*$/, '').trimEnd();
  const stamped = withoutPreviousStamp + '\n' + STAMP_PREFIX + fingerprint + ' */\n';
  writeFileSync(target, stamped, 'utf8');
  const marker = stamped.match(STAMP_PATTERN);
  if (marker?.[1] !== fingerprint) throw new Error('Failed to stamp the offline application release');
  console.log('Stamped offline service worker for application release', fingerprint);
  return fingerprint;
}

const invokedAsScript = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) stampServiceWorker();
