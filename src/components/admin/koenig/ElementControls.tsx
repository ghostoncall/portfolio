import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { EditorController } from "./EditorBridge";
import { CARD_FIELDS, CARD_LABELS, INSERTABLE, NESTED_LABELS, type FieldSpec } from "./catalog";
import { LAYOUT_TYPES } from "./nodes";
import type { CardLayout } from "./layout";
import { KOENIG_FILE_TYPES } from "@/lib/media-upload";
import {
  imageDimensions,
  mediaFileMetadata,
  type KoenigServices,
  type FileUpload,
} from "./services";
import { EmbedSettings } from "./EmbedSettings";
import { SizeControls } from "./ResizeSystem";
import { SIZE_TYPES } from "./sizing";

const textOf = (html: unknown) =>
  new DOMParser().parseFromString(String(html ?? ""), "text/html").body.textContent ?? "";
const isSafeUrl = (value: string) => !value || /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(value);

function PropertyField({
  spec,
  value,
  onCommit,
  disabled = false,
}: {
  spec: FieldSpec;
  value: unknown;
  onCommit: (value: unknown, merge?: boolean) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const first = useRef(true);
  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);
  const commit = (next: unknown) => {
    onCommit(next, !first.current);
    first.current = false;
  };
  const common = {
    disabled,
    "aria-label": spec.label,
    onFocus: () => {
      first.current = true;
    },
    onBlur: () => {
      if (spec.kind === "url" && draft !== String(value ?? "") && isSafeUrl(draft)) commit(draft);
    },
  };
  if (spec.kind === "boolean")
    return (
      <label className="koenig-control-check">
        <input
          disabled={disabled}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onCommit(e.target.checked)}
        />
        {spec.label}
      </label>
    );
  if (spec.kind === "select")
    return (
      <label>
        {spec.label}
        <select
          disabled={disabled}
          aria-label={spec.label}
          value={String(value ?? "")}
          onChange={(e) => onCommit(e.target.value)}
        >
          {spec.options?.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    );
  const change = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value;
    setDraft(next);
    if (spec.kind !== "url") {
      if (spec.kind === "number") {
        if (next && Number.isFinite(Number(next)))
          commit(Math.max(spec.min ?? -Infinity, Math.min(spec.max ?? Infinity, Number(next))));
      } else commit(next);
    }
  };
  return (
    <label>
      {spec.label}
      {spec.kind === "multiline" ? (
        <textarea {...common} rows={4} value={draft} onChange={change} />
      ) : (
        <input
          {...common}
          type={spec.kind === "number" ? "number" : "text"}
          min={spec.min}
          max={spec.max}
          value={draft}
          onChange={change}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      )}
    </label>
  );
}

export function ElementControls({
  controller,
  services,
}: {
  controller: EditorController | null;
  services: KoenigServices;
}) {
  const selected = controller?.selected;
  const selectedUrl = String(selected?.fields["url"] ?? "");
  const selectedLink = String(selected?.fields["link"] ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [textLink, setTextLink] = useState("");
  const request = useRef(0);
  const active = useRef(selected?.key);
  active.current = selected?.key;
  const fileRef = useRef<HTMLInputElement>(null);
  const uploader = services.useFileUpload(selected?.type ?? "image");
  useEffect(() => {
    request.current++;
    setError("");
    setBusy(false);
  }, [selected?.key]);
  useEffect(() => {
    setUrlDraft(selectedUrl);
  }, [selected?.key, selectedUrl]);
  useEffect(() => {
    setTextLink(selectedLink);
  }, [selected?.key, selectedLink]);

  const resolveUrl = async () => {
    if (!controller || !selected) return;
    const key = selected.key,
      type = selected.type,
      generation = ++request.current;
    const before = controller.current(key);
    const url = urlDraft.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("Use a complete http or https URL.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await services.resolveEmbed(
        url,
        type === "bookmark" ? { type: "bookmark" } : {},
      );
      if (
        generation !== request.current ||
        active.current !== key ||
        !controller.current(key) ||
        controller.current(key)?.["url"] !== before?.["url"]
      )
        return;
      if (type === "bookmark" || result["type"] === "bookmark") {
        const metadata = (result["metadata"] as Record<string, unknown>) ?? {};
        if (type === "bookmark") controller.update({ url, ...metadata });
        else
          controller.replace(
            "bookmark",
            { url, metadata, caption: String(selected.fields["caption"] ?? "") },
            key,
          );
      } else
        controller.update({
          url,
          html: result["html"] ?? "",
          embedType: result["type"] ?? "video",
          metadata: result,
        });
    } catch (e) {
      if (generation === request.current && active.current === key)
        setError(e instanceof Error ? e.message : "Could not load this URL.");
    } finally {
      if (generation === request.current) setBusy(false);
    }
  };

  const replaceFile = async (file: File | undefined) => {
    if (!file || !controller || !selected) return;
    const key = selected.key,
      type = selected.type,
      generation = ++request.current;
    const before = controller.current(key);
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploader.upload([file]);
      const asset = uploaded?.[0];
      if (!asset) throw new Error("Upload failed. Please try again.");
      const dimensions =
        type === "image"
          ? await imageDimensions(asset.url)
          : type === "audio" || type === "video"
            ? await mediaFileMetadata(file, type)
            : {};
      if (
        generation !== request.current ||
        active.current !== key ||
        !controller.current(key) ||
        controller.current(key)?.["src"] !== before?.["src"]
      )
        return;
      controller.update({
        src: asset.url,
        ...dimensions,
        ...(type === "file" ? { fileName: asset.fileName ?? file.name, fileSize: file.size } : {}),
      });
    } catch (e) {
      if (generation === request.current)
        setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      if (generation === request.current) setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const imageUrl = async (src: string) => {
    if (!controller || !selected) return;
    const key = selected.key,
      generation = ++request.current,
      before = controller.current(key);
    if (!src) {
      controller.update({ src: "", width: null, height: null });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const dimensions = await imageDimensions(src);
      if (
        generation === request.current &&
        active.current === key &&
        controller.current(key)?.["src"] === before?.["src"]
      )
        controller.update({ src, ...dimensions });
    } catch (e) {
      if (generation === request.current)
        setError(e instanceof Error ? e.message : "Could not load image.");
    } finally {
      if (generation === request.current) setBusy(false);
    }
  };

  const changeLayout = (change: Partial<CardLayout>) => {
    if (!controller) return;
    const before = selected?.layout;
    const base: CardLayout =
      before && before.align !== "default" ? before : { align: "center", size: "m" };
    const next = { ...base, ...change };
    if (change.size && change.size !== "custom") delete next.aspectRatio;
    controller.layout(next);
  };

  return (
    <section
      className="koenig-controls"
      data-kg-settings-panel="true"
      aria-label="Element controls"
    >
      <div className="koenig-controls-toolbar">
        <label>
          Add element
          <select
            aria-label="Add element"
            value=""
            disabled={!controller}
            onChange={(e) => {
              if (e.target.value) controller?.insert(e.target.value);
            }}
          >
            <option value="">Choose…</option>
            {INSERTABLE.map((type) => (
              <option key={type} value={type}>
                {CARD_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!controller?.canUndo}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => controller?.undo()}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!controller?.canRedo}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => controller?.redo()}
        >
          Redo
        </button>
        <span className="koenig-controls-hint">Select an element to edit its settings.</span>
      </div>
      {selected && controller && (
        <fieldset aria-label={`${CARD_LABELS[selected.type] ?? "Text"} settings`}>
          <legend>{CARD_LABELS[selected.type] ?? "Text"}</legend>
          <div className="koenig-controls-actions">
            <button
              type="button"
              disabled={!selected.canMoveUp}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => controller.action("up")}
            >
              Move up
            </button>
            <button
              type="button"
              disabled={!selected.canMoveDown}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => controller.action("down")}
            >
              Move down
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => controller.action("duplicate")}
            >
              Duplicate
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => controller.action("remove")}
            >
              Remove
            </button>
            {selected.isCard && selected.canEdit && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => controller.action("edit")}
              >
                Edit in card
              </button>
            )}
          </div>
          {selected.isCard ? (
            <>
              {SIZE_TYPES.has(selected.type) && <SizeControls controller={controller} />}
              {LAYOUT_TYPES.has(selected.type) && (
                <div className="koenig-layout-settings">
                  <div role="group" aria-label="Element alignment">
                    {(["default", "left", "center", "right", "full"] as const).map((align) => (
                      <button
                        type="button"
                        key={align}
                        aria-pressed={(selected.layout?.align ?? "default") === align}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() =>
                          align === "default"
                            ? controller.layout(null)
                            : changeLayout({
                                align,
                                ...(align === "full"
                                  ? { size: "full" }
                                  : selected.layout?.size === "full"
                                    ? { size: "m" }
                                    : {}),
                              })
                        }
                      >
                        {align === "full" ? "Full width" : align[0]!.toUpperCase() + align.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div role="group" aria-label="Element size">
                    {(["s", "m", "l", "wide", "original", "custom"] as const)
                      .filter((size) => size != "original" || Number(selected.fields["width"]) > 0)
                      .map((size) => (
                        <button
                          type="button"
                          key={size}
                          aria-pressed={
                            selected.layout?.size === size && selected.layout.align !== "default"
                          }
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() =>
                            changeLayout({
                              size,
                              ...(selected.layout?.align === "full" ? { align: "center" } : {}),
                              ...(size === "custom"
                                ? {
                                    width: selected.layout?.width ?? 320,
                                    unit: selected.layout?.unit ?? "px",
                                  }
                                : {}),
                            })
                          }
                        >
                          {size.length === 1
                            ? size.toUpperCase()
                            : size === "wide"
                              ? "Wide (90%)"
                              : size[0]!.toUpperCase() + size.slice(1)}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <div className="koenig-controls-grid">
                {(CARD_FIELDS[selected.type] ?? [])
                  .filter(
                    (spec) =>
                      !(
                        spec.key in
                        (selected.type === "embed" || selected.type === "bookmark"
                          ? { url: true }
                          : {})
                      ),
                  )
                  .map((spec) => (
                    <PropertyField
                      key={`${selected.key}:${spec.key}`}
                      spec={spec}
                      disabled={busy}
                      value={selected.fields[spec.key]}
                      onCommit={(value, merge) => {
                        if (spec.kind === "url" && !isSafeUrl(String(value))) {
                          setError("Use an http, https or relative URL.");
                          return;
                        }
                        if (selected.type === "image" && spec.key === "src")
                          void imageUrl(String(value));
                        else controller.update({ [spec.key]: value }, merge);
                      }}
                    />
                  ))}
              </div>
              {selected.type === "embed" && selected.fields["html"] && (
                <EmbedSettings controller={controller} />
              )}
              {(selected.type === "embed" || selected.type === "bookmark") && (
                <div className="koenig-controls-url">
                  <label>
                    {selected.type === "embed" ? "Embed URL" : "Bookmark URL"}
                    <input
                      aria-label={selected.type === "embed" ? "Embed URL" : "Bookmark URL"}
                      type="url"
                      value={urlDraft}
                      onChange={(e) => {
                        request.current++;
                        setBusy(false);
                        setUrlDraft(e.target.value);
                      }}
                    />
                  </label>
                  <button type="button" disabled={busy} onClick={() => void resolveUrl()}>
                    {busy ? "Loading…" : "Apply URL"}
                  </button>
                </div>
              )}
              {selected.nested.length > 0 && (
                <div className="koenig-controls-nested">
                  {selected.nested.map((field) => (
                    <div key={field}>
                      <span>
                        {NESTED_LABELS[field] ?? field}
                        {selected.fields[field]
                          ? ` · ${textOf(selected.fields[field]).slice(0, 100)}`
                          : ""}
                      </span>
                      <button
                        type="button"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => controller.focusNested(field)}
                      >
                        Edit {String(NESTED_LABELS[field] ?? field).toLowerCase()}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {["image", "video", "audio", "file"].includes(selected.type) && (
                <div className="koenig-controls-actions">
                  <input
                    ref={fileRef}
                    type="file"
                    aria-label={`Replace ${selected.type}`}
                    hidden
                    accept={
                      selected.type === "file"
                        ? undefined
                        : KOENIG_FILE_TYPES[
                            selected.type as "image" | "video" | "audio"
                          ].mimeTypes.join(",")
                    }
                    onChange={(e) => void replaceFile(e.target.files?.[0])}
                  />
                  <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
                    {busy ? "Uploading…" : `Replace ${selected.type}`}
                  </button>
                </div>
              )}
              {selected.type === "gallery" && (
                <GalleryControls
                  key={selected.key}
                  controller={controller}
                  uploader={uploader}
                  images={selected.fields["images"]}
                />
              )}
            </>
          ) : (
            <div className="koenig-text-settings">
              <label>
                Text block
                <select
                  aria-label="Text block"
                  value={selected.blockType ?? "paragraph"}
                  onChange={(e) => controller.text("block", e.target.value)}
                >
                  {[
                    "paragraph",
                    "h1",
                    "h2",
                    "h3",
                    "h4",
                    "h5",
                    "h6",
                    "quote",
                    "bullet",
                    "number",
                  ].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Text alignment
                <select
                  aria-label="Text alignment"
                  value={selected.alignment || "left"}
                  onChange={(e) => controller.text("align", e.target.value)}
                >
                  {["left", "center", "right", "justify"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <div role="group" aria-label="Text formatting">
                {[
                  "bold",
                  "italic",
                  "underline",
                  "strikethrough",
                  "code",
                  "subscript",
                  "superscript",
                ].map((format) => (
                  <button
                    type="button"
                    key={format}
                    aria-pressed={!!selected.fields[format]}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => controller.text("format", format)}
                  >
                    {format}
                  </button>
                ))}
              </div>
              <label>
                Selected text size
                <select
                  aria-label="Selected text size"
                  value={String(selected.fields["fontSize"] ?? "")}
                  onChange={(e) => controller.text("size", e.target.value)}
                >
                  <option value="">Theme default</option>
                  {[12, 14, 16, 17, 18, 20, 24, 28, 32, 40, 48].map((size) => (
                    <option key={size} value={`${size}px`}>
                      {size}px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Text link
                <input
                  aria-label="Text link"
                  value={textLink}
                  onChange={(e) => setTextLink(e.target.value)}
                />
              </label>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (isSafeUrl(textLink)) controller.text("link", textLink);
                  else setError("Use a complete or relative URL.");
                }}
              >
                Apply link
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => controller.text("indent", "")}
              >
                Indent
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => controller.text("outdent", "")}
              >
                Outdent
              </button>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
        </fieldset>
      )}
    </section>
  );
}

function GalleryControls({
  controller,
  images,
  uploader,
}: {
  controller: EditorController;
  images: unknown;
  uploader: FileUpload;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = Array.isArray(images) ? (images as Record<string, unknown>[]) : [];
  const set = (next: Record<string, unknown>[]) =>
    controller.update({ images: next.map((image, i) => ({ ...image, row: Math.floor(i / 3) })) });
  const source = async (index: number, src: string) => {
    const key = controller.selected!.key,
      before = list[index]?.["src"],
      request = ++generation.current;
    if (!src || !isSafeUrl(src)) {
      setError("Use an image URL that can be loaded.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const dimensions = await imageDimensions(src);
      const current = controller.current(key)?.["images"];
      if (
        request === generation.current &&
        Array.isArray(current) &&
        current[index]?.src === before
      )
        set(current.map((entry, i) => (i === index ? { ...entry, src, ...dimensions } : entry)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load image.");
    } finally {
      if (request === generation.current) setBusy(false);
    }
  };
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const key = controller.selected?.key;
    if (!key) return;
    setError("");
    try {
      const uploaded = await uploader.upload(Array.from(files).slice(0, 9 - list.length));
      if (!uploaded) throw new Error("Upload failed.");
      const additions = await Promise.all(
        uploaded.map(async (file) => ({
          src: file.url,
          fileName: file.fileName ?? "",
          alt: "",
          ...(await imageDimensions(file.url)),
        })),
      );
      const current = controller.current(key)?.["images"];
      if (Array.isArray(current)) set([...current, ...additions].slice(0, 9));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add images.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <div className="koenig-controls-gallery" aria-label="Gallery images">
      {list.map((image, index) => (
        <div key={index}>
          <strong>Image {index + 1}</strong>
          <PropertyField
            spec={{ key: "src", label: `Image ${index + 1} URL`, kind: "url" }}
            value={image["src"]}
            disabled={busy}
            onCommit={(value) => void source(index, String(value))}
          />
          <PropertyField
            spec={{ key: "alt", label: `Image ${index + 1} alt text` }}
            value={image["alt"]}
            onCommit={(value) =>
              set(list.map((entry, i) => (i === index ? { ...entry, alt: value } : entry)))
            }
          />
          <button
            type="button"
            disabled={index === 0}
            onClick={() => {
              const next = [...list];
              [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
              set(next);
            }}
          >
            Earlier
          </button>
          <button
            type="button"
            disabled={index === list.length - 1}
            onClick={() => {
              const next = [...list];
              [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
              set(next);
            }}
          >
            Later
          </button>
          <button type="button" onClick={() => set(list.filter((_, i) => i !== index))}>
            Remove image {index + 1}
          </button>
        </div>
      ))}
      {list.length < 9 && (
        <>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            aria-label="Add gallery images"
            accept={KOENIG_FILE_TYPES.image.mimeTypes.join(",")}
            onChange={(e) => void add(e.target.files)}
          />
          <button
            type="button"
            disabled={uploader.isLoading || busy}
            onClick={() => fileRef.current?.click()}
          >
            Add gallery images
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
