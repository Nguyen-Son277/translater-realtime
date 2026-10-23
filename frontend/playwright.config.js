import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 8000 },
  use: { baseURL: 'http://127.0.0.1:5179', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: `${process.env.PYTHON || '../.venv/bin/python'} -m uvicorn tests.e2e_server:app --app-dir ../backend --host 127.0.0.1 --port 8009`, url: 'http://127.0.0.1:8009/health/live', reuseExistingServer: !process.env.CI },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5179', url: 'http://127.0.0.1:5179', env: { VITE_PROXY_TARGET: 'http://127.0.0.1:8009' }, reuseExistingServer: !process.env.CI },
  ],
});
