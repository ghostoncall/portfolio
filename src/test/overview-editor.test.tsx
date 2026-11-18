/* eslint-disable @typescript-eslint/no-explicit-any -- real router with isolated CMS transport */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Route as PagesRoute } from "@/routes/onlyme.pages";
import { Route as EditorRoute } from "@/routes/onlyme.pages.$slug";
import { Route as IndexRoute } from "@/routes/index";
import { mergePage } from "@/lib/merge-additions";
import { overviewProjects } from "@/lib/featured-projects";

const transport = vi.hoisted(() => ({ row: null as any, save: vi.fn(), publish: vi.fn() }));
const site = {
  name: "Ada",
  title: "Engineer",
  email: "",
  edition: "",
  socials: [],
  copy: { profileImage: "" },
};
const project = {
  slug: "featured",
  title: "Featured project",
  dek: "Published project",
  year: "2026",
  category: "Engineering",
  stack: [],
  blocks: [],
  featured: true,
};
vi.mock("@/lib/server-fns", () => ({
  listStaged: vi.fn(async () => [structuredClone(transport.row)]),
  updateStaged: vi.fn(async ({ data }) => {
    transport.save(data);
    transport.row.staged = structuredClone(data.content);
    return { ok: true };
  }),
  publishItem: vi.fn(async ({ data }) => {
    transport.publish(data);
    transport.row.staged = structuredClone(data.content ?? transport.row.staged);
    transport.row.published = structuredClone(transport.row.staged);
    transport.row.isPublic = true;
    return { ok: true, publishedAt: "2026-11-18T09:00:00Z" };
  }),
  revertItem: vi.fn(async () => {
    transport.row.staged = structuredClone(transport.row.published);
    return { ok: true };
  }),
  unpublishItem: vi.fn(),
  ensureContentPage: vi.fn(),
  listMedia: vi.fn(async () => []),
  getSiteIdentity: vi.fn(async () => site),
  getPublishedProjects: vi.fn(async () => [project]),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

beforeEach(() => {
  const published = {
    kind: "blocks",
    additionsApplied: true,
    blocks: [{ type: "text", body: "Live introduction" }],
  };
  transport.row = {
    slug: "overview",
    title: "Overview",
    kind: "blocks",
    published,
    staged: structuredClone(published),
    isPublic: true,
    updatedAt: "2026-11-18T09:00:00Z",
  };
  transport.save.mockClear();
  transport.publish.mockClear();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});
afterEach(() => cleanup());

async function mount(path = "/onlyme/pages") {
  const root = createRootRoute({ component: Outlet });
  const pages = createRoute({
    getParentRoute: () => root,
    path: "/onlyme/pages",
    component: PagesRoute.options.component as any,
  });
  const edit = createRoute({
    getParentRoute: () => pages,
    path: "$slug",
    component: EditorRoute.options.component as any,
  });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    loader: () => ({
      site,
      overview: mergePage("overview", structuredClone(transport.row.published)),
      featured: overviewProjects([project], site),
    }),
    component: IndexRoute.options.component as any,
  });
  const router = createRouter({
    routeTree: root.addChildren([pages.addChildren([edit]), index]),
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMinMs: 0,
  });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
}

describe("Overview editor and live homepage", () => {
  it("opens the real child editor when Edit is clicked in Pages", async () => {
    await mount();
    fireEvent.click(await screen.findByTestId("page-edit-link"));
    expect(await screen.findByRole("heading", { name: "overview" })).toBeInTheDocument();
    expect(screen.queryByTestId("pages-table")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Live introduction")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View live Overview" })).toHaveAttribute("href", "/");
  });

  it("previews the edited document immediately, saves the draft, and publishes that exact content to the homepage", async () => {
    // Prime the public route cache before editing, to exercise invalidation too.
    const router = await mount("/");
    expect(await screen.findByText("Live introduction")).toBeInTheDocument();
    await act(() => router.navigate({ to: "/onlyme/pages/$slug", params: { slug: "overview" } }));
    const input = await screen.findByDisplayValue("Live introduction");
    fireEvent.change(input, { target: { value: "Updated introduction" } });
    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    const preview = screen.getByLabelText("Live preview");
    expect(within(preview).getByText("Updated introduction")).toBeInTheDocument();
    expect(await within(preview).findByText("Featured project")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cms-save"));
    await waitFor(() => expect(transport.save).toHaveBeenCalled());
    expect(transport.row.staged.blocks[0].body).toBe("Updated introduction");
    expect(transport.row.published.blocks[0].body).toBe("Live introduction");
    // Publish a newer edit without waiting for another autosave.
    fireEvent.change(screen.getByDisplayValue("Updated introduction"), {
      target: { value: "Latest published introduction" },
    });
    fireEvent.click(screen.getByTestId("cms-publish"));
    await waitFor(() => expect(transport.publish).toHaveBeenCalled());
    expect(transport.row.published.blocks[0].body).toBe("Latest published introduction");
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Page save status" })).toHaveTextContent(
        "Published",
      ),
    );
    await act(() => router.navigate({ to: "/" }));
    expect(await screen.findByText("Latest published introduction")).toBeInTheDocument();
    expect(screen.queryByText("Live introduction")).not.toBeInTheDocument();
    expect(screen.getByText("Featured project")).toBeInTheDocument();
  });

  it("persists media fields immediately and can add or remove media/image blocks without hook errors", async () => {
    transport.row.staged.blocks.push({
      type: "media",
      caption: "Old media caption",
      credit: "Old credit",
      items: [{ src: "/a.jpg", poster: "/poster.jpg", title: "Original title" }],
    });
    await mount("/onlyme/pages/overview");
    fireEvent.change(await screen.findByDisplayValue("Old media caption"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Media item 1 URL"), { target: { value: "/b.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: "Add media item" }));
    fireEvent.change(screen.getByLabelText("Media item 2 URL"), {
      target: { value: "https://youtu.be/AAAAAAAAAAA" },
    });
    fireEvent.click(screen.getByTestId("cms-save"));
    await waitFor(() => expect(transport.save).toHaveBeenCalled());
    const media = transport.row.staged.blocks[1];
    expect(media.caption).toBe("");
    expect(media.credit).toBe("Old credit");
    expect(media.items[0]).toMatchObject({
      src: "/b.jpg",
      title: "Original title",
      poster: "/poster.jpg",
    });
    expect(media.items[1].src).toContain("youtu.be");
    fireEvent.click(screen.getByRole("button", { name: /Image$/ }));
    expect(screen.getByText("Image block", { exact: true })).toBeInTheDocument();
    const mediaCard = screen.getByText("Media block", { exact: true }).parentElement!
      .parentElement!;
    fireEvent.click(within(mediaCard).getByRole("button", { name: "Delete" }));
    expect(screen.queryByText("Media block", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Live introduction")).toBeInTheDocument();
  });

  it("uses identical project selection and respects deleted owned Overview content", () => {
    const projects = [
      project,
      { ...project, slug: "archived", status: "archived" as const, priority: 99 },
      { ...project, slug: "priority", priority: 10 },
    ];
    expect(
      overviewProjects(projects, { ...site, copy: { featuredCount: 1 } }).map((p) => p.slug),
    ).toEqual(["priority"]);
    expect(projects.map((p) => p.slug)).toEqual(["featured", "archived", "priority"]);
    const empty = { kind: "blocks", blocks: [], additionsApplied: true };
    expect(mergePage("overview", empty)).toBe(empty);
  });
});
