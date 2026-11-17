// Floating "Back to top" control for public pages.
//
// Appears after ~1.5 screens of scrolling. Pure CSS transitions: on hover the
// circle grows slightly and the arrow nudges upward. Scrolls through Lenis
// when it's active, otherwise native window.scrollTo (instant for
// reduced-motion visitors). While
// hidden it is `inert`, so it can't be tabbed to or announced.
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLenis } from "lenis/react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const lenis = useLenis();

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > window.innerHeight * 1.5);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  function toTop() {
    if (lenis) {
      // Same easing as wheel scrolling (Lenis is off for reduced motion).
      lenis.scrollTo(0);
    } else {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
    // Move focus to the top of the document for keyboard users.
    document.querySelector<HTMLElement>("header a, header button")?.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      inert={!visible}
      className={`group fixed z-30 flex h-14 w-14 items-center justify-center rounded-full border border-foreground/40 bg-background/95 text-foreground transition-[opacity,transform,border-color] duration-200 ease-out hover:scale-110 hover:border-foreground focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100 ${
        visible ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
      style={{
        // Bottom-right. On wide windows it moves in by a quarter of the empty
        // side margin (beyond the 80rem page), so it isn't lost in the far
        // corner but stays well right of the content.
        right: "max(1.25rem, calc((100vw - 80rem) / 4 + 1.25rem), env(safe-area-inset-right))",
        bottom: "max(1.75rem, calc(env(safe-area-inset-bottom) + 1rem))",
      }}
    >
      <ArrowUp
        aria-hidden="true"
        strokeWidth={1.5}
        className="h-5 w-5 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
      />
    </button>
  );
}
