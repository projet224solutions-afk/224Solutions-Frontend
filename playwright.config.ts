import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-tests 224Solutions — démarrent l'app dans un vrai navigateur et
 * vérifient qu'aucune page critique ne plante (attrape les erreurs runtime
 * type "t is not defined" que tsc ne voit pas).
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Démarre automatiquement le dev server (réutilise celui déjà lancé en local)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
