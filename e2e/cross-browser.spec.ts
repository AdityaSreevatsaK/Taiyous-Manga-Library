import { test, expect, type Page } from '@playwright/test';

/** Lightweight synthetic-only parity checks, never downloads real manga. */
async function noHorizontalScroll(page: Page) {
  const bounds = await page.evaluate(() => ({
    viewport: window.innerWidth,
    actual: document.documentElement.scrollWidth,
  }));
  expect(bounds.actual).toBeLessThanOrEqual(bounds.viewport);
}
test('home, desktop navigation and transparent brand assets work on both engines', async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'The sample collection'})).toBeVisible();
  await expect(page.locator('.manga-nav-links > .site-nav-link')).toHaveCount(8);
  await expect(page.locator('.wordmark .brand-sun')).toHaveAttribute('src',/sun-light.webp$/);
  await expect(page.locator('.app-shell')).toHaveClass(/theme-sepia/);
  await expect(page.locator('.book-card')).toHaveCount(4);
  await noHorizontalScroll(page);
});
test('mobile More and six themes stay accessible at narrow widths', async ({page}) => {
  await page.setViewportSize({width:320,height:768});
  await page.goto('/');
  await expect(page.locator('.manga-nav-links > .site-nav-link')).toHaveCount(3);
  await page.locator('.nav-more summary').click();
  await page.locator('.nav-more-menu').getByRole('link',{name:'Analytics'}).click();
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole('heading',{name:'Analytics'})).toBeVisible();
  const theme=page.getByRole('button',{name:'Use Midnight theme'});
  await theme.click();
  await expect(page.locator('.app-shell')).toHaveClass(/theme-midnight/);
  await page.reload();
  await expect(theme).toHaveAttribute('aria-pressed','true');
  await noHorizontalScroll(page);
});
test('a whole manga chapter scrolls vertically with original page ratios', async ({page}) => {
  await page.goto('/manga/mng_lanternarchive/chapters/ch_lanternopening');
  const reader=page.getByRole('region',{name:'Manga reader, continuous chapter view'});
  await expect(reader).toBeVisible();
  const pages=page.locator('.vertical-page');
  await expect(pages).toHaveCount(5);
  await expect(page.getByRole('button',{name:/Next page/})).toHaveCount(0);
  const ratios=await pages.evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).aspectRatio));
  expect(ratios).toHaveLength(5);
  for(const ratio of ratios)expect(ratio).toMatch(/680\s*\/\s*920/);
  await page.locator('.vertical-page').nth(2).evaluate(el=>el.scrollIntoView({block:'start'}));
  await expect(page.locator('.page-navigation')).toContainText('Page 3 of 5');
  await expect(page.locator('.vertical-page-image')).toHaveCount(3);
  await noHorizontalScroll(page);
});
test('chapter navigation never advances an individual image', async ({page}) => {
  await page.goto('/manga/mng_lanternarchive/chapters/ch_lanternopening');
  await expect(page.locator('.vertical-page')).toHaveCount(5);
  await page.getByRole('button',{name:/Next chapter/}).click();
  await expect(page).toHaveURL(/ch_lanternrooftop/);
  await expect(page.locator('.vertical-page')).toHaveCount(4);
  await expect(page.locator('.page-navigation')).toContainText('Chapter 2 of 3');
  await page.getByRole('button',{name:/Previous chapter/}).click();
  await expect(page).toHaveURL(/ch_lanternopening/);
  await expect(page.locator('.vertical-page')).toHaveCount(5);
  await page.getByRole('button',{name:'Jump to chapter'}).click();
  await expect(page.getByRole('dialog',{name:'Choose chapter'})).toBeVisible();
  await page.locator('.manga-picker-result').filter({hasText:'Afterglow'}).click();
  await expect(page.locator('.vertical-page')).toHaveCount(6);
  await expect(page.getByRole('button',{name:/Next chapter/})).toBeDisabled();
});
test('personal shelves persist without changing publication status',async({page})=>{
  await page.goto('/manga/mng_lanternarchive');
  const original=await page.locator('.detail-sub').textContent();
  await page.getByRole('combobox',{name:'Personal reading shelf'}).selectOption('trying');
  await expect(page.locator('.success-toast')).toContainText('Trying Out');
  await page.goto('/trying');
  await expect(page.locator('.book-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.book-card')).toHaveCount(1);
  await page.goto('/manga/mng_lanternarchive');
  await expect(page.locator('.detail-sub')).toHaveText(original);
});
