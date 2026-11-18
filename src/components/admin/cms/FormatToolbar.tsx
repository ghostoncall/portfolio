// Formatting toolbar for every text field in the admin panel.
//
// Mounted once in the admin layout. Whenever a text box or text area gets
// focus, a small bar appears just above it: Bold, Italic, Underline, a font
// picker and "Clear". Select some words first to format just those; with
// nothing selected the whole field is formatted. Ctrl/⌘+B, I and U work too.
// The marks it inserts (see src/lib/rich-inline.tsx) are rendered as real
// formatting on the public site.
//
// Fields that aren't display text — links, slugs, emails, dates, numbers,
// search boxes, IDs — are skipped automatically; any field can opt out with
// `data-plain`.
import { useCallback, useEffect, useRef, useState } from "react";
import { FONT_OPTIONS, plainText, Rich, hasRich } from "@/lib/rich-inline";

type Field = HTMLInputElement | HTMLTextAreaElement;

const SKIP_TYPES = new Set([
  "url",
  "email",
  "number",
  "date",
  "datetime-local",
  "time",
  "month",
  "search",
  "password",
  "tel",
  "color",
  "range",
  "file",
  "checkbox",
  "radio",
  "hidden",
]);
const SKIP_HINT = /(url|link|href|slug|https?:|e-?mail|@|\bid\b|date|year|search|filter|token|key|path|\.pdf|alt text)/i;

function isRichField(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (el.readOnly || el.disabled || el.closest("[data-plain]") || el.hasAttribute("data-plain"))
    return false;
  if (el instanceof HTMLInputElement && SKIP_TYPES.has(el.type)) return false;
  if (el.closest("[data-format-toolbar]")) return false;
  const hint = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.dataset["testid"]]
    .filter(Boolean)
    .join(" ");
  if (SKIP_HINT.test(hint)) return false;
  // A field currently holding a link is a link field.
  if (/^(https?:\/\/|\/|mailto:)/i.test(el.value.trim())) return false;
  return true;
}

/** Set a React-controlled field's value so its onChange fires. */
function setValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function range(el: Field): [number, number] {
  const s = el.selectionStart ?? 0;
  const e = el.selectionEnd ?? 0;
  return s === e ? [0, el.value.length] : [s, e];
}

/** Wrap the selection (or the whole field) in open/close marks; toggles off if already wrapped. */
function toggleWrap(el: Field, open: string, close: string) {
  const v = el.value;
  const [s, e] = range(el);
  const sel = v.slice(s, e);
  let next: string;
  let selStart: number;
  let selEnd: number;
  if (sel.startsWith(open) && sel.endsWith(close) && sel.length >= open.length + close.length) {
    const inner = sel.slice(open.length, sel.length - close.length);
    next = v.slice(0, s) + inner + v.slice(e);
    [selStart, selEnd] = [s, s + inner.length];
  } else if (v.slice(s - open.length, s) === open && v.slice(e, e + close.length) === close) {
    next = v.slice(0, s - open.length) + sel + v.slice(e + close.length);
    [selStart, selEnd] = [s - open.length, e - open.length];
  } else {
    // Keep surrounding spaces outside the marks ("**word** " not "**word **").
    const lead = sel.length - sel.trimStart().length;
    const trail = sel.length - sel.trimEnd().length;
    const core = sel.trim();
    if (!core) return;
    next = v.slice(0, s + lead) + open + core + close + v.slice(e - trail);
    [selStart, selEnd] = [s + lead, s + lead + open.length + core.length + close.length];
  }
  setValue(el, next);
  el.focus();
  el.setSelectionRange(selStart, selEnd);
}

function setFont(el: Field, font: string) {
  const v = el.value;
  const [s, e] = range(el);
  // Remove any font marks inside the selection first, then wrap.
  const sel = v.slice(s, e).replace(/\[font:[a-z]+\]|\[\/font\]/g, "");
  const wrapped = font ? `[font:${font}]${sel}[/font]` : sel;
  setValue(el, v.slice(0, s) + wrapped + v.slice(e));
  el.focus();
  el.setSelectionRange(s, s + wrapped.length);
}

function clearFormatting(el: Field) {
  const v = el.value;
  const [s, e] = range(el);
  const cleared = plainText(v.slice(s, e));
  setValue(el, v.slice(0, s) + cleared + v.slice(e));
  el.focus();
  el.setSelectionRange(s, s + cleared.length);
}

export function FormatToolbar() {
  const [target, setTarget] = useState<Field | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [value, setValueState] = useState("");
  const barRef = useRef<HTMLDivElement>(null);

  const place = useCallback((el: Field) => {
    const r = el.getBoundingClientRect();
    const h = barRef.current?.offsetHeight ?? 40;
    const above = r.top - h - 6;
    setPos({
      top: above > 8 ? above : r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - (barRef.current?.offsetWidth ?? 360) - 8)),
    });
  }, []);

  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if (isRichField(e.target)) {
        setTarget(e.target);
        setValueState(e.target.value);
        place(e.target);
      } else if (!(e.target instanceof Node && barRef.current?.contains(e.target))) {
        setTarget(null);
      }
    };
    const onInput = (e: Event) => {
      if (e.target === target && target) setValueState(target.value);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || !isRichField(e.target)) return;
      const k = e.key.toLowerCase();
      const marks: Record<string, [string, string]> = { b: ["**", "**"], i: ["*", "*"], u: ["__", "__"] };
      if (marks[k]) {
        e.preventDefault();
        toggleWrap(e.target, ...marks[k]!);
      }
    };
    const reposition = () => target && place(target);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [target, place]);

  // Hide when the field leaves the page (drawer closed, etc.).
  useEffect(() => {
    if (!target) return;
    const t = window.setInterval(() => {
      if (!target.isConnected) setTarget(null);
    }, 500);
    return () => window.clearInterval(t);
  }, [target]);

  if (!target || !pos) return null;

  // Buttons must not steal focus/selection from the field.
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center px-2 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div
      ref={barRef}
      data-format-toolbar=""
      role="toolbar"
      aria-label="Text formatting"
      className="fixed z-[100] flex max-w-[calc(100vw-1rem)] flex-col border border-border bg-background shadow-md"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="flex flex-wrap items-center">
        <button type="button" className={`${btn} font-bold`} onMouseDown={keep} onClick={() => toggleWrap(target, "**", "**")} title="Bold (Ctrl/⌘+B)" aria-label="Bold">
          B
        </button>
        <button type="button" className={`${btn} italic font-serif`} onMouseDown={keep} onClick={() => toggleWrap(target, "*", "*")} title="Italic (Ctrl/⌘+I)" aria-label="Italic">
          I
        </button>
        <button type="button" className={`${btn} underline`} onMouseDown={keep} onClick={() => toggleWrap(target, "__", "__")} title="Underline (Ctrl/⌘+U)" aria-label="Underline">
          U
        </button>
        <label className="flex items-center border-l border-border pl-2 text-xs text-muted-foreground">
          <span className="sr-only">Font</span>
          <select
            className="h-8 bg-background pr-1 text-sm text-foreground outline-none"
            value=""
            onChange={(e) => setFont(target, e.target.value === "default" ? "" : e.target.value)}
            aria-label="Font"
          >
            <option value="" disabled>
              Font…
            </option>
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
            <option value="default">Default font</option>
          </select>
        </label>
        <button type="button" className={`${btn} border-l border-border text-xs`} onMouseDown={keep} onClick={() => clearFormatting(target)} title="Remove formatting">
          Clear
        </button>
        <span className="px-2 text-[11px] text-muted-foreground">
          Select words to format part of the text
        </span>
      </div>
      {hasRich(value) && (
        <div className="max-w-[36rem] border-t border-border px-2 py-1.5 text-sm text-foreground">
          <span className="mr-2 text-[11px] uppercase tracking-wider text-muted-foreground">Looks like</span>
          <Rich text={value} />
        </div>
      )}
    </div>
  );
}
