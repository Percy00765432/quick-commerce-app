# QuickCompare

QuickCompare is a Next.js app that compares grocery and quick-commerce prices across platforms like Blinkit and Zepto.

It uses:
- Next.js App Router for the UI and API route
- Playwright for live scraping
- a custom matcher for brand, unit, and size-aware product grouping

## What It Does

You enter:
- a product query like `milk`, `tomato`, or `atta`
- a 6-digit PIN code

The app then:
- sets location on supported platforms using the PIN code
- scrapes live product listings
- groups matching products across stores
- shows the cheapest visible option

## Requirements

Install these before running the project:
- Node.js 20+ recommended
- npm

Playwright's Chromium browser is also required and is installed separately during setup.

## Local Setup

### 1. Clone or copy the project

```bash
git clone <your-repo-url>
cd quick-commerce-app
```

If you are moving it to another PC without Git, copying the whole project folder also works.

### 2. Install dependencies

```bash
npm install
```

If PowerShell blocks `npm`, use:

```powershell
npm.cmd install
```

### 3. Install Playwright Chromium

```bash
npx playwright install chromium
```

If PowerShell blocks `npx`, use:

```powershell
npx.cmd playwright install chromium
```

### 4. Create the environment file

Copy `.env.example` to `.env`.

Example:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
PLAYWRIGHT_HEADLESS=true
```

Notes:
- `DATABASE_URL` is present in `.env.example`, but the current live search flow does not require the database path.
- You can still keep it there for future Prisma work.

### 5. Start the app

```bash
npm run dev
```

Or in PowerShell:

```powershell
npm.cmd run dev
```

Then open:

```text
http://localhost:3000
```

## Running on Another PC

If you push the project to GitHub, setup on another PC is basically:

```bash
git clone <your-repo-url>
cd quick-commerce-app
npm install
npx playwright install chromium
npm run dev
```

If the other PC is Windows PowerShell and scripts are blocked:

```powershell
npm.cmd install
npx.cmd playwright install chromium
npm.cmd run dev
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Useful Test Commands

Type check:

```bash
node_modules/.bin/tsc --noEmit
```

Windows PowerShell:

```powershell
node_modules\.bin\tsc.cmd --noEmit
```

Matcher test:

```bash
node_modules/.bin/jiti scripts/test-matcher.ts
```

Scraper smoke test:

```bash
node_modules/.bin/jiti scripts/test-scrapers.ts milk 560001
```

Windows PowerShell:

```powershell
node_modules\.bin\jiti.cmd scripts\test-scrapers.ts milk 560001
```

## Project Structure

```text
app/
  api/search/route.ts      API route that runs scrapers and matcher
  page.tsx                 Main UI
components/
  SearchBar.tsx
  ComparisonGrid.tsx
  ProductCard.tsx
lib/
  matcher.ts               Product grouping and normalization logic
  platforms.ts             Platform metadata
scrapers/
  blinkit.ts
  zepto.ts
scripts/
  test-matcher.ts
  test-scrapers.ts
```

## Notes and Gotchas

- This app depends on live scraping, so platform UI changes can break selectors.
- PIN code support now affects the scraper location flow, but some unsupported PINs may still behave inconsistently across platforms.
- Playwright must be installed on each machine where you run the project.
- The repo ignores generated scraper screenshots and DOM dumps, so they should not be pushed accidentally.

## Build Check

To verify the app compiles:

```bash
npm run build
```

## Troubleshooting

### `npm` or `npx` is blocked in PowerShell

Use `npm.cmd` and `npx.cmd` instead.

### Fonts or UI changes are not updating

Try:

1. `Ctrl + Shift + R` in the browser
2. restarting the dev server

### Playwright scraping fails

Reinstall Chromium:

```bash
npx playwright install chromium
```

### Port 3000 is already in use

Run Next on another port:

```bash
npx next dev --port 3001
```

Then open `http://localhost:3001`.
