import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function assertNoHorizontalOverflow(page: Page) {
  const snapshot = await page.evaluate(() => {
    const width = window.innerWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>('*')]
      .filter(element => element.getBoundingClientRect().right > width + 1 ||
        element.scrollWidth > element.clientWidth + 1)
      .slice(0, 30)
      .map(element => ({
        element: element.tagName.toLowerCase(),
        className: String(element.className).slice(0, 80),
        right: Math.round(element.getBoundingClientRect().right),
        ownWidth: Math.round(element.getBoundingClientRect().width),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        outline: getComputedStyle(element).outlineWidth,
      }));
    return { width, scrollWidth: document.documentElement.scrollWidth, offenders };
  });
  expect(snapshot.scrollWidth, JSON.stringify(snapshot)).toBeLessThanOrEqual(snapshot.width);
}

async function openSampleReader(page: Page) {
  await page.goto('/');
  await page.locator('.book-card').filter({ hasText: 'The Lantern Archive' }).click();
  await expect(page.getByRole('heading', { name: 'The Lantern Archive' })).toBeVisible();
  await page.getByRole('link', { name: /Read from beginning/ }).click();
  await expect(page.locator('.vertical-page-image').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Next chapter/ })).toBeEnabled();
  await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
}

test.describe('local manga catalogue and chapter reader', () => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280]) {
    test('responsive shelf and details at ' + width + 'px', async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'The sample collection' })).toBeVisible();
      await expect(page.locator('.book-card')).toHaveCount(4);
      await assertNoHorizontalOverflow(page);
      await page.locator('.book-card').first().click();
      await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await page.getByRole('link', { name: /Read from beginning/ }).click();
      // Alphabetical first series defaults to genuine vertical mode.
      await expect(page.locator('.vertical-page-image').first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }
  test('searches/filter/sorts the generated catalogue and honours the empty source', async ({ page }) => {
    await page.goto('/library');
    await page.getByRole('searchbox', { name: /Search series or aliases/ }).fill('keeper of the last light');
    await expect(page.locator('.book-card')).toHaveCount(1);
    await page.getByRole('searchbox', { name: /Search series or aliases/ }).fill('');
    await page.getByRole('combobox', { name: 'Publication' }).selectOption('completed');
    await expect(page.locator('.book-card')).toHaveCount(2);
    await page.getByRole('combobox', { name: 'Publication' }).selectOption('all');
    await page.getByRole('combobox', { name: 'Collection' }).selectOption('Nightfall Stories');
    await expect(page.locator('.book-card')).toHaveCount(2);
    await page.locator('.manga-cloud-menu > summary').click();
    await page.getByRole('button', { name: 'My library (0)' }).click();
    await expect(page.getByText('Your collection is not connected yet')).toBeVisible();
    await expect(page.locator('.book-card')).toHaveCount(0);
  });
  test('scrolls an entire chapter without clicking page controls and resumes the exact position', async ({ page }) => {
    await openSampleReader(page);
    await expect(page.locator('.vertical-page')).toHaveCount(5);
    await expect(page.getByRole('button', { name: /Next page/ })).toHaveCount(0);
    await page.locator('.vertical-page').nth(3).evaluate(el => el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 4 of 5');
    await expect(page.locator('.vertical-page-image')).toHaveCount(3);
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('taiyou-manga:progress:v1:mng_lanternarchive');
      return raw ? JSON.parse(raw).progress.pageIndex : null;
    })).toBe(3);
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('link', { name: /Continue reading/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 4 of 5');
  });

  test('vertical page selector jumps without changing the chapter order or decoding every page', async ({ page }) => {
    await openSampleReader(page);
    await page.getByRole('combobox', { name: 'Jump within chapter' }).selectOption('4');
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
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Exit focus view' }).click();
    await expect(page.getByRole('button', { name: 'Focus view' })).toBeVisible();
  });

  test('vertical image failures never silently mark failed pages as read', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = function () { throw new Error('Synthetic canvas failure'); };
    });
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page.locator('.vertical-page-error').first()).toContainText('could not be loaded');
    expect(await page.evaluate(() => localStorage.getItem('taiyou-manga:progress:v1:mng_lanternarchive'))).toBeNull();
  });

  test('Next and Previous change chapter, never page, including from middle of chapter', async ({ page }) => {
    await openSampleReader(page);
    await page.locator('.vertical-page').nth(2).evaluate(el => el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 5');
    await page.getByRole('button', { name: /Next chapter/ }).click();
    await expect(page.locator('.reader-heading')).toContainText('Above the rooftops');
    await expect(page.locator('.vertical-page')).toHaveCount(4);
    await expect(page.locator('.page-navigation')).toContainText('Chapter 2 of 3');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 4');
    await page.getByRole('button', { name: /Previous chapter/ }).click();
    await expect(page.locator('.reader-heading')).toContainText('The forgotten key');
    await expect(page.locator('.page-navigation')).toContainText('Chapter 1 of 3');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
  });

  test('page selector jumps to an exact zero-based location and resumes it', async ({ page }) => {
    await openSampleReader(page);
    await page.getByRole('combobox', { name: 'Jump within chapter' }).selectOption('4');
    await expect(page.locator('.page-navigation')).toContainText('Page 5 of 5');
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Next chapter/ })).toBeEnabled();
    await page.getByRole('link', { name: /Series details/ }).click();
    await page.getByRole('link', { name: /Continue reading/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 5 of 5');
    await page.getByRole('button',{name:'Choose chapter'}).click();
    await page.locator('.manga-picker-result').filter({hasText:'Above the rooftops'}).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 4');
  });
  test('vertical scrolling does not change chapters or require tapping each page', async ({ page }) => {
    await openSampleReader(page);
    await page.locator('.vertical-page').nth(1).evaluate(el => el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await expect(page.locator('.reader-heading')).toContainText('The forgotten key');
    await expect(page.locator('.vertical-page')).toHaveCount(5);
  });

  test('corrupt synthetic illustrations show retry controls and do not record unread pages', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = function () { throw new Error('Synthetic canvas failure'); };
    });
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page.locator('.vertical-page-error').first()).toContainText('could not be loaded');
    await page.getByRole('button', { name: 'Retry page' }).first().click();
    await expect(page.locator('.vertical-page-error').first()).toContainText('could not be loaded');
    await page.goto('/manga/mng_lanternarchive');
    await expect(page.getByRole('link', { name: /Read from beginning/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue reading/ })).toHaveCount(0);
  });

  test('synthetic chapters remain navigable in a loaded offline tab without remote media calls', async ({ page, context }) => {
    const external: string[] = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
    });
    await openSampleReader(page);
    await context.setOffline(true);
    await page.getByRole('button', { name: /Next chapter/ }).click();
    await expect(page.locator('.reader-heading')).toContainText('Above the rooftops');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 4');
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    expect(external).toEqual([]);
  });

});

test.describe('five-chapter continuous scroll trial', () => {
  test('the whole chapter is scrollable, and Next moves through all five chapters', async ({ page }) => {
    await page.goto('/manga/mng_fivechaptertrial');
    await expect(page.getByRole('heading', { name: 'Five Chapter Scroll Trial' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download chapter' })).toHaveCount(5);
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    const ids = ['ch_trialawakening', 'ch_trialcrossroad', 'ch_trialskybridge', 'ch_trialstarlight', 'ch_trialnewdawn'];
    const pages = [7,6,9,8,6];
    for (let i = 0; i < ids.length; i++) {
      expect(new URL(page.url()).pathname).toContain('/chapters/' + ids[i]);
      expect(new URL(page.url()).searchParams.get('page')).toBe('1');
      await expect(page.locator('.vertical-page')).toHaveCount(pages[i]!);
      await expect(page.locator('.page-navigation')).toContainText('Chapter ' + (i+1) + ' of 5');
      if (i === 0) {
        await page.locator('.vertical-page').nth(4).evaluate(el => el.scrollIntoView({block:'start'}));
        await expect(page.locator('.page-navigation')).toContainText('Page 5 of 7');
      }
      if (i < ids.length - 1) await page.getByRole('button', { name: /Next chapter/ }).click();
    }
    await expect(page.getByRole('button', { name: /Next chapter/ })).toBeDisabled();
    await page.getByRole('button', { name: /Previous chapter/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Chapter 4 of 5');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 8');
  });

  test('loads only nearby images although every page occupies a place in the chapter', async ({ page }) => {
    await page.goto('/manga/mng_fivechaptertrial/chapters/ch_trialskybridge?page=1');
    await expect(page.locator('.vertical-page')).toHaveCount(9);
    expect(await page.locator('.vertical-page-image').count()).toBeLessThanOrEqual(3);
    await page.locator('.vertical-page').nth(7).evaluate(el => el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 8 of 9');
    await expect(page.locator('.vertical-page-image')).toHaveCount(3);
  });
});

test.describe('browser history and deep links', () => {
  test('direct chapter URL restores exact page after refresh', async ({ page }) => {
    await page.goto('/manga/mng_lanternarchive/chapters/ch_lanternrooftop?page=3');
    await expect(page.locator('.reader-heading')).toContainText('The Lantern Archive');
    await expect(page.getByRole('button', { name: 'Choose chapter' })).toContainText('Above the rooftops');
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 4');
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 4');
  });

  test('native links preserve Back/Forward and page selection URLs', async ({ page }) => {
    await page.goto('/');
    await page.locator('.book-card').filter({ hasText: 'The Lantern Archive' }).click();
    await expect(page).toHaveURL(/\/manga\/mng_lanternarchive$/);
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page).toHaveURL(/\/chapters\/ch_lanternopening\?page=1$/);
    await page.getByRole('button', { name: /Next chapter/ }).click();
    await expect(page).toHaveURL(/\/chapters\/ch_lanternrooftop\?page=1$/);
    await page.goBack();
    await expect(page.locator('.reader-heading')).toContainText('The forgotten key');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
    await page.goForward();
    await expect(page.locator('.reader-heading')).toContainText('The forgotten key');
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
      await expect(page.getByRole('heading', { name: 'All Manga' })).toBeVisible();
    }
  });

  test('home and library have distinct navigation URLs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /A place for every story/ })).toBeVisible();
    await page.locator('.book-card').first().click();
    await page.getByRole('link', { name: 'Back to the shelf' }).click();
    await expect(page).toHaveURL('/library');
    await expect(page.getByRole('heading', { name: /A place for every story/ })).toHaveCount(0);
    await page.getByRole('link', { name: 'Taiyou Manga home' }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('continue reading shelf', () => {
  test('does not show continue cards until an actual page is loaded', async ({page}) => {
    await page.goto('/');
    await expect(page.locator('.continue-card')).toHaveCount(0);
    await page.locator('.book-card').filter({hasText:'The Lantern Archive'}).click();
    await page.getByRole('link',{name:/Read from beginning/}).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.locator('.vertical-page').nth(2).evaluate(el=>el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 5');
    await page.getByRole('link',{name:'Taiyou Manga home'}).click();
    const card=page.locator('.continue-card').filter({hasText:'The Lantern Archive'});
    await expect(card).toContainText('Chapter 1 of 3 · Page 3 of 5');
    await expect(page.locator('.book-card').filter({hasText:'The Lantern Archive'}))
      .toContainText('In progress · Chapter 1 of 3');
    await card.click();
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 5');
    await page.reload();
    await page.getByRole('link',{name:'Taiyou Manga home'}).click();
    await expect(page.locator('.continue-card')).toHaveCount(1);
  });

  test('recent entries sort by latest saved progress without affecting the empty private catalogue', async ({page}) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('link',{name:/Read from beginning/}).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.goto('/manga/mng_fivechaptertrial');
    await page.getByRole('link',{name:/Read from beginning/}).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.getByRole('link',{name:'Taiyou Manga home'}).click();
    await expect(page.locator('.continue-card')).toHaveCount(2);
    await expect(page.locator('.continue-card').first()).toContainText('Five Chapter Scroll Trial');
    await page.locator('.manga-cloud-menu > summary').click();
    await page.getByRole('button',{name:'My library (0)'}).click();
    await expect(page.locator('.continue-card')).toHaveCount(0);
  });
});

test.describe('persistent browser reading state', () => {
  test('page identity and location survive reload and new tab on one browser', async ({ page, context }) => {
    await openSampleReader(page);
    await page.locator('.vertical-page').nth(1).evaluate(el => el.scrollIntoView({block:'start'}));
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
    await expect(page.locator('.app-shell')).toHaveClass(/theme-sepia/);
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Reader theme' })).toHaveValue('sepia');
    await expect(page.getByRole('combobox', { name: 'Image fit' })).toHaveValue('width');
    await expect(page.getByText(/Continuous chapter scroll/)).toBeVisible();
    await page.getByRole('combobox', { name: 'Reader theme' }).focus();
    await expect(page.getByRole('combobox', { name: 'Reader theme' })).toHaveValue('sepia');
  });

  test('a corrupt record does not erase another manga history or itself', async ({ page }) => {
    await openSampleReader(page);
    await page.getByRole('button', { name: /Next chapter/ }).click();
    await page.goto('/manga/mng_silvergarden');
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
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
    await page.locator('.vertical-page').nth(1).evaluate(el => el.scrollIntoView({block:'start'}));
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

test.describe('manual local reading backup and restore', () => {
  test('downloads and restores a versioned progress file without media or accidental overwrite', async ({page}) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('link', {name:/Read from beginning/}).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.locator('.vertical-page').nth(2).evaluate(el=>el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 5');
    await page.goto('/library');
    await page.locator('.manga-cloud-menu > summary').click();
    await page.getByText('Transfer reading progress between devices').click();
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download personal backup'}).click();
    const download=await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^taiyou-manga-personal-\d{4}-\d{2}-\d{2}\.json$/);
    const file=await download.path();
    expect(file).toBeTruthy();
    const bytes=await readFile(file!);
    const backup=JSON.parse(bytes.toString('utf-8'));
    expect(backup.schemaVersion).toBe(2);
    expect(backup.kind).toBe('taiyou-manga-local-personal-backup');
    expect(backup.reader.progress).toHaveLength(1);
    expect(backup.reader.progress[0].pageIndex).toBe(2);
    expect(JSON.stringify(backup)).not.toContain('assetPath');
    await page.evaluate(()=>localStorage.removeItem('taiyou-manga:progress:v1:mng_lanternarchive'));
    await page.reload();
    await page.locator('.manga-cloud-menu > summary').click();
    await page.getByText('Transfer reading progress between devices').click();
    await page.locator('.backup-panel input[type=file]').setInputFiles({
      name: download.suggestedFilename(), mimeType:'application/json', buffer:bytes,
    });
    await expect(page.locator('.backup-preview')).toContainText('1 potentially restorable');
    await expect(page.getByRole('button',{name:'Confirm restore'})).toBeEnabled();
    await page.getByRole('button',{name:'Confirm restore'}).click();
    await expect(page.locator('.backup-message')).toContainText('1 newer progress records imported');
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('link',{name:/Continue reading/}).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 5');
  });

  test('refuses invalid files and requires explicit confirmation for valid imports', async ({page}) => {
    await page.goto('/library');
    await page.locator('.manga-cloud-menu > summary').click();
    await page.getByText('Transfer reading progress between devices').click();
    const input=page.locator('.backup-panel input[type=file]');
    await input.setInputFiles({name:'untrusted.json',mimeType:'application/json',
      buffer:Buffer.from('{"kind":"wrong","progress":[]}')});
    await expect(page.locator('.backup-message')).toContainText('not a supported');
    await expect(page.locator('.backup-preview')).toHaveCount(0);
    const document={
      schemaVersion:1,mediaKind:'manga',kind:'taiyou-manga-local-reader-backup',
      exportedAt:'2026-11-19T00:00:00.000Z',progress:[],preferences:{direction:'vertical',fit:'width',theme:'sepia'},
    };
    await input.setInputFiles({name:'settings.json',mimeType:'application/json',
      buffer:Buffer.from(JSON.stringify(document))});
    await expect(page.getByRole('button',{name:'Confirm restore'})).toBeDisabled();
    await page.getByRole('checkbox',{name:/Also replace this device/}).check();
    await expect(page.getByRole('button',{name:'Confirm restore'})).toBeEnabled();
    await page.getByRole('button',{name:'Cancel'}).click();
    await expect(page.locator('.backup-preview')).toHaveCount(0);
    await expect(page.locator('.app-shell')).toHaveClass(/theme-sepia/);
  });
});

test.describe('explicit offline chapter storage and application shell', () => {
  test('production service worker has a unique application build fingerprint', async ({page}) => {
    await page.goto('/');
    const script = await page.request.get('/sw.js');
    expect(script.ok()).toBe(true);
    expect(await script.text()).toMatch(/Taiyou offline shell release: [a-f0-9]{24}/);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    const registration = await page.evaluate(async () => {
      const active = await navigator.serviceWorker.getRegistration('/');
      return { url: active?.active?.scriptURL, updateViaCache: active?.updateViaCache };
    });
    expect(registration.url).toContain('/sw.js');
    expect(registration.updateViaCache).toBe('none');
  });

  test('downloads only the chosen synthetic chapter, serves verified offline blobs and removes it independently', async ({ page }) => {
    await page.goto('/manga/mng_lanternarchive');
    await expect(page.getByRole('button', { name: 'Download chapter' })).toHaveCount(3);
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Chapter saved locally and verified.')).toBeVisible();
    await expect(page.getByText('Available offline',{exact:true})).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Available Offline (1)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download chapter' })).toHaveCount(2);
    await page.getByRole('link', { name: 'Available Offline (1)' }).click();
    await expect(page).toHaveURL('/offline');
    await expect(page.locator('.offline-series-link')).toHaveCount(1);
    await page.locator('.offline-series-link').first().click();
    await expect.poll(async () => page.locator('.vertical-page-image').first().getAttribute('src')).toMatch(/^blob:/);
    await page.locator('.vertical-page').nth(1).evaluate(el => el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.getByRole('link', { name: /Series details/ }).click();
    await page.getByRole('button', { name: 'Remove offline copy' }).first().click();
    await expect(page.getByText(/Offline copy removed/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Available Offline (0)' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue reading/ })).toBeVisible();
  });

  test('a corrupt cached chapter is flagged and cannot silently skip pages', async ({ page }) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Available offline',{exact:true})).toHaveCount(1);
    await page.evaluate(async () => {
      const cache = await caches.open('taiyou-manga-synthetic-chapters-v1');
      const keys = await cache.keys();
      if (!keys.length) throw new Error('Expected downloaded chapter pages');
      await cache.delete(keys[0]!);
    });
    await page.reload();
    await expect(page.getByText('Offline copy needs repair')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Available Offline (0)' })).toBeVisible();
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page.locator('.vertical-page-error').first()).toContainText('could not be loaded');
    await expect(page.getByRole('link', { name: /Continue reading/ })).toHaveCount(0);
    await page.getByRole('link', { name: /Series details/ }).click();
    await page.getByRole('button', { name: 'Remove offline copy' }).first().click();
    await expect(page.getByText(/Offline copy removed/)).toBeVisible();
  });

  test('cold offline start opens an explicitly downloaded chapter from production shell cache', async ({ page, context }) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Available offline',{exact:true})).toHaveCount(1);
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
    await expect(page.locator('.offline-series-link')).toHaveCount(1,{timeout:15000});
    await page.locator('.offline-series-link').click();
    await expect.poll(async () => page.locator('.vertical-page-image').first().getAttribute('src')).toMatch(/^blob:/);
    await page.locator('.vertical-page').nth(1).evaluate(el => el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await expect.poll(async () => page.locator('.vertical-page-image').first().getAttribute('src')).toMatch(/^blob:/);
    await context.setOffline(false);
  });

  test('a vertical chapter uses downloaded images without loading every image', async ({ page }) => {
    await page.goto('/manga/mng_clockworkshore');
    await page.getByRole('button', { name: 'Download chapter' }).click();
    await expect(page.getByText('Available offline',{exact:true})).toBeVisible();
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
    await page.locator('.vertical-page').nth(1).evaluate(el => el.scrollIntoView({block:'start'}));
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
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
  });

  test('cache quota refusal is explicit and never marks the chapter as downloaded', async ({ page }) => {
    await page.addInitScript(() => {
      Cache.prototype.put = async () => { throw new DOMException('Synthetic quota exceeded', 'QuotaExceededError'); };
    });
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText(/Synthetic quota exceeded/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Available Offline (0)' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('taiyou-manga:offline-chapter:v1:ch_lanternopening'))).toBeNull();
  });

  test('service worker update check preserves verified media and progress', async ({ page }) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Available offline',{exact:true})).toHaveCount(1);
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await page.locator('.vertical-page').nth(1).evaluate(el => el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 2 of 5');
    await expect.poll(async () => page.locator('.vertical-page-image').first().getAttribute('src')).toMatch(/^blob:/);
    await expect(page.getByRole('link', { name: 'Available Offline (1)' })).toBeVisible();
    const cache = await page.evaluate(() => caches.keys());
    expect(cache).toContain('taiyou-manga-synthetic-chapters-v1');
  });

  test('mobile navigation and download actions have safe 44px targets without overflow', async ({ page }) => {
    for (const width of [320, 375, 390, 430, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 760 });
      await page.goto('/manga/mng_lanternarchive');
      await assertNoHorizontalOverflow(page);
      const heights = await page.locator('.manga-nav-links > .site-nav-link, .offline-chapter-control button')
        .evaluateAll(elements => elements.map(el => Math.round(el.getBoundingClientRect().height)));
      expect(heights.every(height => height >= 44), 'touch target width ' + width + ': ' + heights).toBe(true);
      // Repeating viewport checks should use either the fresh start or the stored resume link.
      await page.getByRole('link', { name: /Read from beginning|Continue reading/ }).click();
      await assertNoHorizontalOverflow(page);
      const readerHeights = await page.locator('.reader-options button, .page-navigation button, .reader-selectors select')
        .evaluateAll(elements => elements.map(el => Math.round(el.getBoundingClientRect().height)));
      expect(readerHeights.every(height => height >= 44), 'reader touch targets ' + width + ': ' + readerHeights).toBe(true);
    }
  });

  test('offline inventory honours keyboard navigation and reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button', { name: 'Download chapter' }).first().click();
    await expect(page.getByText('Available offline',{exact:true})).toHaveCount(1);
    await page.getByRole('link', { name: 'Available Offline (1)' }).focus();
    await expect(page.getByRole('link', { name: 'Available Offline (1)' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/offline');
    const link = page.locator('.offline-series-link');
    await expect(link).toHaveCount(1);
    expect(await link.evaluate(el => getComputedStyle(el).transitionDuration)).toMatch(/^0s/);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
  });
});

test.describe('approved library navigation and personal presentation', () => {
  test('defaults to Sepia and supports six persisted themes and matching branding', async ({page}) => {
    await page.goto('/');
    const theme=(name:string)=>page.getByRole('button',{name:'Use '+name+' theme'});
    await expect(theme('Sepia')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.wordmark .brand-sun')).toHaveAttribute('src',/sun-light.webp/);
    for (const theme of ['paper','charcoal','midnight','ocean','plum','sepia']) {
      await page.getByRole('button',{name:'Use '+theme.charAt(0).toUpperCase()+theme.slice(1)+' theme'}).click();
      await expect(page.locator('.app-shell')).toHaveClass(new RegExp('theme-'+theme));
    }
    await theme('Charcoal').click();
    await expect(page.locator('.wordmark .brand-sun')).toHaveAttribute('src',/sun-dark.webp/);
    await expect(page.locator('#taiyou-favicon')).toHaveAttribute('href',/favicon-dark.png/);
    await page.reload();
    await expect(theme('Charcoal')).toHaveAttribute('aria-pressed','true');
    const manifest=await page.request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBe(true);
    expect((await manifest.json()).icons).toHaveLength(2);
  });

  test('eight sections on desktop and accessible compact More navigation on mobile', async ({page}) => {
    await page.setViewportSize({width:1280,height:900});
    await page.goto('/');
    await expect(page.locator('.manga-nav-links > .site-nav-link')).toHaveCount(8);
    await page.getByRole('link',{name:'Currently Reading (0)'}).click();
    await expect(page).toHaveURL('/reading');
    await expect(page.locator('.site-nav-link[aria-current="page"]')).toHaveCount(1);
    await page.setViewportSize({width:320,height:800});
    await expect(page.locator('.manga-nav-links > .site-nav-link')).toHaveCount(3);
    await expect(page.getByText('More',{exact:true})).toBeVisible();
    await page.locator('.nav-more summary').click();
    await page.getByRole('link',{name:'Analytics'}).click();
    await expect(page).toHaveURL('/analytics');
    await expect(page.getByRole('heading',{name:'Analytics'})).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('personal shelves persist locally and publication ribbons remain separate', async ({page}) => {
    await page.goto('/manga/mng_lanternarchive');
    const selector=page.getByRole('combobox',{name:'Personal reading shelf'});
    await selector.selectOption('trying');
    await expect(page.getByRole('status')).toContainText('Trying Out');
    await page.goto('/trying');
    await expect(page.locator('.book-card')).toHaveCount(1);
    await expect(page.locator('.book-card .status-ribbon').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.book-card')).toHaveCount(1);
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('combobox',{name:'Personal reading shelf'}).selectOption('finished');
    await page.goto('/finished');
    await expect(page.locator('.book-card')).toHaveCount(1);
    await page.goto('/trying');
    await expect(page.locator('.book-card')).toHaveCount(0);
  });

  test('chapter footer selects whole chapters rather than advancing pages', async ({page}) => {
    await openSampleReader(page);
    await page.getByRole('button',{name:'Jump to chapter'}).click();
    await expect(page.getByRole('dialog',{name:'Choose chapter'})).toBeVisible();
    await page.locator('.manga-picker-result').nth(1).click();
    await expect(page.locator('.page-navigation')).toContainText('Chapter 2 of');
    await expect(page.locator('.vertical-page')).toHaveCount(4);
    await expect(page.getByRole('button',{name:/Next page/})).toHaveCount(0);
  });
});

test('approved brand assets survive an offline cold launch', async ({page,context}) => {
  await page.goto('/');
  await page.evaluate(async () => {await navigator.serviceWorker.ready;});
  await page.waitForFunction(async () => {
    const names=await caches.keys();
    for (const name of names.filter(name=>name.startsWith('taiyou-manga-shell-v1-'))) {
      const cache=await caches.open(name);
      if (await cache.match('/branding/sun-light.webp')) return true;
    }
    return false;
  });
  await context.setOffline(true);
  await page.goto('/');
  await expect(page.getByRole('link',{name:'Taiyou Manga home'})).toBeVisible();
  await expect.poll(async () => page.locator('.wordmark .brand-sun').evaluate(
    (img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await context.setOffline(false);
});

test.describe('personal annotations never leave the browser',()=>{
  test('rating intensity, notes and personal tags survive reload and provide filtering',async({page})=>{
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button',{name:'Rate 1 out of 10'}).click();
    await page.mouse.move(0,0);
    const one=Number(await page.getByRole('button',{name:'Rate 1 out of 10'}).evaluate(
      element=>getComputedStyle(element).opacity));
    await page.getByRole('button',{name:'Rate 10 out of 10'}).click();
    await page.mouse.move(0,0);
    const ten=Number(await page.getByRole('button',{name:'Rate 10 out of 10'}).evaluate(
      element=>getComputedStyle(element).opacity));
    expect(ten).toBeGreaterThan(one);
    await expect(page.getByText('10 / 10')).toBeVisible();
    await page.getByRole('textbox',{name:'Personal notes'}).fill('A brilliant, quiet story');
    await page.getByRole('button',{name:'Save notes'}).click();
    await page.getByLabel('Add a personal tag').fill('  rOmAnCe  ');
    await page.getByRole('button',{name:'Add tag'}).click();
    await expect(page.getByRole('button',{name:'Remove tag Romance'})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox',{name:'Personal notes'})).toHaveValue('A brilliant, quiet story');
    await expect(page.getByText('10 / 10')).toBeVisible();
    await page.getByRole('button',{name:'Romance',exact:true}).click();
    await expect(page).toHaveURL(/\/library\?tag=Romance/);
    await expect(page.locator('.book-card')).toHaveCount(1);
    await expect(page.locator('.book-card')).toContainText('10/10 · Mine');
  });
  test('personal tag removal uses application confirmation, never a browser confirm',async({page})=>{
    await page.goto('/manga/mng_lanternarchive');
    await page.getByLabel('Add a personal tag').fill('Keep This');
    await page.getByRole('button',{name:'Add tag'}).click();
    await page.getByRole('button',{name:'Remove tag Keep This'}).click();
    await expect(page.getByRole('dialog',{name:'Remove personal tag?'})).toBeVisible();
    await page.getByRole('button',{name:'Cancel'}).click();
    await expect(page.getByRole('button',{name:'Remove tag Keep This'})).toBeVisible();
    await page.getByRole('button',{name:'Remove tag Keep This'}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Remove tag'}).click();
    await expect(page.getByRole('button',{name:'Remove tag Keep This'})).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button',{name:'Remove tag Keep This'})).toHaveCount(0);
  });
});

test.describe('compatible private manga library backups',()=>{
  test('exports and restores notes, ratings, tags and reading shelves with explicit consent',async({page})=>{
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('combobox',{name:'Personal reading shelf'}).selectOption('trying');
    await page.getByRole('button',{name:'Rate 9 out of 10'}).click();
    await page.getByRole('textbox',{name:'Personal notes'}).fill('My export test note');
    await page.getByRole('button',{name:'Save notes'}).click();
    await page.getByLabel('Add a personal tag').fill('Adventure Favourite');
    await page.getByRole('button',{name:'Add tag'}).click();
    await page.goto('/library');
    await page.locator('.manga-cloud-menu > summary').click();
    await page.getByText('Transfer reading progress between devices').click();
    const got=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download personal backup'}).click();
    const download=await got;
    const bytes=await readFile((await download.path())!);
    const document=JSON.parse(bytes.toString('utf8'));
    expect(document.schemaVersion).toBe(2);
    expect(document.annotations).toHaveLength(1);
    expect(document.shelves).toHaveLength(1);
    expect(document.annotations[0].notes).toBe('My export test note');
    await page.evaluate(()=>{
      for(const suffix of ['personal-shelf:v1:','personal-annotation:v1:'])
        localStorage.removeItem('taiyou-manga:'+suffix+'mng_lanternarchive');
    });
    await page.reload();
    await page.locator('.manga-cloud-menu > summary').click();
    await page.getByText('Transfer reading progress between devices').click();
    await page.locator('.backup-panel input[type=file]').setInputFiles({
      name:'private.json',mimeType:'application/json',buffer:bytes,
    });
    await expect(page.locator('.backup-preview')).toContainText('2 eligible to restore');
    await page.getByRole('checkbox',{name:/Also restore personal shelves/}).check();
    await page.getByRole('button',{name:'Confirm restore'}).click();
    await expect(page.locator('.backup-message')).toContainText('1 personal shelves and 1 annotations restored');
    await page.goto('/manga/mng_lanternarchive');
    await expect(page.getByRole('combobox',{name:'Personal reading shelf'})).toHaveValue('trying');
    await expect(page.getByRole('textbox',{name:'Personal notes'})).toHaveValue('My export test note');
    await expect(page.getByRole('button',{name:'Remove tag Adventure Favourite'})).toBeVisible();
    await expect(page.getByText('9 / 10')).toBeVisible();
  });
});

test.describe('nested personal manga collections',()=>{
  test('creates, nests, filters and adds a manga without changing publication status',async({page})=>{
    await page.goto('/library');
    await page.getByText('Manage my collections (0)').click();
    await page.getByRole('textbox',{name:'New collection name'}).fill('Favourites');
    await page.getByRole('button',{name:'Create collection'}).click();
    await expect(page.locator('.collections-manager')).toContainText('Favourites');
    await page.getByRole('textbox',{name:'New collection name'}).fill('Romance');
    await page.getByRole('combobox',{name:'Inside collection'}).selectOption({label:'Favourites'});
    await page.getByRole('button',{name:'Create collection'}).click();
    await expect(page.locator('.collections-manager')).toContainText('Favourites / Romance');
    await page.goto('/manga/mng_lanternarchive');
    const publicationBefore=await page.locator('.detail-sub').textContent();
    await page.getByRole('combobox',{name:'Add to collection'}).selectOption({label:'Favourites / Romance'});
    await expect(page.locator('.success-toast')).toContainText('Added manga to collection');
    await expect(page.locator('.collection-member')).toContainText('Favourites / Romance');
    await expect(page.locator('.detail-sub')).toHaveText(publicationBefore);
    await page.locator('.collection-member .tag').click();
    await expect(page).toHaveURL(/\/library\?collection=personal%3A/);
    await expect(page.locator('.book-card')).toHaveCount(1);
    await expect(page.locator('.book-card')).toContainText('The Lantern Archive');
    await page.reload();
    await expect(page.locator('.book-card')).toHaveCount(1);
  });
  test('requires confirmation before a collection tree is deleted and preserves manga',async({page})=>{
    await page.goto('/library');
    await page.getByText('Manage my collections (0)').click();
    await page.getByRole('textbox',{name:'New collection name'}).fill('Parent');
    await page.getByRole('button',{name:'Create collection'}).click();
    await page.getByRole('textbox',{name:'New collection name'}).fill('Child');
    await page.getByRole('combobox',{name:'Inside collection'}).selectOption({label:'Parent'});
    await page.getByRole('button',{name:'Create collection'}).click();
    await page.locator('.collection-list-item').filter({hasText:'Parent'}).first()
      .getByRole('button',{name:'Delete'}).click();
    await expect(page.getByRole('dialog',{name:'Delete this collection?'})).toContainText('1 nested collection(s)');
    await page.getByRole('dialog').getByRole('button',{name:'Cancel'}).click();
    await expect(page.locator('.collection-list-item')).toHaveCount(2);
    await page.locator('.collection-list-item').filter({hasText:'Parent'}).first()
      .getByRole('button',{name:'Delete'}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Delete collection'}).click();
    await expect(page.locator('.collection-list-item')).toHaveCount(0);
    await expect(page.locator('.book-card')).toHaveCount(4);
    await page.reload();
    await expect(page.getByText('Manage my collections (0)')).toBeVisible();
  });
  test('keeps collection, tag and theme menus functional at narrow widths',async({page})=>{
    for(const width of [320,375,390,768,1280]) {
      await page.setViewportSize({width,height:820});
      await page.goto('/library');
      await assertNoHorizontalOverflow(page);
      const collections=page.locator('.header-menu').filter({has:page.locator('summary:text-is("Collections")')});
      await collections.locator('summary').click();
      await expect(collections.getByRole('button',{name:'All collections'})).toBeVisible();
      await collections.locator('summary').click();
    }
  });
});

test('catalogue search and private collection filters remain bookmarkable on reload',async({page})=>{
  await page.goto('/library?tag=Adventure&q=lantern&sort=chapters');
  await expect(page.getByRole('combobox',{name:'Genre'})).toHaveValue('Adventure');
  await expect(page.getByRole('searchbox',{name:'Search series or aliases'})).toHaveValue('lantern');
  await expect(page.getByRole('combobox',{name:'Sort'})).toHaveValue('chapters');
  await expect(page.locator('.book-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.book-card')).toHaveCount(1);
  await page.getByRole('combobox',{name:'Genre'}).selectOption('');
  await expect(page).not.toHaveURL(/tag=Adventure/);
});

test('a full personal backup restores a nested collection tree with confirmation',async({page})=>{
  await page.goto('/library');
  await page.getByText('Manage my collections (0)').click();
  await page.getByRole('textbox',{name:'New collection name'}).fill('Parent');
  await page.getByRole('button',{name:'Create collection'}).click();
  await page.getByRole('textbox',{name:'New collection name'}).fill('Child');
  await page.getByRole('combobox',{name:'Inside collection'}).selectOption({label:'Parent'});
  await page.getByRole('button',{name:'Create collection'}).click();
  const save=page.waitForEvent('download');
  await page.locator('.manga-cloud-menu > summary').click();
  await page.getByText('Transfer reading progress between devices').click();
  await page.getByRole('button',{name:'Download personal backup'}).click();
  const zip=await save;
  const bytes=await readFile((await zip.path())!);
  const doc=JSON.parse(bytes.toString('utf8'));
  expect(doc.collections.items).toHaveLength(2);
  await page.evaluate(()=>localStorage.removeItem('taiyou-manga:personal-collections:v1'));
  await page.reload();
  await page.locator('.manga-cloud-menu > summary').click();
  await page.getByText('Transfer reading progress between devices').click();
  await page.locator('.backup-panel input[type=file]').setInputFiles({
    name:'collections.json',mimeType:'application/json',buffer:bytes,
  });
  await expect(page.locator('.backup-preview')).toContainText('2 new collections available to import');
  await page.getByRole('checkbox',{name:/Also restore personal shelves/}).check();
  await page.getByRole('button',{name:'Confirm restore'}).click();
  await expect(page.locator('.backup-message')).toContainText('2 collections imported');
  await expect(page.locator('.collections-manager')).toContainText('Parent / Child');
  await page.reload();
  await expect(page.getByText('Manage my collections (2)')).toBeVisible();
});

test.describe('advanced discovery and grounded personal analytics',()=>{
  test('creator and chapter range compose, remain bookmarkable and reset correctly',async({page})=>{
    await page.goto('/library?creator=Taiyou&minChapters=3&maxChapters=3&offline=not-downloaded');
    await expect(page.locator('.advanced-search')).toBeVisible();
    await expect(page.locator('.book-card')).toHaveCount(1);
    await expect(page.locator('.book-card')).toContainText('The Lantern Archive');
    await page.reload();
    await expect(page.getByRole('spinbutton',{name:'Minimum chapters'})).toHaveValue('3');
    await expect(page.getByRole('spinbutton',{name:'Maximum chapters'})).toHaveValue('3');
    await page.getByRole('button',{name:'Reset advanced filters'}).click();
    await expect(page.locator('.book-card')).toHaveCount(4);
    await expect(page).not.toHaveURL(/minChapters/);
  });
  test('personal ratings and shelves participate in advanced filters without changing published metadata',async({page})=>{
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button',{name:'Rate 10 out of 10'}).click();
    await page.getByRole('combobox',{name:'Personal reading shelf'}).selectOption('trying');
    await page.goto('/library?minRating=9&reading=trying');
    await expect(page.locator('.book-card')).toHaveCount(1);
    await expect(page.locator('.book-card')).toContainText('The Lantern Archive');
    await page.getByRole('combobox',{name:'My reading state'}).selectOption('finished');
    await expect(page.locator('.book-card')).toHaveCount(0);
    await expect(page).toHaveURL(/reading=finished/);
    await page.reload();
    await expect(page.locator('.book-card')).toHaveCount(0);
  });
  test('analytics reports exact saved positions and personal ratings, never fabricated durations',async({page})=>{
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button',{name:'Rate 8 out of 10'}).click();
    await page.getByRole('link',{name:/Read from beginning/}).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.goto('/analytics');
    await expect(page.getByRole('heading',{name:'Analytics'})).toBeVisible();
    await expect(page.locator('.analytics-grid')).toContainText('1');
    await expect(page.locator('.analytics-grid')).toContainText('8');
    await expect(page.locator('.analytics-recent')).toContainText('The Lantern Archive');
    await expect(page.locator('.analytics-ratings')).toContainText('My ratings distribution');
    await expect(page.locator('.analytics-shelf')).not.toContainText('minutes read');
  });
  test('advanced Search header stays usable on small mobile screens',async({page})=>{
    for(const width of [320,375,390,768]){
      await page.setViewportSize({width,height:812});
      await page.goto('/library');
      await page.getByRole('button',{name:'Advanced Search'}).click();
      await expect(page.locator('.advanced-search')).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  });
});

test('personal favourites are accessible, persisted and curated only on Home', async ({ page }) => {
  await page.goto('/manga/mng_lanternarchive');
  const add=page.getByRole('button',{name:/Add to favourites/});
  await expect(add).toHaveAttribute('aria-pressed','false');
  await add.click();
  await expect(page.getByRole('button',{name:/Remove from favourites/})).toHaveAttribute('aria-pressed','true');
  await page.goto('/');
  await expect(page.locator('.book-card').first()).toContainText('The Lantern Archive');
  await expect(page.locator('.book-card').first()).toContainText('Favourite');
  await page.reload();
  await expect(page.locator('.book-card').first()).toContainText('The Lantern Archive');
  await page.goto('/manga/mng_lanternarchive');
  await page.getByRole('button',{name:/Remove from favourites/}).click();
  await expect(page.getByRole('button',{name:/Add to favourites/})).toHaveAttribute('aria-pressed','false');
  await page.goto('/');
  await expect(page.locator('.book-favourite')).toHaveCount(0);
});

test('manual chapter completion persists and never alters chapter reading navigation', async ({ page }) => {
  await page.goto('/manga/mng_lanternarchive');
  await expect(page.getByText('0 of 3 chapters explicitly marked completed on this device.')).toBeVisible();
  const first=page.getByRole('button',{name:'Mark chapter 1 completed'});
  await expect(first).toHaveAttribute('aria-pressed','false');
  await first.click();
  await expect(page.getByRole('button',{name:'Mark chapter 1 incomplete'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('1 of 3 chapters explicitly marked completed on this device.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Mark chapter 1 incomplete'})).toBeVisible();
  await page.getByRole('button',{name:'Mark chapter 1 incomplete'}).click();
  await expect(page.getByText('0 of 3 chapters explicitly marked completed on this device.')).toBeVisible();
  await page.getByRole('link',{name:/Read from beginning/}).click();
  await expect(page.getByRole('button',{name:/Next chapter/})).toBeEnabled();
  await page.getByRole('link',{name:/Series details/}).click();
  await expect(page.getByText('0 of 3 chapters explicitly marked completed on this device.')).toBeVisible();
});

test('mock authenticated empty HF dataset replaces sample catalogue with a truthful private view', async ({page}) => {
  await page.route('**/api/auth/session', route => route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      connected:true,repo:'AdityaSreevatsaK/Taiyous-Manga',owner:'AdityaSreevatsaK',
    }),
  }));
  await page.route('**/api/library', route => route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      connected:true,repo:'AdityaSreevatsaK/Taiyous-Manga',empty:true,
      revision:'a'.repeat(40),entries:[],
    }),
  }));
  await page.route('**/api/auth/logout', route => route.fulfill({
    status:200,contentType:'application/json',body:'{"connected":false}',
  }));
  await page.goto('/');
  await expect(page.getByText('Your private shelves are ready.',{exact:false})).toBeVisible();
  await page.locator('.manga-cloud-menu > summary').click();
  await expect(page.getByRole('button',{name:'My library (0)'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Your private library is empty'})).toBeVisible();
  await expect(page.locator('.book-card')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Use Sepia theme'})).toBeVisible();
  await expect(page.locator('.manga-cloud-menu')).toHaveAttribute('open','');
  await page.getByRole('button',{name:'Sign out of Hugging Face'}).click();
  await expect(page.getByRole('button',{name:'My library (0)'})).toBeVisible();
  await expect(page.locator('.book-card')).toHaveCount(4);
  await expect(page.getByText('THE READING ROOM / DEMONSTRATION')).toBeVisible();
});

test('editorial cover grid stays readable, accessible and unbroken across device widths', async ({page}) => {
  for (const width of [320,390,740,1024,1500]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await expect(page.locator('.editorial-hero')).toBeVisible();
    await expect(page.locator('.editorial-overview')).toContainText('Series in the library');
    await expect(page.locator('.book-card')).toHaveCount(4);
    await assertNoHorizontalOverflow(page);
    const cover=await page.locator('.book-card .book-cover').first().boundingBox();
    expect(cover).toBeTruthy();
    expect(cover!.height/cover!.width).toBeGreaterThan(1.45);
    expect(cover!.height/cover!.width).toBeLessThan(1.6);
  }
  await expect(page.locator('.status-ribbon').filter({hasText:'Story Complete'})).toHaveCount(2);
  await expect(page.locator('.status-ribbon').filter({hasText:'Updating'})).toHaveCount(1);
  await expect(page.locator('.status-ribbon').filter({hasText:'On Hiatus'})).toHaveCount(1);
  await page.getByRole('link',{name:/The Lantern Archive/}).first().click();
  await expect(page.locator('.detail-synopsis')).toBeVisible();
  await expect(page.getByRole('link',{name:/Read from beginning/})).toBeVisible();
});
test('editorial theme tokens cover all six approved app palettes', async ({page}) => {
  await page.goto('/');
  for(const theme of ['sepia','paper','charcoal','midnight','ocean','plum']){
    await page.getByRole('button',{name:'Use '+theme.charAt(0).toUpperCase()+theme.slice(1)+' theme'}).click();
    await expect(page.locator('.app-shell')).toHaveClass(new RegExp('theme-'+theme));
    const tokens=await page.locator('.app-shell').evaluate(node=>{
      const style=getComputedStyle(node);
      return ['--editorial-ink','--editorial-surface','--editorial-line'].map(name=>style.getPropertyValue(name).trim());
    });
    expect(tokens.every(Boolean),theme+' editorial palette incomplete').toBe(true);
  }
});

test('novel-style masthead keeps logo, real cloud, search, themes and all manga sections reachable',async({page})=>{
  for(const width of [320,390,740,900,1280,1536]){
    await page.setViewportSize({width,height:820});
    await page.goto('/');
    await expect(page.locator('.manga-topbar')).toBeVisible();
    await expect(page.locator('.manga-nav-links')).toBeVisible();
    await expect(page.locator('.manga-nav-tools')).toBeVisible();
    await expect(page.locator('.wordmark .manga-wordmark-text')).toContainText("TAIYOU'S");
    await expect(page.locator('.manga-cloud-menu > summary')).toBeVisible();
    await expect(page.getByRole('searchbox',{name:'Search all manga'})).toBeVisible();
    await expect(page.locator('.manga-theme-swatch')).toHaveCount(6);
    await expect(page.locator('.mode-bar')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
  }
  await expect(page.locator('.editorial-hero')).toBeVisible();
  await expect(page.locator('.editorial-overview')).toBeVisible();
  const background=await page.locator('.editorial-hero').evaluate(node=>getComputedStyle(node).backgroundImage);
  expect(background).toContain('linear-gradient');
  await page.getByRole('button',{name:'Use Paper theme'}).click();
  await expect(page.locator('.app-shell')).toHaveClass(/theme-paper/);
  await page.getByRole('searchbox',{name:'Search all manga'}).fill('Lantern');
  await expect(page).toHaveURL(/\/library\?q=Lantern$/);
  await expect(page.locator('.book-card')).toHaveCount(1);
  await expect(page.getByRole('searchbox',{name:'Search series or aliases'})).toHaveValue('Lantern');
});
test('cloud icon consolidates sample, private connection and versioned backup tools',async({page})=>{
  await page.setViewportSize({width:320,height:820});
  await page.goto('/');
  await page.locator('.manga-cloud-menu > summary').click();
  const panel=page.locator('.manga-cloud-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button',{name:'Try the sample reader'})).toHaveAttribute('aria-pressed','true');
  await expect(panel.getByRole('button',{name:'My library (0)'})).toHaveAttribute('aria-pressed','false');
  await expect(panel.getByText('Transfer reading progress between devices')).toBeVisible();
  const rect=await panel.boundingBox();
  expect(rect).toBeTruthy();
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.x+rect!.width).toBeLessThanOrEqual(321);
  await panel.getByRole('button',{name:'My library (0)'}).click();
  await expect(page.locator('.book-card')).toHaveCount(0);
  await page.locator('.manga-cloud-menu > summary').click();
  await page.locator('.manga-cloud-menu > summary').click();
  await panel.getByRole('button',{name:'Try the sample reader'}).click();
  await expect(page.locator('.book-card')).toHaveCount(4);
  await assertNoHorizontalOverflow(page);
});

test('Novel Library brand assets and chrome render without the invented logo tile',async({page})=>{
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:820});
    await page.goto('/');
    const mark=page.locator('.manga-logo-frame');
    await expect(mark).toBeVisible();
    await expect(mark.locator('img')).toHaveAttribute('src',/branding\/sun-light\.webp$/);
    const style=await mark.evaluate(node=>({
      border:getComputedStyle(node).borderTopWidth,
      background:getComputedStyle(node).backgroundColor,
      image:getComputedStyle(node.querySelector('img')!).objectFit,
    }));
    expect(style.border,'framed logo should be removed').toBe('0px');
    expect(style.background,'logo must float freely').toBe('rgba(0, 0, 0, 0)');
    expect(style.image).toBe('contain');
    const cloud=page.locator('.manga-cloud-icon');
    const svg=await cloud.locator('svg').boundingBox();
    const dot=await cloud.locator('.manga-cloud-dot').boundingBox();
    expect(svg&&dot).toBeTruthy();
    // Novel Library's indicator is inside the cloud, not bottom-right on the button.
    expect(dot!.x+dot!.width/2).toBeGreaterThan(svg!.x+svg!.width*.4);
    expect(dot!.x+dot!.width/2).toBeLessThan(svg!.x+svg!.width*.62);
    await assertNoHorizontalOverflow(page);
  }
  for(const [name,swatch] of [
    ['Sepia','#e9d5b7'],['Paper','#f9f9f7'],['Charcoal','#30343c'],
    ['Midnight','#12213b'],['Ocean','#dcecf6'],['Plum','#332638']
  ]){
    const button=page.getByRole('button',{name:'Use '+name+' theme'});
    await expect(button).toBeVisible();
    expect(await button.evaluate(el=>(el as HTMLElement).style.getPropertyValue('--swatch-bg'))).toBe(swatch);
  }
});
test('verified manga owner sees useful Master controls without unsafe upload APIs',async({page})=>{
  await page.route('**/api/auth/session',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      connected:true,owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga',
    }),
  }));
  await page.route('**/api/library',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      connected:true,repo:'AdityaSreevatsaK/Taiyous-Manga',revision:'a'.repeat(40),
      empty:true,entries:[],
    }),
  }));
  await page.goto('/');
  await expect(page.getByText('Your private shelves are ready.',{exact:false})).toBeVisible();
  const master=page.locator('.manga-master-menu');
  await expect(master.getByText('Master',{exact:true})).toBeVisible();
  await master.locator('summary').click();
  await expect(master.getByText('Connected as AdityaSreevatsaK.')).toBeVisible();
  await expect(master.getByRole('link',{name:'Manga Storage Controller'}))
    .toHaveAttribute('href','https://github.com/AdityaSreevatsaK/Taiyou-Manga-Storage-Controller');
  await expect(page.getByRole('link',{name:'Manage manga'})).toHaveAttribute('href',
    'https://github.com/AdityaSreevatsaK/Taiyou-Manga-Storage-Controller/actions');
  await master.getByRole('button',{name:'Open my private library'}).click();
  await expect(master).not.toHaveAttribute('open','');
  await expect(page.getByRole('heading',{name:'Your private library is empty'})).toBeVisible();
});

test('private ReLIFE-style chapter list opens verified images without endless scrolling',async({page})=>{
  const mangaId='mng_'+'e'.repeat(24),sha='b'.repeat(40),pageId='pg_'+'f'.repeat(24);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/IX8AAAAASUVORK5CYII=';
  const bytes=Buffer.from(png,'base64'),hash='b00daa524994d8c3c1451326482d57cd44b35c2022c88247dd24c55109acc02e';
  const chapters=Array.from({length:90},(_,i)=>({
    id:'ch_'+i.toString(16).padStart(24,'0'),label:'Chapter '+(i+1),
    sequence:i,pageCount:1,
  }));
  const entry={kind:'manga',id:mangaId,title:'ReLIFE',aliases:[],creators:[],tags:[],
    publicationStatus:'completed',direction:'vertical',chapters};
  await page.route('**/api/auth/session',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      connected:true,owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga',
    }),
  }));
  await page.route('**/api/library',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      connected:true,repo:'AdityaSreevatsaK/Taiyous-Manga',revision:sha,empty:false,entries:[entry],
    }),
  }));
  await page.route('**/api/media/manifest?*',route=>{
    const chapterId=new URL(route.request().url()).searchParams.get('chapterId')!;
    const manifest={schemaVersion:1,mediaKind:'manga',chapterId,pages:[{
      id:pageId,assetPath:'manga/'+mangaId+'/'+chapterId+'/'+pageId+'.png',
      mimeType:'image/png',width:1,height:1,byteSize:bytes.length,sha256:hash,
    }]};
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({revision:sha,manifest})});
  });
  await page.route('**/api/media/page?*',route=>route.fulfill({
    status:200,body:bytes,headers:{'Content-Type':'image/png','Content-Length':String(bytes.length)},
  }));
  await page.goto('/');
  await expect(page.getByRole('link',{name:/ReLIFE/}).first()).toBeVisible();
  await page.locator('.book-card').filter({hasText:'ReLIFE'}).click();
  await expect(page.getByRole('heading',{name:'ReLIFE'})).toBeVisible();
  await expect(page.locator('.chapter-entry')).toHaveCount(25);
  await expect(page.locator('.chapter-list-count')).toContainText('Showing 25 of 90 chapters');
  await page.getByRole('button',{name:'Show next 25 chapters'}).click();
  await expect(page.locator('.chapter-entry')).toHaveCount(50);
  await page.getByRole('searchbox',{name:'Search chapters'}).fill('Chapter 87');
  await expect(page.locator('.chapter-entry')).toHaveCount(1);
  await page.getByRole('button',{name:/Chapter 87.*Read/}).click();
  await expect(page.locator('.vertical-page-image')).toBeVisible();
  await expect(page.locator('.vertical-page-image')).toHaveAttribute('alt','Manga page 1 of 1');
  await expect(page.getByRole('button',{name:'Next chapter →'})).toBeEnabled();
  await page.reload();
  await expect(page.locator('.vertical-page-image')).toBeVisible();
  await page.getByRole('button',{name:'Next chapter →'}).click();
  await expect(page.locator('.reader-heading')).toContainText('Chapter 88');
  await expect(page.locator('.vertical-page-image')).toBeVisible();
  await expect(page.getByText('Offline copies of private chapters are not yet supported.')).toBeVisible();
});

test('Novel Library series layout, card order, chapter picker and clear button hover contrast',async({page})=>{
  for(const width of [320,390,740,1280]){
    await page.setViewportSize({width,height:850});
    await page.goto('/manga/mng_lanternarchive');
    await expect(page.locator('.manga-details-hero')).toBeVisible();
    await expect(page.locator('.manga-details-columns .manga-journey-card')).toBeVisible();
    await expect(page.locator('.manga-details-columns .manga-info-card')).toBeVisible();
    await expect(page.locator('.manga-details-columns .manga-synopsis-card')).toBeVisible();
    await expect(page.locator('.manga-details-main .chapter-section')).toBeVisible();
    await expect(page.locator('.manga-details-main .personal-annotations')).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
  const read=page.locator('.manga-details-hero .detail-actions .primary').first();
  const before=await read.evaluate(node=>getComputedStyle(node).backgroundColor);
  await read.hover();
  const after=await read.evaluate(node=>getComputedStyle(node).backgroundColor);
  expect(after).not.toBe(before);
  await read.click();
  await page.getByRole('button',{name:'Jump to chapter'}).click();
  const modal=page.getByRole('dialog',{name:'Choose chapter'});
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('searchbox',{name:'Search chapters by name or number'})).toBeFocused();
  await modal.getByRole('searchbox',{name:'Search chapters by name or number'}).fill('rooftops');
  await expect(page.locator('.manga-picker-result')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await page.getByRole('button',{name:'Jump to chapter'}).click();
  await page.locator('.manga-picker-result').nth(1).click();
  await expect(page.locator('.reader-heading')).toContainText('Above the rooftops');
});
