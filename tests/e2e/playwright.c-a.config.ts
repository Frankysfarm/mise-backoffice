import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:34279' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: './node_modules/.bin/next dev -p 34279',
    cwd: process.cwd(),
    url: 'http://localhost:34279/login',
    reuseExistingServer: false,
  },
});
