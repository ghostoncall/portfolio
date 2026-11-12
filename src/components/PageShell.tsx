import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Rss, FileText, ChevronDown } from "lucide-react";
import type { SiteIdentity } from "@/db/schema";
import { SideMenu } from "@/components/SideMenu";

const NAV_BRAND_HOME = "engineerthisaryan";

/** Navigation destinations mirrored from SideMenu so the mobile drawer
 *  offers the same hierarchy as the desktop aside. */
const MOBILE_NAV_ITEMS: Array<{
  label: string;
  href: string;
  children?: Array<{ label: string; href: string }>;
  activeWhen?: (pathname: string) => boolean;
}> = [
  { label: "Overview", href: "/" },
  { label: "Projects", href: "/projects", children: [] },
  { label: "Blog", href: "/blog" },
  {
    label: "Skills, Certificates & Awards",
    href: "/skills",
    children: [
      { label: "Skills", href: "/skills" },
      { label: "Certificates", href: "/certificates" },
      { label: "Awards & Recognitions", href: "/awards" },
    ],
  },
  { label: "Experience", href: "/experience" },
  { label: "Volunteering", href: "/volunteering" },
  { label: "Contact", href: "/contact" },
];

export function SiteHeader({ site }: { site: SiteIdentity }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const navBrand = isHome ? NAV_BRAND_HOME : site.name;
  const showHomeBrand = site.showHomeBrand ?? true;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const htmlRef = useRef<HTMLElement | null>(null);

  // Lock background scroll (Lenis + native) while the mobile menu is open.
  useEffect(() => {
    const html = document.documentElement;
    htmlRef.current = html;
    if (isMenuOpen) {
      html.style.overflow = "hidden";
      html.style.touchAction = "none";
      html.style.position = "relative";
      html.style.width = "100%";
    } else {
      html.style.overflow = "";
      html.style.touchAction = "";
      html.style.position = "";
      html.style.width = "";
    }
    return () => {
      if (!isMenuOpen) {
        html.style.overflow = "";
        html.style.touchAction = "";
        html.style.position = "";
        html.style.width = "";
      }
    };
  }, [isMenuOpen]);

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (isMenuOpen && event.key === "Escape") {
        setIsMenuOpen(false);
      }
    },
    [isMenuOpen],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [isMenuOpen, handleKeydown]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      {/* Mobile hamburger button — hidden at and above the md breakpoint. */}
      <button
        type="button"
        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={isMenuOpen}
        className="md:hidden flex items-center gap-1 p-3 min-h-[44px] rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
        onClick={() => setIsMenuOpen((prev) => !prev)}
      >
        <span
          className="relative inline-block h-5 w-5 transition-all duration-200"
          aria-hidden="true"
        >
          <span
            className="absolute left-0 top-0 w-full h-[2px] bg-current transition-all duration-200"
            style={{
              transform: isMenuOpen
                ? "translateY(6px) rotate(45deg)"
                : "translateY(0) rotate(0deg)",
            }}
          />
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-current transition-all duration-200"
            style={{
              opacity: isMenuOpen ? 0 : 1,
            }}
          />
          <span
            className="absolute left-0 bottom-0 w-full h-[2px] bg-current transition-all duration-200"
            style={{
              transform: isMenuOpen
                ? "translateY(-6px) rotate(-45deg)"
                : "translateY(0) rotate(0deg)",
            }}
          />
        </span>
      </button>

      {/* Mobile navigation drawer — overlays the page, hidden above md. */}
      {isMenuOpen && (
        <div ref={menuRef} className="fixed inset-0 z-50 flex flex-col md:hidden">
          {/* Backdrop — closes the menu on click/tap. */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
            onClick={closeMenu}
          />
          {/* Menu panel */}
          <div className="relative z-10 flex flex-col h-full w-full max-w-[80vw] bg-background border-l border-border shadow-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="font-serif text-xl text-foreground">Menu</h2>
              <button
                type="button"
                aria-label="Close menu"
                className="p-2 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={closeMenu}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav
              className="flex-1 overflow-y-auto px-6 py-4 space-y-1"
              aria-label="Mobile navigation"
            >
              {MOBILE_NAV_ITEMS.map((item) => {
                const baseHref = item.href.split("#")[0]!;
                const active = item.activeWhen
                  ? item.activeWhen(pathname)
                  : pathname === baseHref || pathname.startsWith(baseHref + "#");
                const hasChildren = item.children && item.children.length > 0;
                return (
                  <div key={item.label} className="border-b border-border/50">
                    <div
                      onClick={
                        hasChildren
                          ? () => {}
                          : () => {
                              closeMenu();
                            }
                      }
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 rounded-md transition-colors ${
                        active ? "bg-accent text-accent-foreground" : ""
                      }`}
                    >
                      <Link
                        to={baseHref}
                        onClick={closeMenu}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "text-accent-foreground"
                            : "text-foreground hover:text-accent-foreground"
                        }`}
                      >
                        {item.label}
                        {hasChildren && (
                          <ChevronDown
                            className={`ml-auto h-3 w-3 shrink-0 transition-transform duration-200 ${
                              active ? "rotate-180" : ""
                            }`}
                          />
                        )}
                      </Link>
                    </div>
                    {hasChildren && active && item.children && (
                      <ul className="space-y-1 px-3 pb-2 pt-1 ml-2">
                        {item.children.map((child) => {
                          const childActive = pathname === child.href;
                          return (
                            <li key={child.label}>
                              <Link
                                to={child.href.split("#")[0]!}
                                onClick={closeMenu}
                                className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                                  childActive
                                    ? "text-accent-foreground underline underline-offset-4"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>
            {site.socials.length > 0 && (
              <div className="px-6 py-4 border-t border-border space-y-2">
                <span className="text-xs label-caps text-muted-foreground">Follow</span>
                <div className="flex items-center gap-3">
                  {site.socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={closeMenu}
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent px-3 py-1.5 rounded-md transition-colors"
                    >
                      {s.label === "LinkedIn" ? (
                        <img
                          src="https://img.icons8.com/ios-filled/50/000000/linkedin.png"
                          alt="LinkedIn"
                          width="18"
                          height="18"
                          className="shrink-0"
                        />
                      ) : s.label === "GitHub" ? (
                        <img
                          src="https://img.icons8.com/fluent/50/000000/github.png"
                          alt="GitHub"
                          width="18"
                          height="18"
                          className="shrink-0"
                        />
                      ) : null}
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="px-6 py-4 border-t border-border">
              <span className="text-xs text-muted-foreground">{site.edition}</span>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="hidden sm:flex items-center gap-4">
            {site.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-base font-medium text-muted-foreground tracking-tight hover:opacity-80"
              >
                {s.label === "LinkedIn" ? (
                  <img
                    src="https://img.icons8.com/ios-filled/50/000000/linkedin.png"
                    alt="LinkedIn"
                    width="20"
                    height="20"
                    className="shrink-0"
                  />
                ) : s.label === "GitHub" ? (
                  <img
                    src="https://img.icons8.com/fluent/50/000000/github.png"
                    alt="GitHub"
                    width="20"
                    height="20"
                    className="shrink-0"
                  />
                ) : null}
                {s.label}
              </a>
            ))}
          </div>
          {!(isHome && !showHomeBrand) && (
            <Link
              to="/"
              className="flex-1 text-center font-serif text-nav-mobile text-foreground sm:text-2xl md:text-3xl"
            >
              {navBrand}
            </Link>
          )}
          <span className="hidden sm:inline-block text-nav-mobile font-medium text-white tracking-tight bg-black">
            {site.edition}
          </span>
        </div>
      </header>
    </>
  );
}

export function PageShell({
  crumbs,
  title,
  children,
  site,
  profileImage,
}: {
  crumbs: string[];
  title: string;
  children: ReactNode;
  site: SiteIdentity;
  profileImage?: string;
}) {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-24">
      <nav className="mt-10 flex flex-wrap gap-1 text-sm text-link">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        {crumbs.map((c) => (
          <span key={c}>
            <span className="mx-1 text-muted-foreground">›</span>
            {c}
          </span>
        ))}
      </nav>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-start lg:items-center">
        <div className="flex-1">
          <h1 className="mt-2 text-heading-1 sm:text-5xl md:text-6xl leading-tight text-foreground">
            {title}
          </h1>
        </div>
        {profileImage && (
          <div className="shrink-0">
            <img
              src={profileImage}
              alt="Profile"
              className="w-[160px] h-[160px] md:w-[200px] md:h-[200px] rounded-[20px] object-cover border border-border"
            />
          </div>
        )}
      </div>
      <hr className="mt-8 border-border" />

      <div className="mt-8 grid gap-10 md:grid-cols-[18rem_1fr] lg:gap-16">
        <aside className="hidden md:block">
          <SideMenu />
        </aside>
        <article className="min-w-0 max-w-3xl">{children}</article>
      </div>
    </main>
  );
}

export function SiteFooter({ site }: { site: SiteIdentity }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:text-base">
        <span className="font-serif">
          © {year} {site.name ?? "Aryan Mehndiratta"}
        </span>
        <span className="flex gap-6">
          <a
            href="/rss.xml"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:text-foreground"
          >
            <Rss size={16} strokeWidth={1.5} />
            <span>RSS Feed</span>
          </a>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:text-foreground"
          >
            <FileText size={16} strokeWidth={1.5} />
            <span>Sitemap</span>
          </a>
        </span>
      </div>
    </footer>
  );
}
