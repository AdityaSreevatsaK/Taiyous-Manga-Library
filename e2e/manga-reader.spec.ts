import { expect, test, type Page } from '@playwright/test';

async function openSampleReader(page: Page) {
  await page.goto('/');
  await page.locator('.book-card').filter({ hasText: 'The Lantern Archive' }).click();
  await expect(page.getByRole('heading', { name: 'The Lantern Archive' })).toBeVisible();
  await page.getByRole('link', { name: /Read from beginning/ }).click();
  await expect(page.locator('.reader-page')).toBeVisible();
  await expect(page.getByRole('button', { name: /Next page/ })).toBeEnabled();
  await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
}

test.describe('local manga catalogue and chapter reader', () => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280]) {
    test('responsive shelf and details at ' + width + 'px', async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'The sample collection' })).toBeVisible();
      await expect(page.locator('.book-card')).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.locator('.book-card').first().click();
      await expect(page.getByRole('heading', { name: 'Chapters & volumes' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole('link', { name: /Read from beginning/ }).click();
      // Alphabetical first series defaults to genuine vertical mode.
      await expect(page.locator('.reader-page,.vertical-page-image').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
  test('searches/filter/sorts the generated catalogue and honours the empty source', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: /Search series or aliases/ }).fill('keeper of the last light');
    await expect(page.locator('.book-card')).toHaveCount(1);
    await page.getByRole('searchbox', { name: /Search series or aliases/ }).fill('');
    await page.getByRole('combobox', { name: 'Publication' }).selectOption('completed');
    await expect(page.locator('.book-card')).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Publication' }).selectOption('all');
    await page.getByRole('combobox', { name: 'Collection' }).selectOption('Nightfall Stories');
    await expect(page.locator('.book-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'My library (empty)' }).click();
    await expect(page.getByText('Your collection is not connected yet')).toBeVisible();
    await expect(page.locator('.book-card')).toHaveCount(0);
  });
  test('RTL/LTR arrows and true continuous vertical scrolling with exact resume within the tab', async ({ page }) => {
    await openSampleReader(page);
    const reader = page.locator('.reader-shell');
    await reader.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.getByRole('button', { name: 'Left to right' }).click();
    await reader.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 5');
    await page.getByRole('button', { name: 'Vertical' }).click();
    await expect(page.locator('.vertical-page')).toHaveCount(5);
    await expect(page.locator('.vertical-page-image')).toHaveCount(3);
    // Page 4 is physically below page 3, not a stepper pretending to scroll.
    await page.locator('.vertical-page').nth(3).evaluate(element => element.scrollIntoView({ block: 'start' }));
    await expect(page.locator('.page-navigation')).toContainText('Page 4 of 5');
    await expect(page.locator('.vertical-page-image')).toHaveCount(3);
    await page.getByRole('link', { name: /Series details/ }).click();
    await page.getByRole('link', { name: /Continue reading/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 4 of 5');
  });

  test('vertical page selector jumps without changing the chapter order or decoding every page', async ({ page }) => {
    await openSampleReader(page);
    await page.getByRole('button', { name: 'Vertical' }).click();
    await page.getByRole('combobox', { name: 'Go to page' }).selectOption('4');
    await expect(page.locator('.page-navigation')).toContainText('Page 5 of 5');
    await expect(page.locator('.vertical-page-image')).toHaveCount(2);
    expect(await page.locator('.vertical-page').nth(4).evaluate(node => {
      const rect = node.getBoundingClientRect();
      return rect.top >= -30 && rect.top < window.innerHeight / 2;
    })).toBe(true);
    // No page has been silently removed or reordered.
    await expect(page.locator('.vertical-page')).toHaveCount(5);
  });

  test('focus view keeps exit and navigation reachable on narrow landscape screens', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 320 });
    await openSampleReader(page);
    await page.getByRole('button', { name: 'Focus view' }).click();
    await expect(page.getByRole('button', { name: 'Exit focus view' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Exit focus view' }).click();
    await expect(page.getByRole('button', { name: 'Focus view' })).toBeVisible();
  });

  test('vertical fixture generation failure is explicit and does not falsely record progress', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = function () { throw new Error('Synthetic canvas failure'); };
    });
    await page.goto('/');
    await page.locator('.book-card').filter({ hasText: 'The Lantern Archive' }).click();
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await page.getByRole('button', { name: 'Vertical' }).click();
    await expect(page.locator('.vertical-page-error').first()).toContainText('could not be loaded');
    await expect(page.getByRole('button', { name: /Next page/ })).toBeDisabled();
    await page.getByRole('link', { name: /Series details/ }).click();
    await expect(page.getByRole('link', { name: /Read from beginning/ })).toBeVisible();
  });

  test('chapter transitions never silently skip missing pages', async ({ page }) => {
    await openSampleReader(page);
    const next = page.getByRole('button', { name: /Next page/ });
    for (let index = 0; index < 5; index++) await next.click();
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 4');
    await expect(page.locator('.reader-heading')).toContainText('Above the rooftops');
    await page.getByRole('button', { name: /Previous page/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 5 of 5');
    await expect(page.locator('.reader-heading')).toContainText('The forgotten key');
  });
  test('page selector jumps to an exact zero-based location and resumes it', async ({ page }) => {
    await openSampleReader(page);
    await page.getByRole('combobox', { name: 'Go to page' }).selectOption('4');
    await expect(page.locator('.page-navigation')).toContainText('Page 5 of 5');
    await expect(page.locator('.reader-page')).toBeVisible();
    await expect(page.getByRole('button', { name: /Next page/ })).toBeEnabled();
    await page.getByRole('link', { name: /Series details/ }).click();
    await page.getByRole('link', { name: /Continue reading/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 5 of 5');
    await page.getByRole('combobox', { name: 'Choose chapter' }).selectOption('ch_lanternrooftop');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 4');
  });
  test('RTL swipe changes the canonical page, not reverse image ordering', async ({ page }) => {
    await openSampleReader(page);
    await page.locator('.reader-stage').evaluate(node => {
      const first = new Touch({ identifier: 1, target: node, clientX: 90, clientY: 330 });
      const last = new Touch({ identifier: 1, target: node, clientX: 220, clientY: 330 });
      node.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [first], changedTouches: [first] }));
      node.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [last] }));
    });
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
  });
  test('corrupt canvas images show a recoverable error and do not advance progress', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = function () { throw new Error('Synthetic canvas failure'); };
    });
    await page.goto('/');
    await page.locator('.book-card').filter({ hasText: 'The Lantern Archive' }).click();
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page.getByRole('alert')).toContainText('offline copy is unavailable or corrupt');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
    await expect(page.getByRole('button', { name: /Next page/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Previous page/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Retry page' }).click();
    await expect(page.getByRole('alert')).toContainText('offline copy is unavailable or corrupt');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
    await page.getByRole('link', { name: /Series details/ }).click();
    // A page that could not load must never be falsely recorded as read.
    await expect(page.getByRole('link', { name: /Read from beginning/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue reading/ })).toHaveCount(0);
  });
  test('synthetic sample remains readable offline without protected external requests', async ({ page, context }) => {
    const external: string[] = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
    });
    await openSampleReader(page);
    await context.setOffline(true);
    await page.getByRole('button', { name: /Next page/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await expect(page.locator('.reader-page')).toBeVisible();
    expect(external).toEqual([]);
  });
});

test.describe('browser history and deep links', () => {
  test('direct chapter URL restores exact page after refresh', async ({ page }) => {
    await page.goto('/manga/mng_lanternarchive/chapters/ch_lanternrooftop?page=3');
    await expect(page.locator('.reader-heading')).toContainText('The Lantern Archive');
    await expect(page.getByRole('combobox', { name: 'Choose chapter' })).toHaveValue('ch_lanternrooftop');
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 4');
    await expect(page.locator('.reader-page')).toBeVisible();
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 4');
  });

  test('native links preserve Back/Forward and page selection URLs', async ({ page }) => {
    await page.goto('/');
    await page.locator('.book-card').filter({ hasText: 'The Lantern Archive' }).click();
    await expect(page).toHaveURL(/\/manga\/mng_lanternarchive$/);
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page).toHaveURL(/\/chapters\/ch_lanternopening\?page=1$/);
    await page.getByRole('button', { name: /Next page/ }).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await page.goBack();
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Chapters & volumes' })).toBeVisible();
    await page.goForward();
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
  });

  test('an actual new tab can open a series independently', async ({ page, context }) => {
    await page.goto('/');
    const card = page.locator('.book-card').filter({ hasText: 'The Lantern Archive' });
    const href = await card.getAttribute('href');
    expect(href).toBe('/manga/mng_lanternarchive');
    const newTab = await context.newPage();
    await newTab.goto(href!);
    await expect(newTab.getByRole('heading', { name: 'The Lantern Archive' })).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('invalid series, chapter and page deep links recover to Library', async ({ page }) => {
    for (const path of ['/manga/does-not-exist', '/manga/mng_lanternarchive/chapters/unknown?page=1',
      '/manga/mng_lanternarchive/chapters/ch_lanternopening?page=99']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Page unavailable' })).toBeVisible();
      await page.getByRole('link', { name: 'Open the library' }).click();
      await expect(page).toHaveURL('/library');
      await expect(page.getByRole('heading', { name: 'The sample collection' })).toBeVisible();
    }
  });

  test('home and library have distinct navigation URLs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Every story/ })).toBeVisible();
    await page.locator('.book-card').first().click();
    await page.getByRole('link', { name: 'Back to the shelf' }).click();
    await expect(page).toHaveURL('/library');
    await expect(page.getByRole('heading', { name: /Every story/ })).toHaveCount(0);
    await page.getByRole('link', { name: 'Taiyou Manga home' }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('persistent browser reading state', () => {
  test('page identity and location survive reload and new tab on one browser', async ({ page, context }) => {
    await openSampleReader(page);
    await page.getByRole('button', { name: /Next page/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.getByRole('link', { name: /Series details/ }).click();
    await expect(page.getByRole('link', { name: /Continue reading/ })).toBeVisible();
    const tab = await context.newPage();
    await tab.goto('/manga/mng_lanternarchive');
    await tab.getByRole('link', { name: /Continue reading/ }).click();
    await expect(tab.locator('.page-navigation')).toContainText('Page 2 of 5');
  });

  test('reader settings survive reload without menu-open side effects', async ({ page }) => {
    await openSampleReader(page);
    await page.getByRole('combobox', { name: 'Reader theme' }).selectOption('sepia');
    await page.getByRole('combobox', { name: 'Image fit' }).selectOption('width');
    await page.getByRole('button', { name: 'Left to right' }).click();
    await expect(page.locator('.app-shell')).toHaveClass(/theme-sepia/);
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Reader theme' })).toHaveValue('sepia');
    await expect(page.getByRole('combobox', { name: 'Image fit' })).toHaveValue('width');
    await expect(page.getByRole('button', { name: 'Left to right' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('combobox', { name: 'Reader theme' }).focus();
    await expect(page.getByRole('combobox', { name: 'Reader theme' })).toHaveValue('sepia');
  });

  test('a corrupt record does not erase another manga history or itself', async ({ page }) => {
    await openSampleReader(page);
    await page.getByRole('button', { name: /Next page/ }).click();
    await page.goto('/manga/mng_silvergarden');
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page.locator('.reader-page')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('taiyou-manga:progress:v1:mng_lanternarchive', '{broken-json'));
    await page.reload();
    await expect(page.getByText(/saved reading records could not be verified/)).toBeVisible();
    await page.goto('/manga/mng_lanternarchive');
    await expect(page.getByRole('link', { name: /Read from beginning/ })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('taiyou-manga:progress:v1:mng_lanternarchive')))
      .toBe('{broken-json');
    await page.goto('/manga/mng_silvergarden');
    await expect(page.getByRole('link', { name: /Continue reading/ })).toBeVisible();
  });

  test('page progress remains available when device goes offline in an already loaded tab', async ({ page, context }) => {
    await openSampleReader(page);
    await context.setOffline(true);
    await page.getByRole('button', { name: /Next page/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    const raw = await page.evaluate(() => localStorage.getItem('taiyou-manga:progress:v1:mng_lanternarchive'));
    expect(raw).toContain('ch_lanternopening');
    expect(raw).toContain('"pageIndex":1');
    await context.setOffline(false);
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
  });

  test('vertical progress stores a stable page identity after scrolling', async ({ page }) => {
    await openSampleReader(page);
    await page.getByRole('button', { name: 'Vertical' }).click();
    await page.locator('.vertical-page').nth(3).evaluate(el => el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 4 of 5');
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('taiyou-manga:progress:v1:mng_lanternarchive');
      return raw && JSON.parse(raw).progress.pageIndex;
    })).toBe(3);
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 4 of 5');
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
  });
});

test.describe('explicit offline chapter storage and application shell', () => {
  test('downloads only the chosen synthetic chapter, serves verified offline blobs and removes it independently', async ({ page }) => {
    await page.goto('/manga/mng_lanternarchive');
    await expect(page.getByRole('button', { name: 'Download chapter' })).toHaveCount(3);
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Chapter saved locally and verified.')).toBeVisible();
    await expect(page.getByText('Available offline')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Offline (1)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download chapter' })).toHaveCount(2);
    await page.getByRole('link', { name: 'Offline (1)' }).click();
    await expect(page).toHaveURL('/offline');
    await expect(page.locator('.offline-series-link')).toHaveCount(1);
    await page.locator('.offline-series-link').first().click();
    await expect.poll(async () => page.locator('.reader-page').getAttribute('src')).toMatch(/^blob:/);
    await page.getByRole('button', { name: /Next page/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.getByRole('link', { name: /Series details/ }).click();
    await page.getByRole('button', { name: 'Remove offline copy' }).first().click();
    await expect(page.getByText(/Offline copy removed/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offline (0)' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue reading/ })).toBeVisible();
  });

  test('a corrupt cached chapter is flagged and cannot silently skip pages', async ({ page }) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Available offline')).toHaveCount(1);
    await page.evaluate(async () => {
      const cache = await caches.open('taiyou-manga-synthetic-chapters-v1');
      const keys = await cache.keys();
      if (!keys.length) throw new Error('Expected downloaded chapter pages');
      await cache.delete(keys[0]!);
    });
    await page.reload();
    await expect(page.getByText('Offline copy needs repair')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offline (0)' })).toBeVisible();
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page.getByRole('alert')).toContainText('offline copy');
    await expect(page.getByRole('button', { name: /Next page/ })).toBeDisabled();
    await page.getByRole('link', { name: /Series details/ }).click();
    await page.getByRole('button', { name: 'Remove offline copy' }).first().click();
    await expect(page.getByText(/Offline copy removed/)).toBeVisible();
  });

  test('cold offline start opens an explicitly downloaded chapter from production shell cache', async ({ page, context }) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Available offline')).toHaveCount(1);
    await expect.poll(async () => page.evaluate(async () =>
      (await caches.keys()).some(key => key.startsWith('taiyou-manga-shell-v1-')))).toBe(true);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // control the current client before the simulated cold restart
    await expect.poll(async () => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    const cacheInspection = await page.evaluate(async () => {
      const names = (await caches.keys()).filter(name => name.startsWith('taiyou-manga-shell-v1-')).sort().reverse();
      const store = await caches.open(names[0]!);
      const script = [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(el => el.src);
      const stylesheet = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(el => el.href);
      const files = [...script,...stylesheet];
      return { keys: (await store.keys()).map(key=>key.url), required:files,
        missing: (await Promise.all(files.map(async url => await store.match(url) ? null : url))).filter(Boolean) };
    });
    expect(cacheInspection.missing, JSON.stringify(cacheInspection)).toEqual([]);
    expect(cacheInspection.required.length).toBeGreaterThanOrEqual(2);
    await context.setOffline(true);
    await page.goto('/offline');
    const offlineControl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? 'not-controlled');
    expect(offlineControl).toContain('/sw.js');
    await expect(page.getByRole('heading', { name: 'Offline chapters' })).toBeVisible();
    await expect(page.locator('.offline-series-link')).toHaveCount(1);
    await page.locator('.offline-series-link').click();
    await expect.poll(async () => page.locator('.reader-page').getAttribute('src')).toMatch(/^blob:/);
    await page.getByRole('button', { name: /Next page/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await expect.poll(async () => page.locator('.reader-page').getAttribute('src')).toMatch(/^blob:/);
    await context.setOffline(false);
  });

  test('a vertical chapter uses downloaded images without loading every image', async ({ page }) => {
    await page.goto('/manga/mng_clockworkshore');
    await page.getByRole('button', { name: 'Download chapter' }).click();
    await expect(page.getByText('Available offline')).toBeVisible();
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page.locator('.vertical-page')).toHaveCount(5);
    await expect.poll(async () => page.locator('.vertical-page-image').first().getAttribute('src')).toMatch(/^blob:/);
    expect(await page.locator('.vertical-page-image').count()).toBeLessThanOrEqual(3);
  });

  test('nothing downloads automatically when opening a series', async ({ page }) => {
    await page.goto('/manga/mng_lanternarchive');
    await expect(page.getByRole('button', { name: 'Download chapter' })).toHaveCount(3);
    const downloads = await page.evaluate(async () => {
      const cache = await caches.open('taiyou-manga-synthetic-chapters-v1');
      return (await cache.keys()).length;
    });
    expect(downloads).toBe(0);
  });
});

test.describe('offline failure handling and accessibility hardening', () => {
  test('cancelled opt-in download cleans partial media without clearing progress', async ({ page }) => {
    await page.addInitScript(() => {
      const put = Cache.prototype.put;
      Cache.prototype.put = function(this: Cache, request: RequestInfo | URL, response: Response) {
        return new Promise<void>((resolve, reject) => {
          setTimeout(() => { put.call(this, request, response).then(resolve, reject); }, 350);
        });
      };
    });
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await page.getByRole('button', { name: /Next page/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.getByRole('link', { name: /Series details/ }).click();
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByRole('button', { name: 'Cancel download' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel download' }).click();
    await expect(page.getByText('Chapter download cancelled')).toBeVisible();
    const state = await page.evaluate(async () => {
      const cache = await caches.open('taiyou-manga-synthetic-chapters-v1');
      return {
        pages: (await cache.keys()).length,
        receipt: localStorage.getItem('taiyou-manga:offline-chapter:v1:ch_lanternopening'),
      };
    });
    expect(state.pages).toBe(0);
    expect(state.receipt).toBeNull();
    await expect(page.getByRole('button', { name: 'Download chapter' })).toHaveCount(3);
    await page.getByRole('link', { name: /Continue reading/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await expect(page.locator('.reader-page')).toBeVisible();
  });

  test('cache quota refusal is explicit and never marks the chapter as downloaded', async ({ page }) => {
    await page.addInitScript(() => {
      Cache.prototype.put = async () => { throw new DOMException('Synthetic quota exceeded', 'QuotaExceededError'); };
    });
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText(/Synthetic quota exceeded/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offline (0)' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('taiyou-manga:offline-chapter:v1:ch_lanternopening'))).toBeNull();
  });

  test('service worker update check preserves verified media and progress', async ({ page }) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Available offline')).toHaveCount(1);
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await page.getByRole('button', { name: /Next page/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await expect.poll(async () => page.locator('.reader-page').getAttribute('src')).toMatch(/^blob:/);
    await expect(page.getByRole('link', { name: 'Offline (1)' })).toBeVisible();
    const cache = await page.evaluate(() => caches.keys());
    expect(cache).toContain('taiyou-manga-synthetic-chapters-v1');
  });

  test('mobile navigation and download actions have safe 44px targets without overflow', async ({ page }) => {
    for (const width of [320, 375, 390, 430, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 760 });
      await page.goto('/manga/mng_lanternarchive');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const heights = await page.locator('.site-nav-link, .offline-chapter-control button')
        .evaluateAll(elements => elements.map(el => Math.round(el.getBoundingClientRect().height)));
      expect(heights.every(height => height >= 44), 'touch target width ' + width + ': ' + heights).toBe(true);
      // Repeating viewport checks should use either the fresh start or the stored resume link.
      await page.getByRole('link', { name: /Read from beginning|Continue reading/ }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const readerHeights = await page.locator('.reader-options button, .page-navigation button, .reader-selectors select')
        .evaluateAll(elements => elements.map(el => Math.round(el.getBoundingClientRect().height)));
      expect(readerHeights.every(height => height >= 44), 'reader touch targets ' + width + ': ' + readerHeights).toBe(true);
    }
  });

  test('offline inventory honours keyboard navigation and reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Available offline')).toHaveCount(1);
    await page.getByRole('link', { name: 'Offline (1)' }).focus();
    await expect(page.getByRole('link', { name: 'Offline (1)' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/offline');
    const link = page.locator('.offline-series-link');
    await expect(link).toHaveCount(1);
    expect(await link.evaluate(el => getComputedStyle(el).transitionDuration)).toMatch(/^0s/);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.reader-page')).toBeVisible();
  });
});
