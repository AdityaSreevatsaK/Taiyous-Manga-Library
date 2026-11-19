/* Offline shell only. No private media, authentication or remote providers.
   The production build stamps this script with an asset fingerprint, so each
   changed app version triggers browser service-worker installation. */
const SHELL_PREFIX = 'taiyou-manga-shell-v1-';
const SCOPE_URL = self.registration.scope;
const SCOPE = new URL(SCOPE_URL);
const APP_URL = SCOPE.href;
const OFFLINE_DOCUMENT = new URL('__offline_shell__.html', APP_URL).href;
const SAFE_ASSET = /\.(?:js|css)$/i;

function scoped(url) {
  const target = new URL(url, SCOPE_URL);
  return target.origin === SCOPE.origin && target.pathname.startsWith(SCOPE.pathname) ? target.href : null;
}
async function shellCaches() {
  return (await caches.keys()).filter(name => name.startsWith(SHELL_PREFIX)).sort().reverse();
}
async function activeShell() {
  const names = await shellCaches();
  return names.length ? caches.open(names[0]) : null;
}
async function installShell() {
  const response = await fetch(APP_URL, { cache: 'reload' });
  if (!response.ok) throw new Error('Cannot precache the application entry');
  const html = await response.clone().text();
  // The Vite production document contains hashed module JS and CSS URLs.
  const files = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
    .map(match => scoped(match[1])).filter(Boolean);
  if (!files.length) throw new Error('No application assets found in the release document');
  const stamp = String(Date.now()).padStart(13,'0');
  const key = SHELL_PREFIX + stamp;
  const cache = await caches.open(key);
  try {
    await cache.put(APP_URL, response);
    // An incomplete update cannot claim the new cache as usable.
    await cache.addAll(files);
    // In Chromium's emulated cold-offline mode, cached HTML can load while
    // subresource requests still fail. Prepare a self-contained fall-back
    // using ONLY the two verified, first-party production assets.
    const source = new Map();
    for (const file of files) {
      const asset = await cache.match(file);
      if (!asset) throw new Error('Offline bundle asset missing');
      source.set(file, await asset.text());
    }
    let scripts = 0;
    let styles = 0;
    const offlineHtml = html
      .replace(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi, (tag, path) => {
        const js = source.get(scoped(path));
        if (!js) return tag;
        scripts++;
        // Guard the surrounding HTML parser; source is the trusted Vite build.
        return '<script type="module">' + js.replace(/<\/script/gi, '<\\/script') + '</script>';
      })
      .replace(/<link\b[^>]*\bhref=["']([^"']+\.css)["'][^>]*>/gi, (tag, path) => {
        const css = source.get(scoped(path));
        if (!css) return tag;
        styles++;
        return '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style>';
      });
    if (scripts < 1 || styles < 1) throw new Error('Could not prepare self-contained offline document');
    await cache.put(OFFLINE_DOCUMENT, new Response(offlineHtml, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
    await cache.put(new URL('__shell_ready__', APP_URL).href, new Response('ready'));
  } catch (error) {
    await caches.delete(key);
    throw error;
  }
  await self.skipWaiting();
}
self.addEventListener('install', event => { event.waitUntil(installShell()); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Preserve two verified application releases. Never touch downloaded chapters.
    const names = await shellCaches();
    const complete = [];
    for (const name of names) {
      const cache = await caches.open(name);
      if (await cache.match(new URL('__shell_ready__', APP_URL).href)) complete.push(name);
      else await caches.delete(name);
    }
    for (const name of complete.slice(2)) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== SCOPE.origin ||
    !url.pathname.startsWith(SCOPE.pathname)) return;
  if (url.pathname.endsWith('/sw.js') || url.pathname.includes('/__offline_manga__/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        if (network.ok) return network;
      } catch { /* Offline navigation falls back to last verified build. */ }
      const cache = await activeShell();
      const fallback = await cache?.match(OFFLINE_DOCUMENT) || await cache?.match(APP_URL);
      return fallback || new Response('Offline application shell unavailable', { status: 503 });
    })());
    return;
  }
  if (SAFE_ASSET.test(url.pathname)) {
    event.respondWith((async () => {
      for (const name of await shellCaches()) {
        const cached = await (await caches.open(name)).match(request);
        if (cached) return cached;
      }
      return fetch(request);
    })());
  }
});
