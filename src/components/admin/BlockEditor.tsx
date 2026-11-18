/* eslint-disable @typescript-eslint/no-explicit-any */
// Editable block array for /onlyme. Each block type gets its own form fields.
// Changes flow up via onChange(blocks) — the parent route persists to staged.

import React from "react";
import type { Block } from "@/content/site";
import { HeadingStyleControls } from "@/components/admin/cms/HeadingStyleControls";
import { MediaItemFields } from "@/components/admin/MediaPicker";
import { SortableList } from "@/components/admin/cms/SortableList";
import { GripVertical } from "lucide-react";
import type { FeaturedProjectsBlock } from "@/lib/featured-projects";
import {
  MEDIA_POSITION_OPTIONS,
  MEDIA_RATIO_OPTIONS,
  type MediaFit,
  type MediaPosition,
} from "@/components/media";

type BlockEditorProps = {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  reorderable?: boolean;
  renderFeaturedProjects?: (block: FeaturedProjectsBlock, index: number) => React.ReactNode;
};

const field =
  "w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm";

const label = (t: string) => (
  <span className="block text-xs font-medium text-muted-foreground mb-1">{t}</span>
);

const textarea = (
  value: string,
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void,
  rows = 3,
) => <textarea value={value} onChange={onChange} rows={rows} className={field} />;

const input = (
  value: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  type = "text",
) => <input type={type} value={value} onChange={onChange} className={field} />;

const select = (
  value: string,
  options: { label: string; value: string }[],
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void,
) => (
  <select value={value} onChange={onChange} className={field}>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

const checkbox = (checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={onChange}
    className="rounded border-input bg-background text-primary focus:ring-primary focus:ring-offset-background"
  />
);

function deleteBlock(index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  onChange(blocks.filter((_, i) => i !== index));
}

function addBlock(blocks: Block[], onChange: (b: Block[]) => void, type: Block["type"]) {
  const newBlock: Block =
    type === "featured-projects"
      ? { type: "featured-projects", visible: true }
      : type === "text"
        ? { type: "text", body: "" }
        : type === "heading"
          ? { type: "heading", text: "" }
          : type === "list"
            ? { type: "list", items: [""] }
            : type === "media"
              ? { type: "media", items: [], ratio: "natural", fit: "contain" }
              : type === "image"
                ? { type: "image", alt: "", ratio: "natural", fit: "contain" }
                : type === "video"
                  ? { type: "video" }
                  : type === "link"
                    ? { type: "link", href: "", title: "" }
                    : type === "code"
                      ? { type: "code", language: "text", code: "" }
                      : type === "file"
                        ? { type: "file", name: "" }
                        : type === "quote"
                          ? { type: "quote", text: "" }
                          : { type: "callout", body: "" };
  onChange([...blocks, newBlock]);
}

function updateBlock(
  blocks: Block[],
  index: number,
  next: Partial<Block>,
  onChange: (b: Block[]) => void,
) {
  onChange(blocks.map((b, i) => (i === index ? ({ ...b, ...next } as Block) : b)));
}

function MediaEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  const media = block as Extract<Block, { type: "media" }>;
  const {
    count = 1,
    layout = "carousel",
    ratio = "16/9",
    fit = "cover",
    position = "center",
    caption = "",
    credit = "",
    items = [],
  } = media;
  const setCount = (count: number) => updateBlock(blocks, index, { count }, onChange);
  const setLayout = (layout: NonNullable<typeof media.layout>) =>
    updateBlock(blocks, index, { layout }, onChange);
  const setRatio = (ratio: string) => updateBlock(blocks, index, { ratio }, onChange);
  const setFit = (fit: NonNullable<typeof media.fit>) =>
    updateBlock(blocks, index, { fit }, onChange);
  const setPosition = (position: MediaPosition) =>
    updateBlock(blocks, index, { position }, onChange);
  const setCaption = (caption: string) => updateBlock(blocks, index, { caption }, onChange);
  const setCredit = (credit: string) => updateBlock(blocks, index, { credit }, onChange);
  const setItems = (items: NonNullable<typeof media.items>) =>
    updateBlock(blocks, index, { type: "media", items }, onChange);

  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Media block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Caption")}
          <input value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="col-span-2">
          {label("Credit")}
          <input value={credit} onChange={(e) => setCredit(e.target.value)} />
        </div>
        <div>
          {label("Count (items)")}
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            className={field}
          />
        </div>
        <div>
          {label("Layout")}
          {select(
            layout,
            [
              { label: "Carousel", value: "carousel" },
              { label: "Grid", value: "grid" },
              { label: "Stack", value: "stack" },
            ],
            (e) => setLayout(e.target.value as "carousel" | "grid" | "stack"),
          )}
        </div>
        <div>
          {label("Ratio")}
          {select(ratio, [...MEDIA_RATIO_OPTIONS], (e) => setRatio(e.target.value))}
        </div>
        <div>
          {label("Fit")}
          {select(
            fit,
            [
              { label: "Cover", value: "cover" },
              { label: "Contain", value: "contain" },
            ],
            (e) => setFit(e.target.value as "cover" | "contain"),
          )}
        </div>
        <div>
          {label("Crop position")}
          {select(position, MEDIA_POSITION_OPTIONS, (e) =>
            setPosition(e.target.value as MediaPosition),
          )}
        </div>
      </div>
      <div className="space-y-3" aria-label="Media items">
        {items.map((item, itemIndex) => (
          <div key={itemIndex} className="space-y-2 border-t border-border pt-3">
            <MediaItemFields
              label={`Media item ${itemIndex + 1}`}
              accept="any"
              value={item}
              previewRatio={ratio}
              previewFit={fit}
              previewPosition={position}
              onChange={(next) =>
                setItems(items.map((entry, i) => (i === itemIndex ? { ...entry, ...next } : entry)))
              }
            />
            <div className="flex flex-wrap gap-3 text-xs">
              <button
                type="button"
                disabled={itemIndex === 0}
                onClick={() => {
                  const next = [...items];
                  [next[itemIndex - 1], next[itemIndex]] = [next[itemIndex]!, next[itemIndex - 1]!];
                  setItems(next);
                }}
              >
                Move media earlier
              </button>
              <button
                type="button"
                disabled={itemIndex === items.length - 1}
                onClick={() => {
                  const next = [...items];
                  [next[itemIndex + 1], next[itemIndex]] = [next[itemIndex]!, next[itemIndex + 1]!];
                  setItems(next);
                }}
              >
                Move media later
              </button>
              <button
                type="button"
                onClick={() => setItems(items.filter((_, i) => i !== itemIndex))}
              >
                Remove media item {itemIndex + 1}
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, {}])}
          className="border border-input px-3 py-2 text-sm"
        >
          Add media item
        </button>
      </div>
      <button
        onClick={() => {
          const next: any = {
            type: "media",
            count,
            layout,
            ratio,
            fit,
            position,
          };
          next.caption = caption;
          next.credit = credit;
          updateBlock(blocks, index, next, onChange);
        }}
        className="mt-2 text-xs text-link hover:underline"
      >
        Save media block
      </button>
    </div>
  );
}

function simpleEditor(
  block: Block,
  index: number,
  blocks: Block[],
  onChange: (b: Block[]) => void,
  type: Block["type"],
  fieldName: "body" | "text" | "alt" | "href" | "title" | "name" | "code",
  labelText: string,
  rows?: number,
) {
  const value = (block as any)[fieldName] ?? "";
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">{type} block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      {label(labelText)}
      {rows
        ? textarea(
            value,
            (e) => updateBlock(blocks, index, { [fieldName]: e.target.value }, onChange),
            rows,
          )
        : input(value, (e) =>
            updateBlock(blocks, index, { [fieldName]: e.target.value }, onChange),
          )}
    </div>
  );
}

function ImageEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  const image = block as Extract<Block, { type: "image" }>;
  const ratio = image.ratio ?? "16/9";
  const fit = image.fit ?? "cover";
  const position = image.position ?? "center";
  const setRatio = (ratio: string) =>
    updateBlock(blocks, index, { ratio } as Partial<Block>, onChange);
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Image block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          <MediaItemFields
            label="Image"
            accept="image"
            value={image}
            previewRatio={ratio}
            previewFit={fit}
            previewPosition={position}
            onChange={(next) =>
              updateBlock(
                blocks,
                index,
                {
                  src: next.src,
                  alt: next.alt ?? "",
                  caption: next.caption,
                  width: next.width,
                  height: next.height,
                } as Partial<Block>,
                onChange,
              )
            }
          />
        </div>
        <div className="col-span-2">
          {label("Credit")}
          {input((block as any).credit ?? "", (e) =>
            updateBlock(blocks, index, { credit: e.target.value }, onChange),
          )}
        </div>
        <div>
          {label("Ratio")}
          {select(ratio, [...MEDIA_RATIO_OPTIONS], (e) => setRatio(e.target.value))}
        </div>
        <div>
          {label("Fit")}
          {select(
            fit,
            [
              { label: "Cover", value: "cover" },
              { label: "Contain", value: "contain" },
            ],
            (e) =>
              updateBlock(
                blocks,
                index,
                { fit: e.target.value as MediaFit } as Partial<Block>,
                onChange,
              ),
          )}
        </div>
        <div>
          {label("Crop position")}
          {select(position, MEDIA_POSITION_OPTIONS, (e) =>
            updateBlock(
              blocks,
              index,
              { position: e.target.value as MediaPosition } as Partial<Block>,
              onChange,
            ),
          )}
        </div>
      </div>
      <button
        onClick={() => updateBlock(blocks, index, { ratio, fit, position }, onChange)}
        className="mt-2 text-xs text-link hover:underline"
      >
        Save image block
      </button>
    </div>
  );
}

function VideoEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Video block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Src (file)")}
          {input((block as any).src ?? "", (e) =>
            updateBlock(blocks, index, { src: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Embed (iframe URL)")}
          {input((block as any).embed ?? "", (e) =>
            updateBlock(blocks, index, { embed: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Caption")}
          {input((block as any).caption ?? "", (e) =>
            updateBlock(blocks, index, { caption: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

function LinkEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Link block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Href")}
          {input((block as any).href, (e) =>
            updateBlock(blocks, index, { href: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Title")}
          {input((block as any).title, (e) =>
            updateBlock(blocks, index, { title: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Source")}
          {input((block as any).source ?? "", (e) =>
            updateBlock(blocks, index, { source: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Description")}
          {input((block as any).description ?? "", (e) =>
            updateBlock(blocks, index, { description: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

function CodeEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Code block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          {label("Language")}
          {input((block as any).language, (e) =>
            updateBlock(blocks, index, { language: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Caption")}
          {input((block as any).caption ?? "", (e) =>
            updateBlock(blocks, index, { caption: e.target.value }, onChange),
          )}
        </div>
      </div>
      {label("Code")}
      {textarea(
        (block as any).code,
        (e) => updateBlock(blocks, index, { code: e.target.value }, onChange),
        8,
      )}
    </div>
  );
}

function FileEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">File block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Name")}
          {input((block as any).name, (e) =>
            updateBlock(blocks, index, { name: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Href (URL or path)")}
          {input((block as any).href ?? "", (e) =>
            updateBlock(blocks, index, { href: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Kind (PDF, etc.)")}
          {input((block as any).kind ?? "", (e) =>
            updateBlock(blocks, index, { kind: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Description")}
          {input((block as any).description ?? "", (e) =>
            updateBlock(blocks, index, { description: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

function QuoteEditor(block: Block, index: number, blocks: Block[], onChange: (b: Block[]) => void) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Quote block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Text")}
          {input((block as any).text, (e) =>
            updateBlock(blocks, index, { text: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Cite")}
          {input((block as any).cite ?? "", (e) =>
            updateBlock(blocks, index, { cite: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

function CalloutEditor(
  block: Block,
  index: number,
  blocks: Block[],
  onChange: (b: Block[]) => void,
) {
  return (
    <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start mb-2">
        <span className="label-caps text-muted-foreground">Callout block</span>
        <button
          onClick={() => deleteBlock(index, blocks, onChange)}
          className="text-xs text-destructive underline"
        >
          Delete
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="col-span-2">
          {label("Title")}
          {input((block as any).title ?? "", (e) =>
            updateBlock(blocks, index, { title: e.target.value }, onChange),
          )}
        </div>
        <div className="col-span-2">
          {label("Body")}
          {textarea((block as any).body, (e) =>
            updateBlock(blocks, index, { body: e.target.value }, onChange),
          )}
        </div>
      </div>
    </div>
  );
}

/** Stable editor-only identities keep typing/media controls mounted during edits. */
function useBlockKeys(blocks: Block[]) {
  const prefix = React.useId();
  const serial = React.useRef(0);
  const previous = React.useRef<{ blocks: Block[]; keys: string[] }>({ blocks: [], keys: [] });
  if (previous.current.blocks !== blocks) {
    const old = previous.current;
    const matched = new Set<number>();
    const indices = blocks.map((block) => {
      const index = old.blocks.findIndex((entry, i) => entry === block && !matched.has(i));
      if (index >= 0) matched.add(index);
      return index;
    });
    const keys = indices.map((index, i) => {
      if (index >= 0) return old.keys[index]!;
      if (old.keys[i] && !matched.has(i)) {
        matched.add(i);
        return old.keys[i]!;
      }
      return `${prefix}-block-${serial.current++}`;
    });
    previous.current = { blocks, keys };
  }
  return previous.current.keys;
}

export function BlockEditor({
  blocks,
  onChange,
  reorderable = false,
  renderFeaturedProjects,
}: BlockEditorProps) {
  const keys = useBlockKeys(blocks);
  const blockTypes: { type: Block["type"]; label: string }[] = [
    { type: "heading", label: "H Heading" },
    { type: "text", label: "¶ Text" },
    { type: "list", label: "• List" },
    { type: "quote", label: "❝ Quote" },
    { type: "code", label: "</> Code" },
    { type: "image", label: "🖼 Image" },
    { type: "video", label: "▶ Video" },
    { type: "link", label: "🔗 Link" },
    { type: "file", label: "📎 File" },
    { type: "callout", label: "❗ Callout" },
    { type: "media", label: "⛶ Media" },
    ...(renderFeaturedProjects
      ? [{ type: "featured-projects" as const, label: "Featured Work" }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 p-3 border border-border rounded-lg bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground mr-1">Add:</span>
        {blockTypes.map(({ type, label }) => (
          <button
            key={type}
            disabled={type === "featured-projects" && blocks.some((block) => block.type === type)}
            onClick={() => addBlock(blocks, onChange, type)}
            className="border border-input bg-background px-3 py-1.5 text-xs text-foreground rounded hover:bg-accent transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      {(() => {
        const rendered = blocks.map((block, index) => {
          switch (block.type) {
            case "featured-projects":
              return (
                <React.Fragment key={index}>
                  {renderFeaturedProjects?.(block, index) ?? (
                    <p className="text-sm text-muted-foreground">
                      Featured Work is managed in Overview.
                    </p>
                  )}
                </React.Fragment>
              );
            case "media":
              return MediaEditor(block, index, blocks, onChange);
            case "text":
              return simpleEditor(block, index, blocks, onChange, "text", "body", "Body");
            case "heading":
              return (
                <div
                  key={index}
                  className="p-4 border border-border rounded-lg bg-muted/50 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <span className="label-caps text-muted-foreground">Heading block</span>
                    <button
                      onClick={() => deleteBlock(index, blocks, onChange)}
                      className="text-xs text-destructive underline"
                    >
                      Delete
                    </button>
                  </div>
                  <div>
                    {label("Text")}
                    {input(block.text ?? "", (e) =>
                      updateBlock(blocks, index, { text: e.target.value }, onChange),
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Level</span>
                    {([2, 3] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        aria-pressed={(block.level ?? 2) === lvl}
                        onClick={() => updateBlock(blocks, index, { level: lvl }, onChange)}
                        className={`border px-2 py-0.5 ${
                          (block.level ?? 2) === lvl
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        H{lvl}
                      </button>
                    ))}
                  </div>
                  <HeadingStyleControls
                    label="Style (overrides the site default for this heading)"
                    sample={block.text || "Heading"}
                    level={block.level === 3 ? "h3" : "h2"}
                    value={block.style}
                    onChange={(style) => updateBlock(blocks, index, { style }, onChange)}
                  />
                </div>
              );
            case "list": {
              const ordered = (block as any).ordered ?? false;
              return (
                <div key={index} className="p-4 border border-border rounded-lg bg-muted/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="label-caps text-muted-foreground">List block</span>
                    <button
                      onClick={() => deleteBlock(index, blocks, onChange)}
                      className="text-xs text-destructive underline"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {checkbox(ordered, (e) =>
                      updateBlock(blocks, index, { ordered: e.target.checked }, onChange),
                    )}
                    <span className="text-xs text-muted-foreground">Ordered list</span>
                  </div>
                  {label("Items (one per line)")}
                  {textarea(
                    (block as any).items.join("\n"),
                    (e) =>
                      updateBlock(
                        blocks,
                        index,
                        {
                          items: e.target.value.split("\n").filter(Boolean),
                          ordered,
                        },
                        onChange,
                      ),
                    4,
                  )}
                </div>
              );
            }
            case "image":
              return ImageEditor(block, index, blocks, onChange);
            case "video":
              return VideoEditor(block, index, blocks, onChange);
            case "link":
              return LinkEditor(block, index, blocks, onChange);
            case "code":
              return CodeEditor(block, index, blocks, onChange);
            case "file":
              return FileEditor(block, index, blocks, onChange);
            case "quote":
              return QuoteEditor(block, index, blocks, onChange);
            case "callout":
              return CalloutEditor(block, index, blocks, onChange);
          }
        });
        if (!reorderable) return rendered;
        return (
          <SortableList
            handleOnly
            items={blocks.map((block, index) => ({
              id: keys[index]!,
              block,
              node: rendered[index],
            }))}
            getId={(item) => item.id}
            onReorder={(next) => onChange(next.map((item) => item.block))}
            renderItem={(item, { index, moveUp, moveDown, dragHandleProps }) => (
              <div className="space-y-2" data-overview-block={item.block.type}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    {...dragHandleProps}
                    aria-label={
                      item.block.type === "featured-projects"
                        ? "Drag Featured Work section"
                        : `Drag Overview block ${index + 1}`
                    }
                    style={{ touchAction: "none" }}
                    className="inline-flex min-h-[40px] min-w-[40px] cursor-grab items-center justify-center border border-border active:cursor-grabbing"
                  >
                    <GripVertical className="size-4" />
                  </button>
                  <span>Overview block {index + 1}</span>
                  <button
                    type="button"
                    aria-label={`Move Overview block ${index + 1} up`}
                    disabled={index === 0}
                    onClick={moveUp}
                    className="min-h-[40px] border border-border px-3 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move Overview block ${index + 1} down`}
                    disabled={index === blocks.length - 1}
                    onClick={moveDown}
                    className="min-h-[40px] border border-border px-3 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
                {item.node}
              </div>
            )}
          />
        );
      })()}
    </div>
  );
}
