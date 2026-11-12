// Unified tile grid for Skills, Certificates and Awards on the public /skills page.
// Compact, responsive: desktop 3 columns, tablet 2, mobile 1.
import type { Award, Certificate, Skill } from "@/content/site";
import { AwardTile } from "@/components/public/AwardTile";
import { CertificateTile } from "@/components/public/CertificateTile";
import { SkillTile } from "@/components/public/SkillTile";

export function SkillsCertificatesAwardsView({
  skills,
  certificates,
  awards,
}: {
  skills: Skill[];
  certificates: Certificate[];
  awards: Award[];
}) {
  const visibleSkills = skills.filter((s) => s.visible !== false);
  const visibleCerts = certificates.filter((c) => c.visible !== false);
  const visibleAwards = awards.filter((a) => a.visible !== false);

  return (
    <section className="space-y-10">
      {visibleSkills.length > 0 && (
        <div id="skills">
          <h2 className="text-heading-2 sm:text-3xl text-foreground">Skills</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSkills.map((s) => (
              <SkillTile key={s.id} skill={s} />
            ))}
          </div>
        </div>
      )}

      {visibleCerts.length > 0 && (
        <div id="certificates" className="mt-8">
          <h2 className="text-heading-2 sm:text-3xl text-foreground">Certificates</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCerts.map((c) => (
              <CertificateTile key={c.id} cert={c} />
            ))}
          </div>
        </div>
      )}

      {visibleAwards.length > 0 && (
        <div id="awards" className="mt-8">
          <h2 className="text-heading-2 sm:text-3xl text-foreground">Awards</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAwards.map((a) => (
              <AwardTile key={a.id} award={a} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
