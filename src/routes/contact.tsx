import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { site } from "@/content/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact — ${site.name}` },
      {
        name: "description",
        content: `Get in touch with ${site.name} about AI projects and roles.`,
      },
      { property: "og:title", content: `Contact ${site.name}` },
      { property: "og:description", content: "Email, GitHub, LinkedIn and a contact form." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

const field =
  "w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring";

function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <PageShell crumbs={["Contact"]} title="Correspondence">
      <p className="prose-editorial">
        Write to{" "}
        <a href={`mailto:${site.email}`} className="text-link hover:underline">
          {site.email}
        </a>
        , or use the form below.
      </p>
      {sent ? (
        <p className="mt-8 bg-muted p-6 font-serif">Thank you — your message has been noted.</p>
      ) : (
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <label className="block">
            <span className="label-caps text-muted-foreground">Name</span>
            <input required className={field} />
          </label>
          <label className="block">
            <span className="label-caps text-muted-foreground">Email</span>
            <input required type="email" className={field} />
          </label>
          <label className="block">
            <span className="label-caps text-muted-foreground">Message</span>
            <textarea required rows={6} className={field} data-lenis-prevent />
          </label>
          <button className="label-caps bg-primary px-6 py-3 text-primary-foreground hover:opacity-90">
            Send
          </button>
        </form>
      )}
    </PageShell>
  );
}
