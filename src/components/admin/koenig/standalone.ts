/** Koenig's exported audio/video/gallery/toggle markup normally needs Ghost's
 * frontend scripts. This site doesn't load them. Adapt only these card exports
 * to native browser controls; preserve native classes, data and import format.
 * This runs during node serialization, never against the live editor DOM.
 */
export function standaloneCard(
  element: HTMLElement,
  type: string,
  fields?: Record<string, unknown>,
): HTMLElement {
  if (type === "button" && ["left", "center", "right"].includes(String(fields?.["alignment"])))
    element.style.textAlign = String(fields!["alignment"]);
  if (type === "audio" || type === "video") {
    const media = element.querySelector<HTMLMediaElement>(type);
    if (media) {
      media.controls = true;
      element
        .querySelectorAll(
          `.kg-${type}-player,.kg-video-overlay,.kg-video-player-container,.kg-audio-thumbnail.placeholder`,
        )
        .forEach((el) => el.remove());
      if (type === "video") {
        // Upstream emits unquoted empty thumbnail attributes, which can consume
        // the following attribute. Restore them from canonical node properties.
        if (fields) {
          element.setAttribute("data-kg-thumbnail", String(fields["thumbnailSrc"] ?? ""));
          element.setAttribute(
            "data-kg-custom-thumbnail",
            String(fields["customThumbnailSrc"] ?? ""),
          );
        }
        const poster =
          element.getAttribute("data-kg-custom-thumbnail") ||
          element.getAttribute("data-kg-thumbnail");
        if (poster) (media as HTMLVideoElement).poster = poster;
        media.style.height = "auto";
      } else {
        const artwork = element.querySelector<HTMLImageElement>(".kg-audio-thumbnail");
        if (artwork?.getAttribute("src"))
          Object.assign(artwork.style, { width: "72px", height: "72px", objectFit: "cover" });
        else artwork?.remove();
      }
    }
  }
  if (type === "gallery") {
    const container = element.querySelector<HTMLElement>(".kg-gallery-container");
    if (container)
      Object.assign(container.style, { display: "flex", flexDirection: "column", gap: "0.75rem" });
    element.querySelectorAll<HTMLElement>(".kg-gallery-row").forEach((row) => {
      Object.assign(row.style, { display: "flex", gap: "0.75rem" });
      row.querySelectorAll<HTMLElement>(".kg-gallery-image").forEach((cell) => {
        const image = cell.querySelector("img");
        const ratio = image
          ? Number(image.getAttribute("width")) / Number(image.getAttribute("height"))
          : 1;
        Object.assign(cell.style, {
          flex: `${Number.isFinite(ratio) && ratio > 0 ? ratio : 1} 1 0%`,
          minWidth: "0",
        });
        if (image) Object.assign(image.style, { width: "100%", height: "auto" });
      });
    });
  }
  if (type === "toggle") {
    const heading = element.querySelector(".kg-toggle-heading");
    const content = element.querySelector(".kg-toggle-content");
    if (heading && content) {
      heading.querySelector("button")?.remove();
      const details = document.createElement("details"),
        summary = document.createElement("summary");
      summary.className = heading.className;
      summary.append(...Array.from(heading.childNodes));
      details.append(summary, content);
      element.replaceChildren(details);
    }
  }
  return element;
}
