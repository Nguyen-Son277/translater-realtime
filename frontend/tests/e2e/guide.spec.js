import { test, expect } from '@playwright/test';
import { groupedArticles } from '../../src/guide/index.js';

const SLUGS = [
  'tong-quan', 'bat-dau-nhanh', 'tai-khoan', 'trang-chu', 'tao-cuoc-tro-chuyen', 'tham-gia',
  'trong-phong', 'micro', 'nguoi-noi', 'doc-hoi-thoai', 'moi-nguoi', 'trang-thai-doi-phuong',
  'so-sanh', 'ngon-ngu', 'lich-su', 'khach', 'su-co', 'gioi-han',
];

test('the guide index is public, lists every guide as a link and holds no guide body', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/guide');

  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hướng dẫn sử dụng Song Ngữ');
  const cards = page.locator('.guide-card');
  await expect(cards).toHaveCount(18);
  // The index must be a link hub, not the guides themselves.
  await expect(page.locator('.guide-content')).toHaveCount(0);

  // The index shows every guide once, in the curated group order.
  const expectedOrder = groupedArticles().flatMap(group => group.items.map(article => `/guide/${article.slug}`));
  const hrefs = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  expect(hrefs).toEqual(expectedOrder);
  expect([...hrefs].sort()).toEqual(SLUGS.map(slug => `/guide/${slug}`).sort());
  for (const card of await cards.all()) {
    const box = await card.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(errors).toEqual([]);
});

for (const slug of SLUGS) test(`guide page /guide/${slug} renders one guide with working navigation`, async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`/guide/${slug}`);

  await expect(page).toHaveURL(new RegExp(`/guide/${slug}$`));
  await expect(page.locator('main article')).toHaveCount(1);
  await expect(page.locator('#guide-article-title')).not.toBeEmpty();

  // Exactly one guide per page: never a stacked index of all sections.
  expect(await page.locator('.guide-content > *').count()).toBeGreaterThan(0);
  await expect(page.locator('.guide-card')).toHaveCount(0);

  // Breadcrumb links back to the index, and the index shows every guide again.
  await page.getByRole('navigation', { name: 'Đường dẫn hướng dẫn' }).getByRole('link', { name: 'Hướng dẫn sử dụng' }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.locator('.guide-card')).toHaveCount(18);
  expect(errors).toEqual([]);
});

test('previous/next navigation walks all guides in order and stops at both ends', async ({ page }) => {
  await page.goto('/guide/tong-quan');
  const nav = page.getByRole('navigation', { name: 'Điều hướng giữa các hướng dẫn' });
  await expect(nav.getByRole('link', { name: /Trước/ })).toHaveCount(0);

  for (let index = 0; index < SLUGS.length - 1; index += 1) {
    await nav.getByRole('link', { name: /Sau/ }).click();
    await expect(page).toHaveURL(new RegExp(`/guide/${SLUGS[index + 1]}$`));
    await expect(page.locator('#guide-article-title')).not.toBeEmpty();
  }
  await expect(nav.getByRole('link', { name: /Sau/ })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Tất cả hướng dẫn' }).click();
  await expect(page).toHaveURL(/\/guide$/);
});

test('an unknown guide slug explains the problem instead of failing', async ({ page }) => {
  await page.goto('/guide/khong-ton-tai');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Không tìm thấy hướng dẫn');
  await page.getByRole('link', { name: 'Tất cả hướng dẫn' }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.locator('.guide-card')).toHaveCount(18);
});

test('guide pages and the index reflow at narrow widths and keep wide tables scrollable', async ({ page }) => {
  for (const path of ['/guide', '/guide/su-co', '/guide/so-sanh', '/guide/micro']) {
    await page.goto(path);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} at ${width}px`).toBe(true);
    }
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/guide/su-co');
  const wraps = page.locator('.guide-table-wrap');
  expect(await wraps.count()).toBeGreaterThan(0);
  for (const wrap of await wraps.all()) {
    expect(await wrap.evaluate(element => getComputedStyle(element).overflowX)).toBe('auto');
  }

  // Enlarged browser text must not create horizontal overflow either.
  for (const path of ['/guide', '/guide/su-co']) {
    await page.goto(path);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.setViewportSize({ width: 390, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} at 200%`).toBe(true);
  }
});

test('the whole guide follows the interface language', async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hướng dẫn sử dụng Song Ngữ');
  await expect(page.locator('.guide-card').first()).toContainText('Tổng quan');

  await page.getByRole('combobox', { name: 'Chọn ngôn ngữ giao diện' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Song Ngữ user guide');
  await expect(page.locator('.guide-card').first()).toContainText('Overview');
  await expect(page.getByText(/only (?:written )?in Vietnamese/)).toHaveCount(0);

  await page.goto('/guide/micro');
  // Titles come from the article data, so the page must show the `en` title exactly.
  const { default: micro } = await import('../../src/guide/articles/micro.js');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(micro.titles.en.title);
  await expect(page.locator('.guide-content')).toContainText(micro.blocks.en.find(block => block.type === 'list').items[0].slice(0, 30).replaceAll('**', ''));
  await expect(page.getByRole('navigation', { name: 'Guide navigation' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Select interface language' }).selectOption('zh-CN');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(micro.titles['zh-CN'].title);
  await expect(page.locator('.guide-content')).toContainText('开始聆听');

  await page.goto('/guide');
  await expect(page.locator('.guide-card').first()).toContainText('总览');
  await page.getByRole('combobox', { name: '选择界面语言' }).selectOption('vi');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hướng dẫn sử dụng Song Ngữ');
});

test('the shared header and the login page link to the guide index', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Hướng dẫn sử dụng' }).click();
  await expect(page).toHaveURL(/\/guide$/);

  await page.goto('/guide/micro');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Hướng dẫn sử dụng' })).toBeVisible();
  await header.getByRole('link', { name: 'Hướng dẫn sử dụng' }).click();
  await expect(page).toHaveURL(/\/guide$/);
});
