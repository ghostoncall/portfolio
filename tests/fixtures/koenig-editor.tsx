// Browser-only integration fixture. Imports the production editor and renderer.
// Network services are injected here; no real post is written or published.
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { KoenigBodyEditor, type EditorHandle } from "../../src/components/admin/KoenigBodyEditor";
import { BlogRenderer } from "../../src/components/admin/BlogRenderer";
import { blogThemeVars, DEFAULT_BLOG_SETTINGS } from "../../src/lib/blog-settings";
import {
  KoenigServicesProvider,
  type KoenigServices,
} from "../../src/components/admin/koenig/services";
import type { PostBody, PostImageLayout } from "../../src/content/site";
import { ImageCropper } from "../../src/components/admin/cms/ImageCropper";

type Options = {
  body?: PostBody;
  imageLayouts?: Record<string, PostImageLayout>;
  canvasWidth?: number;
  zoom?: number;
};
const fixture = window as typeof window & {
  __koenigFixture?: Record<string, unknown>;
  __koenigRoot?: ReturnType<typeof createRoot>;
};
let uploads = 0;
const services: KoenigServices = {
  useFileUpload() {
    return {
      isLoading: false,
      progress: 100,
      errors: [],
      filesNumber: 0,
      async upload(files) {
        return Array.from(files).map((file) => ({
          url: `${location.origin}/images/profile.jpeg?upload=${++uploads}&name=${encodeURIComponent(file.name)}`,
          fileName: file.name,
        }));
      },
    };
  },
  async resolveEmbed(url, options) {
    await new Promise((resolve) => setTimeout(resolve, url.includes("slow") ? 500 : 5));
    if (url.includes("fail")) throw new Error("Fixture provider unavailable");
    if (options?.type === "bookmark" || url.includes("example.com"))
      return {
        url,
        type: "bookmark",
        metadata: {
          title: "Resolved bookmark",
          description: "A useful bookmark",
          author: "Author",
          publisher: "Example",
          icon: "",
          thumbnail: "",
        },
      };
    const vimeo = url.includes("vimeo");
    return {
      type: "video",
      url,
      title: "Resolved video",
      width: 560,
      height: 315,
      html: `<iframe src="${vimeo ? "https://player.vimeo.com/video/123456" : "https://www.youtube.com/embed/AAAAAAAAAAA"}" width="560" height="315" title="Resolved video" allowfullscreen></iframe>`,
    };
  },
};

function Harness({ initial }: { initial: Options }) {
  const [value, setValue] = useState<PostBody>(
    initial.body ?? { lexical: {}, html: "<p>Opening paragraph.</p>" },
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState("split");
  const editorRef = useRef<EditorHandle | null>(null);
  const changes = useRef(0);
  useEffect(() => {
    fixture.__koenigFixture = {
      snapshot: () => editorRef.current?.getSnapshot() ?? value,
      value,
      saved,
      changes: changes.current,
      original: initial,
    };
  }, [value, saved, initial]);
  const flush = () => {
    const current = editorRef.current?.getSnapshot() ?? value;
    setValue(current);
    return current;
  };
  return (
    <KoenigServicesProvider value={services}>
      <main
        id="koenig-fixture"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "white",
          overflow: "auto",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            data-testid="save-draft"
            onClick={() => {
              const current = flush();
              setSaved(JSON.stringify(current));
            }}
          >
            Save draft
          </button>
          <button
            type="button"
            data-testid="reopen"
            disabled={!saved}
            onClick={() => {
              setValue(JSON.parse(saved!) as PostBody);
              setRevision((n) => n + 1);
              setMode("split");
            }}
          >
            Reopen saved
          </button>
          <button
            type="button"
            data-testid="toggle-preview"
            onClick={() => {
              flush();
              setMode((m) => (m === "preview" ? "split" : "preview"));
            }}
          >
            Toggle preview
          </button>
        </div>
        <div
          id="fixture-editor"
          style={{
            maxWidth: initial.canvasWidth ?? 980,
            display: mode === "preview" ? "none" : "block",
            ...(initial.zoom
              ? { transform: `scale(${initial.zoom})`, transformOrigin: "top left" }
              : {}),
          }}
        >
          <textarea
            data-testid="excerpt-scale"
            className="text-sm"
            defaultValue="How I got to work at DRDO's Quantum lab QTRC"
          />
          <KoenigBodyEditor
            key={revision}
            initialLexical={value.lexical["root"] ? value.lexical : null}
            initialHtml={value.html}
            imageLayouts={initial.imageLayouts}
            themeVars={{
              ...blogThemeVars(DEFAULT_BLOG_SETTINGS),
              ...(initial.canvasWidth
                ? { "--blog-content-width": `${initial.canvasWidth}px` }
                : {}),
            }}
            editorRef={editorRef}
            onInitialValue={setValue}
            onChange={(next) => {
              changes.current++;
              setValue(next);
            }}
          />
        </div>
        <div id="fixture-preview" style={{ maxWidth: initial.canvasWidth ?? 980, marginTop: 32 }}>
          <BlogRenderer
            themeVars={
              initial.canvasWidth
                ? ({ "--blog-content-width": `${initial.canvasWidth}px` } as React.CSSProperties)
                : undefined
            }
            post={{
              slug: "fixture",
              title: "Fixture",
              dek: "",
              date: "2026-11-18",
              tags: [],
              blocks: [],
              body: value,
              imageLayouts: initial.imageLayouts,
            }}
          />
        </div>
      </main>
    </KoenigServicesProvider>
  );
}

export function mountKoenigFixture(initial: Options = {}) {
  fixture.__koenigRoot?.unmount();
  document.getElementById("koenig-fixture-mount")?.remove();
  const mount = document.createElement("div");
  mount.id = "koenig-fixture-mount";
  document.body.append(mount);
  fixture.__koenigRoot = createRoot(mount);
  fixture.__koenigRoot.render(<Harness initial={initial} />);
}

function CropHarness() {
  const [open, setOpen] = useState(false),
    [result, setResult] = useState<unknown>(null);
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "white",
        overflow: "auto",
        padding: 24,
      }}
    >
      <button data-testid="open-crop" onClick={() => setOpen(true)}>
        Crop image
      </button>
      <pre data-testid="crop-result">{JSON.stringify(result)}</pre>
      {open && (
        <ImageCropper
          src="/images/profile.jpeg"
          aspect={4 / 3}
          onCancel={() => setOpen(false)}
          onConfirm={async (file, crop) => {
            const image = await createImageBitmap(file);
            setResult({
              crop,
              type: file.type,
              size: file.size,
              width: image.width,
              height: image.height,
            });
            image.close();
            setOpen(false);
          }}
        />
      )}
    </main>
  );
}

export function mountCropFixture() {
  fixture.__koenigRoot?.unmount();
  document.getElementById("koenig-fixture-mount")?.remove();
  const mount = document.createElement("div");
  mount.id = "koenig-fixture-mount";
  document.body.append(mount);
  fixture.__koenigRoot = createRoot(mount);
  fixture.__koenigRoot.render(<CropHarness />);
}

export function openCropOverEditor() {
  // Remove the harness's stacking context to mirror the production page.
  const harness = document.getElementById("koenig-fixture")!;
  harness.style.position = "absolute";
  harness.style.zIndex = "auto";
  const mount = document.createElement("div");
  document.body.append(mount);
  const root = createRoot(mount);
  const close = () => {
    root.unmount();
    mount.remove();
  };
  root.render(<ImageCropper src="/images/profile.jpeg" onCancel={close} onConfirm={close} />);
}
