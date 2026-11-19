import { readFileSync } from 'node:fs';

const origin = 'https://taiyous-manga-library.pages.dev';
const localHtml = readFileSync('dist/index.html', 'utf8');
const matchAssets = (html) => [...new Set([...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]))].sort();
const expected = matchAssets(localHtml);
const failures = [];

if (expected.length === 0) throw new Error('Local production build has no asset references');

async function get(path) {
  const response = await fetch(origin + path, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}

async function check(label, callback) {
  try {
    await callback();
    console.log('PASS', label);
  } catch (error) {
    failures.push(label);
    console.error('FAIL', label, '-', error.message);
  }
}

async function main() {
  let served = [];
  await check('Homepage and React shell', async () => {
    const home = await (await get('/')).text();
    if (!home.includes('id="root"')) throw new Error('Homepage is not the React application shell');
    served = matchAssets(home);
    console.log('Live asset names:', served.join(', '));
  });

  await check('Latest master build deployed', async () => {
    const missing = expected.filter((asset) => !served.includes(asset));
    if (missing.length) {
      throw new Error(`Expected: ${expected.join(', ')}; actually served: ${served.join(', ')}`);
    }
  });

  for (const route of [
    '/library', '/offline', '/manga/smoke-test',
    '/manga/mng_fivechaptertrial',
    '/manga/mng_fivechaptertrial/chapters/ch_trialawakening?page=1',
    '/manga/mng_fivechaptertrial/chapters/ch_trialnewdawn?page=1',
  ]) {
    await check('SPA direct route ' + route, async () => {
      const html = await (await get(route)).text();
      if (!html.includes('id="root"')) throw new Error('Not the SPA shell');
    });
  }

  await check('Deployed reader contains five-chapter trial and chapter-only controls', async () => {
    const javascript = served.filter(asset => asset.endsWith('.js'));
    if (javascript.length === 0) throw new Error('No deployed JavaScript assets');
    const all = (await Promise.all(javascript.map(async asset => (await get(asset)).text()))).join('');
    if (!all.includes('Five Chapter Scroll Trial') || !all.includes('Next chapter')) {
      throw new Error('The deployed JavaScript does not contain the chapter-first demo');
    }
  });

  await check('Offline service worker matches current application release', async () => {
    const worker = await (await get('/sw.js')).text();
    if (!worker.includes('addEventListener') || worker.trimStart().startsWith('<')) {
      throw new Error('Missing service worker or HTML fallback');
    }
    const local = readFileSync('dist/sw.js', 'utf8');
    const fingerprint = local.match(/Taiyou offline shell release: ([a-f0-9]{24})/);
    if (!fingerprint || !worker.includes('Taiyou offline shell release: ' + fingerprint[1])) {
      throw new Error('The deployed offline app shell is from an older build');
    }
  });

  await check('Cloudflare production security headers', async () => {
    const response = await get('/');
    const headers = response.headers;
    if (headers.get('x-content-type-options')?.toLowerCase() !== 'nosniff' ||
        headers.get('x-frame-options')?.toUpperCase() !== 'DENY' ||
        !headers.get('content-security-policy')?.includes("default-src 'none'")) {
      throw new Error('Expected no-sniff, frame protection and content security policy headers');
    }
  });

  // Security boundary: a public SPA shell must never replace a private API response.
  await check('Private HF API rejects anonymous reads', async () => {
    for (const route of ['/api/auth/session','/api/library']) {
      const response = await fetch(origin+route,{
        redirect:'manual',signal:AbortSignal.timeout(15000),cache:'no-store',
      });
      if(response.status!==401 || !response.headers.get('Content-Type')?.includes('application/json') ||
         !response.headers.get('Cache-Control')?.includes('no-store')) {
        throw new Error(route+' did not return private 401 JSON (status '+response.status+')');
      }
    }
  });
  await check('Production OAuth redirects to Hugging Face only', async () => {
    const response=await fetch(origin+'/api/auth/login',{
      redirect:'manual',signal:AbortSignal.timeout(15000),cache:'no-store',
    });
    const location=response.headers.get('Location')||'';
    if(response.status!==303 || !location.startsWith('https://huggingface.co/oauth/authorize?') ||
       !response.headers.get('Set-Cookie')?.includes('HttpOnly')) {
      throw new Error('Expected a secure confidential OAuth redirect');
    }
  });

  for (const asset of served) {
    await check('Deployed asset ' + asset, async () => {
      const response = await get(asset);
      if ((await response.arrayBuffer()).byteLength === 0) throw new Error('Empty asset');
    });
  }

  if (failures.length) {
    console.error('LIVE SMOKE FAILED:', failures.join('; '));
    process.exitCode = 1;
  } else {
    console.log('LIVE CLOUDFLARE SMOKE PASSED');
  }
}

main().catch((error) => {
  console.error('LIVE CLOUDFLARE SMOKE FATAL:', error.message);
  process.exitCode = 1;
});
