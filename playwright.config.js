import { defineConfig } from '@playwright/test';

const PORT = 4173;
const DESKTOP = { viewport: { width: 1280, height: 800 } };
const MOBILE = { viewport: { width: 375, height: 667 }, hasTouch: true };

// Three engines x two sizes. Limits (see Practice.md section 4):
// - "webkit" is Playwright's WebKit build, the engine behind Safari, not real Safari or an iPhone.
// - Firefox has no mobile mode in Playwright (isMobile is not supported), so "firefox-mobile"
//   is desktop Firefox in a narrow window with touch enabled.
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  // Firefox's software renderer crashed and timed out with 4 parallel browsers on this machine.
  workers: 3,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
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
  webServer: {
    command: `npx serve -l ${PORT} --no-clipboard .`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
