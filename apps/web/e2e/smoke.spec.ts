import { expect, test } from '@playwright/test';

test('landing page renders the foundation overview', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Plan work. Ship together.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open workspace' })).toBeVisible();
  await expect(page.getByText('Hardened API shell')).toBeVisible();
});

test('unknown routes show the not-found page', async ({ page }) => {
  await page.goto('/does-not-exist');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
