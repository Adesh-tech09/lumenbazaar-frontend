import { expect, test, type Page } from "@playwright/test";

/**
 * API outage and recovery across critical routes.
 *
 * The backend is the deterministic mock server from the release gate. Every API
 * request is intercepted so the test can hold it in a hard outage and then let
 * it reach the real mock backend once the route recovers. No fixtures are
 * substituted for live reads while the API is down.
 */

const apiOrigin = "http://127.0.0.1:8080";

async function apiOutage(page: Page) {
  let online = false;

  await page.route(`${apiOrigin}/**`, async (route) => {
    if (online) {
      await route.continue();
      return;
    }

    await route.abort("failed");
  });

  return {
    recover: () => {
      online = true;
    }
  };
}

test.describe("API outage and recovery", () => {
  test("dashboard reports an outage without showing demo values as live", async ({ page }) => {
    await apiOutage(page);
    await page.goto("/");

    await expect(page.getByText("API unavailable").first()).toBeVisible();
    await expect(page.getByText("Explicit demo data")).toHaveCount(0);
    await expect(
      page.locator('[role="status"]', {
        hasText: "Dashboard data is unavailable from the configured backend."
      })
    ).toBeAttached();
  });

  test("explore retries successfully after the catalog recovers", async ({ page }) => {
    const control = await apiOutage(page);
    await page.goto("/explore");

    await expect(page.getByRole("alert").getByText("Catalog unavailable")).toBeVisible();
    await expect(page.getByText("Release-gated Stellar API")).toHaveCount(0);

    control.recover();
    await page.getByRole("button", { name: "Retry" }).click();

    await expect(page.getByText("Release-gated Stellar API")).toBeVisible();
  });

  test("resource detail announces an outage and recovers on retry", async ({ page }) => {
    const control = await apiOutage(page);
    await page.goto("/resources/resource_release");

    await expect(page.getByRole("alert").getByText("Unable to load resource")).toBeVisible();
    await expect(page.getByText("Release-gated Stellar API")).toHaveCount(0);

    control.recover();
    await page.getByRole("button", { name: "Retry" }).click();

    await expect(page.getByRole("heading", { name: "Release-gated Stellar API" })).toBeVisible();
    await expect(page.getByText("API data")).toBeVisible();
  });

  test("operators report unavailable status without substituting demo data", async ({ page }) => {
    await apiOutage(page);
    await page.goto("/operators");

    await expect(page.getByText("API unavailable").first()).toBeVisible();
    await expect(page.getByText("Explicit demo data")).toHaveCount(0);
  });

  test("transactions and seller screens fail closed while capabilities are unavailable", async ({
    page
  }) => {
    await apiOutage(page);

    await page.goto("/transactions");
    await expect(page.getByRole("alert").getByText("Transactions unavailable")).toBeVisible();

    await page.goto("/seller");
    await expect(page.getByRole("alert").getByText("Seller data unavailable")).toBeVisible();
    await expect(page.getByText("Ready to publish")).toHaveCount(0);
  });
});
