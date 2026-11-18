import { expect, test, type Page } from '@playwright/test';

async function openSampleReader(page: Page) {
  await page.goto('/');
  await page.locator('.book-card').filter({ hasText: 'The Lantern Archive' }).click();
  await expect(page.getByRole('heading', { name: 'The Lantern Archive' })).toBeVisible();
  await page.getByRole('button', { name: /Read from beginning/ }).click();
  await expect(page.locator('.reader-page')).toBeVisible();
  await expect(page.getByRole('button', { name: /Next page/ })).toBeEnabled();
  await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
}

test.describe('local manga catalogue and chapter reader', () => {
  for (const width of [320, 375, 390, 768, 1280]) {
    test('responsive shelf and details at ' + width + 'px', async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'The sample collection' })).toBeVisible();
      await expect(page.locator('.book-card')).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.locator('.book-card').first().click();
      await expect(page.getByRole('heading', { name: 'Chapters & volumes' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole('button', { name: /Read from beginning/ }).click();
      await expect(page.locator('.reader-page')).toBeVisible();
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
  test('RTL/LTR/vertical arrows and exact page resume within the tab', async ({ page }) => {
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
    await reader.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.page-navigation')).toContainText('Page 4 of 5');
    await page.getByRole('button', { name: /Series details/ }).click();
    await page.getByRole('button', { name: /Continue reading/ }).click();
    await expect(page.locator('.page-navigation')).toContainText('Page 4 of 5');
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
    await page.getByRole('button', { name: /Series details/ }).click();
    await page.getByRole('button', { name: /Continue reading/ }).click();
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
    await page.getByRole('button', { name: /Read from beginning/ }).click();
    await expect(page.getByRole('alert')).toContainText('generated page could not be displayed');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
    await expect(page.getByRole('button', { name: /Next page/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Previous page/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Retry page' }).click();
    await expect(page.getByRole('alert')).toContainText('generated page could not be displayed');
    await expect(page.locator('.page-navigation')).toContainText('Page 1 of 5');
    await page.getByRole('button', { name: /Series details/ }).click();
    // A page that could not load must never be falsely recorded as read.
    await expect(page.getByRole('button', { name: /Read from beginning/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue reading/ })).toHaveCount(0);
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
