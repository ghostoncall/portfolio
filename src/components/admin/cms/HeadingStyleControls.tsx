// Font / Bold / Italic controls for a heading, with a live sample.
// Used for the site-wide defaults (Settings) and per heading (page editor).
import {
  HEADING_FONTS,
  headingInlineStyle,
  type HeadingFontId,
  type HeadingStyle,
} from "@/lib/typography";

export function HeadingStyleControls({
  label,
  sample,
  level = "h2",
  value,
  onChange,
  inheritLabel = "Default",
}: {
  label: string;
  sample?: string;
  level?: "h1" | "h2" | "h3";
  value: HeadingStyle | undefined;
  onChange: (next: HeadingStyle | undefined) => void;
  inheritLabel?: string;
}) {
  const v = value ?? {};
  const set = (patch: Partial<HeadingStyle>) => {
    const next: HeadingStyle = { ...v, ...patch };
    (Object.keys(next) as (keyof HeadingStyle)[]).forEach((k) => {
      if (next[k] === undefined) delete next[k];
    });
    onChange(Object.keys(next).length ? next : undefined);
  };
  const toggle = "border px-2.5 py-1 text-xs transition-colors";
  const on = "border-foreground bg-foreground text-background";
  const off = "border-border text-muted-foreground hover:text-foreground";
  const Sample = level;

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={v.font ?? ""}
          onChange={(e) =>
            set({ font: (e.target.value || undefined) as HeadingFontId | undefined })
          }
          aria-label={`${label} font`}
          className="border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="">{inheritLabel} font</option>
          {HEADING_FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={v.bold === true}
          onClick={() => set({ bold: v.bold ? undefined : true })}
          className={`${toggle} font-bold ${v.bold ? on : off}`}
        >
          B<span className="sr-only">old</span>
        </button>
        <button
          type="button"
          aria-pressed={v.italic === true}
          onClick={() => set({ italic: v.italic ? undefined : true })}
          className={`${toggle} italic ${v.italic ? on : off}`}
        >
          I<span className="sr-only">talic</span>
        </button>
      </div>
      {sample && (
        <Sample
          className={`truncate text-foreground ${level === "h1" ? "text-3xl" : "text-2xl"}`}
          style={headingInlineStyle(v)}
        >
          {sample}
        </Sample>
      )}
    </div>
  );
}
