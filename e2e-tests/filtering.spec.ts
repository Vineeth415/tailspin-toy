import { test, expect } from '@playwright/test';

test.describe('Game Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('games-grid')).toBeVisible();
  });

  test('filters games by category', async ({ page }) => {
    await test.step('Select the Strategy category', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
    });

    await test.step('Show only strategy games', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).toHaveCount(4);
      await expect(visibleCards.first()).toHaveAttribute('data-game-category', 'Strategy');
    });
  });

  test('filters games by publisher', async ({ page }) => {
    await test.step('Select CodeForge Studios', async () => {
      await page.getByRole('checkbox', { name: 'CodeForge Studios' }).check();
    });

    await test.step('Show only CodeForge Studios games', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).toHaveCount(6);
      await expect(visibleCards.first()).toHaveAttribute('data-game-publisher', 'CodeForge Studios');
    });
  });

  test('combines category and publisher filters', async ({ page }) => {
    await test.step('Select Strategy and CodeForge Studios', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
      await page.getByRole('checkbox', { name: 'CodeForge Studios' }).check();
    });

    await test.step('Show only games matching both filters', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).toHaveCount(1);
      await expect(visibleCards.first().getByTestId('game-title')).toHaveText('DevOps Dominion');
    });
  });
});
