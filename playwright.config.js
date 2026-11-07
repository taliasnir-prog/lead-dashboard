import { defineConfig } from '@playwright/test';

// Where the tests run:
// - without BASE_URL: against a local server that serves the project under /lead-dashboard/,
//   the same path as GitHub Pages (tests/support/static-server.mjs)
// - with BASE_URL (for example https://taliasnir-prog.github.io/lead-dashboard/): against that
//   address only, and no local server is started
// Tests navigate with page.goto('./'), never '/', so they stay under /lead-dashboard/.
const PORT = 4173;
const LOCAL_URL = `http://localhost:${PORT}/lead-dashboard/`;
const withSlash = (u) => (u.endsWith('/') ? u : `${u}/`);
const BASE_URL = process.env.BASE_URL ? withSlash(process.env.BASE_URL) : LOCAL_URL;
const REMOTE = Boolean(process.env.BASE_URL);

const DESKTOP = { viewport: { width: 1280, height: 800 } };
const MOBILE = { viewport: { width: 375, height: 667 }, hasTouch: true };

// Three engines x two sizes. Limits (see Practice.md section 4):
// - "webkit" is Playwright's WebKit build, the engine behind Safari, not real Safari or an iPhone.
// - Firefox has no mobile mode in Playwright (isMobile is not supported), so "firefox-mobile"
//   is desktop Firefox in a narrow window with touch enabled.
// Every test gets a new, isolated browser context (empty localStorage, no cookies), and only
// writes fictional demo data, also when running against the public address.
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  // Firefox's software renderer crashed and timed out with 4 parallel browsers on this machine.
  workers: 3,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', ...DESKTOP } },
    { name: 'chromium-mobile', use: { browserName: 'chromium', ...MOBILE, isMobile: true } },
    { name: 'firefox-desktop', use: { browserName: 'firefox', ...DESKTOP } },
    { name: 'firefox-mobile', use: { browserName: 'firefox', ...MOBILE } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', ...DESKTOP } },
    { name: 'webkit-mobile', use: { browserName: 'webkit', ...MOBILE, isMobile: true } },
  ],
  webServer: REMOTE ? undefined : {
    command: `node tests/support/static-server.mjs`,
    url: LOCAL_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
