import { readFileSync } from 'node:fs';

const origin = 'https://taiyous-manga-library.pages.dev';
const localHtml = readFileSync('dist/index.html', 'utf8');
const matchAssets = (html) => [...new Set([...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]))].sort();
const expected = matchAssets(localHtml);

if (expected.length === 0) throw new Error('Local production build has no asset references');

async function get(path) {
  const response = await fetch(origin + path, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}

async function main() {
  const home = await (await get('/')).text();
  if (!home.includes('id="root"')) throw new Error('Homepage is not the React application shell');

  const served = matchAssets(home);
  const missing = expected.filter((asset) => !served.includes(asset));
  if (missing.length) {
    throw new Error(`Cloudflare is not serving the current master build. Expected assets: ${expected.join(', ')}; served assets: ${served.join(', ')}`);
  }
  console.log('PASS Cloudflare homepage and current build fingerprint');

  for (const route of ['/library', '/offline', '/manga/smoke-test']) {
    const html = await (await get(route)).text();
    if (!html.includes('id="root"')) throw new Error(`${route} did not return the SPA shell`);
    console.log('PASS SPA deep link:', route);
  }

  const worker = await (await get('/sw.js')).text();
  if (!worker.includes('addEventListener') || worker.trimStart().startsWith('<')) {
    throw new Error('Service worker missing or replaced by HTML fallback');
  }
  console.log('PASS offline service worker reachable');

  for (const asset of expected) {
    const response = await get(asset);
    const body = await response.arrayBuffer();
    if (body.byteLength === 0) throw new Error(`Empty asset: ${asset}`);
    console.log('PASS asset:', asset);
  }
  console.log('LIVE CLOUDFLARE SMOKE PASSED');
}

main().catch((error) => {
  console.error('LIVE CLOUDFLARE SMOKE FAILED:', error.message);
  process.exitCode = 1;
});
