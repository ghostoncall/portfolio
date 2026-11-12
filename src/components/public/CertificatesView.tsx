// Public Certificates section — rendered on the /certificates page.
// All fields optional; empty entries render nothing.
import type { Certificate } from "@/content/site";
import { CertificateTile } from "@/components/public/CertificateTile";

export function CertificatesView({ certificates }: { certificates: Certificate[] }) {
  const visibleCerts = certificates.filter((c) => c.visible !== false);
  if (!visibleCerts.length) return null;

  return (
    <section id="certificates" className="space-y-6">
      <h2 className="text-heading-2 sm:text-3xl text-foreground">Certificates</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCerts.map((c) => (
          <CertificateTile key={c.id} cert={c} />
        ))}
      </div>
    </section>
  );
}
