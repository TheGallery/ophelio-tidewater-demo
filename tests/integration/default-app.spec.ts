import { expect, test } from '@playwright/test';

test('serves the scaffolded SvelteKit app', async ({ page }) => {
	await page.goto('/');

	await expect(
		page.getByRole('heading', { name: 'Welcome to SvelteKit' })
	).toBeVisible();
	await expect(
		page.getByRole('link', { name: 'svelte.dev/docs/kit' })
	).toBeVisible();
});
