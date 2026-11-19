import { describe, expect, it } from "vitest";

import { loadPaymentActivity } from "./payments";
import {
  deleteSavedView,
  loadSavedViews,
  parseTransactionFilterParams,
  saveSavedView,
  toPaymentActivityFilters,
  validateTransactionFilters,
  withTransactionFilters
} from "./transaction-filters";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("transaction filters", () => {
  it("includes both boundary dates in the query", () => {
    const inclusive = loadPaymentActivity(
      {
        dateFrom: "2026-09-02",
        dateTo: "2026-09-02"
      },
      "demo"
    );
    const afterEnd = loadPaymentActivity({ dateFrom: "2026-09-03" }, "demo");
    const beforeStart = loadPaymentActivity({ dateTo: "2026-09-01" }, "demo");

    expect(inclusive).toHaveLength(3);
    expect(afterEnd).toHaveLength(0);
    expect(beforeStart).toHaveLength(0);
  });

  it("supports multiple assets and multiple sellers", () => {
    expect(loadPaymentActivity({ assets: ["USDC"] }, "demo")).toHaveLength(3);
    expect(loadPaymentActivity({ assets: ["usdc", "EURC"] }, "demo")).toHaveLength(3);
    expect(loadPaymentActivity({ assets: ["EURC"] }, "demo")).toHaveLength(0);
    expect(loadPaymentActivity({ sellerIds: ["seller_atlas_weather"] }, "demo")).toHaveLength(2);
    expect(
      loadPaymentActivity(
        {
          sellerIds: ["seller_atlas_weather", "seller_vector_rag"]
        },
        "demo"
      )
    ).toHaveLength(3);
  });

  it("combines status, asset, and seller filters", () => {
    const failed = loadPaymentActivity(
      {
        assets: ["USDC"],
        sellerIds: ["seller_atlas_weather"],
        status: "failed"
      },
      "demo"
    );

    expect(failed).toHaveLength(1);
    expect(failed[0]?.attempt.id).toBe("attempt_weather_failed_001");
  });

  it("rejects reversed and malformed date ranges before querying", () => {
    const reversed = validateTransactionFilters({
      dateFrom: "2026-09-05",
      dateTo: "2026-09-01"
    });
    const malformed = validateTransactionFilters({ dateFrom: "2026-13-01" });
    const unknown = validateTransactionFilters({ cursor: "c2" });

    expect(reversed.success).toBe(false);
    expect(reversed.success ? [] : reversed.error.issues[0]?.message).toContain("start date");
    expect(malformed.success).toBe(false);
    expect(unknown.success).toBe(false);
  });

  it("parses filters from the URL and reports invalid params without querying", () => {
    const valid = parseTransactionFilterParams(
      new URLSearchParams(
        "assets=USDC,EURC&sellers=seller_atlas_weather&dateFrom=2026-09-02&dateTo=2026-09-02&status=settled&cursor=c2"
      )
    );

    expect(valid.errors).toEqual([]);
    expect(valid.filters).toEqual({
      assets: ["USDC", "EURC"],
      dateFrom: "2026-09-02",
      dateTo: "2026-09-02",
      sellers: ["seller_atlas_weather"],
      status: "settled"
    });

    const invalid = parseTransactionFilterParams(
      new URLSearchParams("dateFrom=2026-09-05&dateTo=2026-09-01")
    );

    expect(invalid.filters).toEqual({});
    expect(invalid.errors.length).toBeGreaterThan(0);
  });

  it("maps the legacy single date to an inclusive date range", () => {
    const parsed = parseTransactionFilterParams(new URLSearchParams("date=2026-09-02"));

    expect(parsed.filters.dateFrom).toBe("2026-09-02");
    expect(parsed.filters.dateTo).toBe("2026-09-02");
  });

  it("serializes filters without dropping cursor semantics", () => {
    const filters = {
      assets: ["USDC", "EURC"],
      dateFrom: "2026-09-02",
      dateTo: "2026-09-02",
      network: "stellar:testnet" as const,
      sellers: ["seller_atlas_weather"],
      status: "settled" as const
    };
    const params = withTransactionFilters(
      new URLSearchParams("cursor=c2&direction=forward&transaction=attempt_weather_001"),
      filters
    );
    const reparsed = parseTransactionFilterParams(params);

    expect(params.get("cursor")).toBe("c2");
    expect(params.get("direction")).toBe("forward");
    expect(params.get("transaction")).toBe("attempt_weather_001");
    expect(reparsed.filters).toEqual(filters);
    expect(toPaymentActivityFilters(reparsed.filters)).toEqual({
      assets: ["USDC", "EURC"],
      dateFrom: "2026-09-02",
      dateTo: "2026-09-02",
      network: "stellar:testnet",
      sellerIds: ["seller_atlas_weather"],
      status: "settled"
    });
  });

  it("saves, restores, and deletes cursor-free local views", () => {
    const storage = new MemoryStorage();
    const saved = saveSavedView(
      "Testnet failures",
      { assets: ["USDC"], status: "failed" },
      storage
    );

    expect(saved.name).toBe("Testnet failures");
    expect(loadSavedViews(storage)).toHaveLength(1);
    expect(loadSavedViews(storage)[0]?.filters).toEqual({
      assets: ["USDC"],
      status: "failed"
    });

    expect(deleteSavedView(saved.id, storage)).toEqual([]);
    expect(loadSavedViews(storage)).toEqual([]);
  });

  it("ignores corrupt saved-view storage and rejects empty names", () => {
    const storage = new MemoryStorage();
    storage.setItem("lumenbazaar.frontend.transaction-views.v1", "{not-json");

    expect(loadSavedViews(storage)).toEqual([]);
    expect(() => saveSavedView("   ", {}, storage)).toThrow("name");
  });
});
