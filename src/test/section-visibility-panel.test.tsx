import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SectionVisibilityPanel } from "@/components/admin/cms/SectionVisibilityPanel";

const transport = vi.hoisted(() => ({
  invalidate: vi.fn(async () => undefined),
  save: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: transport.invalidate }),
}));
vi.mock("@/lib/server-fns", () => ({
  getSectionVisibilityAdmin: vi.fn(async () => ({})),
  setSectionVisibility: (request: unknown) => transport.save(request),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("immediate section switches", () => {
  it("keeps independent in-flight changes and rolls back only the failed switch", async () => {
    let failAwards!: (error: Error) => void;
    let saveSkills!: () => void;
    transport.save.mockImplementation(
      ({ data }: { data: { section: string } }) =>
        new Promise<void>((resolve, reject) => {
          if (data.section === "awards") failAwards = reject;
          else saveSkills = resolve;
        }),
    );
    render(<SectionVisibilityPanel />);
    const awards = await screen.findByRole("checkbox", {
      name: "Show Awards on the site",
    });
    const skills = screen.getByRole("checkbox", { name: "Show Skills on the site" });
    fireEvent.click(awards);
    fireEvent.click(skills);
    expect(awards).not.toBeChecked();
    expect(skills).not.toBeChecked();
    expect(awards).toBeDisabled();
    expect(skills).toBeDisabled();
    await act(async () => {
      saveSkills();
    });
    await waitFor(() => expect(skills).toBeEnabled());
    await act(async () => {
      failAwards(new Error("Save failed; retry."));
    });
    await waitFor(() => expect(awards).toBeEnabled());
    expect(awards).toBeChecked();
    expect(skills).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("Save failed; retry.");
    expect(transport.invalidate).toHaveBeenCalledTimes(1);
  });

  it("keeps a saved flag when only refreshing the public route fails", async () => {
    transport.save.mockResolvedValueOnce({ ok: true });
    transport.invalidate.mockRejectedValueOnce(new Error("Refresh failed"));
    render(<SectionVisibilityPanel />);
    const awards = await screen.findByRole("checkbox", {
      name: "Show Awards on the site",
    });
    fireEvent.click(awards);
    await waitFor(() => expect(awards).toBeEnabled());
    expect(awards).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("Visibility was saved");
  });
});
