// Desktop site index (left column of every public page).
//
// Every row is a real link that fills the whole row, so clicking anywhere in
// the rectangle navigates — not just on the text. Sections with sub-pages get
// a separate, clearly labelled +/− button to show or hide them.
import { Link, useRouterState } from "@tanstack/react-router";
import { useContext, useEffect, useState } from "react";
import type { SiteIdentity } from "@/db/schema";
import {
  NavOrderContext,
  NavProjectsContext,
  ResumeVisibilityContext,
  SectionVisibilityContext,
} from "@/components/nav-projects";
import { buildNav, childActive } from "@/components/site-nav";
import { plainText, Rich } from "@/lib/rich-inline";

const rowText =
  "font-sans text-[clamp(0.95rem,1rem+0.5vw,1.25rem)] font-bold leading-tight tracking-tight";

export function SideMenu({ site }: { site?: SiteIdentity | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navOrder = useContext(NavOrderContext);
  const projects = useContext(NavProjectsContext);
  const resumeVisible = useContext(ResumeVisibilityContext);
  const visibility = useContext(SectionVisibilityContext);
  const items = buildNav(site, navOrder, projects, resumeVisible, visibility);

  // Sections start open when you're inside them, and open when you navigate in.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.slug, Boolean(i.children && i.isActive(pathname))])),
  );
  useEffect(() => {
    const current = items.find((i) => i.children && i.isActive(pathname));
    if (current) setOpen((o) => (o[current.slug] ? o : { ...o, [current.slug]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <nav aria-label="Site index" className="border-t border-foreground/30">
      <ul>
        {items.map((item) => {
          const active = item.isActive(pathname);
          const exact = active && !item.children?.some((c) => childActive(c, pathname));
          const hasChildren = Boolean(item.children?.length);
          const isOpen = hasChildren && Boolean(open[item.slug]);
          const listId = `side-menu-${item.slug}`;
          return (
            <li key={item.slug} className="border-b border-foreground/30">
              <div
                className={`flex items-stretch ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}
              >
                <Link
                  to={item.to}
                  aria-current={exact ? "page" : undefined}
                  className={`${rowText} flex min-h-[44px] min-w-0 flex-1 items-center [overflow-wrap:anywhere] px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                    active ? "" : "hover:bg-muted"
                  }`}
                >
                  <span>
                    <Rich text={item.label} />
                    {hasChildren && (
                      <sup className="ml-1 align-super text-xs font-normal">
                        (+{item.children!.length})
                      </sup>
                    )}
                  </span>
                </Link>
                {hasChildren && (
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [item.slug]: !isOpen }))}
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    aria-label={`${isOpen ? "Hide" : "Show"} ${plainText(item.label)} pages`}
                    className={`flex w-11 shrink-0 items-center justify-center text-xl font-light leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                      active
                        ? "text-primary-foreground hover:bg-primary-foreground/10"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                  </button>
                )}
              </div>
              {isOpen && (
                <ul id={listId} className="py-2">
                  {item.children!.map((child) => {
                    const here = childActive(child, pathname);
                    return (
                      <li key={child.key}>
                        <Link
                          to={child.to}
                          {...(child.params ? { params: child.params } : {})}
                          aria-current={here ? "page" : undefined}
                          className={`flex min-h-[40px] min-w-0 items-center [overflow-wrap:anywhere] px-6 py-2 text-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                            here
                              ? "font-semibold text-foreground underline underline-offset-4"
                              : "text-muted-foreground"
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
  );
}
