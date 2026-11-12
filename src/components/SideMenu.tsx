import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useContext, useState } from "react";
import {
  projects as staticProjects,
  skills as staticSkills,
  certificates as staticCertificates,
  awards as staticAwards,
} from "@/content/site";
import { NavProjectsContext, type NavProject } from "@/components/nav-projects";

const items = [
  { to: "/", label: "Overview" },
  { to: "/education", label: "Education" },
  { to: "/projects", label: "Projects", children: true },
  { to: "/blog", label: "Blog" },
  { to: "/skills", label: "Skills, Certificates & Awards", children: true },
  { to: "/experience", label: "Experience" },
  { to: "/volunteering", label: "Volunteering" },
  { to: "/contact", label: "Contact" },
] as const;

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

  return (
    <nav aria-label="Site index" className="border-t border-foreground/30">
      {items.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const hasChildren = "children" in item;
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
                  onClick={toggleOpen}
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
