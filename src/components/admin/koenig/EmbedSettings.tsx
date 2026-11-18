import type { EditorController } from "./EditorBridge";

/** Edit the native EmbedNode html/metadata, not an independent UI settings map. */
export function EmbedSettings({ controller }: { controller: EditorController }) {
  const fields = controller.selected!.fields;
  const html = String(fields["html"] ?? "");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const frame = doc.querySelector("iframe");
  let url: URL | null = null;
  try {
    if (frame) url = new URL(frame.src);
  } catch {
    /* Source editor remains available. */
  }
  const youtube = url && /^(www\.)?youtube(?:-nocookie)?\.com$/.test(url.hostname);
  const vimeo = url?.hostname === "player.vimeo.com";
  const metadata = fields["metadata"] as Record<string, unknown> | undefined;
  const update = (
    change: (frame: HTMLIFrameElement, url: URL) => void,
    dimensions?: { width?: number; height?: number },
  ) => {
    if (!frame || !url) return;
    change(frame, url);
    frame.src = url.href;
    controller.update({
      html: doc.body.innerHTML,
      metadata: { ...metadata, ...dimensions, html: doc.body.innerHTML },
    });
  };
  return (
    <div className="koenig-controls-grid" aria-label="Embed settings">
      {frame && url && (
        <>
          {youtube || vimeo ? (
            <label>
              Video ratio
              <select
                aria-label="Video ratio"
                value={frame.getAttribute("data-portfolio-embed-ratio") ?? ""}
                onChange={(e) => {
                  const [width, height] = e.target.value.split("/").map(Number);
                  if (!width || !height) return;
                  update(
                    (frame) => {
                      frame.setAttribute("data-portfolio-embed-ratio", `${width}/${height}`);
                      frame.setAttribute("width", String(width * 100));
                      frame.setAttribute("height", String(height * 100));
                      Object.assign(frame.style, {
                        width: "100%",
                        height: "auto",
                        aspectRatio: `${width} / ${height}`,
                      });
                    },
                    { width: width * 100, height: height * 100 },
                  );
                }}
              >
                <option value="">Provider default</option>
                <option value="16/9">16:9</option>
                <option value="4/3">4:3</option>
                <option value="1/1">Square</option>
                <option value="9/16">Portrait 9:16</option>
              </select>
            </label>
          ) : (
            <label>
              Embed height (pixels)
              <input
                aria-label="Embed height"
                type="number"
                min="80"
                max="2000"
                value={frame.getAttribute("height") ?? ""}
                onChange={(e) => {
                  const height = Number(e.target.value);
                  if (height < 80 || height > 2000) return;
                  update(
                    (frame) => {
                      frame.setAttribute("height", String(height));
                      frame.style.height = `${height}px`;
                      frame.style.width = "100%";
                    },
                    { height },
                  );
                }}
              />
            </label>
          )}
          {youtube && (
            <>
              <label>
                Start at (seconds)
                <input
                  aria-label="Start at (seconds)"
                  type="number"
                  min="0"
                  max="86400"
                  value={url.searchParams.get("start") ?? "0"}
                  onChange={(e) => {
                    const start = Number(e.target.value);
                    if (!Number.isInteger(start) || start < 0 || start > 86400) return;
                    update((_frame, url) => {
                      if (start) url.searchParams.set("start", String(start));
                      else url.searchParams.delete("start");
                    });
                  }}
                />
              </label>
              <label className="koenig-control-check">
                <input
                  type="checkbox"
                  checked={url.searchParams.get("controls") !== "0"}
                  onChange={(e) =>
                    update((_frame, url) =>
                      url.searchParams.set("controls", e.target.checked ? "1" : "0"),
                    )
                  }
                />
                Player controls
              </label>
            </>
          )}
          {(youtube || vimeo) && (
            <label className="koenig-control-check">
              <input
                type="checkbox"
                checked={url.searchParams.get("loop") === "1"}
                onChange={(e) =>
                  update((_frame, url) => {
                    url.searchParams.set("loop", e.target.checked ? "1" : "0");
                    if (youtube) {
                      if (e.target.checked)
                        url.searchParams.set("playlist", url.pathname.split("/").pop()!);
                      else url.searchParams.delete("playlist");
                    }
                  })
                }
              />
              Loop video
            </label>
          )}
        </>
      )}
      <label>
        Embed HTML
        <textarea
          aria-label="Embed HTML"
          rows={4}
          value={html}
          onChange={(e) =>
            controller.update({
              html: e.target.value,
              metadata: { ...metadata, html: e.target.value },
            })
          }
        />
      </label>
    </div>
  );
}
