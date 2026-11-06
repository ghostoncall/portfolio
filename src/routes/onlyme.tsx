import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { site } from "@/content/site";
import { extractSessionCookie } from "@/lib/auth";

export const Route = createFileRoute("/onlyme")({
  component: OnlymeLayout,
});

function OnlymeLayout() {
  const cookie =
    typeof document !== "undefined"
      ? extractSessionCookie(document.cookie)
      : null;
  const authed = !!cookie;
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/onlyme";
  const isLoginPage = currentPath === "/onlyme/login";

  if (!authed && !isLoginPage && typeof window !== "undefined") {
    const from = new URLSearchParams(window.location.search).get("from") ?? "/onlyme";
    window.location.href = `/onlyme/login?from=${encodeURIComponent(from)}`;
    return null;
  }

  if (isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-72 border-r border-border flex-col bg-muted/50 md:flex">
        <nav className="flex-1 p-6 space-y-1">
          <Link
            to="/onlyme"
            className="block px-4 py-3 text-sm font-medium text-foreground rounded-lg bg-primary"
          >
            Dashboard
          </Link>
          <Link
            to="/onlyme/settings"
            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            Settings
          </Link>
          <Link
            to="/onlyme/pages"
            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            Pages
          </Link>
          <Link
            to="/onlyme/projects"
            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            Projects
          </Link>
          <Link
            to="/onlyme/blogs"
            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            Blogs
          </Link>
          <Link
            to="/onlyme/media"
            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            Media
          </Link>
          <Link
            to="/onlyme/export"
            className="block px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            Backup
          </Link>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              document.cookie =
                "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
              window.location.href = "/onlyme/login";
            }}
            className="mt-6"
          >
            <button type="submit" className="text-xs text-destructive underline">
              Sign out
            </button>
          </form>
        </nav>
      </aside>

      <div className="flex-1 p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-serif text-foreground">{site.edition}</p>
            <h1 className="text-4xl font-bold text-foreground">Admin</h1>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
