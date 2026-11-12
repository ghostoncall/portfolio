# Email Template Redesign — Design Doc

**Date:** 2026-11-12  
**Area:** Contact-form notification email (only email path in the app)  
**Size:** Project (reusable template system)

## Intent & Why
Emails sent by the portfolio (currently only contact-form notifications to engineerthisaryan@gmail.com) use generic corporate HTML with system fonts, blue links, gray backgrounds, and rounded corners. They do not match the website's editorial design language. The goal is to make every email look like it was designed by the same person who designed the site: ink on near-white paper, serif display type, hairline rules, square corners, no gradients, restrained spacing.

## Goals
- Reusable email template system in `src/lib/email-templates.ts` so future email types share branding/components.
- Contact notification email presents: sender name, clickable sender email (mailto + Reply-To header preserved), subject, date/time, full message — scannable hierarchy.
- Brand header + clean footer consistent with the site.
- Plain-text fallback included.
- Do not break: contact form UI/UX, Turnstile/honeypot/rate-limit/duplicate protection, Supabase persistence, `emailDeliveryStatus` tracking, SMTP delivery path, or auth/DB schemas.

## Constraints
- Table-based layout, inline CSS only, no JavaScript.
- Email-safe font stack with fallbacks (external fonts load inconsistently).
- Compatible with Gmail, Outlook, Apple Mail, mobile clients; dark-mode readable; responsive (no horizontal overflow).
- Do not expose secrets in frontend; no new paid services/dependencies.
- Use existing SMTP env vars (SMTP_HOST/PORT/User/Pass/From/To) — already configured for Gmail.
- Reuse `site.name` / `site.edition` for header branding (matches website identity).

## Approaches Considered
| Approach | Trade-off | Verdict |
|---|---|---|
| Keep inline HTML, tweak colours | Fast but not reusable; stays generic | Rejected |
| New dependency (MJML, React Email, etc.) | New build step/dependency, against "no new deps" | Rejected |
| Dedicated `src/lib/email-templates.ts` module + wire into existing `sendContactEmail` | Reusable, no new deps, preserves all protection | Selected |

## Decisions (calls made)
- Header uses `site.name` / `site.edition` from `getSiteIdentity()` (same as website header).
- Colour palette: ink foreground `oklch(0.2 0 0)`, near-white background `oklch(0.995 0.002 90)`, hairline border `oklch(0.88 0 0)`, link `oklch(0.5 0.07 245)`.
- Font stack: `Cormorant Garamond`/`Libre Baskerville` with Georgia/serif fallback; `Lato` for labels/buttons.
- Square corners (radius 0), hairline 1px borders, no box-shadows.
- Reply-To remains the visitor (already correct); From remains `Portfolio Contact <SMTP_FROM>`.
- Sender email in body is a `mailto:` link (clickable to reply).
- Plain-text mirror of HTML for clients that prefer text.

## Files
- Create: `src/lib/email-templates.ts` — `baseEmailTemplate()`, `contactNotificationEmail()`, `toPlainText()`.
- Modify: `src/lib/server-fns.ts` `sendContactEmail` handler — replace inline `html:` block with template call; keep SMTP, protections, persistence, status tracking identical.

## What's left to builder
- Implement templates and wire into `sendContactEmail`.
- Submit a real contact form; verify delivery to engineerthisaryan@gmail.com; check plain-text + mobile rendering.
