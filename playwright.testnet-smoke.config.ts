import { defineConfig, devices } from "@playwright/test";

/**
 * Opt-in deployed testnet payment smoke suite.
 *
 * Required environment variables:
 * - LUMENBAZAAR_TESTNET_SMOKE=1
 * - LUMENBAZAAR_TESTNET_FRONTEND_URL=https://<deployed-frontend>
 * - LUMENBAZAAR_TESTNET_API_URL=https://<deployed-backend>
 *
 * Optional:
 * - LUMENBAZAAR_TESTNET_RESOURCE_ID=<active-paid-resource-id>
 * - LUMENBAZAAR_TESTNET_RECEIPT_ID=<public-receipt-id>
 * - FREIGHTER_EXTENSION_PATH=<unpacked-extension-dir> for manual wallet runs
 *
 * No funded secret is required or accepted. Wallet signature and settlement
 * steps stay manual unless a reviewer supplies a local wallet extension.
 */

const frontendUrl = process.env.LUMENBAZAAR_TESTNET_FRONTEND_URL;
const apiUrl = process.env.LUMENBAZAAR_TESTNET_API_URL;
const extensionPath = process.env.FREIGHTER_EXTENSION_PATH;

if (process.env.LUMENBAZAAR_TESTNET_SMOKE !== "1") {
  throw new Error(
    "Set LUMENBAZAAR_TESTNET_SMOKE=1 to run the deployed testnet payment smoke suite."
  );
}

if (!frontendUrl || !apiUrl) {
  throw new Error(
    "LUMENBAZAAR_TESTNET_FRONTEND_URL and LUMENBAZAAR_TESTNET_API_URL are required for the deployed testnet payment smoke suite."
  );
}

export default defineConfig({
  expect: {
    timeout: 30_000
  },
  reporter: [["list"]],
  testDir: "./tests/testnet-e2e",
  timeout: 180_000,
  use: {
    baseURL: frontendUrl,
    headless: extensionPath === undefined,
    launchOptions:
      extensionPath === undefined
        ? undefined
        : {
            args: [
              `--disable-extensions-except=${extensionPath}`,
              `--load-extension=${extensionPath}`
            ]
          },
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "testnet-desktop",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "testnet-mobile",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
