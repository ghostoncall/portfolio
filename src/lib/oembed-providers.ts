// Fixed official endpoints; arbitrary pages still use the existing bookmark
// fallback. Never discover or fetch an endpoint supplied by the remote page.
export const OEMBED_PROVIDERS: { test: RegExp; endpoint: string }[] = [
  {
    test: /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch|shorts|live)|youtu\.be\/)/i,
    endpoint: "https://www.youtube.com/oembed?format=json&url=",
  },
  {
    test: /^https?:\/\/(www\.|player\.)?vimeo\.com\//i,
    endpoint: "https://vimeo.com/api/oembed.json?url=",
  },
  {
    test: /^https?:\/\/(open\.spotify\.com|spotify\.link)\//i,
    endpoint: "https://open.spotify.com/oembed?url=",
  },
  {
    test: /^https?:\/\/(www\.)?soundcloud\.com\//i,
    endpoint: "https://soundcloud.com/oembed?format=json&url=",
  },
  {
    test: /^https?:\/\/codepen\.io\/[^/]+\/(pen|full|embed)\//i,
    endpoint: "https://codepen.io/api/oembed?format=json&url=",
  },
  // X returns a useful static blockquote without executing third-party scripts.
  {
    test: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^/]+\/status\/\d+/i,
    endpoint: "https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=",
  },
];
