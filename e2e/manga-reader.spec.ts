import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';

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
  await page.goto('/library');
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
      await expect(page.getByRole('heading', { name: /Every panel holds a story/ })).toBeVisible();
      await expect(page.locator('.editorial-journal')).toBeVisible();
      await expect(page.locator('.editorial-shelves')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await page.goto('/library');
      await page.locator('.book-card').first().click();
      await expect(page.getByRole('heading', { name: 'Chapters', exact:true })).toBeVisible();
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
    await expect(page.getByRole('heading',{name:'Your manga library awaits'})).toBeVisible();
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
    const slugs = ['01-the-awakening','02-the-crossroads','03-the-sky-bridge','04-a-spark-of-light','05-the-new-dawn'];
    const pages = [7,6,9,8,6];
    for (let i = 0; i < slugs.length; i++) {
      expect(new URL(page.url()).pathname).toContain('/chapters/' + slugs[i]);
      expect(new URL(page.url()).searchParams.has('page')).toBe(false);
      await expect(page.locator('.vertical-page')).toHaveCount(pages[i]!);
      await expect(page.locator('.page-navigation')).toContainText('Chapter ' + (i+1) + ' of 5');
      if (i === 0) {
        await page.locator('.vertical-page').nth(4).evaluate(el => el.scrollIntoView({block:'start'}));
        await expect(page.locator('.page-navigation')).toContainText('Page 5 of 7');
      }
      if (i < slugs.length - 1) await page.getByRole('button', { name: /Next chapter/ }).click();
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
    await expect(page).toHaveURL(/\/manga\/the-lantern-archive\/chapters\/02-above-the-rooftops\?page=3$/);
    await expect(page.locator('.reader-heading')).toContainText('The Lantern Archive');
    await expect(page.getByRole('button', { name: 'Choose chapter' })).toContainText('Above the rooftops');
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 4');
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 4');
  });

  test('native links preserve Back/Forward and page selection URLs', async ({ page }) => {
    await page.goto('/library');
    await page.locator('.book-card').filter({ hasText: 'The Lantern Archive' }).click();
    await expect(page).toHaveURL(/\/manga\/the-lantern-archive$/);
    await page.getByRole('link', { name: /Read from beginning/ }).click();
    await expect(page).toHaveURL(/\/chapters\/01-the-forgotten-key$/);
    await page.getByRole('button', { name: /Next chapter/ }).click();
    await expect(page).toHaveURL(/\/chapters\/02-above-the-rooftops$/);
    await page.goBack();
    await expect(page.locator('.reader-heading')).toContainText('The forgotten key');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Chapters', exact:true })).toBeVisible();
    await page.goForward();
    await expect(page.locator('.reader-heading')).toContainText('The forgotten key');
  });

  test('an actual new tab can open a series independently', async ({ page, context }) => {
    await page.goto('/library');
    const card = page.locator('.book-card').filter({ hasText: 'The Lantern Archive' });
    const href = await card.locator('.book-card-cover-link').getAttribute('href');
    expect(href).toBe('/manga/the-lantern-archive');
    const newTab = await context.newPage();
    await newTab.goto(href!);
    await expect(newTab.getByRole('heading', { name: 'The Lantern Archive' })).toBeVisible();
    await expect(page).toHaveURL('/library');
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
    await expect(page.getByRole('heading', { name: /Every panel holds a story/ })).toBeVisible();
    await page.locator('.editorial-index-row').first().click();
    await page.getByRole('link', { name: 'Back to the shelf' }).click();
    await expect(page).toHaveURL('/library');
    await expect(page.getByRole('heading', { name: /Every panel holds a story/ })).toHaveCount(0);
    await page.getByRole('link', { name: 'Taiyou Manga home' }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('continue reading shelf', () => {
  test('does not show continue cards until an actual page is loaded', async ({page}) => {
    await page.goto('/');
    await expect(page.locator('.editorial-continue-card')).toHaveCount(0);
    await page.goto('/library');
    await page.locator('.book-card').filter({hasText:'The Lantern Archive'}).click();
    await page.getByRole('link',{name:/Read from beginning/}).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.locator('.vertical-page').nth(2).evaluate(el=>el.scrollIntoView({block:'start'}));
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 5');
    await page.getByRole('link',{name:'Taiyou Manga home'}).click();
    const card=page.locator('.editorial-continue-card').filter({hasText:'The Lantern Archive'});
    await expect(card).toContainText('Chapter 1 of 3');
    await card.locator('.editorial-rail-read').click();
    await expect(page.locator('.page-navigation')).toContainText('Page 3 of 5');
    await page.reload();
    await page.getByRole('link',{name:'Taiyou Manga home'}).click();
    await expect(page.locator('.editorial-continue-card')).toHaveCount(1);
  });

  test('recent entries sort by latest saved progress without affecting the empty private catalogue', async ({page}) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('link',{name:/Read from beginning/}).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.goto('/manga/mng_fivechaptertrial');
    await page.getByRole('link',{name:/Read from beginning/}).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.getByRole('link',{name:'Taiyou Manga home'}).click();
    await expect(page.locator('.editorial-continue-card')).toHaveCount(2);
    await expect(page.locator('.editorial-continue-card').first()).toContainText('Five Chapter Scroll Trial');
    await page.locator('.manga-cloud-menu > summary').click();
    await page.getByRole('button',{name:'My library (0)'}).click();
    await expect(page.locator('.editorial-continue-card')).toHaveCount(0);
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
    await expect(page.getByRole('button', { name: 'Download chapter' })).toHaveCount(2);
    // The Novel-style details masthead uses compact navigation; the full
    // offline shelf remains available from All Manga.
    await page.goto('/library');
    await expect(page.getByRole('link', { name: 'Available Offline (1)' })).toBeVisible();
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
    await expect(page.getByRole('link', { name: /Continue reading/ })).toBeVisible();
    await page.goto('/library');
    await expect(page.getByRole('link', { name: 'Available Offline (0)' })).toBeVisible();
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
    await page.goto('/library');
    await expect(page.getByRole('link', { name: 'Available Offline (0)' })).toBeVisible();
    await page.goto('/manga/mng_lanternarchive');
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
    await page.goto('/library');
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
      const heights = await page.locator('.manga-detail-quick-nav a:visible, .manga-detail-quick-nav summary:visible, .offline-chapter-control button:visible')
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
    await page.goto('/library');
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

  test('six visible shelves and Analytics inside Master on desktop and mobile', async ({page}) => {
    await page.setViewportSize({width:1280,height:900});
    await page.goto('/');
    await expect(page.locator('.manga-nav-links > .site-nav-link')).toHaveCount(6);
    await expect(page.locator('.manga-nav-links')).not.toContainText('To Be Read');
    await expect(page.locator('.manga-nav-links')).not.toContainText('Analytics');
    await expect(page.getByRole('link',{name:'Master',exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Currently Reading (0)'}).click();
    await expect(page).toHaveURL('/reading');
    await expect(page.locator('.site-nav-link[aria-current="page"]')).toHaveCount(1);
    await page.setViewportSize({width:320,height:800});
    await expect(page.locator('.manga-nav-links > .site-nav-link')).toHaveCount(3);
    await expect(page.getByText('More',{exact:true})).toBeVisible();
    await page.locator('.nav-more summary').click();
    await expect(page.locator('.nav-more-menu')).not.toContainText('Analytics');
    await expect(page.locator('.nav-more-menu')).not.toContainText('To Be Read');
    await page.getByRole('link',{name:'All Manga'}).click();
    await expect(page).toHaveURL('/library');
    await page.getByRole('link',{name:'Master',exact:true}).click();
    await expect(page).toHaveURL('/master');
    await page.getByRole('navigation',{name:'Master Controls sections'})
      .getByRole('link',{name:'Analytics'}).click();
    await expect(page).toHaveURL('/master?view=analytics');
    await expect(page.locator('.manga-master-page .analytics-shelf')).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('personal shelves persist locally and publication ribbons remain separate', async ({page}) => {
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button',{name:'Add to Trying Out'}).click();
    await expect(page.getByRole('status')).toContainText('Trying Out');
    await page.goto('/trying');
    await expect(page.locator('.book-card')).toHaveCount(1);
    await expect(page.locator('.book-card .status-ribbon').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.book-card')).toHaveCount(1);
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button',{name:/Mark as completed/}).click();
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
  test('ten-point rating, comments and reviewed personal tags survive reload and filter',async({page})=>{
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button',{name:/Rate 1 out of 10/}).click();
    await expect(page.getByRole('button',{name:/Rate 1 out of 10/})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:/Rate 10 out of 10/}).click();
    await expect(page.getByRole('button',{name:/Rate 10 out of 10/})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'Save rating'}).first().click();
    await expect(page.locator('.manga-hero-rating')).toContainText('10/10');
    await page.getByRole('textbox',{name:'My comments / reading notes'})
      .fill('A brilliant, quiet story');
    await page.getByRole('button',{name:'Save comments'}).click();
    await page.getByRole('textbox',{name:'Tag name'}).fill('  Quiet Favourite  ');
    await page.getByRole('button',{name:'Add tag'}).click();
    await expect(page.locator('.tag-draft-actions')).toContainText('Unsaved tag changes');
    await page.getByRole('button',{name:'Review & save tags'}).click();
    await page.getByRole('dialog',{name:'Save tag changes?'})
      .getByRole('button',{name:'Save tags'}).click();
    await page.reload();
    await expect(page.getByRole('textbox',{name:'My comments / reading notes'}))
      .toHaveValue('A brilliant, quiet story');
    await expect(page.locator('.manga-hero-rating')).toContainText('10/10');
    await page.getByRole('button',{name:'Quiet Favourite',exact:true}).click();
    await expect(page).toHaveURL(/\/library\?tag=Quiet/);
    await expect(page.locator('.book-card')).toHaveCount(1);
    await expect(page.locator('.book-card')).toContainText('10/10 · Mine');
  });
  test('Novel detail tags are add-only and saved in one reviewed batch',async({page})=>{
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('textbox',{name:'Tag name'}).fill('Keep This');
    await page.getByRole('button',{name:'Add tag'}).click();
    await page.getByRole('button',{name:'Review & save tags'}).click();
    await page.getByRole('dialog',{name:'Save tag changes?'})
      .getByRole('button',{name:'Save tags'}).click();
    await expect(page.locator('.manga-tags-card')).toContainText('Keep This');
    await expect(page.getByRole('button',{name:'Remove tag Keep This'})).toHaveCount(0);
    await page.getByRole('textbox',{name:'Tag name'}).fill('Maybe Later');
    await page.getByRole('button',{name:'Add tag'}).click();
    await expect(page.locator('.tag-draft-actions')).toContainText('Unsaved tag changes');
    await page.getByRole('button',{name:'Discard changes'}).click();
    await expect(page.locator('.manga-tags-card')).toContainText('Keep This');
    await expect(page.locator('.manga-tags-card')).not.toContainText('Maybe Later');
    await page.reload();
    await expect(page.locator('.manga-tags-card')).toContainText('Keep This');
  });

});

test.describe('compatible private manga library backups',()=>{
  test('exports and restores notes, ratings, tags and reading shelves with explicit consent',async({page})=>{
    await page.goto('/manga/mng_lanternarchive');
    await page.getByRole('button',{name:'Add to Trying Out'}).click();
    await page.getByRole('button',{name:/Rate 9 out of 10/}).click();
    await page.getByRole('button',{name:'Save rating'}).first().click();
    await page.getByRole('textbox',{name:'My comments / reading notes'}).fill('My export test note');
    await page.getByRole('button',{name:'Save comments'}).click();
    await page.getByRole('textbox',{name:'Tag name'}).fill('Adventure Favourite');
    await page.getByRole('button',{name:'Add tag'}).click();
    await page.getByRole('button',{name:'Review & save tags'}).click();
    await page.getByRole('dialog',{name:'Save tag changes?'}).getByRole('button',{name:'Save tags'}).click();
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
    await expect(page.getByRole('button',{name:/Trying Out/})).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('textbox',{name:'My comments / reading notes'})).toHaveValue('My export test note');
    await expect(page.locator('.manga-tags-card')).toContainText('Adventure Favourite');
    await expect(page.locator('.manga-hero-rating')).toContainText('9/10');
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
    await page.getByRole('button',{name:'Add to collection'}).click();
    await page.getByRole('dialog',{name:'Collections for The Lantern Archive'})
      .getByRole('checkbox',{name:'Favourites / Romance'}).check();
    await page.getByRole('button',{name:'Done'}).click();
    await expect(page.locator('.collection-change-toast')).toContainText('Added manga to collection');
    await expect(page.locator('.details-hero-membership')).toContainText('Favourites / Romance');
    await expect(page.locator('.detail-sub')).toHaveText(publicationBefore);
    await page.locator('.details-hero-membership').filter({hasText:'Favourites / Romance'}).click();
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
    await page.getByRole('button',{name:/Rate 10 out of 10/}).click();
    await page.getByRole('button',{name:'Save rating'}).first().click();
    await page.getByRole('button',{name:'Add to Trying Out'}).click();
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
    await page.getByRole('button',{name:/Rate 8 out of 10/}).click();
    await page.getByRole('button',{name:'Save rating'}).first().click();
    await page.getByRole('link',{name:/Read from beginning/}).click();
    await expect(page.locator('.vertical-page-image').first()).toBeVisible();
    await page.goto('/analytics');
    await expect(page).toHaveURL('/master?view=analytics');
    await expect(page.locator('.manga-master-page').getByRole('heading',{name:'Analytics'})).toBeVisible();
    await expect(page.getByRole('navigation',{name:'Master Controls sections'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Private owner access required'})).toHaveCount(0);
    await expect(page.getByRole('textbox',{name:/passphrase|password/i})).toHaveCount(0);
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
  await expect(page.locator('.editorial-journal')).toBeVisible();
  await page.goto('/library');
  await expect(page.locator('.book-card').filter({hasText:'The Lantern Archive'})).toContainText('Favourite');
  await page.reload();
  await expect(page.locator('.book-card').filter({hasText:'The Lantern Archive'})).toContainText('Favourite');
  await page.goto('/manga/mng_lanternarchive');
  await page.getByRole('button',{name:/Remove from favourites/}).click();
  await expect(page.getByRole('button',{name:/Add to favourites/})).toHaveAttribute('aria-pressed','false');
  await page.goto('/library');
  await expect(page.locator('.book-favourite')).toHaveCount(0);
});

test('manual chapter completion is explicit, persists and does not alter navigation',async({page})=>{
  await page.goto('/manga/mng_lanternarchive');
  const completion=page.locator('.manga-chapter-completion');
  await expect(completion).toContainText('0 of 3 chapters explicitly marked completed.');
  const first=completion.getByRole('checkbox',{name:'Chapter 1'});
  await expect(first).not.toBeChecked();
  await first.check();
  await expect(first).toBeChecked();
  await expect(completion).toContainText('1 of 3 chapters explicitly marked completed.');
  await page.reload();
  await expect(page.locator('.manga-chapter-completion').getByRole('checkbox',{name:'Chapter 1'})).toBeChecked();
  await page.locator('.manga-chapter-completion').getByRole('checkbox',{name:'Chapter 1'}).uncheck();
  await expect(page.locator('.manga-chapter-completion')).toContainText('0 of 3 chapters explicitly marked completed.');
  await page.getByRole('link',{name:/Read from beginning/}).click();
  await expect(page.getByRole('button',{name:/Next chapter/})).toBeEnabled();
  await page.getByRole('link',{name:/Series details/}).click();
  await expect(page.locator('.manga-chapter-completion')).toContainText('0 of 3 chapters explicitly marked completed.');
});

test('mock authenticated empty HF dataset replaces sample catalogue with a truthful private view', async ({page}) => {
  await page.route('**/api/auth/session', route => route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      connected:true,owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga',
    }),
  }));
  await page.route('**/api/library', route => route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      connected:true,owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga',empty:true,
      revision:'a'.repeat(40),entries:[],
    }),
  }));
  await page.route('**/api/auth/logout', route => route.fulfill({
    status:200,contentType:'application/json',body:'{"connected":false}',
  }));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Your manga library awaits'})).toBeVisible();
  await page.locator('.manga-cloud-menu > summary').click();
  await expect(page.getByRole('button',{name:'My library (0)'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Your manga library awaits'})).toBeVisible();
  await expect(page.locator('.book-card')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Use Sepia theme'})).toBeVisible();
  await expect(page.locator('.manga-cloud-menu')).toHaveAttribute('open','');
  await page.getByRole('button',{name:'Sign out of Hugging Face'}).click();
  await expect(page.getByRole('button',{name:'My library (0)'})).toBeVisible();
  await expect(page.locator('.editorial-journal')).toBeVisible();
  await expect(page.getByRole('heading',{name:/Every panel holds a story/})).toBeVisible();
});

test('Novel editorial home is complete, readable and navigable at split-screen widths',async({page})=>{
 for(const width of [320,390,430,740,1024,1500]){
  await page.setViewportSize({width,height:900});
  await page.goto('/');
  await expect(page.locator('.editorial-grand')).toBeVisible();
  await expect(page.getByRole('heading',{name:/Every panel holds a story/})).toBeVisible();
  await expect(page.locator('.editorial-journal')).toBeVisible();
  await expect(page.locator('.editorial-journal-index .editorial-index-row')).toHaveCount(3);
  await expect(page.locator('.editorial-shelves')).toBeVisible();
  await expect(page.locator('.editorial-all-books')).toBeVisible();
  await expect(page.locator('.editorial-grand-ledger button')).toHaveCount(4);
  await assertNoHorizontalOverflow(page);
 }
 await page.locator('.editorial-browse-all').click();
 await expect(page).toHaveURL('/library');
 await expect(page.locator('.book-card')).toHaveCount(4);
 await expect(page.locator('.status-ribbon').filter({hasText:'Story Complete'})).toHaveCount(2);
 await expect(page.locator('.status-ribbon').filter({hasText:'Updating'})).toHaveCount(1);
 await expect(page.locator('.status-ribbon').filter({hasText:'On Hiatus'})).toHaveCount(1);
 await page.locator('.book-card').filter({hasText:'The Lantern Archive'}).click();
 await expect(page.locator('.manga-synopsis-card .detail-description')).toBeVisible();
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
  await expect(page.locator('.editorial-grand')).toBeVisible();
  await expect(page.locator('.editorial-journal')).toBeVisible();
  const background=await page.locator('.editorial-grand').evaluate(node=>getComputedStyle(node).backgroundImage);
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
  await expect(page.locator('.editorial-journal')).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('author links browse attributed manga without nested anchors or losing direct links',async({page})=>{
  await page.goto('/library');
  const first=page.locator('.book-card').filter({hasText:'The Lantern Archive'});
  await expect(first.locator('.manga-author-link').first()).toHaveAttribute('href',/\/library\?creator=Taiyou/);
  await first.locator('.manga-author-link').first().click();
  await expect(page).toHaveURL(/\/library\?creator=Taiyou/);
  await expect(page.locator('.book-card')).toHaveCount(4);
  await expect(page.getByRole('searchbox',{name:'Creator'})).toHaveValue('Taiyou Studio (fictional)');
  await page.locator('.book-card').filter({hasText:'The Lantern Archive'}).locator('.book-card-cover-link').click();
  await expect(page.locator('.manga-info-card .manga-author-link')).toHaveCount(1);
  await page.locator('.manga-info-card .manga-author-link').click();
  await expect(page).toHaveURL(/\/library\?creator=Taiyou/);
  await expect(page.locator('.book-card')).toHaveCount(4);
});

test('personal tag form is a simple text field without duplicate caption or dropdown',async({page})=>{
  await page.goto('/manga/the-lantern-archive');
  const form=page.locator('.manga-tags-card .details-tag-form');
  await expect(form.getByRole('textbox',{name:'Tag name'})).toBeVisible();
  await expect(form.getByText('Add a personal tag')).toHaveCount(0);
  await expect(form.locator('datalist')).toHaveCount(0);
  await expect(form.getByRole('textbox',{name:'Tag name'})).not.toHaveAttribute('list', /.+/);
  await form.getByRole('textbox',{name:'Tag name'}).fill('Warm-hearted');
  await form.getByRole('button',{name:'Add tag'}).click();
  await expect(page.locator('.manga-tags-card')).toContainText(/Warm.Hearted/i);
});

test('authenticated manga homepage mirrors Novel floating gallery with three complete real covers',async({page})=>{
  const webp=Buffer.from('UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAMAAUAmJaACdLoAA5gA/vDEC/8pX7svSTqy/zs9lsayAAA=','base64');
  const hash=createHash('sha256').update(webp).digest('hex');
  const cloud={connected:true,owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga'};
  const entries=Array.from({length:4},(_,i)=>{
    const id='mng_visualparity'+String(i).padStart(3,'0');
    return {kind:'manga',id,title:'Featured Manga '+(i+1),aliases:[],
      creators:['Creator '+(i+1)],tags:['Romance','Slice of Life'],
      publicationStatus:'completed',direction:'vertical',synopsis:'Synopsis for featured manga '+(i+1)+'.',
      chapters:[{id:'ch_visualparity'+String(i).padStart(3,'0'),
        label:'Chapter 1',sequence:1,pageCount:1}],
      cover:{assetPath:'covers/'+id+'.webp',mimeType:'image/webp',
        width:2,height:3,byteSize:webp.length,sha256:hash}};
  });
  await page.route('**/api/auth/session',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(cloud)
  }));
  await page.route('**/api/library',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({...cloud,revision:'a'.repeat(40),entries})
  }));
  await page.route('**/api/media/cover?*',route=>route.fulfill({
    status:200,contentType:'image/webp',body:webp
  }));
  for(const width of [430,650,790,900,1080]){
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    const gallery=page.locator('.editorial-grand-gallery');
    await expect(gallery).toBeVisible();
    const visible=page.locator('.editorial-art-book:not(.editorial-art-book-pending)');
    await expect(visible).toHaveCount(3,{timeout:20000});
    await expect(visible.locator('.cover-has-image')).toHaveCount(3);
    // Regression: the source-port had a missing wrapper class, so intrinsic
    // JPG/WEBP dimensions escaped the hero and made every shelf image enormous.
    await expect(page.locator('.manga-editorial-home')).toBeVisible();
    const imageContainment=await visible.locator('.cover').evaluateAll(covers=>covers.map(el=>{
      const img=el.querySelector('img.manga-cover-image');
      const frame=el.getBoundingClientRect(),image=img?.getBoundingClientRect();
      return image?{
        frameWidth:frame.width,frameHeight:frame.height,
        imageWidth:image.width,imageHeight:image.height,
        frameOverflowX:Math.max(frame.left-image.left,image.right-frame.right),
        frameOverflowY:Math.max(frame.top-image.top,image.bottom-frame.bottom),
      }:null;
    }));
    expect(imageContainment).toHaveLength(3);
    for(const art of imageContainment){
      expect(art).not.toBeNull();
      expect(art!.frameWidth).toBeLessThan(220);
      expect(art!.imageWidth).toBeLessThanOrEqual(art!.frameWidth+1);
      expect(art!.imageHeight).toBeLessThanOrEqual(art!.frameHeight+1);
      expect(art!.frameOverflowX).toBeLessThanOrEqual(1);
      expect(art!.frameOverflowY).toBeLessThanOrEqual(1);
    }
    const shelfArt=await page.locator('.editorial-shelf-cover .cover').evaluateAll(arts=>
      arts.map(el=>({width:el.getBoundingClientRect().width,
        imageWidth:el.querySelector('img')?.getBoundingClientRect().width??0})));
    for(const art of shelfArt){
      expect(art.width).toBeLessThanOrEqual(66);
      expect(art.imageWidth).toBeLessThanOrEqual(art.width+1);
    }
    const bounds=await gallery.boundingBox();
    const covers=await visible.locator('.cover').evaluateAll(nodes=>nodes.map(el=>{
      const r=el.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,ratio:getComputedStyle(el).aspectRatio};
    }));
    expect(covers).toHaveLength(3);
    for(const cover of covers){
      expect(cover.ratio.replaceAll(' ','')).toBe('2/3');
      expect(cover.left).toBeGreaterThanOrEqual(bounds!.x-6);
      expect(cover.right).toBeLessThanOrEqual(bounds!.x+bounds!.width+6);
    }
    await assertNoHorizontalOverflow(page);
  }
  await page.setViewportSize({width:1280,height:850});
  await page.goto('/');
  await expect(page.locator('.editorial-art-book:not(.editorial-art-book-pending)')).toHaveCount(3);
  const centre=page.locator('.editorial-art-book-1');
  const centreTitle=(await centre.getAttribute('aria-label'))?.replace('Preview and open ','');
  expect(centreTitle).toBeTruthy();
  const details=page.locator('.editorial-featured-book');
  await expect(details.getByRole('heading',{level:2})).toHaveText(centreTitle!);
  const featuredTitle=details.getByRole('heading',{level:2});
  await expect.poll(()=>featuredTitle.evaluate(el=>getComputedStyle(el).color)).toBe('rgb(255, 243, 213)');
  await expect.poll(()=>details.locator('.editorial-featured-synopsis')
    .evaluate(el=>getComputedStyle(el).color)).toBe('rgb(232, 238, 249)');
  const first=page.locator('.editorial-art-book:not(.editorial-art-book-pending)').first();
  await expect(first).toBeVisible();
  await expect(first).toHaveAttribute('href',/\/manga\//);
  const label=first.locator('.editorial-art-hover-label');
  await expect(label).toBeHidden();
  const oldScale=await first.evaluate(el=>getComputedStyle(el).scale);
  await first.hover();
  await expect(label).toBeVisible();
  const firstTitle=(await first.getAttribute('aria-label'))!.replace('Preview and open ','');
  await expect(featuredTitle).toHaveText(firstTitle);
  const firstNumber=Number(firstTitle.replace('Featured Manga ',''));
  await expect(details.locator('.editorial-featured-author')).toHaveText('by Creator '+firstNumber);
  await expect(details.locator('.editorial-featured-synopsis'))
    .toContainText('Synopsis for featured manga '+firstNumber);
  await expect(page.locator('.editorial-grand-actions .editorial-secondary')).toHaveAttribute('href',await first.getAttribute('href')??'');
  await expect.poll(()=>first.evaluate(el=>getComputedStyle(el).scale)).not.toBe(oldScale);
  await page.locator('.editorial-grand-tagline').hover();
  await expect(featuredTitle).toHaveText(centreTitle!);
  await first.focus();
  await expect(featuredTitle).toHaveText(firstTitle);
  await first.click();
  await expect(page.locator('.manga-details-hero')).toBeVisible();
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
    const cloud=page.locator('.cloud-status-icon');
    const svg=await cloud.locator('svg').boundingBox();
    const dot=await cloud.locator('.cloud-status-dot').boundingBox();
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
      connected:true,owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga',revision:'a'.repeat(40),
      empty:true,entries:[],
    }),
  }));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Your manga library awaits'})).toBeVisible();
  const master=page.getByRole('link',{name:'Master',exact:true});
  await expect(master).toHaveAttribute('href','/master');
  await expect(page.getByRole('link',{name:'Manage manga'})).toHaveCount(0);
  await expect(page.locator('.manga-master-menu')).toHaveCount(0);
  await master.click();
  await expect(page).toHaveURL('/master');
  await expect(page.getByRole('heading',{name:'Master Controls'})).toBeVisible();
  await expect(page.getByText('Private catalogue connected as')).toContainText('AdityaSreevatsaK');
  await expect(page.getByRole('link',{name:/Manga Storage Controller/}))
    .toHaveAttribute('href','https://github.com/AdityaSreevatsaK/Taiyou-Manga-Storage-Controller');
  await expect(page.getByRole('link',{name:/View private dataset/}))
    .toHaveAttribute('href','https://huggingface.co/datasets/AdityaSreevatsaK/Taiyous-Manga');
  await expect(page.getByRole('button',{name:'Refresh catalogue'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Master Controls'})).toBeVisible();
  await page.getByRole('link',{name:'Back to library'}).click();
  await expect(page.getByRole('heading',{name:'Your private library is empty'})).toBeVisible();
});

test('Novel catalogue cloud sits immediately beside sun wordmark without changing its glyph',async({page})=>{
  await page.setViewportSize({width:1280,height:850});
  await page.goto('/');
  const cloud=page.locator('.manga-cloud-menu');
  const wordmark=page.locator('.manga-topbar .wordmark');
  const cloudBox=await cloud.boundingBox(),logoBox=await wordmark.boundingBox();
  expect(cloudBox).toBeTruthy();
  expect(logoBox).toBeTruthy();
  expect(cloudBox!.x).toBeGreaterThanOrEqual(logoBox!.x+logoBox!.width-2);
  expect(cloudBox!.x).toBeLessThan(logoBox!.x+logoBox!.width+65);
  const glyph=cloud.locator('svg').first();
  await expect(glyph).toHaveAttribute('width','25');
  await expect(glyph).toHaveAttribute('height','25');
  await expect(glyph).toHaveAttribute('stroke-width','1.9');
  const rendered=await glyph.boundingBox();
  expect(rendered?.width).toBe(27);
  expect(rendered?.height).toBe(27);
  const toggle=await cloud.locator(':scope > summary').boundingBox();
  expect(toggle?.width).toBe(42);
  expect(toggle?.height).toBe(42);
  await expect(cloud.locator('.cloud-status-dot')).toHaveCount(1);
  await cloud.locator(':scope > summary').click();
  await expect(page.getByRole('heading',{name:'Cloud library settings'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cloud).not.toHaveAttribute('open','');
});

test('Analytics works without an owner password, with management still protected',async({page})=>{
  await page.goto('/master?view=analytics');
  await expect(page.locator('.manga-master-page .analytics-shelf')).toBeVisible();
  await expect(page.locator('.analytics-grid')).toContainText('Catalogue series');
  await expect(page.getByRole('heading',{name:'Private owner access required'})).toHaveCount(0);
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL('/master?view=analytics');
  await expect(page.locator('.analytics-shelf')).toBeVisible();
  await page.getByRole('navigation',{name:'Master Controls sections'})
    .getByRole('link',{name:'Library management'}).click();
  await expect(page).toHaveURL('/master');
  await expect(page.getByRole('heading',{name:'Private owner access required'})).toBeVisible();
  await page.goto('/to-read');
  await expect(page).toHaveURL('/library');
  await expect(page.getByRole('heading',{name:'All Manga'})).toBeVisible();
});

test('unauthenticated Master route never exposes a private catalogue',async({page})=>{
  await page.goto('/master');
  await expect(page.getByRole('heading',{name:'Master Controls'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Private owner access required'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Sign in with Hugging Face'})).toHaveAttribute('href','/api/auth/login');
  await expect(page.locator('.manga-master-record')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Manage manga'})).toHaveCount(0);
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
      connected:true,owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga',revision:sha,empty:false,entries:[entry],
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
  await page.goto('/library');
  await expect(page.getByRole('link',{name:/ReLIFE/}).first()).toBeVisible();
  await page.locator('.book-card').filter({hasText:'ReLIFE'}).click();
  await expect(page.getByRole('heading',{name:'ReLIFE'})).toBeVisible();
  await expect(page.locator('.novel-chapter-browser .chapter-list [role="listitem"]')).toHaveCount(50);
  await expect(page.locator('.chapter-paging')).toContainText('Showing 1–50 of 90');
  await page.getByRole('button',{name:'Next ›'}).click();
  await expect(page.locator('.chapter-paging')).toContainText('Showing 51–90 of 90');
  await page.getByRole('searchbox',{name:'Search chapters'}).fill('Chapter 87');
  await expect(page.locator('.novel-chapter-browser .chapter-list [role="listitem"]')).toHaveCount(1);
  await page.getByRole('button',{name:/Chapter 87/}).click();
  await expect(page.locator('.vertical-page-image')).toBeVisible();
  await expect(page.locator('.vertical-page-image')).toHaveAttribute('alt','Manga page 1 of 1');
  const chapterStatus=page.locator('.chapter-preload-progress');
  await expect(chapterStatus).toBeVisible();
  await expect(chapterStatus.locator('progress')).toHaveCount(0);
  await expect(chapterStatus.locator('.chapter-preload-message')).toContainText('Chapter ready');
  await expect(chapterStatus.locator('.chapter-preload-count')).toContainText('1');
  await expect(chapterStatus.locator('.chapter-preload-emblem svg')).toBeVisible();
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
    await expect(page.locator('.manga-details-sidebar .personal-annotations')).toBeVisible();
    if(width<=700)await expect(page.locator('.manga-mobile-rating')).toBeVisible();
    else await expect(page.locator('.manga-hero-rating')).toBeVisible();
  await expect(page.locator('.manga-details-sidebar .manga-tags-card')).toBeVisible();
  await expect(page.locator('.manga-details-sidebar .manga-management-card')).toBeVisible();

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


test('private manga cover and metadata refresh preserve local reading records on mobile',async({page})=>{
  const mangaId='mng_metadatademo001',chapterId='ch_metadatademo001';
  const baseline={kind:'manga',id:mangaId,title:'Metadata Demo',aliases:[],creators:[],tags:[],
    publicationStatus:'unknown',direction:'vertical',chapters:[{id:chapterId,label:'Chapter 1',sequence:1,pageCount:1}]};
  const cover={assetPath:'covers/'+mangaId+'.webp',mimeType:'image/webp',
    width:2,height:3,byteSize:62,sha256:'a'.repeat(64)};
  const enriched={...baseline,creatorRoles:[
    {name:'Example Writer',role:'author'},{name:'Example Illustrator',role:'artist'}],
    creators:['Example Writer','Example Illustrator'],
    aliases:['Another Title'],tags:['Romance'],synopsis:'An accurate enriched synopsis.',
    publicationStatus:'completed',cover,
    metadataSources:{cover:{provider:'mangadex',sourceId:'demo',
      sourceUrl:'https://mangadex.org/title/demo',retrievedAt:'2026-11-20T08:30:00Z'}}};
  let enrichedNow=false;
  const cloud={connected:true,owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga'};
  await page.route('**/api/auth/session',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(cloud),
  }));
  await page.route('**/api/library',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({...cloud,entries:[enrichedNow?enriched:baseline]}),
  }));
  const webp=Buffer.from('UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAMAAUAmJaACdLoAA5gA/vDEC/8pX7svSTqy/zs9lsayAAA=','base64');
  await page.route('**/api/media/cover?*',route=>route.fulfill({
    status:200,contentType:'image/webp',body:webp,
  }));
  await page.setViewportSize({width:390,height:850});
  await page.goto('/library');
  await page.locator('.book-card').filter({hasText:'Metadata Demo'}).click();
  await expect(page.locator('.manga-details-hero')).toBeVisible();
  await expect(page.locator('.manga-details-hero .manga-cover-image')).toHaveCount(0);
  await page.evaluate(id=>localStorage.setItem('taiyou-manga:progress:v1:'+id,'saved-do-not-replace'),mangaId);
  enrichedNow=true;
  // Novel BookDetails uses a dedicated header; refresh the private catalogue
  // using the normal library header, then return to the series details.
  await page.goto('/library');
  await page.locator('.manga-cloud-menu > summary').click();
  await page.getByRole('button',{name:'Refresh cloud'}).click();
  await page.getByRole('heading',{name:'All Manga'}).waitFor();
  await page.locator('.book-card').filter({hasText:'Metadata Demo'}).click();
  await expect(page.locator('.manga-info-card')).toContainText('Example Writer');
  await expect(page.locator('.manga-info-card')).toContainText('Example Illustrator');
  await expect(page.locator('.manga-info-card')).toContainText('Another Title');
  await expect(page.locator('.manga-synopsis-card')).toContainText('An accurate enriched synopsis.');
  await expect(page.locator('.manga-tags-card')).toContainText('Romance');
  await expect(page.locator('.manga-details-hero .manga-cover-image')).toHaveJSProperty('naturalWidth',2);
  expect(await page.evaluate(id=>localStorage.getItem('taiyou-manga:progress:v1:'+id),mangaId))
    .toBe('saved-do-not-replace');
  await assertNoHorizontalOverflow(page);
});

test('failed authenticated cover request leaves readable placeholder and metadata',async({page})=>{
  const mangaId='mng_coverfallback001';
  const cloud={connected:true,owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga'};
  const entry={kind:'manga',id:mangaId,title:'Missing Cover Demo',aliases:[],creators:[],
    creatorRoles:[{name:'Example Author',role:'author'}],tags:[],publicationStatus:'unknown',
    direction:'vertical',chapters:[],cover:{assetPath:'covers/'+mangaId+'.webp',
      mimeType:'image/webp',width:2,height:3,byteSize:100,sha256:'b'.repeat(64)}};
  await page.route('**/api/auth/session',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(cloud),
  }));
  await page.route('**/api/library',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({...cloud,entries:[entry]}),
  }));
  await page.route('**/api/media/cover?*',route=>route.fulfill({status:404}));
  await page.setViewportSize({width:320,height:850});
  await page.goto('/library');
  await page.locator('.book-card').filter({hasText:'Missing Cover Demo'}).click();
  await expect(page.locator('.detail-cover .manga-cover-image')).toHaveCount(0);
  await expect(page.locator('.detail-cover .cover-title')).toContainText('Missing Cover Demo');
  await expect(page.locator('.manga-info-card')).toContainText('Example Author');
  await expect(page.locator('.manga-synopsis-card')).toContainText('A synopsis has not been added yet.');
  await assertNoHorizontalOverflow(page);
});

test('Novel Library details keep source and personal tags together, separate from comments',async({page})=>{
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:850});
    await page.goto('/manga/mng_lanternarchive');
    const classes=await page.locator('.manga-details-sidebar > section')
      .evaluateAll(nodes=>nodes.map(node=>node.className));
    expect(classes).toHaveLength(5);
    for(const [index,name] of [
      [0,'manga-journey-card'],[1,'manga-info-card'],[2,'manga-tags-card'],
      [3,'personal-annotations'],[4,'manga-management-card'],
    ] as const)expect(classes[index]).toContain(name);
    await expect(page.locator('.manga-tags-card .details-tag-form')).toBeVisible();
    await expect(page.locator('.personal-annotations .personal-tag-editor')).toHaveCount(0);
    await expect(page.locator('.personal-annotations .personal-notes-editor')).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});

test('personal tag deletion requires management disclosure and explicit confirmation',async({page})=>{
  await page.goto('/manga/mng_lanternarchive');
  await page.getByRole('textbox',{name:'Tag name'}).fill('Protected Favourite');
  await page.getByRole('button',{name:'Add tag'}).click();
  await page.getByRole('button',{name:'Review & save tags'}).click();
  await page.getByRole('dialog',{name:'Save tag changes?'}).getByRole('button',{name:'Save tags'}).click();
  await expect(page.getByRole('button',{name:'Remove tag Protected Favourite'})).toHaveCount(0);
  await page.locator('.manga-personal-tag-management summary').click();
  await page.getByRole('button',{name:'Remove personal tag Protected Favourite'}).click();
  const modal=page.getByRole('dialog',{name:'Remove this personal tag?'});
  await expect(modal).toBeVisible();
  await modal.getByRole('button',{name:'Cancel'}).click();
  await expect(page.locator('.manga-tags-card')).toContainText('Protected Favourite');
  await page.getByRole('button',{name:'Remove personal tag Protected Favourite'}).click();
  await modal.getByRole('button',{name:'Remove personal tag'}).click();
  await page.reload();
  await expect(page.locator('.manga-tags-card')).not.toContainText('Protected Favourite');
});

test('Novel-style collection picker opens from the manga hero and preserves membership on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:850});
  await page.goto('/library');
  await page.getByText('Manage my collections (0)').click();
  await page.getByRole('textbox',{name:'New collection name'}).fill('Favourites');
  await page.getByRole('button',{name:'Create collection'}).click();
  await page.goto('/manga/mng_lanternarchive');
  const opener=page.getByRole('button',{name:'Add to collection'});
  await opener.click();
  const modal=page.getByRole('dialog',{name:'Collections for The Lantern Archive'});
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button',{name:'Close collection picker'})).toBeFocused();
  await modal.getByRole('checkbox',{name:'Favourites'}).check();
  await expect(modal.getByRole('checkbox',{name:'Favourites'})).toBeChecked();
  await expect(page.locator('.collection-change-toast')).toContainText('Added manga to collection');
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator('.details-hero-membership')).toContainText('Favourites');
  await opener.click();
  await modal.getByRole('checkbox',{name:'Favourites'}).uncheck();
  await expect(modal.getByRole('checkbox',{name:'Favourites'})).not.toBeChecked();
  await modal.getByRole('button',{name:'Done'}).click();
  await expect(page.locator('.details-hero-membership')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});

test('mobile rating uses Novel Library compact selector and retains saved value',async({page})=>{
  await page.setViewportSize({width:390,height:820});
  await page.goto('/manga/mng_lanternarchive');
  const rating=page.getByRole('combobox',{name:'Rate this manga'});
  await expect(rating).toBeVisible();
  await rating.selectOption('9');
  await page.locator('.manga-mobile-rating').getByRole('button',{name:'Save rating'}).click();
  await page.reload();
  await expect(page.getByRole('combobox',{name:'Rate this manga'})).toHaveValue('9');
  await expect(page.locator('.manga-mobile-rating')).toContainText('9/10');
});

/** Regression: the Novel Library uses IndexedDB rather than repeating provider
 * downloads on every refresh. Twenty private Manga covers must do the same.
 */
test('twenty verified private covers load from IndexedDB on refresh and clear at logout',async({page})=>{
  const image=Buffer.from(
    'UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAMAAUAmJaACdLoAA5gA/vDEC/8pX7svSTqy/zs9lsayAAA=',
    'base64');
  const sha256=createHash('sha256').update(image).digest('hex');
  const items=Array.from({length:20},(_,i)=>{
    const id='mng_cachecover'+String(i+1).padStart(4,'0');
    return {kind:'manga',id,title:'Artwork '+String(i+1),aliases:[],creators:[],
      tags:[],publicationStatus:'completed',direction:'vertical',chapters:[],
      cover:{assetPath:'covers/'+id+'.webp',mimeType:'image/webp',
        width:2,height:3,byteSize:image.length,sha256}};
  });
  const cloud={connected:true,owner:'AdityaSreevatsaK',
    repo:'AdityaSreevatsaK/Taiyous-Manga',entries:items};
  let requested=0;
  await page.route('**/api/library',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(cloud),
  }));
  await page.route('**/api/media/cover?*',route=>{
    requested++;
    return route.fulfill({status:200,contentType:'image/webp',body:image});
  });
  await page.route('**/api/auth/logout',route=>route.fulfill({
    status:200,contentType:'application/json',body:'{"ok":true}',
  }));
  const countCached=()=>page.evaluate(async()=>{
    return await new Promise<number>((resolve,reject)=>{
      const req=indexedDB.open('taiyou-manga-private-covers-v1');
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{
        const tx=req.result.transaction('covers','readonly');
        const count=tx.objectStore('covers').count();
        count.onsuccess=()=>{resolve(count.result);req.result.close();};
        count.onerror=()=>reject(count.error);
      };
    });
  });
  await page.goto('/library');
  await expect(page.locator('.book-card')).toHaveCount(20);
  for(let i=0;i<20;i++){
    const card=page.locator('.book-card').nth(i);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.manga-cover-image')).toHaveJSProperty('naturalWidth',2);
  }
  expect(requested).toBe(20);
  await expect.poll(countCached,{timeout:15000}).toBe(20);
  await page.reload();
  await expect(page.locator('.book-card')).toHaveCount(20);
  for(let i=0;i<20;i++){
    const card=page.locator('.book-card').nth(i);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.manga-cover-image')).toHaveJSProperty('naturalWidth',2);
  }
  expect(requested).toBe(20);
  await page.locator('.manga-cloud-menu > summary').click();
  await page.getByRole('button',{name:'Sign out of Hugging Face'}).click();
  await expect.poll(countCached,{timeout:15000}).toBe(0);
});

test('Novel status labels and book icon are distinct from publication ribbons',async({page})=>{
  await page.goto('/manga/mng_silvergarden');
  await expect(page.locator('.manga-publication-pill')).toHaveText('Completed');
  await expect(page.locator('.manga-info-card')).toContainText('Completed');
  await expect(page.locator('.detail-sub')).not.toContainText('Story Complete');
  await expect(page.locator('.manga-chapter-stat svg')).toBeVisible();
  await expect(page.locator('.manga-chapter-stat')).toContainText('chapters');
  await page.goto('/library');
  await expect(page.locator('.status-ribbon').filter({hasText:'Story Complete'})).toHaveCount(2);
});

test('editable manga synopsis saves locally, survives refresh and restores its original',async({page})=>{
  await page.goto('/manga/mng_lanternarchive');
  const card=page.locator('.manga-synopsis-card');
  const original=await card.locator('.detail-description').textContent();
  const edit=card.getByRole('button',{name:'Edit summary'});
  await edit.click();
  await expect(card.getByRole('textbox',{name:/Personal synopsis/})).toBeVisible();
  await card.getByRole('textbox',{name:/Personal synopsis/}).fill('A carefully edited personal synopsis.');
  await card.getByRole('button',{name:'Save synopsis'}).click();
  await expect(card.locator('.detail-description')).toHaveText('A carefully edited personal synopsis.');
  await page.reload();
  await expect(card.locator('.detail-description')).toHaveText('A carefully edited personal synopsis.');
  await card.getByRole('button',{name:'Restore original'}).click();
  await expect(card.locator('.detail-description')).toHaveText(original!);
  await page.reload();
  await expect(card.locator('.detail-description')).toHaveText(original!);
});

test('manga details reproduce Novel Library icons, structure, footer and scroll affordance',async({page})=>{
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:850});
    await page.goto('/manga/mng_lanternarchive');
    const header=page.locator('.manga-details-topbar');
    await expect(header.getByRole('link',{name:"Taiyou's Manga Library home"})).toBeVisible();
    await expect(header.locator('.taiyou-brand-mark')).toHaveAttribute('width','32');
    await expect(header.getByRole('navigation',{name:'Navigate library'})).toBeVisible();
    await expect(header.getByRole('button',{name:/Choose colour theme/})).toBeVisible();
    for(const [card,title] of [
      ['.manga-journey-card','Reading progress'],['.manga-info-card','Details'],
      ['.manga-tags-card','Tags & genres'],['.personal-annotations','Comments & reading notes'],
      ['.manga-management-card','Manage this manga'],['.manga-synopsis-card','Synopsis'],
      ['.novel-chapter-browser','Chapters']
    ]){
      const section=page.locator(card);
      await expect(section.getByRole('heading',{name:title,exact:true})).toBeVisible();
      await expect(section.locator('.details-section-header')).toHaveCount(1);
      if(card!=='.manga-synopsis-card')
        await expect(section.locator('.details-section-icon svg, svg.details-section-icon')).toHaveCount(1);
    }
    await expect(page.locator('.manga-synopsis-edit')).toContainText('Edit summary');
    await expect(page.locator('.manga-synopsis-edit svg')).toHaveCount(1);
    await expect(page.locator('.manga-synopsis-card .detail-description')).toHaveAttribute('tabindex','0');
    await expect(page.locator('.site-credit-footer')).toContainText("Taiyou's Manga Library");
    await expect(page.locator('.site-credit-footer')).toContainText('Created by Taiyou');
    await expect(page.locator('.site-credit-footer')).not.toContainText('No cloud progress sync');
    await assertNoHorizontalOverflow(page);
  }
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await expect(page.getByRole('button',{name:'Back to top'})).toBeVisible();
  await page.getByRole('button',{name:'Back to top'}).click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(100);
});

test('Novel catalogue cloud and separate BookDetails header keep keyboard and six-theme parity',async({page})=>{
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:850});
    await page.goto('/');
    const toggle=page.locator('.manga-cloud-menu>summary');
    const glyph=toggle.locator('.cloud-status-icon svg');
    await expect(glyph).toHaveAttribute('width','25');
    await expect(glyph).toHaveAttribute('height','25');
    await expect(glyph).toHaveAttribute('stroke-width','1.9');
    await expect(toggle.locator('.cloud-status-dot.is-disconnected')).toHaveCount(1);
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.manga-cloud-panel')).toBeVisible();
    await expect(page.locator('.manga-cloud-panel')).toContainText('Cloud library settings');
    await page.keyboard.press('Escape');
    await expect(page.locator('.manga-cloud-panel')).toBeHidden();
    await expect(toggle).toBeFocused();

    await page.goto('/manga/mng_lanternarchive');
    await expect(page.locator('.manga-details-topbar')).toBeVisible();
    await expect(page.locator('.site-header')).toHaveCount(0);
    await expect(page.locator('.manga-cloud-menu')).toHaveCount(0);
    const choose=page.getByRole('button',{name:/Choose colour theme/});
    await choose.click();
    const menu=page.locator('.manga-theme-menu-panel');
    await expect(menu.getByRole('button',{name:/Use .* theme/})).toHaveCount(6);
    await expect(menu.getByRole('button',{name:'Use Paper theme'})).toBeVisible();
    await menu.getByRole('button',{name:'Use Paper theme'}).click();
    await expect(page.locator('.app-shell')).toHaveClass(/theme-paper/);
    await expect(menu).toHaveCount(0);
    await choose.click();
    await menu.getByRole('button',{name:'Use Charcoal theme'}).click();
    await expect(page.locator('.app-shell')).toHaveClass(/theme-charcoal/);
    await assertNoHorizontalOverflow(page);
  }
});
