import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Receipt } from "@/services/api/schemas";

import { ReceiptSharePanel } from "./receipt-share-panel";

const receipt: Receipt = {
  amount: "12.5",
  assetCode: "USDC",
  assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWBRXM6LSV7XYJJJX34ZPUSC6D6P2",
  correlationId: "corr_private_123",
  createdAt: "2026-11-19T10:00:00Z",
  evidenceHash: "evidence_private_456",
  failureCode: null,
  failureReason: null,
  id: "receipt_weather_001",
  ledger: 123456,
  network: "stellar:testnet",
  paymentAttemptId: "attempt_private_789",
  resourceId: null,
  sellerId: null,
  settledAt: "2026-11-19T10:01:00Z",
  status: "finalized",
  transactionHash: "a".repeat(64),
  updatedAt: "2026-11-19T10:01:00Z"
};

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(navigator, "share");
});

describe("ReceiptSharePanel", () => {
  it("requires a privacy review before showing the share link", async () => {
    const user = userEvent.setup();
    render(<ReceiptSharePanel receipt={receipt} />);

    expect(screen.queryByLabelText("Public receipt link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Review share link/i }));

    expect(screen.getByText("Privacy review")).toBeInTheDocument();
    expect(screen.getByText("Included in the link")).toBeInTheDocument();
    expect(screen.getByText("Visible to the recipient")).toBeInTheDocument();
    expect(screen.getByText("Excluded from the link")).toBeInTheDocument();
    expect(screen.getByLabelText("Public receipt link")).toHaveValue(
      `${window.location.origin}/receipts/receipt_weather_001`
    );
    expect(screen.queryByText(receipt.paymentAttemptId)).not.toBeInTheDocument();
  });

  it("copies the minimum public link", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    render(<ReceiptSharePanel receipt={receipt} />);
    await user.click(screen.getByRole("button", { name: /Review share link/i }));
    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/receipts/receipt_weather_001`
    );
    expect(await screen.findByText(/Share link copied/)).toBeInTheDocument();
  });

  it("keeps the link available when copying fails", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
    });

    render(<ReceiptSharePanel receipt={receipt} />);
    await user.click(screen.getByRole("button", { name: /Review share link/i }));
    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByText(/Copy failed. Select the link above/)).toBeInTheDocument();
    expect(screen.getByLabelText("Public receipt link")).toHaveValue(
      `${window.location.origin}/receipts/receipt_weather_001`
    );
  });

  it("falls back to the visible link when native share fails", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("unsupported"))
    });

    render(<ReceiptSharePanel receipt={receipt} />);
    await user.click(screen.getByRole("button", { name: /Review share link/i }));
    await user.click(screen.getByRole("button", { name: "Share…" }));

    expect(await screen.findByText(/Native share is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });
});
