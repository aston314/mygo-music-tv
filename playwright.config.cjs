const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: '*.spec.cjs',
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:18943', viewport: { width: 1280, height: 720 }, headless: true },
  outputDir: 'tests/results',
  reporter: 'list',
  webServer: { command: 'node tests/preview-server.cjs', url: 'http://127.0.0.1:18943', reuseExistingServer: false, timeout: 120000 }
});
