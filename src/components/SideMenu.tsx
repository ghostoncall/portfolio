import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useContext, useState } from "react";
import {
  projects as staticProjects,
  skills as staticSkills,
  certificates as staticCertificates,
  awards as staticAwards,
} from "@/content/site";
import { NavOrderContext, NavProjectsContext, type NavProject } from "@/components/nav-projects";

/** Canonical default nav order (matches NavReorder / seed).
 *  Kept synchronous (no async fetch) so the nav never flickers or reorders
 *  under the user's cursor. Drag-and-drop reordering is managed in the admin
 *  panel via NavReorder; this public menu renders the stable default order.
 */
const DEFAULT_NAV: Array<{
  slug: string;
  label: string;
  to: string;
  order: number;
  hasChildren: boolean;
}> = [
  { slug: "overview", label: "Overview", to: "/", order: 0, hasChildren: false },
  { slug: "education", label: "Education", to: "/education", order: 1, hasChildren: false },
  { slug: "projects", label: "Projects", to: "/projects", order: 2, hasChildren: true },
  { slug: "blog", label: "Blog", to: "/blog", order: 3, hasChildren: false },
  {
    slug: "skills",
    label: "Skills, Certificates & Awards",
    to: "/skills",
    order: 4,
    hasChildren: true,
  },
  { slug: "experience", label: "Experience", to: "/experience", order: 7, hasChildren: false },
  {
    slug: "volunteering",
    label: "Volunteering",
    to: "/volunteering",
    order: 8,
    hasChildren: false,
  },
  { slug: "contact", label: "Contact", to: "/contact", order: 9, hasChildren: false },
] as const;

type NavItem = {
  slug: string;
  label: string;
  to: string;
  navOrder: number;
  hasChildren: boolean;
};

function defaultItems(): NavItem[] {
  return DEFAULT_NAV.map((d) => ({
    slug: d.slug,
    label: d.label,
    to: d.to,
    navOrder: d.order,
    hasChildren: d.hasChildren,
  }));
}

/** Apply the admin-saved order on top of the defaults. Deterministic: unknown
 *  slugs keep their default position after the ordered ones. */
function orderItems(items: NavItem[], order: string[] | null): NavItem[] {
  if (!order || order.length === 0) return items;
  const rank = new Map(order.map((slug, i) => [slug, i]));
  return [...items].sort(
    (a, b) =>
      (rank.get(a.slug) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.slug) ?? Number.MAX_SAFE_INTEGER) || a.navOrder - b.navOrder,
  );
}

const itemClass =
  "block py-1.5 font-sans text-[clamp(0.95rem,1rem+0.5vw,1.25rem)] font-bold leading-tight tracking-tight text-foreground transition-opacity hover:opacity-60";

const skillCategoryItems = [
  { label: "Skills", href: "/skills" },
  { label: "Certificates", href: "/certificates" },
  { label: "Awards & Recognitions", href: "/awards" },
] as const;

export function SideMenu() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [projectsOpen, setProjectsOpen] = useState(pathname.startsWith("/projects"));
  const [skillsOpen, setSkillsOpen] = useState(
    pathname === "/skills" || pathname === "/certificates" || pathname === "/awards",
  );
  const liveProjects = useContext(NavProjectsContext);
  const projectList: NavProject[] =
    liveProjects ?? staticProjects.map((p) => ({ slug: p.slug, title: p.title }));
  const skillsList = staticSkills.skills.filter((s) => s.visible !== false);
  const certsList = staticCertificates.certificates.filter((c) => c.visible !== false);
  const awardsList = staticAwards.entries.filter((a) => a.visible !== false);
  const skillsCount = skillsList.length + certsList.length + awardsList.length;

  const navOrder = useContext(NavOrderContext);
  const items = orderItems(defaultItems(), navOrder);

  return (
    <nav aria-label="Site index" className="border-t border-foreground/30">
      {items.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const hasChildren = item.hasChildren;
        const isSkillsSection = item.label === "Skills, Certificates & Awards";
        const isOpen = isSkillsSection ? skillsOpen : projectsOpen;
        const toggleOpen = () => {
          if (isSkillsSection) setSkillsOpen((o) => !o);
          else setProjectsOpen((o) => !o);
        };
        return (
          <div key={item.to} className="border-b border-foreground/30">
            <div
              onClick={
                hasChildren
                  ? toggleOpen
                  : () => {
                      navigate({ to: item.to });
                    }
              }
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 ${
                active ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              <Link
                to={item.to}
                className={`${itemClass} ${active ? "text-primary-foreground hover:opacity-100" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="whitespace-nowrap">{item.label}</span>
                {hasChildren && (
                  <sup className="ml-1 align-super text-xs font-normal">
                    (+
                    {item.label === "Skills, Certificates & Awards"
                      ? skillsCount
                      : projectList.length}
                    )
                  </sup>
                )}
              </Link>
              {hasChildren && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOpen();
                  }}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
                  className={`px-1 text-xl font-light leading-none ${active ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {isOpen ? "−" : "+"}
                </button>
              )}
            </div>
            {hasChildren && isOpen && (
              <ul className="space-y-1 px-3 pb-4 pt-2">
                {isSkillsSection
                  ? skillCategoryItems.map((sc) => {
                      const scActive = pathname === sc.href;
                      return (
                        <li key={sc.label} className="px-3 py-1">
                          <a
                            href={sc.href}
                            className={`text-sm text-muted-foreground hover:text-foreground ${
                              scActive ? "text-foreground underline underline-offset-4" : ""
                            }`}
                          >
                            {sc.label}
                          </a>
                        </li>
                      );
                    })
                  : projectList.map((p) => (
                      <li key={p.slug} className="px-3 py-1">
                        <Link
                          to="/projects/$slug"
                          params={{ slug: p.slug }}
                          className="text-sm text-muted-foreground hover:text-foreground"
                          activeProps={{
                            className: "text-foreground underline underline-offset-4",
                          }}
                        >
                          {p.title}
                        </Link>
                      </li>
                    ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
