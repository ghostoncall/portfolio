import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

// Koenig 2.1.0 embeds Lexical 0.13.1. Its public APIs must come from that
// same bundle; importing a second Lexical creates incompatible contexts.
// The hash pins these export bindings to the inspected upstream artifact.
const BUNDLE_SHA = "3b03b202799bd23ee25cb2c40fb8a83a47268bf45a563e5624af149a47ee8da6";
const MARKER = "/* portfolio: koenig runtime exports */";
const FACADE = `\n${MARKER}\nexport { B as KoenigLexical, We as KoenigHtml, q as KoenigReact, oV as KoenigSelection, fg as KoenigRichText, vL as KoenigList, Gg as KoenigLink, _J as useKoenigHistory, TV as EDIT_CARD_COMMAND };\n`;
const SSR_STUB = `
export const KoenigComposer = () => null;
export const KoenigEditor = () => null;
export const KoenigComposableEditor = () => null;
export const HtmlOutputPlugin = () => null;
export const ExternalControlPlugin = () => null;
export const $selectDecoratorNode = () => {};
export const useKoenigHistory = () => ({ historyState: {} });
export const EDIT_CARD_COMMAND = {};
export const DEFAULT_NODES = [];
export const KoenigLexical = {}, KoenigHtml = {}, KoenigReact = {}, KoenigSelection = {}, KoenigRichText = {}, KoenigList = {}, KoenigLink = {};
export const version = "2.1.0";
export default {};
`;

export function koenigRuntime(): Plugin {
  return {
    name: "koenig-runtime",
    enforce: "pre",
    resolveId(id) {
      if (id === "@tryghost/koenig-lexical" && this.environment.config.consumer === "server") {
        return "\0koenig-ssr-stub";
      }
      return null;
    },
    load(id) {
      return id === "\0koenig-ssr-stub" ? SSR_STUB : null;
    },
    transform(code, id) {
      if (
        !id
          .replaceAll("\\", "/")
          .split("?")[0]
          ?.endsWith("/@tryghost/koenig-lexical/dist/koenig-lexical.js")
      )
        return null;
      if (code.includes(MARKER)) return null;
      const original = readFileSync(id.split("?")[0]!, "utf8");
      const hash = createHash("sha256").update(original.replaceAll("\r\n", "\n")).digest("hex");
      if (hash !== BUNDLE_SHA)
        throw new Error(
          "Koenig's installed bundle changed. Review the runtime adapter before upgrading the editor.",
        );
      return { code: code + FACADE, map: null };
    },
  };
}
