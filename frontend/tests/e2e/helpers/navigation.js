import { expect } from '@playwright/test';

export async function openHeaderMenu(page) {
  const toggle = page.locator('button.header-menu-toggle');
  await toggle.waitFor({ state: 'attached' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
}
