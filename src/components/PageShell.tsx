import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { X, Rss, FileText, ChevronDown } from "lucide-react";
import { useLenis } from "lenis/react";
import type { SiteIdentity } from "@/db/schema";
import { SideMenu } from "@/components/SideMenu";
import {
  NavProjectsContext,
  ResumeVisibilityContext,
  SectionVisibilityContext,
} from "@/components/nav-projects";
import { buildNav, childActive } from "@/components/site-nav";
import { CopyEmailButton } from "@/components/CopyEmailButton";
import { copyText } from "@/lib/site-copy";
import { sectionVisible } from "@/lib/section-visibility";
import { plainText, Rich } from "@/lib/rich-inline";

/** Inline brand marks (no third-party image requests). Matched by URL. */
function SocialIcon({ href }: { href: string }) {
  const host = (() => {
    try {
      return new URL(href).hostname;
    } catch {
      return "";
    }
  })();
  const path = /github\.com$/i.test(host)
    ? "M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57l-.02-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .31.21.69.82.57A12 12 0 0 0 12 .3"
    : /linkedin\.com$/i.test(host)
      ? "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
      : null;
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="shrink-0">
      <path fill="currentColor" d={path} />
    </svg>
  );
}

function Socials({
  site,
  className,
  linkClassName,
  onNavigate,
}: {
  site: SiteIdentity;
  className: string;
  linkClassName: string;
  onNavigate?: () => void;
}) {
  const socials = (site.socials ?? []).filter((s) => s.label?.trim() && s.href?.trim());
  if (!socials.length) return null;
  return (
    <div className={className}>
      {socials.map((s) => (
        <a
          key={`${s.label}-${s.href}`}
          href={s.href}
          target="_blank"
          rel="noreferrer"
          onClick={onNavigate}
          className={linkClassName}
        >
          <SocialIcon href={s.href} />
          {s.label}
        </a>
      ))}
    </div>
  );
}

export function SiteHeader({ site, navOrder }: { site: SiteIdentity; navOrder?: string[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const navBrand = isHome ? copyText(site, "homeBrand") : site.name;
  const showHomeBrand = site.showHomeBrand ?? true;
  const projects = useContext(NavProjectsContext);
  const resumeVisible = useContext(ResumeVisibilityContext);
  const visibility = useContext(SectionVisibilityContext);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const items = buildNav(site, navOrder ?? null, projects, resumeVisible, visibility);
  const [expanded, setExpanded] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lenis = useLenis();

  // Lock background scroll (Lenis + native) while the mobile menu is open, and
  // move focus into the menu; return it to the Menu button when it closes.
  useEffect(() => {
    const html = document.documentElement;
    if (!isMenuOpen) {
      lenis?.start();
      return;
    }
    lenis?.stop();
    html.style.overflow = "hidden";
    // The section you're in starts expanded.
    setExpanded(items.find((i) => i.children?.length && i.isActive(pathname))?.slug ?? null);
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      lenis?.start();
      menuButtonRef.current?.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen, lenis]);

  // Any navigation closes the menu (including browser back/forward).
  useEffect(() => setIsMenuOpen(false), [pathname]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      {/* Mobile navigation drawer — overlays the page, hidden above md. */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          {/* Backdrop — closes the menu on click/tap. */}
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={closeMenu} />
          <div className="relative z-10 ml-auto flex h-full w-[min(22rem,88vw)] flex-col border-l border-border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b border-border py-3 pl-5 pr-3">
              <p className="font-serif text-xl text-foreground">Menu</p>
              <button
                ref={closeButtonRef}
                type="button"
                className="inline-flex min-h-[48px] items-center gap-2 border border-foreground/40 px-4 text-base font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={closeMenu}
              >
                <X className="h-5 w-5" aria-hidden="true" />
                Close
              </button>
            </div>
            <nav
              data-lenis-prevent=""
              className="flex-1 overflow-y-auto overscroll-contain"
              aria-label="Site"
            >
              <ul>
                {items.map((item) => {
                  const active = item.isActive(pathname);
                  const hasChildren = Boolean(item.children?.length);
                  const isOpen = hasChildren && expanded === item.slug;
                  const listId = `mobile-menu-${item.slug}`;
                  return (
                    <li key={item.slug} className="border-b border-border">
                      <div
                        className={`flex items-stretch ${
                          active ? "bg-primary text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        {/* The link fills the whole row: tap anywhere in it. */}
                        <Link
                          to={item.to}
                          onClick={closeMenu}
                          aria-current={active ? "page" : undefined}
                          className={`flex min-h-[56px] min-w-0 flex-1 items-center [overflow-wrap:anywhere] px-5 py-3 text-lg font-semibold leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                            active ? "" : "active:bg-muted"
                          }`}
                        >
                          <Rich text={item.label} />
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : item.slug)}
                            aria-expanded={isOpen}
                            aria-controls={listId}
                            aria-label={`${isOpen ? "Hide" : "Show"} ${plainText(item.label)} pages`}
                            className={`flex w-[56px] shrink-0 items-center justify-center border-l transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                              active
                                ? "border-primary-foreground/25"
                                : "border-border active:bg-muted"
                            }`}
                          >
                            <ChevronDown
                              aria-hidden="true"
                              className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>
                      {isOpen && (
                        <ul id={listId} className="bg-muted/40 py-1">
                          {item.children!.map((child) => {
                            const here = childActive(child, pathname);
                            return (
                              <li key={child.key}>
                                <Link
                                  to={child.to}
                                  {...(child.params ? { params: child.params } : {})}
                                  onClick={closeMenu}
                                  aria-current={here ? "page" : undefined}
                                  className={`flex min-h-[48px] min-w-0 items-center [overflow-wrap:anywhere] px-8 py-2.5 text-base transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                                    here
                                      ? "font-semibold text-foreground underline underline-offset-4"
                                      : "text-foreground/80"
                                  }`}
                                >
                                  <Rich text={child.label} />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
            <Socials
              site={site}
              onNavigate={closeMenu}
              className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3"
              linkClassName="inline-flex min-h-[48px] items-center gap-2 px-3 text-base text-foreground hover:bg-muted"
            />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:py-5">
          <Socials
            site={site}
            className="hidden items-center gap-4 sm:flex"
            linkClassName="flex items-center gap-2 text-base font-medium tracking-tight text-muted-foreground hover:text-foreground"
          />
          {!(isHome && !showHomeBrand) ? (
            <Link
              to="/"
              className="min-w-0 flex-1 truncate text-left font-serif text-nav-mobile text-foreground sm:text-center sm:text-2xl md:text-3xl"
            >
              <Rich text={navBrand} />
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {site.edition && (
            <span className="hidden bg-black text-nav-mobile font-medium tracking-tight text-white md:inline-block">
              {site.edition}
            </span>
          )}
          {/* Mobile menu button: icon + the word "Menu", a full 48px target. */}
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={isMenuOpen}
            aria-haspopup="dialog"
            onClick={() => setIsMenuOpen(true)}
            className="inline-flex min-h-[48px] min-w-[48px] shrink-0 items-center gap-2 border border-foreground/50 px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
          >
            <span aria-hidden="true" className="flex w-5 flex-col gap-[5px]">
              <span className="h-0.5 w-full bg-current" />
              <span className="h-0.5 w-full bg-current" />
              <span className="h-0.5 w-full bg-current" />
            </span>
            Menu
          </button>
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
  profileAlt,
}: {
  crumbs: string[];
  title: string;
  children: ReactNode;
  site: SiteIdentity;
  profileImage?: string | undefined;
  profileAlt?: string | undefined;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
      <nav aria-label="Breadcrumb" className="mt-8 flex flex-wrap gap-1 text-sm text-link md:mt-10">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        {crumbs.map((c) => (
          <span key={c}>
            <span className="mx-1 text-muted-foreground">›</span>
            {plainText(c)}
          </span>
        ))}
      </nav>
      <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:gap-8">
        <div className="w-full flex-1">
          <h1 className="mt-2 text-center text-heading-1 leading-tight text-foreground sm:text-5xl md:text-6xl lg:text-left">
            <Rich text={title} />
          </h1>
        </div>
        {profileImage && (
          <div className="shrink-0 self-center lg:self-auto">
            <img
              src={profileImage}
              alt={plainText(profileAlt) || `Portrait of ${plainText(site.name)}`}
              width={200}
              height={200}
              decoding="async"
              fetchPriority="high"
              className="h-[160px] w-[160px] rounded-[20px] border border-border object-cover md:h-[200px] md:w-[200px]"
            />
          </div>
        )}
      </div>
      <hr className="mt-8 border-border" />

      <div className="mt-8 grid gap-10 md:grid-cols-[18rem_1fr] lg:gap-16">
        <aside className="hidden md:block">
          <SideMenu site={site} />
        </aside>
        <article className="min-w-0 max-w-3xl">{children}</article>
      </div>
    </main>
  );
}

/** Pages that end with the footer's "get in touch" call to action. */
const CTA_PATHS = new Set(["/skills", "/certificates", "/awards"]);

export function SiteFooter({ site }: { site: SiteIdentity }) {
  const year = new Date().getFullYear();
  const visibility = useContext(SectionVisibilityContext);
  // The "get in touch" call to action appears only in the Skills,
  // Certificates & Awards section — centered, no social links. Its wording is
  // editable (Settings → Page titles & wording); clearing the heading hides it.
  const showCta = useRouterState({
    select: (s) => CTA_PATHS.has(s.location.pathname.replace(/\/$/, "")),
  });
  const ctaHeading = copyText(site, "footerCtaHeading");
  const ctaLink = copyText(site, "footerCtaLink");
  return (
    <footer className="border-t border-border">
      {showCta && ctaHeading && sectionVisible(visibility, "contact") && (
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 pt-12 text-center">
          <p className="font-display text-2xl text-foreground sm:text-3xl">
            <Rich text={ctaHeading} />
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {ctaLink && (
              <Link
                to="/contact"
                className="inline-flex min-h-[44px] items-center font-semibold text-foreground underline-offset-4 transition-colors hover:underline"
              >
                <Rich text={ctaLink} /> →
              </Link>
            )}
            {site.email && (
              <>
                {ctaLink && <span aria-hidden="true">·</span>}
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <a
                    href={`mailto:${site.email}`}
                    className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    {site.email}
                  </a>
                  <CopyEmailButton email={site.email} />
                </span>
              </>
            )}
          </p>
        </div>
      )}
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:text-base">
        <span className="font-serif">
          © {year} <Rich text={site.name} />
        </span>
        <span className="flex gap-6">
          {sectionVisible(visibility, "blog") && (
            <a
              href="/rss.xml"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 hover:text-foreground"
            >
              <Rss size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>RSS Feed</span>
            </a>
          )}
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:text-foreground"
          >
            <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Sitemap</span>
          </a>
        </span>
      </div>
    </footer>
  );
}
