import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { Route } from "@/routes/onlyme.skills-certificates-awards";

const mocks = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("@/lib/server-fns", () => ({ getStaged: vi.fn(), listStaged: vi.fn() }));
vi.mock("@/components/admin/cms/useUnsavedChanges", () => ({
  useUnsavedChanges: () => ({ confirmLeave: vi.fn() }),
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/components/admin/cms/useCmsDraft", () => ({
  useCmsDraft: ({ normalize, slug }: { normalize: (raw: unknown) => unknown; slug: string }) => {
    const doc = normalize(
      slug === "certificates" ? { certificates: [{ id: "cert1", title: "Test certificate" }] } : {},
    );
    return {
      doc,
      data: { staged: doc, published: doc, isPublic: true },
      loading: false,
      dirty: false,
      saving: false,
      error: null,
      notice: null,
      lastSaved: null,
      patch: mocks.patch,
      save: vi.fn(),
      publish: vi.fn(),
      unpublish: vi.fn(),
      revert: vi.fn(),
      reload: vi.fn(),
    };
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const Admin = Route.options.component as ComponentType;

describe("Skills, certificates and awards admin", () => {
  it("loads with no deletion selected and opens each editor", () => {
    render(<Admin />);
    expect(screen.getByText("Skills · Certificates · Awards")).toBeInTheDocument();
    for (const [button, title] of [
      ["Add skill", "Skill"],
      ["Add certificate", "Certificate"],
      ["Add award", "Award"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: button }));
      expect(
        within(screen.getByRole("dialog")).getByRole("heading", { name: title }),
      ).toBeInTheDocument();
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    }
  });

  it("waits for confirmation before deleting an entry", () => {
    render(<Admin />);
    fireEvent.click(screen.getByTestId("certificates-delete"));
    expect(screen.getByText('Delete "Test certificate"?')).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    expect(mocks.patch).toHaveBeenCalledOnce();
  });
});
