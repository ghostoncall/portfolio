/* Browser fixture: actual routes, forms, renderer and client RPC serialization.
 * Only the transport is isolated. No real page is saved or published. */
import React from "react";
import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fromJSON } from "seroval";
import { QueryClient } from "@tanstack/react-query";
import { Route as Pages } from "../../src/routes/onlyme.pages";
import { Route as Editor } from "../../src/routes/onlyme.pages.$slug";
import { Route as Index } from "../../src/routes/index";
import * as api from "../../src/lib/server-fns";
import { mergePage } from "../../src/lib/merge-additions";
import type { BlocksPage } from "../../src/lib/featured-projects";

const fixture = window as typeof window & {
  __overviewRoot?: ReturnType<typeof createRoot>;
  __overviewFixture?: Record<string, unknown>;
};
const originalFetch = window.fetch.bind(window);
const site = {
  name: "Overview fixture",
  title: "Engineer",
  edition: "2026",
  email: "",
  socials: [],
  copy: { profileImage: "" },
};
const project = {
  slug: "case-study",
  title: "Published featured project",
  year: "2026",
  dek: "Project description",
  category: "Engineering",
  featured: true,
  stack: [],
  blocks: [],
};

export function mountOverviewFixture(
  options: { featured?: boolean; restore?: boolean; initialPath?: string } = {},
) {
  const published: BlocksPage = {
    kind: "blocks",
    blocks: [{ type: "text", body: "Original published overview" }],
    additionsApplied: true,
  };
  const initialRow = {
    slug: "overview",
    title: "Overview",
    kind: "blocks",
    published,
    staged: structuredClone(published),
    isPublic: true,
    updatedAt: "2026-11-18T10:00:00Z",
  };
  const stored = options.restore ? localStorage.getItem("featured-overview-fixture") : null;
  const row: typeof initialRow = stored ? JSON.parse(stored) : initialRow;
  const projects = options.featured
    ? [
        project,
        { ...project, slug: "second-project", title: "Second featured project", priority: -1 },
        { ...project, slug: "third-project", title: "Third published project", featured: false },
        { ...project, slug: "archived-project", title: "Archived project", status: "archived" },
      ]
    : [project];
  const persist = () => {
    if (options.featured) localStorage.setItem("featured-overview-fixture", JSON.stringify(row));
  };
  persist();
  const calls: string[] = [];
  const methods = Object.fromEntries(
    [
      "listStaged",
      "updateStaged",
      "publishItem",
      "revertItem",
      "getSiteIdentity",
      "getPublishedProjects",
      "getPublishedPage",
    ].map((name) => {
      const fn = api[name as keyof typeof api] as unknown as { url: string };
      return [new URL(fn.url, location.origin).pathname, name];
    }),
  );
  window.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      location.origin,
    );
    const name = methods[url.pathname];
    if (!name) {
      if ((init?.method ?? "GET") !== "GET")
        throw new Error("The fixture blocks unhandled writes.");
      return originalFetch(input, init);
    }
    calls.push(name);
    const payload =
      typeof init?.body === "string"
        ? (fromJSON(JSON.parse(init.body)) as { data?: { content?: typeof published } })
        : {};
    let result: unknown;
    if (name === "listStaged") result = [structuredClone(row)];
    if (name === "getSiteIdentity") result = site;
    if (name === "getPublishedProjects") result = projects;
    if (name === "getPublishedPage") result = mergePage("overview", row.published);
    if (name === "updateStaged") {
      row.staged = structuredClone(payload.data!.content!);
      result = { ok: true };
      persist();
    }
    if (name === "publishItem") {
      row.staged = structuredClone(payload.data?.content ?? row.staged);
      row.published = structuredClone(row.staged);
      result = { ok: true, publishedAt: "2026-11-18T10:00:00Z" };
      persist();
    }
    if (name === "revertItem") {
      row.staged = structuredClone(row.published);
      result = { ok: true };
      persist();
    }
    return new Response(JSON.stringify({ result, context: {} }), {
      headers: { "content-type": "application/json" },
    });
  };
  const root = createRootRoute({
    loader: () => ({ site }),
    component: Outlet,
    shellComponent: ({ children }) => <>{children}</>,
  });
  const pages = createRoute({
    getParentRoute: () => root,
    path: "/onlyme/pages",
    component: Pages.options.component as never,
  });
  const editor = createRoute({
    getParentRoute: () => pages,
    path: "$slug",
    component: Editor.options.component as never,
  });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    loader: Index.options.loader as never,
    component: Index.options.component as never,
  });
  const router = createRouter({
    context: { queryClient: new QueryClient() },
    routeTree: root.addChildren([pages.addChildren([editor]), index]),
    history: createMemoryHistory({ initialEntries: [options.initialPath ?? "/onlyme/pages"] }),
  });
  if (options.featured)
    (window as typeof window & { __TSR_ROUTER__?: unknown }).__TSR_ROUTER__ = router;
  fixture.__overviewFixture = {
    snapshot: () => structuredClone(row),
    projects: () => structuredClone(projects),
    calls,
  };
  fixture.__overviewRoot?.unmount();
  document.getElementById("overview-fixture")?.remove();
  const mount = document.createElement("div");
  mount.id = "overview-fixture";
  Object.assign(mount.style, {
    position: "fixed",
    inset: "0",
    background: "white",
    zIndex: "40",
    overflow: "auto",
    padding: "24px",
  });
  document.body.append(mount);
  fixture.__overviewRoot = createRoot(mount);
  fixture.__overviewRoot.render(
    <>
      <button data-testid="overview-public-view" onClick={() => void router.navigate({ to: "/" })}>
        Open public homepage
      </button>
      <button
        data-testid="overview-edit-view"
        onClick={() => void router.navigate({ to: "/onlyme/pages/overview" })}
      >
        Open Overview editor
      </button>
      <RouterProvider router={router} />
    </>,
  );
}
