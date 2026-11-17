/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ReactLenis } from "lenis/react";

// Side-effect import (not ?url) so TanStack Start's manifest owns the
// stylesheet and can inline it into the SSR HTML (server.build.inlineCss).
import "../styles.css";
import { SiteHeader, SiteFooter } from "../components/PageShell";
import { BackToTop } from "../components/BackToTop";
import { NavOrderContext, NavProjectsContext, type NavProject } from "../components/nav-projects";
import { getPublishedNavOrder, getPublishedProjects, getSiteIdentity } from "@/lib/server-fns";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    const [site, projects, navOrder] = await Promise.all([
      (getSiteIdentity as any)(),
      (getPublishedProjects as any)(),
      (getPublishedNavOrder as any)(),
    ]);
    const navProjects: NavProject[] = (projects as any[])
      .filter((p) => p.status !== "archived")
      .map((p) => ({ slug: p.slug, title: p.title }));
    return { site, navProjects, navOrder: (navOrder as string[]) ?? [] };
  },
  // Site identity, nav order and the project list change only when the admin
  // publishes. Public client-side navigations reuse the copy loaded with the
  // page instead of re-requesting all three; child loaders read `site` from it
  // too (see siteFromRoot). Inside /onlyme the default staleness rules apply so
  // the editor still sees fresh data, and leaving /onlyme invalidates it.
  shouldReload: ({ location }) => (location.pathname.startsWith("/onlyme") ? undefined : false),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI Engineer Portfolio" },
      { name: "description", content: "Portfolio of an AI engineer." },
      // Matches --background (paper white) so mobile browser chrome blends in.
      { name: "theme-color", content: "#fdfdfb" },
      { property: "og:site_name", content: "engineerthisaryan" },
    ],
    links: [
      // Fonts are self-hosted (src/fonts.css, public/fonts/). Preload only the
      // two faces used by above-the-fold text — the body serif (LCP paragraph)
      // and Lato 400 — so they arrive with the CSS and the swap barely shifts.
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fonts/libre-baskerville-normal-latin-3eb80fbc.woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fonts/lato-normal-latin-918b7dc3.woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "Aryan Mehndiratta RSS Feed",
        href: "/rss.xml",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Lenis smooth scrolling for mouse wheels and trackpads. Touch keeps the
 * browser's native momentum (Lenis' default), and visitors who prefer reduced
 * motion get plain native scrolling. Inner scroll areas (PDF viewer, mobile
 * menu) opt out with `data-lenis-prevent` so they scroll natively.
 */
function SmoothScroll({ children }: { children: ReactNode }) {
  const [smooth, setSmooth] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSmooth(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return smooth ? <ReactLenis root>{children}</ReactLenis> : <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isAdmin = useRouterState({
    select: (s) => s.location.pathname.startsWith("/onlyme"),
  });
  const { site, navProjects, navOrder } = Route.useLoaderData() as {
    site: any;
    navProjects: NavProject[];
    navOrder: string[];
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SmoothScroll>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <SiteHeader site={site} navOrder={navOrder ?? []} />
        <NavOrderContext.Provider value={navOrder ?? []}>
          <NavProjectsContext.Provider value={navProjects ?? []}>
            <Outlet />
          </NavProjectsContext.Provider>
        </NavOrderContext.Provider>
        <SiteFooter site={site} />
        {!isAdmin && <BackToTop />}
      </SmoothScroll>
    </QueryClientProvider>
  );
}
