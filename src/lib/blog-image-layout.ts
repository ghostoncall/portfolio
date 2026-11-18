import type { PostImageLayout } from "@/content/site";

export function decodeImageAttribute(value: string): string {
  return value.replace(/&(?:amp|#38|#x26);/gi, "&");
}

export function imageLayoutForSource(
  layouts: Record<string, PostImageLayout>,
  src: string,
): PostImageLayout | undefined {
  return (
    layouts[src] ??
    Object.entries(layouts).find(
      ([key]) => decodeImageAttribute(key) === decodeImageAttribute(src),
    )?.[1]
  );
}

export function imageLayoutClasses(layout: PostImageLayout): string[] {
  return [`kg-layout-${layout.align}`, ...(layout.size ? [`kg-size-${layout.size}`] : [])];
}

/** Decorate Koenig's editing DOM without changing its document or selection. */
export function syncEditorImageLayouts(
  host: HTMLElement,
  layouts: Record<string, PostImageLayout>,
) {
  const root = host.querySelector<HTMLElement>('.kg-prose[contenteditable="true"]');
  if (!root) return;
  root.classList.add("kg-content");
  for (const card of root.querySelectorAll<HTMLElement>('[data-kg-card="image"]')) {
    const wrapper = card.closest<HTMLElement>("[data-lexical-decorator]");
    if (!wrapper) continue;
    for (const cls of [...wrapper.classList]) {
      if (/^kg-(?:layout|size)-/.test(cls)) wrapper.classList.remove(cls);
    }
    const src = card.querySelector("img")?.getAttribute("src");
    const layout = src ? imageLayoutForSource(layouts, src) : undefined;
    if (layout) {
      wrapper.classList.add(...imageLayoutClasses(layout));
      wrapper.dataset["blogImageLayout"] = layout.align;
    } else {
      delete wrapper.dataset["blogImageLayout"];
    }
  }
}
