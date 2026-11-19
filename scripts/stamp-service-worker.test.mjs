import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeReleaseFingerprint, STATIC_SHELL_ASSETS } from './stamp-service-worker.mjs';

const html = `<!doctype html><script type="module" src="/assets/app-123.js"></script><link rel="stylesheet" href="/assets/main-456.css">`;
const assets = new Map([
  ['assets/app-123.js', Buffer.from('console.log("first version")')],
  ['assets/main-456.css', Buffer.from('body{color:black}')],
  ...STATIC_SHELL_ASSETS.map(asset => [asset, Buffer.from('approved asset ' + asset)]),
]);
function fingerprint(markup = html, files = assets) {
  return computeReleaseFingerprint(markup, path => {
    const bytes = files.get(path);
    if (!bytes) throw new Error('Missing ' + path);
    return bytes;
  });
}

test('service worker fingerprint is stable for identical app builds', () => {
  assert.equal(fingerprint(), fingerprint());
  assert.match(fingerprint(), /^[a-f0-9]{24}$/);
});

test('changing a JavaScript or CSS bundle changes the SW release fingerprint', () => {
  const first = fingerprint();
  const changedJs = new Map(assets);
  changedJs.set('assets/app-123.js', Buffer.from('console.log("updated version")'));
  assert.notEqual(first, fingerprint(html, changedJs));
  const changedCss = new Map(assets);
  changedCss.set('assets/main-456.css', Buffer.from('body{color:white}'));
  assert.notEqual(first, fingerprint(html, changedCss));
});

test('changing HTML or referenced fingerprinted assets requires a new SW release', () => {
  assert.notEqual(fingerprint(), fingerprint(html.replace('<!doctype html>', '<!doctype html><!-- updated shell -->')));
  const changedAsset = html.replace('app-123.js', 'app-789.js');
  const updatedFiles = new Map(assets);
  updatedFiles.set('assets/app-789.js', updatedFiles.get('assets/app-123.js'));
  assert.notEqual(fingerprint(), fingerprint(changedAsset, updatedFiles));
});

test('rejects missing assets, external URLs and builds without both JS and CSS', () => {
  assert.throws(() => fingerprint(html, new Map()), /Missing/);
  assert.throws(() => fingerprint('<script src="https://evil.example/app.js"></script><link href="/assets/main-456.css">'),
    /local JavaScript and CSS/);
  assert.throws(() => fingerprint('<script src="/assets/app-123.js"></script>'), /local JavaScript and CSS/);
});

test('changed approved branding bytes require a new offline release', () => {
  const first=fingerprint();
  const updated=new Map(assets);
  updated.set('branding/sun-light.webp',Buffer.from('updated blue-gold mark'));
  assert.notEqual(first,fingerprint(html,updated));
  const missing=new Map(assets);
  missing.delete('manifest.webmanifest');
  assert.throws(()=>fingerprint(html,missing),/Missing manifest.webmanifest/);
});
