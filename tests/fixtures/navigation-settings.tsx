// Real settings/forms/loaders/menus; durable isolated transport. No real CMS writes.
import React from "react";
import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  getRouteApi,
  Outlet,
  RouterProvider,
  useRouter,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { fromJSON } from "seroval";
import * as api from "../../src/lib/server-fns";
import { Route as RootRoute } from "../../src/routes/__root";
import { Route as SettingsRoute } from "../../src/routes/onlyme.settings";
import { Route as ResumeAdminRoute } from "../../src/routes/onlyme.resume";
import { Route as AwardsRoute } from "../../src/routes/awards";
import { Route as SkillsRoute } from "../../src/routes/skills";
import { Route as CertificatesRoute } from "../../src/routes/certificates";
import { Route as IndexRoute } from "../../src/routes/index";
import { SiteHeader, SiteFooter } from "../../src/components/PageShell";
import {
  NavOrderContext,
  NavProjectsContext,
  ResumeVisibilityContext,
  SectionVisibilityContext,
  type NavProject,
} from "../../src/components/nav-projects";
import type { SiteIdentity } from "../../src/db/schema";
import type { SectionVisibility } from "../../src/lib/section-visibility";
import type { PublicPageSlug } from "../../src/lib/site-copy";
import type { ResumeSettings } from "../../src/lib/resume";

const STORAGE = "navigation-settings-fixture-v1";
type Store = {
  site: { staged: SiteIdentity; published: SiteIdentity };
  visibility: SectionVisibility;
  resume: { staged: ResumeSettings; published: ResumeSettings };
  order: string[];
  award: {
    id: string;
    title: string;
    description: string;
    reason: string;
    thumbnail: { src: string; alt: string };
    referenceUrl: string;
    date: string;
    metadata: { preserved: string };
  };
};
const fixture = window as typeof window & {
  __navigationRoot?: ReturnType<typeof createRoot>;
  __navigationFixture?: { snapshot(): Store; calls: string[] };
};
const originalFetch = window.fetch.bind(window);
const rootApi = getRouteApi("__root__");
function Frame() {
  const data = rootApi.useLoaderData() as {
    site: SiteIdentity;
    navOrder: string[];
    navProjects: NavProject[];
    sectionVisibility: SectionVisibility;
    resumeVisible: boolean;
  };
  const router = useRouter();
  return (
    <SectionVisibilityContext.Provider value={data.sectionVisibility}>
      <ResumeVisibilityContext.Provider value={data.resumeVisible}>
        <NavOrderContext.Provider value={data.navOrder}>
          <NavProjectsContext.Provider value={data.navProjects}>
            <SiteHeader site={data.site} navOrder={data.navOrder} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 10 }}>
              {["/onlyme/settings", "/awards", "/skills", "/", "/onlyme/resume"].map((path) => (
                <button
                  key={path}
                  data-testid={`fixture-go-${path}`}
                  onClick={() => void router.navigate({ to: path })}
                >
                  {path}
                </button>
              ))}
            </div>
            <div style={{ padding: 16 }}>
              <Outlet />
            </div>
            <SiteFooter site={data.site} />
          </NavProjectsContext.Provider>
        </NavOrderContext.Provider>
      </ResumeVisibilityContext.Provider>
    </SectionVisibilityContext.Provider>
  );
}

export function mountNavigationFixture({ initialPath = "/onlyme/settings", reset = false } = {}) {
  const saved = reset ? null : localStorage.getItem(STORAGE);
  const site: SiteIdentity = {
    name: "Navigation fixture",
    title: "Engineer",
    edition: "2026",
    email: "",
    socials: [],
    copy: { profileImage: "" },
  };
  const current = {
    storagePath: "resume/unchanged.pdf",
    fileName: "Original CV.pdf",
    size: 100,
    uploadedAt: "2026-01-01T00:00:00Z",
    version: "original",
  };
  const state: Store = saved
    ? JSON.parse(saved)
    : {
        site: { staged: structuredClone(site), published: structuredClone(site) },
        visibility: {},
        order: [],
        resume: { staged: { current, visible: true }, published: { current, visible: true } },
        award: {
          id: "award1",
          title: "Original research award",
          description: "A **formatted** description",
          reason: "Original recognition reason",
          thumbnail: { src: "/images/profile.jpeg", alt: "Original award image" },
          referenceUrl: "https://example.com/credential",
          date: "2026",
          metadata: { preserved: "Original metadata" },
        },
      };
  const persist = () => localStorage.setItem(STORAGE, JSON.stringify(state));
  const flags = () => ({ ...state.visibility, resume: state.resume.published.visible !== false });
  const writeFlag = (section: PublicPageSlug, visible: boolean) => {
    if (section === "resume") {
      state.resume.staged.visible = visible;
      state.resume.published.visible = visible;
    } else state.visibility[section] = visible;
    persist();
  };
  const names = [
    "getSiteIdentity",
    "getPublishedProjects",
    "getPublishedNavOrder",
    "getPublishedSectionVisibility",
    "getSectionVisibilityAdmin",
    "setSectionVisibility",
    "getStaged",
    "updateStaged",
    "publishItem",
    "revertItem",
    "getPublishedAwards",
    "getPublishedSkills",
    "getPublishedCertificates",
    "getPublishedPage",
    "getResumeAdmin",
    "setResumeVisibility",
    "listMedia",
    "reorderNav",
  ] as const;
  const methods = Object.fromEntries(
    names.map((name) => [
      new URL((api[name] as unknown as { url: string }).url, location.origin).pathname,
      name,
    ]),
  );
  const calls: string[] = [];
  window.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      location.origin,
    );
    const name = methods[url.pathname];
    if (!name) {
      if ((init?.method ?? "GET") !== "GET") throw new Error("Fixture blocked an unhandled write.");
      return originalFetch(input, init);
    }
    calls.push(name);
    const payload =
      typeof init?.body === "string"
        ? (fromJSON(JSON.parse(init.body)) as {
            data: {
              content?: SiteIdentity;
              section?: PublicPageSlug;
              visible?: boolean;
              slugs?: string[];
            };
          })
        : { data: {} };
    const data = payload.data;
    let result: unknown;
    if (name === "getSiteIdentity") result = state.site.published;
    if (name === "getPublishedProjects")
      result = [
        {
          slug: "preserved-project",
          title: "Preserved featured project",
          year: "2026",
          category: "Engineering",
          dek: "Unchanged project",
          featured: true,
          stack: [],
          blocks: [],
        },
      ];
    if (name === "getPublishedNavOrder") result = state.order;
    if (name === "getPublishedSectionVisibility" || name === "getSectionVisibilityAdmin")
      result = flags();
    if (name === "setSectionVisibility") {
      await new Promise((resolve) => setTimeout(resolve, data.section === "awards" ? 120 : 15));
      writeFlag(data.section!, data.visible!);
      result = { ok: true, section: data.section, visible: data.visible };
    }
    if (name === "getStaged")
      result = { ...state.site, isPublic: true, updatedAt: "2026-11-18T10:00:00Z" };
    if (name === "updateStaged") {
      state.site.staged = structuredClone(data.content!);
      persist();
      result = { ok: true };
    }
    if (name === "publishItem") {
      state.site.staged = structuredClone(data.content ?? state.site.staged);
      state.site.published = structuredClone(state.site.staged);
      persist();
      result = { ok: true };
    }
    if (name === "revertItem") {
      state.site.staged = structuredClone(state.site.published);
      persist();
      result = { ok: true };
    }
    if (name === "getPublishedAwards")
      result = { kind: "awards", entries: [state.award], additionsApplied: true };
    if (name === "getPublishedSkills")
      result = {
        kind: "skills",
        skills: [{ id: "skill1", name: "Original skill", categoryId: "engineering" }],
        categories: [{ id: "engineering", name: "Engineering" }],
        additionsApplied: true,
      };
    if (name === "getPublishedCertificates")
      result = { kind: "certificates", certificates: [], additionsApplied: true };
    if (name === "getPublishedPage")
      result = {
        kind: "blocks",
        blocks: [{ type: "text", body: "Original overview content" }],
        additionsApplied: true,
      };
    if (name === "getResumeAdmin")
      result = {
        visible: flags().resume,
        staged: state.resume.staged.current,
        published: state.resume.published.current,
        stagedUrl: null,
        publishedUrl: null,
      };
    if (name === "setResumeVisibility") {
      writeFlag("resume", data.visible!);
      result = { ok: true, visible: data.visible };
    }
    if (name === "listMedia") result = [];
    if (name === "reorderNav") {
      state.order = data.slugs ?? [];
      persist();
      result = { ok: true };
    }
    return new Response(JSON.stringify({ result, context: {} }), {
      headers: { "content-type": "application/json" },
    });
  };
  persist();
  const root = createRootRoute({
    loader: RootRoute.options.loader as never,
    shouldReload: RootRoute.options.shouldReload as never,
    component: Frame,
    notFoundComponent: () => <p data-testid="section-unavailable">This section is unavailable.</p>,
  });
  const route = (path: string, original: { options: { loader?: unknown; component?: unknown } }) =>
    createRoute({
      getParentRoute: () => root,
      path,
      loader: original.options.loader as never,
      component: original.options.component as never,
    });
  const router = createRouter({
    context: { queryClient: new QueryClient() },
    routeTree: root.addChildren([
      route("/onlyme/settings", SettingsRoute),
      route("/onlyme/resume", ResumeAdminRoute),
      route("/awards", AwardsRoute),
      route("/skills", SkillsRoute),
      route("/certificates", CertificatesRoute),
      route("/", IndexRoute),
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  fixture.__navigationFixture = { snapshot: () => structuredClone(state), calls };
  fixture.__navigationRoot?.unmount();
  document.getElementById("navigation-fixture")?.remove();
  const mount = document.createElement("div");
  mount.id = "navigation-fixture";
  Object.assign(mount.style, {
    position: "fixed",
    inset: "0",
    zIndex: "40",
    background: "white",
    overflow: "auto",
  });
  document.body.append(mount);
  fixture.__navigationRoot = createRoot(mount);
  fixture.__navigationRoot.render(<RouterProvider router={router} />);
}
