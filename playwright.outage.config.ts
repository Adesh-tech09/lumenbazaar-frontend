import { defineConfig, devices } from "@playwright/test";

/**
 * Outage/recovery gate.
 *
 * Runs the production build against the deterministic mock backend so each
 * critical route can be switched between a hard API outage and a healthy
 * backend inside a single browser test.
 */
export default defineConfig({
  expect: {
    timeout: 15_000
  },
  reporter: [["list"]],
  testDir: "./tests/outage-e2e",
  timeout: 120_000,
  use: {
    baseURL: "http://127.0.0.1:3102",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "node tests/release-e2e/mock-server.mjs",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://127.0.0.1:8080/version"
    },
    {
      command: "pnpm build && pnpm start --hostname 127.0.0.1 --port 3102",
      env: {
        NEXT_PUBLIC_ENABLE_MAINNET: "false",
        NEXT_PUBLIC_ENABLE_UPTO_SESSIONS: "false",
        NEXT_PUBLIC_LUMENBAZAAR_API_URL: "http://127.0.0.1:8080",
        NEXT_PUBLIC_LUMENBAZAAR_DEFAULT_NETWORK: "stellar:testnet",
        NEXT_PUBLIC_LUMENBAZAAR_ENV: "testnet"
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      url: "http://127.0.0.1:3102"
    }
  ],
  projects: [
    {
      name: "outage-desktop",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "outage-mobile",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
