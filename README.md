# AI Portfolio

Personal portfolio — AI engineering work, projects, writing and experience.
Editorial "academic catalog" design: serif display type, hairline rules, ink-on-paper palette, square corners.

## Stack

- **TanStack Start** — React 19, file-based routing, SSR + server functions
- **Vite 8 + nitro** build tooling, **Tailwind CSS v4** with design tokens
- shadcn/ui components (restyled square + monochrome)
- Vitest + Testing Library for the existing route/media tests

## Run

```bash
npm install
npm run dev        # http://localhost:8080
npm test
npm run lint
npm run build      # production bundle in .output/
```

## Editing content

All copy lives in **`src/content/site.ts`** as typed `Block` arrays — pages assemble from those blocks, so adding projects, posts or media never breaks the layout. Any media file (image/video/pdf/zip/YouTube link…) goes through the self-contained `Media` component in `src/components/media.tsx`.

## Deploy

TanStack Start is Nitro-based and deploys to Vercel/Cloudflare/Node hosting. The default build targets `cloudflare-module`; on Vercel set `NITRO_PRESET=vercel` (or `preset: "vercel"` in the nitro config). Custom domain attaches at the host's dashboard with SSL auto-provisioning.

---

**© 2026 Your Name. All rights reserved.** — the site footer renders the year automatically.
