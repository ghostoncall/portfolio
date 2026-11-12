// Public Awards section — rendered on the /awards page.
// All fields optional; empty entries render nothing.
import type { Award } from "@/content/site";
import { AwardTile } from "@/components/public/AwardTile";

export function AwardsView({ awards }: { awards: Award[] }) {
  const visibleAwards = awards.filter((a) => a.visible !== false);
  if (!visibleAwards.length) return null;

  return (
    <section id="awards" className="space-y-6">
      <h2 className="text-heading-2 sm:text-3xl text-foreground">Awards</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleAwards.map((a) => (
          <AwardTile key={a.id} award={a} />
        ))}
      </div>
    </section>
  );
}
