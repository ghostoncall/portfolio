export type FieldSpec = {
  key: string;
  label: string;
  kind?: "text" | "multiline" | "url" | "boolean" | "number" | "select";
  options?: string[];
  min?: number;
  max?: number;
};
const f = (
  key: string,
  label: string,
  kind: FieldSpec["kind"] = "text",
  options?: string[],
): FieldSpec => ({ key, label, kind, ...(options ? { options } : {}) });
const alignment = f("alignment", "Alignment", "select", ["left", "center", "right"]);

// These are the installed 2.1.0 node properties, not invented card features.
// Rich nested fields keep their native editors; more complex native settings
// stay available through the card's existing Edit controls.
export const CARD_FIELDS: Record<string, FieldSpec[]> = {
  image: [
    f("src", "Image URL", "url"),
    f("alt", "Alt text"),
    f("href", "Image link", "url"),
    f("title", "Image title"),
  ],
  embed: [f("url", "Embed URL", "url")],
  bookmark: [
    f("url", "Bookmark URL", "url"),
    f("title", "Title"),
    f("description", "Description", "multiline"),
    f("author", "Author"),
    f("publisher", "Publisher"),
    f("thumbnail", "Thumbnail URL", "url"),
    f("icon", "Icon URL", "url"),
  ],
  gallery: [],
  video: [
    f("src", "Video URL", "url"),
    f("customThumbnailSrc", "Poster URL", "url"),
    f("loop", "Loop", "boolean"),
  ],
  audio: [
    f("src", "Audio URL", "url"),
    f("title", "Title"),
    f("thumbnailSrc", "Artwork URL", "url"),
  ],
  file: [
    f("src", "File URL", "url"),
    f("fileTitle", "Title"),
    f("fileCaption", "Caption"),
    f("fileName", "Download filename"),
  ],
  codeblock: [f("language", "Language"), f("code", "Code", "multiline")],
  html: [f("html", "HTML", "multiline")],
  markdown: [f("markdown", "Markdown", "multiline")],
  button: [f("buttonText", "Button text"), f("buttonUrl", "Button URL", "url"), alignment],
  callout: [
    f("calloutEmoji", "Icon"),
    f("backgroundColor", "Background", "select", [
      "grey",
      "white",
      "blue",
      "green",
      "yellow",
      "red",
      "pink",
      "purple",
      "accent",
    ]),
  ],
  toggle: [],
  header: [
    f("backgroundImageSrc", "Background image URL", "url"),
    f("buttonEnabled", "Show button", "boolean"),
    f("buttonText", "Button text"),
    f("buttonUrl", "Button URL", "url"),
    alignment,
  ],
  product: [
    f("productImageSrc", "Product image URL", "url"),
    f("productImageAlt", "Image alt text"),
    f("productRatingEnabled", "Show rating", "boolean"),
    { ...f("productStarRating", "Rating", "number"), min: 1, max: 5 },
    f("productButtonEnabled", "Show button", "boolean"),
    f("productButton", "Button text"),
    f("productUrl", "Product URL", "url"),
  ],
  "call-to-action": [
    f("imageUrl", "Image URL", "url"),
    f("showButton", "Show button", "boolean"),
    f("buttonText", "Button text"),
    f("buttonUrl", "Button URL", "url"),
    f("showDividers", "Show dividers", "boolean"),
    f("hasSponsorLabel", "Show sponsor label", "boolean"),
    alignment,
  ],
  signup: [
    f("buttonText", "Button text"),
    f("backgroundImageSrc", "Background image URL", "url"),
    alignment,
  ],
  "email-cta": [
    f("buttonText", "Button text"),
    f("buttonUrl", "Button URL", "url"),
    f("showButton", "Show button", "boolean"),
    f("showDividers", "Show dividers", "boolean"),
    alignment,
  ],
  email: [],
  transistor: [],
  horizontalrule: [],
  paywall: [],
};

export const CARD_LABELS: Record<string, string> = {
  image: "Image",
  embed: "Embed",
  bookmark: "Bookmark",
  gallery: "Gallery",
  video: "Video",
  audio: "Audio",
  file: "File",
  codeblock: "Code block",
  html: "HTML card",
  markdown: "Markdown",
  button: "Button",
  callout: "Callout",
  toggle: "Toggle",
  header: "Header",
  product: "Product",
  "call-to-action": "Call to action",
  signup: "Signup",
  "email-cta": "Email call to action",
  email: "Email content",
  transistor: "Transistor",
  horizontalrule: "Divider",
  paywall: "Public preview divider",
};
export const INSERTABLE = [
  "image",
  "embed",
  "bookmark",
  "gallery",
  "video",
  "audio",
  "file",
  "codeblock",
  "html",
  "markdown",
  "button",
  "callout",
  "toggle",
  "header",
  "product",
  "horizontalrule",
];
export const NESTED_LABELS: Record<string, string> = {
  caption: "Caption",
  calloutText: "Text",
  heading: "Heading",
  content: "Content",
  header: "Heading",
  subheader: "Subheading",
  productTitle: "Title",
  productDescription: "Description",
  disclaimer: "Disclaimer",
  textValue: "Text",
  sponsorLabel: "Sponsor label",
  html: "Content",
};
