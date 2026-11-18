/* eslint-disable @typescript-eslint/no-explicit-any -- upstream card classes have no declarations */
import { DEFAULT_NODES } from "@tryghost/koenig-lexical";
import type { LexicalNode } from "lexical";
import { layoutWidth, normalizeLayout, type CardLayout } from "./layout";
import { standaloneCard } from "./standalone";
import { L } from "./runtime";
import { layoutHeight, sizeExport } from "./sizing";

export type CardNode = LexicalNode & {
  [field: string]: any;
  getDataset(): Record<string, any>;
  getPortfolioLayout(): CardLayout | null;
  setPortfolioLayout(layout: CardLayout | null): void;
};
export type CardClass = {
  new (data?: Record<string, any>, key?: string): CardNode;
  getType(): string;
  getPropertyDefaults(): Record<string, any>;
  [field: string | symbol]: any;
};

export const NESTED_FIELDS: Record<string, Record<string, string>> = {
  image: { caption: "captionEditor" },
  embed: { caption: "captionEditor" },
  gallery: { caption: "captionEditor" },
  bookmark: { caption: "captionEditor" },
  video: { caption: "captionEditor" },
  codeblock: { caption: "captionEditor" },
  callout: { calloutText: "calloutTextEditor" },
  toggle: { heading: "headingEditor", content: "contentEditor" },
  header: { header: "headerTextEditor", subheader: "subheaderTextEditor" },
  product: { productTitle: "productTitleEditor", productDescription: "productDescriptionEditor" },
  signup: {
    header: "headerTextEditor",
    subheader: "subheaderTextEditor",
    disclaimer: "disclaimerTextEditor",
  },
  email: { html: "htmlEditor" },
  "email-cta": { html: "htmlEditor" },
  "call-to-action": { textValue: "callToActionHtmlEditor", sponsorLabel: "sponsorLabelHtmlEditor" },
};
export const LAYOUT_TYPES = new Set([
  "image",
  "embed",
  "gallery",
  "video",
  "audio",
  "bookmark",
  "file",
  "html",
  "product",
  "header",
  "callout",
  "toggle",
  "call-to-action",
  "signup",
]);
const INSTALLED = Symbol.for("portfolio.koenig.layout.v1");

function reflectLayout(dom: HTMLElement, layout: CardLayout | null, naturalWidth: unknown) {
  dom.removeAttribute("data-portfolio-sizing");
  dom.style.removeProperty("--portfolio-card-height");
  if (!layout) {
    dom.removeAttribute("data-portfolio-align");
    dom.removeAttribute("data-portfolio-size");
    dom.style.removeProperty("--portfolio-card-width");
    return;
  }
  dom.setAttribute("data-portfolio-align", layout.align);
  dom.setAttribute("data-portfolio-size", layout.size);
  dom.style.setProperty("--portfolio-card-width", layoutWidth(layout, naturalWidth));
  if (layout.size === "custom") {
    const type = dom.dataset["portfolioType"] ?? "";
    dom.setAttribute("data-portfolio-sizing", type);
    const height = layoutHeight(layout, type);
    if (height) dom.style.setProperty("--portfolio-card-height", height);
  }
}

/** Extend native card lifecycles, retaining their constructors, types and views.
 * Koenig factories instantiate their native classes directly, so replacement
 * classes would break those factories. Optional fields travel with native clones.
 */
export function installCardExtensions(): Map<string, CardClass> {
  const Paragraph = L.ParagraphNode as any;
  if (!Object.hasOwn(Paragraph, INSTALLED)) {
    Object.defineProperty(Paragraph, INSTALLED, { value: true });
    const importParagraph = Paragraph.importDOM;
    Paragraph.importDOM = function () {
      const converters = importParagraph.call(this),
        convert = converters.p;
      return {
        ...converters,
        p: (element: HTMLElement) => {
          const converter = convert(element);
          return (
            converter && {
              ...converter,
              conversion: (dom: HTMLElement) => {
                const result = converter.conversion(dom);
                if (dom.dir === "ltr" || dom.dir === "rtl") result.node?.setDirection(dom.dir);
                return result;
              },
            }
          );
        },
      };
    };
  }
  const classes = new Map<string, CardClass>();
  for (const entry of DEFAULT_NODES) {
    if (
      typeof entry !== "function" ||
      typeof (entry as unknown as CardClass).getPropertyDefaults !== "function"
    )
      continue;
    const Klass = entry as unknown as CardClass;
    const type = Klass.getType();
    classes.set(type, Klass);
    if (Object.hasOwn(Klass, INSTALLED)) continue;
    Object.defineProperty(Klass, INSTALLED, { value: true });
    const proto = Klass.prototype as CardNode;
    const clone = Klass["clone"],
      importJSON = Klass["importJSON"];
    const exportJSON = proto.exportJSON,
      exportDOM: any = proto.exportDOM;
    const createDOM = proto.createDOM,
      updateDOM = proto.updateDOM;

    proto.getPortfolioLayout = function () {
      return normalizeLayout(this.getLatest()["__portfolioLayout"]);
    };
    proto.setPortfolioLayout = function (layout) {
      this.getWritable()["__portfolioLayout"] = normalizeLayout(layout);
    };
    Klass["clone"] = function (node: CardNode) {
      const copy = clone.call(this, node) as CardNode;
      copy["__portfolioLayout"] = node["__portfolioLayout"] ?? null;
      return copy;
    };
    Klass["importJSON"] = function (json: Record<string, unknown>) {
      const node = importJSON.call(this, json) as CardNode;
      node["__portfolioLayout"] = normalizeLayout(json["portfolioLayout"]);
      return node;
    };
    proto.exportJSON = function () {
      const json = exportJSON.call(this);
      const layout = this.getPortfolioLayout();
      return layout ? { ...json, portfolioLayout: layout } : json;
    };
    proto.createDOM = function (config, editor) {
      const dom = createDOM.call(this, config, editor);
      dom.dataset["portfolioType"] = type;
      reflectLayout(dom, this.getPortfolioLayout(), this["width"]);
      return dom;
    };
    proto.updateDOM = function (previous, dom, config) {
      const replace = updateDOM.call(this, previous, dom, config);
      reflectLayout(dom, this.getPortfolioLayout(), this["width"]);
      return replace;
    };
    proto.exportDOM = function (editor, ...options: any[]) {
      // Nested caption/text editors serialize independently of the parent node.
      // Read their canonical HTML rather than an older cached string property.
      const nested = NESTED_FIELDS[type] ?? {};
      const json = this.exportJSON() as Record<string, unknown>;
      const proxy = new Proxy(this, {
        get(target, key) {
          if (key === "getDataset")
            return () => ({
              ...target.getDataset(),
              ...Object.fromEntries(Object.keys(nested).map((field) => [field, json[field]])),
            });
          if (typeof key === "string") {
            const field = key.startsWith("__") ? key.slice(2) : key;
            if (field in nested) return json[field];
          }
          return Reflect.get(target, key, target);
        },
      });
      const output = exportDOM.call(proxy, editor, ...options);
      if (output.element instanceof HTMLElement)
        output.element = standaloneCard(output.element, type, json);
      const layout = this.getPortfolioLayout();
      if (!layout || !output.element) return output;
      let element = output.element;
      if (!(element instanceof HTMLElement) || element.tagName !== "FIGURE") {
        const figure = document.createElement("figure");
        figure.classList.add("kg-card");
        figure.append(element);
        element = figure;
      }
      element.setAttribute("data-portfolio-layout", layout.align);
      element.setAttribute("data-portfolio-size", layout.size);
      if (layout.width) element.setAttribute("data-portfolio-width", String(layout.width));
      if (layout.unit) element.setAttribute("data-portfolio-unit", layout.unit);
      if (layout.height) element.setAttribute("data-portfolio-height", String(layout.height));
      if (layout.locked !== undefined)
        element.setAttribute("data-portfolio-locked", String(layout.locked));
      if (layout.aspectRatio)
        element.setAttribute("data-portfolio-ratio", String(layout.aspectRatio));
      element.classList.add(`kg-layout-${layout.align}`);
      if (["s", "m", "l"].includes(layout.size)) element.classList.add(`kg-size-${layout.size}`);
      element.style.setProperty("--kg-img-width", layoutWidth(layout, this["width"]));
      sizeExport(element, type, layout);
      return { ...output, element };
    };

    const importDOM = Klass["importDOM"];
    if (importDOM)
      Klass["importDOM"] = function () {
        const converters = importDOM.call(this);
        return Object.fromEntries(
          Object.entries(converters ?? {}).map(([tag, factory]) => [
            tag,
            (dom: HTMLElement) => {
              const converter = (factory as any)(dom);
              if (!converter) return converter;
              return {
                ...converter,
                conversion: (element: HTMLElement) => {
                  const result = converter.conversion(element);
                  const marker = element.closest("[data-portfolio-layout]");
                  const layout = marker
                    ? normalizeLayout({
                        align: marker.getAttribute("data-portfolio-layout"),
                        size: marker.getAttribute("data-portfolio-size"),
                        width: marker.getAttribute("data-portfolio-width"),
                        unit: marker.getAttribute("data-portfolio-unit"),
                        height: marker.getAttribute("data-portfolio-height"),
                        locked: marker.hasAttribute("data-portfolio-locked")
                          ? marker.getAttribute("data-portfolio-locked") === "true"
                          : undefined,
                        aspectRatio: marker.getAttribute("data-portfolio-ratio"),
                      })
                    : null;
                  for (const node of [result?.node].flat().filter(Boolean)) {
                    if (layout && node.getType() === type) node.setPortfolioLayout(layout);
                  }
                  return result;
                },
              };
            },
          ]),
        );
      };

    // Keep the native Regular/Wide/Full toolbar and contextual controls in sync.
    if (Object.hasOwn(Klass.getPropertyDefaults(), "cardWidth")) {
      let owner: object | null = proto;
      let descriptor: PropertyDescriptor | undefined;
      while (owner && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(owner, "cardWidth");
        owner = Object.getPrototypeOf(owner);
      }
      if (descriptor?.get && descriptor.set) {
        const original = descriptor;
        Object.defineProperty(proto, "cardWidth", {
          configurable: true,
          get() {
            return original.get!.call(this);
          },
          set(value) {
            original.set!.call(this, value);
            this.setPortfolioLayout(
              value === "wide"
                ? { align: "center", size: "wide" }
                : value === "full"
                  ? { align: "full", size: "full" }
                  : this.getPortfolioLayout()
                    ? { align: "default", size: "full" }
                    : null,
            );
          },
        });
      }
    }
  }
  return classes;
}
