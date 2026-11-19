import { describe, expect, it } from "vitest";

import { loadPaymentActivity } from "./payments";
import {
  resolveTransactionDetail,
  transactionIdFromParams,
  withTransactionSelection,
  withoutTransactionSelection
} from "./transaction-detail";

describe("transaction detail resolution", () => {
  it("finds a visible transaction", () => {
    const result = resolveTransactionDetail("attempt_weather_001", loadPaymentActivity({}, "demo"));

    expect(result.state).toBe("found");
    expect(result.state === "found" ? result.activity.receipt?.id : undefined).toBe(
      "receipt_weather_001"
    );
  });

  it("returns an explicit missing state for unknown ids", () => {
    expect(resolveTransactionDetail("attempt_missing", loadPaymentActivity({}, "demo"))).toEqual({
      state: "missing"
    });
    expect(resolveTransactionDetail(undefined, loadPaymentActivity({}, "demo"))).toEqual({
      state: "missing"
    });
  });

  it("returns an explicit unauthorized state for records outside the workspace", () => {
    const activity = loadPaymentActivity({}, "demo")[0];

    expect(activity).toBeDefined();
    const unauthorized = resolveTransactionDetail(activity!.attempt.id, [
      { ...activity!, seller: undefined }
    ]);

    expect(unauthorized).toEqual({ state: "unauthorized" });
  });

  it("adds and removes only the transaction param for shareable links", () => {
    const selected = withTransactionSelection(
      new URLSearchParams("assets=USDC&cursor=c2"),
      "attempt_weather_001"
    );

    expect(selected.get("assets")).toBe("USDC");
    expect(transactionIdFromParams(selected)).toBe("attempt_weather_001");

    const closed = withoutTransactionSelection(selected);
    expect(closed.get("assets")).toBe("USDC");
    expect(closed.get("cursor")).toBe("c2");
    expect(closed.get("transaction")).toBeNull();
  });
});
