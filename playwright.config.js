import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npx serve -l ${PORT} --no-clipboard .`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
