// Reading time from a post's actual readable content.
//
//   text  : visible words (tags/scripts/styles stripped) at 230 words/minute
//   images: 12 s for the first, then 1 s less each, never below 3 s
//   embeds: 20 s each (videos, embed cards)
// Rounded up, minimum 1 minute ("0 min read" is never shown).
import type { Block, Post } from "@/content/site";

const WPM = 230;

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
}

function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

function blocksText(blocks: Block[]): { words: number; images: number; embeds: number } {
  let words = 0;
  let images = 0;
  let embeds = 0;
  for (const b of blocks ?? []) {
    switch (b.type) {
      case "text":
      case "callout":
        words += countWords(b.body ?? "");
        if (b.type === "callout") words += countWords(b.title ?? "");
        break;
      case "heading":
        words += countWords(b.text);
        break;
      case "quote":
        words += countWords(b.text) + countWords(b.cite ?? "");
        break;
      case "list":
        words += countWords((b.items ?? []).join(" "));
        break;
      case "code":
        words += countWords(b.code) / 2; // code is skimmed
        break;
      case "image":
        images += 1;
        words += countWords(b.caption ?? "");
        break;
      case "media":
        images += Math.max(1, b.items?.length ?? 1);
        words += countWords(b.caption ?? "");
        break;
      case "video":
        embeds += 1;
        break;
      case "link":
        words += countWords(`${b.title} ${b.description ?? ""}`);
        break;
      default:
        break;
    }
  }
  return { words, images, embeds };
}

export function readingMinutes(post: {
  body?: Post["body"] | undefined;
  blocks?: Block[] | undefined;
}): number {
  let words: number;
  let images: number;
  let embeds: number;
  const html = post.body?.html;
  if (html) {
    words = countWords(htmlToText(html));
    images = (html.match(/<img\b/gi) ?? []).length;
    embeds =
      (html.match(/<iframe\b/gi) ?? []).length +
      (html.match(/class="[^"]*kg-(embed|video)-card/gi) ?? []).length;
  } else {
    ({ words, images, embeds } = blocksText(post.blocks ?? []));
  }
  let seconds = (words / WPM) * 60;
  for (let i = 0; i < images; i++) seconds += Math.max(3, 12 - i);
  seconds += embeds * 20;
  return Math.max(1, Math.ceil(seconds / 60));
}

/** The label to show for a post: computed unless the author set it manually. */
export function readTimeLabel(post: Post): string {
  if (post.readTimeMode === "manual" && post.readTime?.trim()) return post.readTime.trim();
  return `${readingMinutes(post)} min read`;
}

/** Return the post with `readTime` resolved (used by public reads). */
export function withReadTime<T extends Post>(post: T): T {
  return { ...post, readTime: readTimeLabel(post) };
}
