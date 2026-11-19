import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/services/api/query";
import type { NetworkStatusProbe } from "@/services/operators";

import { NetworkStatusBanner } from "./network-status-banner";
import { NetworkStatusProvider } from "./network-status-provider";

function probe(overrides: Partial<NetworkStatusProbe> = {}): NetworkStatusProbe {
  const checkedAt = "2026-11-18T10:00:00.000Z";

  return {
    backend: {
      checkedAt,
      detail: "lumenbazaar-backend responded for api.",
      status: "operational"
    },
    checkedAt,
    stellar: {
      checkedAt,
      detail: "RPC ready; Horizon ready.",
      status: "operational"
    },
    ...overrides
  };
}

function renderBanner(probeImpl: () => Promise<NetworkStatusProbe>) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <NetworkStatusProvider probe={probeImpl}>
        <NetworkStatusBanner />
      </NetworkStatusProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
  // React Query tracks browser connectivity globally; restore it for later tests.
  fireEvent(window, new Event("online"));
});

describe("NetworkStatusBanner", () => {
  it("stays hidden while backend and Stellar checks are operational", async () => {
    const probeImpl = vi.fn(async () => probe());
    renderBanner(probeImpl);

    await waitFor(() => expect(probeImpl).toHaveBeenCalled());
    expect(screen.queryByText("Service checks are degraded")).not.toBeInTheDocument();
    expect(screen.queryByText("You are offline")).not.toBeInTheDocument();
  });

  it("shows the degraded source, status, and check timestamp", async () => {
    renderBanner(async () =>
      probe({
        backend: {
          checkedAt: "2026-11-18T10:00:00.000Z",
          detail: "The backend reported that it is not ready to serve payments.",
          status: "degraded"
        }
      })
    );

    expect(await screen.findByText("Service checks are degraded")).toBeInTheDocument();
    expect(screen.getByText("Backend API:")).toBeInTheDocument();
    expect(screen.getByText("Stellar:")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-11-18T10:00:00.000Z"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-check status" })).toBeInTheDocument();
    expect(screen.getByText(/never retried automatically/i)).toBeInTheDocument();
  });

  it("distinguishes offline browser state from service checks", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    const probeImpl = vi.fn(async () => probe());
    renderBanner(probeImpl);

    fireEvent(window, new Event("offline"));

    expect(await screen.findByText("You are offline")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getAllByText(/Paused while offline/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("button", { name: "Re-check status" })).not.toBeInTheDocument();
    expect(screen.getByText(/resume when the browser reconnects/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/^Offline\./);
  });

  it("re-checks only the read-only probe and does not duplicate announcements", async () => {
    const user = userEvent.setup();
    const probeImpl = vi.fn(async () =>
      probe({
        backend: {
          checkedAt: "2026-11-18T10:00:00.000Z",
          detail: "The backend reported that it is not ready to serve payments.",
          status: "degraded"
        }
      })
    );
    renderBanner(probeImpl);

    await screen.findByText("Service checks are degraded");
    const announcement = screen.getByRole("status").textContent;

    await user.click(screen.getByRole("button", { name: "Re-check status" }));

    await waitFor(() => expect(probeImpl.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByRole("status").textContent).toBe(announcement);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
