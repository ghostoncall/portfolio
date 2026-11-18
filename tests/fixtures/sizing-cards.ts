export const profile = "/images/profile.jpeg";
export const sizingCards: Record<string, Record<string, unknown>> = {
  image: { src: profile, width: 500, height: 500, alt: "Photo", caption: "A caption" },
  embed: {
    url: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
    html: '<iframe src="https://www.youtube.com/embed/AAAAAAAAAAA" width="560" height="315" title="Video"></iframe>',
    embedType: "video",
  },
  bookmark: {
    url: "https://example.com",
    metadata: { title: "Bookmark", description: "Description" },
  },
  gallery: {
    images: [
      { src: profile, width: 500, height: 500, fileName: "profile.jpeg", row: 0, alt: "One" },
      {
        src: `${profile}?second=1`,
        width: 500,
        height: 500,
        fileName: "second.jpeg",
        row: 0,
        alt: "Two",
      },
    ],
  },
  video: {
    src: "https://media.example.com/video.webm",
    width: 160,
    height: 90,
    mimeType: "video/webm",
    thumbnailSrc: profile,
  },
  audio: {
    src: "https://media.example.com/audio.wav",
    title: "Audio",
    duration: 1,
    mimeType: "audio/wav",
  },
  file: {
    src: "https://media.example.com/file.pdf",
    fileName: "file.pdf",
    fileTitle: "File",
    fileSize: 50,
  },
  codeblock: { code: "const answer = 42;\nconsole.log(answer);", language: "js" },
  html: { html: '<p>HTML content <a href="https://example.com">Link</a></p>' },
  markdown: { markdown: "# Markdown\n\nContent [link](https://example.com)" },
  button: { buttonText: "Button", buttonUrl: "https://example.com" },
  callout: { calloutText: "<p>Callout content</p>" },
  toggle: { heading: "Toggle heading", content: "<p>Toggle content</p>" },
  header: { version: 2, header: "Header heading", subheader: "Subheading" },
  product: {
    productTitle: "Product",
    productDescription: "<p>Details</p>",
    productImageSrc: profile,
    productImageWidth: 500,
    productImageHeight: 500,
  },
  horizontalrule: {},
};
export function sizingBody(type: string) {
  const paragraph = () => ({
    type: "paragraph",
    version: 1,
    children: [],
    direction: null,
    format: "",
    indent: 0,
  });
  return {
    html: "",
    lexical: {
      root: {
        type: "root",
        version: 1,
        direction: null,
        format: "",
        indent: 0,
        children: [paragraph(), { type, version: 1, ...sizingCards[type] }, paragraph()],
      },
    },
  };
}
