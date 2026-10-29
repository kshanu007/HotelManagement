import { defineConfig, devices } from '@playwright/test';
const apiPort = process.env.E2E_API_PORT ?? '5000';
const webPort = process.env.E2E_WEB_PORT ?? '5173';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: `http://localhost:${webPort}`, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npx tsx scripts/e2e-server.ts',
      url: `http://127.0.0.1:${apiPort}/ready`,
      reuseExistingServer: false,
      timeout: 180000,
    },
    {
      command: `npm run dev -w @annapurna/web -- --port ${webPort} --strictPort`,
      url: `http://localhost:${webPort}`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
