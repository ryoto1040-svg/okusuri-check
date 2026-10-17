import { defineConfig } from '@playwright/test';
import { normalizeBasePath } from './shared/basePath';
const siteUrl = `http://127.0.0.1:4173${normalizeBasePath(process.env.VITE_BASE_PATH ?? '/')}`;
export default defineConfig({
  testDir: 'tests/browser',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: siteUrl,
    headless: true,
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        (process.platform === 'win32'
          ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
          : undefined),
    },
    trace: 'retain-on-failure',
  },
  reporter: 'list',
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
    url: siteUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
