/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Outlet, Link, redirect, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getAdminUser, getSiteIdentity } from "@/lib/server-fns";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export const Route = createFileRoute("/onlyme")({
  // Server-enforced guard: every /onlyme page requires a Supabase session.
  // The login page is the only exception.
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/onlyme/login") return;

    const user = await getAdminUser();
    if (!user) {
      throw redirect({
        to: "/onlyme/login",

        search: { from: location.pathname } as any,
      });
    }
  },
  loader: async () => {
    const site = await (getSiteIdentity as any)();
    return { site };
  },
  component: OnlymeLayout,
});

function OnlymeLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { site } = Route.useLoaderData() as { site: any };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  // Mobile-only overlay drawer state (desktop uses sidebarCollapsed instead).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const htmlRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setSidebarCollapsed(localStorage.getItem("onlyme:sidebarCollapsed") === "true");
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    const html = document.documentElement;
    htmlRef.current = html;
    if (sidebarOpen) {
      html.style.overflow = "hidden";
      html.style.touchAction = "none";
    } else {
      html.style.overflow = "";
      html.style.touchAction = "";
    }
    return () => {
      if (!sidebarOpen) {
        html.style.overflow = "";
        html.style.touchAction = "";
      }
    };
  }, [sidebarOpen]);

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (sidebarOpen && event.key === "Escape") {
        setSidebarOpen(false);
      }
    },
    [sidebarOpen],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [sidebarOpen, handleKeydown]);

  const closeDrawer = () => setSidebarOpen(false);

  if (pathname === "/onlyme/login") {
    return <Outlet />;
  }

  async function handleSignOut() {
    try {
      await getSupabaseBrowser().auth.signOut();
    } catch {
      // Ignore network errors — still send the user to the login screen.
    } finally {
      window.location.href = "/onlyme/login";
    }
  }

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("onlyme:sidebarCollapsed", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  const navItems = [
    { to: "/onlyme", label: "Dashboard", icon: "📊" },
    { to: "/onlyme/settings", label: "Settings", icon: "⚙️" },
    { to: "/onlyme/pages", label: "Pages", icon: "📄" },
    { to: "/onlyme/projects", label: "Projects", icon: "💼" },
    { to: "/onlyme/skills", label: "Skills", icon: "🧩" },
    { to: "/onlyme/certificates", label: "Certificates", icon: "🎓" },
    { to: "/onlyme/experience", label: "Experience", icon: "🛠️" },
    { to: "/onlyme/volunteering", label: "Volunteering", icon: "🤝" },
    { to: "/onlyme/blogs", label: "Blogs", icon: "📝" },
    { to: "/onlyme/media", label: "Media", icon: "🖼️" },
    { to: "/onlyme/export", label: "Backup", icon: "💾" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile drawer backdrop — closes on tap. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebarRef}
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "w-16 md:w-16" : "w-72"
        } flex-col bg-muted/50 ${sidebarOpen ? "fixed inset-y-0 left-0 z-50" : "hidden md:flex"}`}
      >
        <div className="flex-1 p-3 space-y-1">
          {sidebarOpen && (
            <div className="flex items-center justify-between px-2 py-2">
              <span className="sr-only">Navigation</span>
              <button
                type="button"
                aria-label="Close navigation"
                className="p-2 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={closeDrawer}
              >
                <X className="h-5 w-5 shrink-0" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex items-center justify-between px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors min-h-[44px]"
            title="Toggle sidebar"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronLeft className="h-4 w-4 shrink-0" />
            )}
          </button>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeDrawer}
                  className={`flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors min-h-[44px] ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {!sidebarCollapsed && (
                    <>
                      <span className="text-xl shrink-0">{item.icon}</span>
                      <span>{item.label}</span>
                    </>
                  )}
                  {sidebarCollapsed && <span className="text-xl shrink-0">{item.icon}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-3 text-xs text-destructive underline hover:bg-destructive/10 transition-colors min-h-[44px]"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile hamburger to open the drawer — hidden at and above md via CSS. */}
      <div className="md:hidden flex items-center gap-2 pl-4 pt-3">
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={sidebarOpen}
          className="flex items-center gap-1 p-3 min-h-[44px] rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
          onClick={() => setSidebarOpen(true)}
        >
          <span
            className="relative inline-block h-5 w-5 transition-all duration-200"
            aria-hidden="true"
          >
            <span
              className="absolute left-0 top-0 w-full h-[2px] bg-current transition-all duration-200"
              style={{
                transform: sidebarOpen
                  ? "translateY(6px) rotate(45deg)"
                  : "translateY(0) rotate(0deg)",
              }}
            />
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-current transition-all duration-200"
              style={{
                opacity: sidebarOpen ? 0 : 1,
              }}
            />
            <span
              className="absolute left-0 bottom-0 w-full h-[2px] bg-current transition-all duration-200"
              style={{
                transform: sidebarOpen
                  ? "translateY(-6px) rotate(-45deg)"
                  : "translateY(0) rotate(0deg)",
              }}
            />
          </span>
        </button>
      </div>

      <div className="flex-1 p-8 md:pr-4">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-serif text-foreground">{site?.edition}</p>
            <h1 className="text-heading-1 sm:text-4xl font-bold text-foreground">Admin</h1>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
