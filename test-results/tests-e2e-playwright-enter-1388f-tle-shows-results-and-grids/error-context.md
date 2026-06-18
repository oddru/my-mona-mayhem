# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\playwright.spec.js >> enter two valid users and click Battle shows results and grids
- Location: tests\e2e\playwright.spec.js:43:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('#results .player')
Expected: 2
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('#results .player')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic [ref=e3]:
    - heading "Mona Mayhem" [level=1] [ref=e4]
    - paragraph [ref=e5]: GitHub Contribution Battle Arena — enter two usernames and battle!
  - generic [ref=e6]:
    - generic [ref=e7]:
      - text: Player 1
      - textbox "Player 1" [disabled] [ref=e8]: octocat
    - generic [ref=e9]:
      - text: Player 2
      - textbox "Player 2" [disabled] [ref=e10]: torvalds
    - button "Battle!" [disabled] [ref=e11]: Battle!Battling…
  - generic [ref=e12]:
    - generic [ref=e14]: octocat
    - generic [ref=e16]: VS
    - generic [ref=e17]:
      - generic [ref=e18]: torvalds
      - generic [ref=e19]: No data
  - generic [ref=e20]: Mona Mayhem — Retro edition
```

# Test source

```ts
  1  | // Playwright E2E tests for Mona Mayhem battle flow
  2  | // How to run:
  3  | // 1) Install deps: npm install
  4  | // 2) Install Playwright browsers (only needed once): npx playwright install
  5  | // 3) Start dev server in another terminal: npm run dev
  6  | // 4) Run tests: npm run test:e2e
  7  | // Notes: These tests assume the app is available at http://localhost:3000
  8  | // If you cannot or do not want to install Playwright/browsers in CI, do not run these here.
  9  | 
  10 | import { test, expect } from '@playwright/test';
  11 | 
  12 | const BASE = process.env.BASE_URL || 'http://localhost:3000';
  13 | 
  14 | // Helper fixtures: provides deterministic mock responses for API routes
  15 | const mockResponses = {
  16 |   octocat: { weeks: [ { days: [ { count: 2 }, { count: 3 }, { count: 1 } ] } ] },
  17 |   torvalds: { weeks: [ { days: [ { count: 5 }, { count: 4 }, { count: 3 } ] } ] },
  18 |   nouserfound: 404
  19 | };
  20 | 
  21 | async function routeContributions(route) {
  22 |   const url = route.request().url();
  23 |   const m = url.match(/\/api\/contributions\/(.+)$/);
  24 |   if (!m) return route.continue();
  25 |   const user = decodeURIComponent(m[1]);
  26 |   const resp = mockResponses[user];
  27 |   if (resp === undefined) return route.continue();
  28 |   if (resp === 404) return route.fulfill({ status: 404, body: 'Not found' });
  29 |   return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
  30 | }
  31 | 
  32 | // Basic smoke: load page and show form
  33 | test('loads main page and shows battle form', async ({ page }) => {
  34 |   await page.route('**/api/contributions/*', routeContributions);
  35 |   await page.goto(BASE + '/');
  36 |   await expect(page.locator('#battle-form')).toBeVisible();
  37 |   await expect(page.locator('#player1')).toBeVisible();
  38 |   await expect(page.locator('#player2')).toBeVisible();
  39 |   await expect(page.locator('#battle-btn')).toBeVisible();
  40 | });
  41 | 
  42 | // Successful battle flow
  43 | test('enter two valid users and click Battle shows results and grids', async ({ page }) => {
  44 |   await page.route('**/api/contributions/*', routeContributions);
  45 |   await page.goto(BASE + '/');
  46 |   await page.fill('#player1', 'octocat');
  47 |   await page.fill('#player2', 'torvalds');
  48 |   await page.click('#battle-btn');
  49 |   // results should contain two player blocks and a winner message
> 50 |   await expect(page.locator('#results .player')).toHaveCount(2);
     |                                                  ^ Error: expect(locator).toHaveCount(expected) failed
  51 |   await expect(page.locator('#results .winner')).toBeVisible();
  52 |   // small-grid cells must render for both players
  53 |   await expect(page.locator('#results .small-grid')).toHaveCount(2);
  54 | });
  55 | 
  56 | // Validation: empty fields
  57 | test('shows validation error when fields are empty', async ({ page }) => {
  58 |   await page.route('**/api/contributions/*', routeContributions);
  59 |   await page.goto(BASE + '/');
  60 |   await page.click('#battle-btn');
  61 |   await expect(page.locator('#results')).toContainText('Please enter two valid GitHub usernames.');
  62 | });
  63 | 
  64 | // Validation: invalid username pattern (contains space)
  65 | test('shows validation error for invalid username pattern', async ({ page }) => {
  66 |   await page.route('**/api/contributions/*', routeContributions);
  67 |   await page.goto(BASE + '/');
  68 |   await page.fill('#player1', 'bad user');
  69 |   await page.fill('#player2', 'torvalds');
  70 |   await page.click('#battle-btn');
  71 |   await expect(page.locator('#results')).toContainText('Please enter two valid GitHub usernames.');
  72 | });
  73 | 
  74 | // API 404 path
  75 | test('handles upstream 404 (user not found) gracefully', async ({ page }) => {
  76 |   await page.route('**/api/contributions/*', routeContributions);
  77 |   await page.goto(BASE + '/');
  78 |   await page.fill('#player1', 'octocat');
  79 |   await page.fill('#player2', 'nouserfound');
  80 |   await page.click('#battle-btn');
  81 |   // one of the player blocks should show "User not found"
  82 |   await expect(page.locator('#results .player .error')).toContainText('User not found');
  83 | });
  84 | 
  85 | // Keyboard Enter triggers battle
  86 | test('press Enter in input triggers battle', async ({ page }) => {
  87 |   await page.route('**/api/contributions/*', routeContributions);
  88 |   await page.goto(BASE + '/');
  89 |   await page.fill('#player1', 'octocat');
  90 |   await page.fill('#player2', 'torvalds');
  91 |   await page.focus('#player2');
  92 |   await page.keyboard.press('Enter');
  93 |   await expect(page.locator('#results .player')).toHaveCount(2);
  94 | });
  95 | 
```