import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseStatus } from "@/components/admin/cms/DatabaseStatus";
import { checkDatabase } from "@/lib/server-fns";

vi.mock("@/lib/server-fns", () => ({ checkDatabase: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("Database status recovery", () => {
  it("clears a stale warning automatically when the connection recovers", async () => {
    vi.useFakeTimers();
    vi.mocked(checkDatabase).mockResolvedValueOnce({ ok: false, ms: 10 });
    vi.mocked(checkDatabase).mockResolvedValueOnce({ ok: true, ms: 10 });
    await act(async () => {
      render(<DatabaseStatus />);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(checkDatabase).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(checkDatabase).toHaveBeenCalledTimes(2);
  });

  it("checks again when the user returns to the admin window", async () => {
    vi.mocked(checkDatabase).mockResolvedValueOnce({ ok: false, ms: 10 });
    vi.mocked(checkDatabase).mockResolvedValueOnce({ ok: true, ms: 10 });
    await act(async () => {
      render(<DatabaseStatus />);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
