// Playwright E2E tests for Mona Mayhem battle flow
// How to run:
// 1) Install deps: npm install
// 2) Install Playwright browsers (only needed once): npx playwright install
// 3) Start dev server in another terminal: npm run dev
// 4) Run tests: npm run test:e2e
// Notes: These tests assume the app is available at http://localhost:3000
// If you cannot or do not want to install Playwright/browsers in CI, do not run these here.

import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

// Helper fixtures: provides deterministic mock responses for API routes
const mockResponses = {
  octocat: { weeks: [ { days: [ { count: 2 }, { count: 3 }, { count: 1 } ] } ] },
  torvalds: { weeks: [ { days: [ { count: 5 }, { count: 4 }, { count: 3 } ] } ] },
  nouserfound: 404
};

async function routeContributions(route) {
  const url = route.request().url();
  const m = url.match(/\/api\/contributions\/(.+)$/);
  if (!m) return route.continue();
  const user = decodeURIComponent(m[1]);
  const resp = mockResponses[user];
  if (resp === undefined) return route.continue();
  if (resp === 404) return route.fulfill({ status: 404, body: 'Not found' });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
}

// Basic smoke: load page and show form
test('loads main page and shows battle form', async ({ page }) => {
  await page.route('**/api/contributions/*', routeContributions);
  await page.goto(BASE + '/');
  await expect(page.locator('#battle-form')).toBeVisible();
  await expect(page.locator('#player1')).toBeVisible();
  await expect(page.locator('#player2')).toBeVisible();
  await expect(page.locator('#battle-btn')).toBeVisible();
});

// Successful battle flow
test('enter two valid users and click Battle shows results and grids', async ({ page }) => {
  await page.route('**/api/contributions/*', routeContributions);
  await page.goto(BASE + '/');
  await page.fill('#player1', 'octocat');
  await page.fill('#player2', 'torvalds');
  await page.click('#battle-btn');
  // results should contain two player blocks and a winner message
  await expect(page.locator('#results .player')).toHaveCount(2);
  await expect(page.locator('#results .winner')).toBeVisible();
  // small-grid cells must render for both players
  await expect(page.locator('#results .small-grid')).toHaveCount(2);
});

// Validation: empty fields
test('shows validation error when fields are empty', async ({ page }) => {
  await page.route('**/api/contributions/*', routeContributions);
  await page.goto(BASE + '/');
  await page.click('#battle-btn');
  await expect(page.locator('#results')).toContainText('Please enter two valid GitHub usernames.');
});

// Validation: invalid username pattern (contains space)
test('shows validation error for invalid username pattern', async ({ page }) => {
  await page.route('**/api/contributions/*', routeContributions);
  await page.goto(BASE + '/');
  await page.fill('#player1', 'bad user');
  await page.fill('#player2', 'torvalds');
  await page.click('#battle-btn');
  await expect(page.locator('#results')).toContainText('Please enter two valid GitHub usernames.');
});

// API 404 path
test('handles upstream 404 (user not found) gracefully', async ({ page }) => {
  await page.route('**/api/contributions/*', routeContributions);
  await page.goto(BASE + '/');
  await page.fill('#player1', 'octocat');
  await page.fill('#player2', 'nouserfound');
  await page.click('#battle-btn');
  // one of the player blocks should show "User not found"
  await expect(page.locator('#results .player .error')).toContainText('User not found');
});

// Keyboard Enter triggers battle
test('press Enter in input triggers battle', async ({ page }) => {
  await page.route('**/api/contributions/*', routeContributions);
  await page.goto(BASE + '/');
  await page.fill('#player1', 'octocat');
  await page.fill('#player2', 'torvalds');
  await page.focus('#player2');
  await page.keyboard.press('Enter');
  await expect(page.locator('#results .player')).toHaveCount(2);
});
