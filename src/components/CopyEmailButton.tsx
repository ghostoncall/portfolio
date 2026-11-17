// One-click copy for the configured contact email (site identity → email).
// Uses the async Clipboard API, falls back to a hidden-textarea copy for
// browsers/contexts without it, and reports the result to screen readers.
import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

type State = "idle" | "copied" | "failed";

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copy command was rejected");
}

export function CopyEmailButton({ email, className = "" }: { email: string; className?: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!email) return null;

  async function onCopy() {
    try {
      await copyText(email);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  const label =
    state === "copied" ? "Copied!" : state === "failed" ? "Press Ctrl/⌘+C to copy" : "Copy";

  return (
    <span className={`inline-flex items-center gap-1.5 align-middle ${className}`}>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy email address ${email}`}
        title="Copy email address"
        className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {state === "copied" ? (
          <Check aria-hidden="true" className="h-3.5 w-3.5" />
        ) : (
          <Copy aria-hidden="true" className="h-3.5 w-3.5" />
        )}
      </button>
      <span
        role="status"
        className={`font-sans text-xs text-muted-foreground transition-opacity duration-200 ${
          state === "idle" ? "opacity-0" : "opacity-100"
        }`}
      >
        {state === "idle" ? "" : label}
      </span>
    </span>
  );
}
