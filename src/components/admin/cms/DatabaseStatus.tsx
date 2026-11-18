/* eslint-disable @typescript-eslint/no-explicit-any */
// Admin banner shown only when the server can't reach the database — so a
// dead connection reads as a clear message instead of editors that hang,
// stay empty or fail to save.
import { useCallback, useEffect, useRef, useState } from "react";
import { checkDatabase } from "@/lib/server-fns";

export function DatabaseStatus() {
  const [down, setDown] = useState(false);
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      const r: any = await (checkDatabase as any)();
      setDown(!r?.ok);
    } catch {
      // Not signed in / network error: the page itself handles that.
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [check]);

  // A transient failure must not leave the banner stuck after recovery.
  useEffect(() => {
    if (!down) return;
    const retry = window.setInterval(() => void check(), 10_000);
    return () => window.clearInterval(retry);
  }, [down, check]);

  if (!down) return null;
  return (
    <div
      role="alert"
      className="mb-6 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
    >
      <p className="font-semibold text-destructive">The database can't be reached right now.</p>
      <p className="mt-1 text-foreground">
        Content won't load or save until the connection is back. Nothing has been lost. If you're
        running the site on your own computer, your network may be blocking the database connection;
        the live site is not affected.
      </p>
      <button
        type="button"
        onClick={() => void check()}
        disabled={checking}
        className="mt-3 min-h-[44px] border border-foreground/40 bg-background px-4 font-semibold hover:bg-muted disabled:opacity-50"
      >
        {checking ? "Checking…" : "Try again"}
      </button>
    </div>
  );
}
