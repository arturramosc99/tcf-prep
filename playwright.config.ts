// End-to-end tests. Everything runs offline: the app talks to e2e/mock-api.ts instead of Anthropic/OpenAI,
// and stores data in a throwaway PGlite folder. Run with `npm run test:e2e`.
import { defineConfig, devices } from '@playwright/test';

import { STATE } from './e2e/helpers';

const PORT = 3100;
const MOCK = 4999;

// Set every variable explicitly: `next start` also reads .env.local, and a developer's personal
// settings (database, keys, history import) must never leak into a test run.
const appEnv = {
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_TELEMETRY_DISABLED: '1',
  PGLITE_DIR: '.data/e2e',
  DATABASE_URL: '',
  POSTGRES_URL: '',
  LEGACY_DIR: 'e2e/fixtures/no-legacy',
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
  APP_PASSWORD: '',
  CLAUDE_CLI_FALLBACK: '0',
  SESSION_SECRET: 'e2e-session-secret-not-used-anywhere-else',
  ANTHROPIC_BASE_URL: `http://localhost:${MOCK}`,
  OPENAI_BASE_URL: `http://localhost:${MOCK}/openai/v1`,
  // tests reach the 'Claude writes a new prompt' path after one simulation; screenshots show the real bank
  CONSIGNES_BANK_LIMIT: process.env.SCREENSHOTS ? '' : '1',
};

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } };
const sizes = {
  mobile: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  tablet: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 800 } },
};
const matrix = Object.entries(sizes).flatMap(([size, use]) => (['light', 'dark'] as const).map((colorScheme) => ({
  name: `layout-${size}-${colorScheme}`,
  testMatch: /layout\.spec\.ts/,
  dependencies: ['setup'],
  use: { ...devices['Desktop Chrome'], ...use, colorScheme, storageState: STATE },
})));

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node --import tsx e2e/mock-api.ts', port: MOCK, reuseExistingServer: false },
    {
      command: `rm -rf .data/e2e && next build && next start -p ${PORT}`,
      port: PORT, env: appEnv, timeout: 300_000, reuseExistingServer: false,
    },
  ],
  projects: [
    { name: 'setup', testMatch: /setup\.ts/, use: desktop },
    { name: 'app', testMatch: /\.spec\.ts/, testIgnore: /layout\.spec\.ts/, dependencies: ['setup'], use: { ...desktop, storageState: STATE } },
    ...matrix,
    // only with `npm run screenshots`
    ...(process.env.SCREENSHOTS ? [{ name: 'screenshots', testMatch: /screenshots\.ts/, dependencies: ['setup'], use: { ...desktop, storageState: STATE, colorScheme: 'light' as const } }] : []),
  ],
});
