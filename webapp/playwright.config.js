import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/microbit-input/browser', timeout: 20000, fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, trace: 'retain-on-failure' },
  outputDir: 'build/browser-results', reporter: [['list']],
  webServer: { command: `"${process.execPath}" verification/serve-input.js`, url: 'http://127.0.0.1:4173/examples/microbit-input/', reuseExistingServer: !process.env.CI }
});
