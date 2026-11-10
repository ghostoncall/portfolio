/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { getSiteIdentity } from "@/lib/server-fns";
import { sendContactEmail } from "@/lib/server-fns";

export const Route = createFileRoute("/contact")({
  loader: async () => {
    const site = await (getSiteIdentity as any)();
    return { site };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Contact — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content: `Get in touch with ${site?.name ?? "the site owner"} about AI projects and roles.`,
        },
        { property: "og:title", content: `Contact ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content: "Email, GitHub, LinkedIn and a contact form.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Contact,
});

const field =
  "w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring aria-[invalid=true]:border-destructive";

const SUBJECT_OPTIONS = [
  { value: "general", label: "General Inquiry" },
  { value: "project", label: "Project Collaboration" },
  { value: "freelance", label: "Freelance / Work Opportunity" },
  { value: "job", label: "Job Opportunity" },
  { value: "tech", label: "Technical Discussion" },
  { value: "business", label: "Business Inquiry" },
  { value: "feedback", label: "Feedback / Suggestions" },
  { value: "issue", label: "Website Issue / Bug Report" },
  { value: "other", label: "Something Else" },
];

const LIMITS = {
  name: 100,
  email: 254,
  subject: 120,
  message: 5000,
};

type Fields = {
  name: string;
  email: string;
  subject_category: string;
  custom_subject: string;
  message: string;
};

type ErrorKey = keyof Fields | "subject" | "form";
type Errors = Partial<Record<ErrorKey, string | undefined>>;

function validate(values: Fields): Errors {
  const errors: Errors = {};

  if (!values.name.trim()) errors.name = "Please enter your name.";
  else if (values.name.trim().length > LIMITS.name)
    errors.name = `Please keep your name under ${LIMITS.name} characters.`;

  if (!values.email.trim()) errors.email = "Please enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim()))
    errors.email = "Please enter a valid email address.";

  if (!values.subject_category) errors.subject = "Please choose a subject.";

  if (values.subject_category === "other") {
    if (!values.custom_subject.trim()) errors.custom_subject = "Please specify your subject.";
    else if (values.custom_subject.trim().length > LIMITS.subject)
      errors.custom_subject = `Please keep the subject under ${LIMITS.subject} characters.`;
  }

  if (!values.message.trim()) errors.message = "Please write a message.";
  else if (values.message.trim().length < 10)
    errors.message = "Please write at least 10 characters.";
  else if (values.message.length > LIMITS.message)
    errors.message = `Please keep your message under ${LIMITS.message} characters.`;

  return errors;
}

function Contact() {
  const { site } = Route.useLoaderData() as { site: any };
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [values, setValues] = useState<Fields>({
    name: "",
    email: "",
    subject_category: "",
    custom_subject: "",
    message: "",
  });

  const siteKey = (import.meta.env as any).VITE_TURNSTILE_SITE_KEY as string | undefined;
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    if (!siteKey) return;

    const render = () => {
      const turnstile = (window as any).turnstile;
      if (!turnstile || !turnstileRef.current || widgetId.current) return;
      widgetId.current = turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        theme: "light",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (existing) {
      if ((window as any).turnstile) render();
      else existing.addEventListener("load", render);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset["turnstile"] = "1";
    script.addEventListener("load", render);
    document.head.appendChild(script);
  }, [siteKey]);

  const update = (key: keyof Fields, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const honeypot = String(formData.get("company_website") ?? "");

    const nextErrors = validate(values);
    if (honeypot.trim()) nextErrors.form = "Invalid submission.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstKey = Object.keys(nextErrors)[0];
      const target = form.querySelector<HTMLElement>(`[name="${firstKey}"]`);
      target?.focus();
      return;
    }

    setErrors({});
    setSending(true);
    try {
      const result = await (sendContactEmail as any)({
        data: {
          ...values,
          name: values.name.trim(),
          email: values.email.trim(),
          custom_subject: values.subject_category === "other" ? values.custom_subject.trim() : "",
          message: values.message.trim(),
          honeypot,
          turnstile_token: turnstileToken,
        },
      });
      if (result?.ok === false) {
        throw new Error("We couldn't send your message. Please try again.");
      }
      setSent(true);
    } catch (err: any) {
      const message =
        typeof err?.message === "string" && err.message
          ? err.message
          : "We couldn't send your message. Please try again.";
      setErrors({ form: message });
      if ((window as any).turnstile && widgetId.current) {
        (window as any).turnstile.reset(widgetId.current);
        setTurnstileToken("");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <PageShell crumbs={["Contact"]} title="Correspondence" site={site}>
      <p className="prose-editorial">
        Write to{" "}
        <a href={`mailto:${site.email}`} className="text-link hover:underline">
          {site.email}
        </a>
        , or use the form below.
      </p>
      {sent ? (
        <p className="mt-8 bg-muted p-6 font-serif" role="status">
          Thank you — your message has been noted.
        </p>
      ) : (
        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          {errors.form ? (
            <p
              className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
              role="alert"
            >
              {errors.form}
            </p>
          ) : null}

          <div className="block">
            <label className="block" htmlFor="contact-name">
              <span className="label-caps text-muted-foreground">Name</span>
            </label>
            <input
              id="contact-name"
              className={field}
              name="name"
              autoComplete="name"
              maxLength={LIMITS.name}
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
            />
            {errors.name ? (
              <span id="contact-name-error" className="mt-1 block text-sm text-destructive">
                {errors.name}
              </span>
            ) : null}
          </div>

          <div className="block">
            <label className="block" htmlFor="contact-email">
              <span className="label-caps text-muted-foreground">Email</span>
            </label>
            <input
              id="contact-email"
              type="email"
              className={field}
              name="email"
              autoComplete="email"
              maxLength={LIMITS.email}
              value={values.email}
              onChange={(e) => update("email", e.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "contact-email-error" : undefined}
            />
            {errors.email ? (
              <span id="contact-email-error" className="mt-1 block text-sm text-destructive">
                {errors.email}
              </span>
            ) : null}
          </div>

          <div className="block">
            <label className="block" htmlFor="contact-subject">
              <span className="label-caps text-muted-foreground">Subject</span>
            </label>
            <select
              id="contact-subject"
              className={field}
              name="subject_category"
              value={values.subject_category}
              onChange={(e) => update("subject_category", e.target.value)}
              aria-invalid={Boolean(errors.subject)}
              aria-describedby={errors.subject ? "contact-subject-error" : undefined}
            >
              <option value="">Select a subject</option>
              {SUBJECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.subject ? (
              <span id="contact-subject-error" className="mt-1 block text-sm text-destructive">
                {errors.subject}
              </span>
            ) : null}
          </div>

          {values.subject_category === "other" ? (
            <div className="block">
              <label className="block" htmlFor="contact-custom-subject">
                <span className="label-caps text-muted-foreground">Custom Subject</span>
              </label>
              <input
                id="contact-custom-subject"
                type="text"
                className={field}
                name="custom_subject"
                maxLength={LIMITS.subject}
                placeholder="Please specify subject"
                value={values.custom_subject}
                onChange={(e) => update("custom_subject", e.target.value)}
                aria-invalid={Boolean(errors.custom_subject)}
                aria-describedby={
                  errors.custom_subject ? "contact-custom-subject-error" : undefined
                }
              />
              {errors.custom_subject ? (
                <span
                  id="contact-custom-subject-error"
                  className="mt-1 block text-sm text-destructive"
                >
                  {errors.custom_subject}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="block">
            <label className="block" htmlFor="contact-message">
              <span className="label-caps text-muted-foreground">Message</span>
            </label>
            <textarea
              id="contact-message"
              rows={6}
              className={field}
              data-lenis-prevent
              name="message"
              maxLength={LIMITS.message}
              value={values.message}
              onChange={(e) => update("message", e.target.value)}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "contact-message-error" : undefined}
            />
            {errors.message ? (
              <span id="contact-message-error" className="mt-1 block text-sm text-destructive">
                {errors.message}
              </span>
            ) : null}
          </div>

          {/* Honeypot: hidden from people, irresistible to bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="contact-company-website">Company website</label>
            <input
              id="contact-company-website"
              name="company_website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {siteKey ? <div ref={turnstileRef} className="min-h-[65px]" /> : null}

          <button
            type="submit"
            disabled={sending}
            aria-busy={sending}
            className="label-caps bg-primary px-6 py-3 text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      )}
    </PageShell>
  );
}
