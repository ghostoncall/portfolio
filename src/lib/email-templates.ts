// Email template system — reusable, design-system-matched HTML emails.
//
// Every email reuses `baseEmailTemplate` so future notification types share
// the same branding, typography, colours and layout as the website. All CSS
// is inline (email clients strip `<style>` blocks), layouts are table-based,
// and there is no JavaScript.
//
// Colours mirror src/styles.css:
//   foreground  oklch(0.2 0 0)   -> #1a1a1a   ink
//   background  oklch(0.995 0.002 90) -> #fdfdfd near-white paper
//   border      oklch(0.88 0 0)   -> #e0e0e0  hairline
//   link        oklch(0.5 0.07 245) -> #4a5fd6
//   muted       oklch(0.48 0 0)   -> #737373
//
// Fonts fall back to Georgia/serif because external web fonts load
// inconsistently across email clients.

const INK = "#1a1a1a";
const PAPER = "#fdfdfd";
const CARD = "#ffffff";
const BORDER = "#e0e0e0";
const MUTED = "#737373";
const LINK = "#4a5fd6";

const SERIF = "'Libre Baskerville', Georgia, serif";
const DISPLAY = "'Cormorant Garamond', Georgia, serif";
const SANS = "'Lato', system-ui, sans-serif";

/** Escape text for safe placement inside HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Turn the visitor's multi-line message into paragraph blocks. */
function messageBlocks(message: string): string {
  return message
    .split(/\n+/)
    .map((line) => {
      const text = escapeHtml(line.trim());
      if (!text) return "";
      return `<p style="margin:0 0 12px 0;font-family:${SERIF};font-size:15px;line-height:1.7;color:${INK}">${text}</p>`;
    })
    .join("");
}

/** Shared scaffold: brand header, content region, clean footer. */
export function baseEmailTemplate({
  title,
  preview,
  siteName,
  siteEdition,
  body,
}: {
  title: string;
  preview?: string;
  siteName: string;
  siteEdition: string;
  body: string;
}): { html: string; text: string; subject: string } {
  const safeTitle = escapeHtml(title);
  const safeSiteName = escapeHtml(siteName);
  const safeSiteEdition = escapeHtml(siteEdition);
  const previewText = preview ? escapeHtml(preview) : safeTitle;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAPER};color:${INK};font-family:${SANS};-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:${PAPER};padding:24px 12px">
    <tr>
      <td align="center">
        <!-- Outer container: capped width, hairline border, square corners. -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;background-color:${CARD};border:1px solid ${BORDER}">
          <!-- Brand header -->
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid ${BORDER}">
              <h1 style="margin:0;font-family:${DISPLAY};font-size:26px;font-weight:400;letter-spacing:-0.01em;color:${INK}">${safeSiteName}</h1>
              <p style="margin:4px 0 0 0;font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED}">${safeSiteEdition}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px">${body}</td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px;border-top:1px solid ${BORDER};font-family:${SANS};font-size:12px;line-height:1.5;color:${MUTED}">
              <p style="margin:0 0 6px 0">${safeSiteName} · ${safeSiteEdition}</p>
              <p style="margin:0">Sent from your portfolio contact form — reply to this email to respond.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.replace(/\n\s*/g, " ");

  const text = [
    `${safeSiteName} — ${safeSiteEdition}`,
    "=".repeat(Math.max(safeTitle.length, 10)),
    "",
    previewText,
    "",
    ...body
      .replace(/<[^>]*>/g, "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean),
    "",
    `${safeSiteName} · ${safeSiteEdition}`,
    "Sent from your portfolio contact form — reply to this email to respond.",
  ].join("\n");

  return { html, text, subject: safeTitle };
}

/** Contact-form notification email presented to the site owner. */
export function contactNotificationEmail({
  name,
  email,
  subject,
  customSubject,
  message,
  siteName,
  siteEdition,
}: {
  name: string;
  email: string;
  subject: string;
  customSubject?: string;
  message: string;
  siteName: string;
  siteEdition: string;
}): { html: string; text: string; subject: string } {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const date = new Date().toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const body = `
    <h2 style="margin:0 0 16px 0;font-family:${DISPLAY};font-size:20px;font-weight:400;letter-spacing:-0.01em;color:${INK}">New contact form submission</h2>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:20px">
      <tr>
        <td style="padding:8px 0;font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};width:33%">Name</td>
        <td style="padding:8px 0;font-family:${SERIF};font-size:15px;color:${INK};text-align:right">${safeName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">Email</td>
        <td style="padding:8px 0;font-family:${SERIF};font-size:15px;color:${INK};text-align:right"><a href="mailto:${safeEmail}" style="color:${LINK};text-decoration:none;font-weight:600">${safeEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">Subject</td>
        <td style="padding:8px 0;font-family:${SERIF};font-size:15px;color:${INK};text-align:right">${safeSubject}</td>
      </tr>
      ${
        customSubject
          ? `<tr>
          <td style="padding:8px 0;font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">Custom subject</td>
          <td style="padding:8px 0;font-family:${SERIF};font-size:15px;color:${INK};text-align:right">${escapeHtml(customSubject)}</td>
        </tr>`
          : ""
      }
      <tr>
        <td style="padding:16px 0 0 0;font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">Received</td>
        <td style="padding:16px 0 0 0;font-family:${SERIF};font-size:15px;color:${INK};text-align:right">${escapeHtml(date)}</td>
      </tr>
    </table>

    <div style="color:${MUTED};font-family:${SANS};font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">Message</div>
    <div style="border:1px solid ${BORDER};padding:16px">${messageBlocks(message)}</div>

    <p style="margin-top:22px;font-family:${SANS};font-size:12px;line-height:1.5;color:${MUTED}">Reply to this email to answer ${safeName}.</p>
  `;

  return baseEmailTemplate({
    title: `New contact form submission — ${safeName}`,
    preview: `Message from ${safeName} (${safeEmail})`,
    siteName,
    siteEdition,
    body,
  });
}
