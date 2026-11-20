import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/services/api/client";
import { normalizeUiError } from "@/services/ui-state";
import { ErrorState } from "@/components/ui/surfaces";

import { RouteError } from "./route-error";

class TestBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: (Error & { digest?: string }) | null }
> {
  state: { error: (Error & { digest?: string }) | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error !== null) {
      return (
        <RouteError
          description="The route could not render."
          error={this.state.error}
          reset={() => {
            this.setState({ error: null });
            this.props.onReset();
          }}
          title="Route unavailable"
        />
      );
    }

    return this.props.children;
  }
}

function Throws({ error }: { error: Error }): ReactNode {
  throw error;
}

describe("RouteError", () => {
  it("catches a thrown render error, retains the digest, and resets on retry", async () => {
    const onReset = vi.fn();
    const error = Object.assign(new Error("render exploded"), { digest: "req_render_123" });

    render(
      <TestBoundary onReset={onReset}>
        <Throws error={error} />
      </TestBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Route unavailable");
    expect(screen.getByText("req_render_123")).toBeInTheDocument();
    expect(screen.getByText(/never repeated automatically/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("shows a safe request identifier for query errors", () => {
    const state = normalizeUiError(
      new ApiClientError({
        code: "SERVICE_UNAVAILABLE",
        message: "Backend unavailable.",
        requestId: "req_query_456",
        status: 503
      }),
      {
        description: "Fallback",
        title: "Query unavailable"
      }
    );

    render(<ErrorState {...state} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Query unavailable");
    expect(screen.getByText("req_query_456")).toBeInTheDocument();
  });
});
