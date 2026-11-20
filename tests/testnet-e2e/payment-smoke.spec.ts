import { expect, test } from "@playwright/test";

/**
 * Deployed testnet payment smoke suite.
 *
 * Public reads run without credentials. The suite never installs fixture
 * interception: every assertion below uses the deployed frontend and backend.
 * Wallet signature and settlement remain manual, and are skipped unless a
 * reviewer supplies a local Freighter extension.
 */

const frontendUrl = process.env.LUMENBAZAAR_TESTNET_FRONTEND_URL ?? "";
const apiUrl = process.env.LUMENBAZAAR_TESTNET_API_URL ?? "";
const configuredResourceId = process.env.LUMENBAZAAR_TESTNET_RESOURCE_ID;
const configuredReceiptId = process.env.LUMENBAZAAR_TESTNET_RECEIPT_ID;

type DiscoveryResource = {
  amount?: string;
  id: string;
  name: string;
  network?: string;
  status?: string;
};

test.describe("Deployed testnet payment smoke", () => {
  test("captures deployment and commit metadata", async ({ request }) => {
    const versionResponse = await request.get(`${apiUrl}/version`);

    expect(versionResponse.ok()).toBe(true);
    const version = await versionResponse.json();

    await test.info().attach("testnet-commit-metadata", {
      body: JSON.stringify(
        {
          apiUrl,
          backendCommit: version.commit ?? "unknown",
          capturedAt: new Date().toISOString(),
          frontendUrl,
          frontendCommit: process.env.LUMENBAZAAR_RELEASE_COMMIT ?? "unknown",
          resourceId: configuredResourceId ?? "discovered",
          receiptId: configuredReceiptId ?? "not-requested"
        },
        null,
        2
      ),
      contentType: "application/json"
    });
  });

  test("public readiness and supported networks respond without credentials", async ({
    request
  }) => {
    const ready = await request.get(`${apiUrl}/ready`);
    expect(ready.ok()).toBe(true);
    const readiness = await ready.json();
    expect(readiness.ok).toBe(true);
    expect(readiness.capabilities?.exact).toBe(true);

    const supported = await request.get(`${apiUrl}/v1/supported`);
    expect(supported.ok()).toBe(true);
    const schemes = await supported.json();
    const exact = schemes.kinds?.find(
      (kind: { scheme: string; x402Version: number }) =>
        kind.scheme === "exact" && kind.x402Version === 2
    );
    expect(exact, "deployed backend advertises x402 v2 exact").toBeDefined();
  });

  test("discovery returns a paid testnet resource", async ({ request }) => {
    const response = await request.get(`${apiUrl}/v1/discovery/search?query=stellar`);
    expect(response.ok()).toBe(true);

    const search = await response.json();
    expect(Array.isArray(search.resources)).toBe(true);

    if (configuredResourceId === undefined) {
      test.info().annotations.push({
        description: "Set LUMENBAZAAR_TESTNET_RESOURCE_ID to pin a reviewed resource.",
        type: "note"
      });
    }

    const resource: DiscoveryResource | undefined =
      configuredResourceId === undefined
        ? search.resources[0]
        : search.resources.find(
            (candidate: DiscoveryResource) => candidate.id === configuredResourceId
          );

    expect(resource, "discovery returns at least one active paid resource").toBeDefined();
    expect(resource?.network).toBe("stellar:testnet");
    expect(resource?.status).not.toBe("archived");
  });

  test("frontend renders discovery through payment terms without demo data", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Demo data")).toHaveCount(0);
    await expect(page.getByText(/testnet mode/)).toBeVisible();

    await page.goto("/explore");
    await expect(page.getByText("Catalog unavailable")).toHaveCount(0);

    const inspect = page.getByRole("link", { name: /Inspect/ }).first();
    if ((await inspect.count()) === 0) {
      test.skip(true, "Deployed discovery returned no resources to inspect.");
    }

    await inspect.click();
    await expect(page.getByRole("heading", { name: "Payment terms" })).toBeVisible();
    await expect(page.getByText("Demo data")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("receipt display shows public evidence when a receipt ID is supplied", async ({ page }) => {
    test.skip(
      configuredReceiptId === undefined,
      "Set LUMENBAZAAR_TESTNET_RECEIPT_ID to a public testnet receipt to check receipt display."
    );

    await page.goto(`/receipts/${configuredReceiptId}`);
    await expect(page.getByRole("heading", { name: /receipt/i }).first()).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("wallet signature and settlement remain a manual step", async () => {
    test.skip(
      process.env.FREIGHTER_EXTENSION_PATH === undefined,
      "Wallet signature and settlement stay manual. Supply FREIGHTER_EXTENSION_PATH for a local reviewed run; CI never receives funded secrets."
    );
  });
});
