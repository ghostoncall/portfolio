// All portfolio content lives here. Pages are assembled from flexible "blocks",
// so you can add images, videos, links, code, files or new block types without
// touching the layout.
//
// For ANY file (jpg, png, mp4, pdf, ppt, docx, YouTube link, zip…) use the
// "media" block. Leave `items` empty for placeholders; add as many items as
// you like and it becomes a carousel automatically.

import type { MediaItem } from "@/components/media";

export type { MediaItem };

export type Block =
  | {
      type: "media";
      items?: MediaItem[];
      count?: number;
      layout?: "carousel" | "grid" | "stack";
      ratio?: string;
      fit?: "cover" | "contain";
      caption?: string;
      credit?: string;
    }
  | { type: "text"; body: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | {
      type: "image";
      src?: string;
      alt: string;
      caption?: string;
      credit?: string;
      ratio?: "16/9" | "4/3" | "1/1" | "3/2";
    }
  | { type: "video"; src?: string; embed?: string; caption?: string }
  | { type: "link"; href: string; title: string; source?: string; description?: string }
  | { type: "code"; language: string; code: string; caption?: string }
  | { type: "file"; href?: string; name: string; kind?: string; description?: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title?: string; body: string };

export const site = {
  name: "Your Name",
  title: "AI Engineer",
  edition: "Portfolio 2026",
  email: "you@example.com",
  socials: [
    { label: "GitHub", href: "https://github.com/" },
    { label: "LinkedIn", href: "https://linkedin.com/" },
  ],
};

export const overview: Block[] = [
  {
    type: "text",
    body: "I design and build applied AI systems — from retrieval-augmented assistants to computer-vision pipelines — with a focus on reliability, evaluation and thoughtful product craft.",
  },
  { type: "heading", text: "Areas of Focus" },
  {
    type: "list",
    ordered: true,
    items: [
      "Large language model applications, agents and tool use.",
      "Retrieval-augmented generation and semantic search.",
      "Computer vision and multimodal models.",
      "MLOps: evaluation, deployment and monitoring in production.",
    ],
  },
  {
    type: "media",
    caption: "Featured media — a photo, video, slide deck or any file.",
    credit: "Your Name",
  },
  {
    type: "quote",
    text: "Good AI is mostly good engineering, with a little magic at the edges.",
    cite: "Working principle",
  },
];

export type Project = {
  slug: string;
  title: string;
  dek: string;
  year: string;
  category: string;
  stack: string[];
  blocks: Block[];
};

export const projects: Project[] = [
  {
    slug: "rag-research-assistant",
    title: "Research Assistant with Retrieval",
    dek: "A citation-grounded assistant that answers questions over thousands of papers.",
    year: "2026",
    category: "LLM Applications",
    stack: ["Python", "LangChain", "pgvector", "OpenAI", "FastAPI"],
    blocks: [
      { type: "heading", text: "The Problem" },
      {
        type: "text",
        body: "Describe the problem, who it was for, and why existing tools fell short.",
      },
      {
        type: "image",
        alt: "Project screenshot",
        caption: "Screenshot of the interface.",
        ratio: "16/9",
      },
      { type: "heading", text: "Approach" },
      { type: "text", body: "Explain architecture, models chosen and trade-offs." },
      {
        type: "code",
        language: "python",
        caption: "Hybrid retrieval, simplified.",
        code: `def retrieve(query: str, k: int = 8):
    dense = vector_store.search(embed(query), k=k)
    sparse = bm25.search(query, k=k)
    return rerank(query, dense + sparse)[:k]`,
      },
      {
        type: "media",
        count: 4,
        caption: "Demo gallery — videos, screenshots, slides or documents.",
      },
      { type: "heading", text: "Results" },
      {
        type: "list",
        items: ["Answer accuracy up 32% over baseline.", "Median latency under 1.2s."],
      },
      {
        type: "link",
        href: "https://github.com/",
        title: "Source code",
        source: "GitHub",
        description: "Repository and documentation.",
      },
    ],
  },
  {
    slug: "vision-defect-detection",
    title: "Visual Defect Detection",
    dek: "A real-time vision model spotting manufacturing defects on the line.",
    year: "2025",
    category: "Computer Vision",
    stack: ["PyTorch", "YOLO", "ONNX", "Docker"],
    blocks: [
      { type: "text", body: "Summary of the project, data, and outcome." },
      { type: "image", alt: "Detection results", caption: "Sample detections.", ratio: "3/2" },
      { type: "callout", title: "Outcome", body: "Reduced manual inspection time by 60%." },
    ],
  },
  {
    slug: "agentic-workflow",
    title: "Agentic Workflow Automation",
    dek: "Tool-using agents that triage support tickets and draft replies.",
    year: "2025",
    category: "Agents",
    stack: ["TypeScript", "LLM tool calling", "Postgres"],
    blocks: [{ type: "text", body: "Describe the agent design, guardrails and evaluation." }],
  },
];

export const skills: { group: string; items: { name: string; detail: string }[] }[] = [
  {
    group: "LLMs & Agents",
    items: [
      { name: "Prompt & tool design", detail: "Function calling, structured output" },
      { name: "Agents", detail: "Planning, memory, multi-step workflows" },
      { name: "Evaluation", detail: "Golden sets, LLM-as-judge, regression tests" },
    ],
  },
  {
    group: "Retrieval",
    items: [
      { name: "RAG", detail: "Chunking, hybrid search, reranking" },
      { name: "Vector databases", detail: "pgvector, Pinecone, FAISS" },
    ],
  },
  {
    group: "Machine Learning",
    items: [
      { name: "Deep learning", detail: "PyTorch, fine-tuning, LoRA" },
      { name: "Computer vision", detail: "Detection, segmentation" },
    ],
  },
  {
    group: "Engineering",
    items: [
      { name: "Languages", detail: "Python, TypeScript, SQL" },
      { name: "MLOps", detail: "Docker, CI/CD, monitoring" },
    ],
  },
];

export const certificates: Block[] = [
  {
    type: "file",
    name: "Machine Learning Specialization",
    kind: "PDF",
    description: "Certificate placeholder — attach your file.",
  },
  {
    type: "file",
    name: "Cloud AI Practitioner",
    kind: "PDF",
    description: "Certificate placeholder.",
  },
];

export type Post = {
  slug: string;
  title: string;
  dek: string;
  /** ISO date, e.g. "2026-10-12" */
  date: string;
  readTime?: string;
  tags: string[];
  /** Optional cover — any file type. Leave src empty for a placeholder. */
  cover?: MediaItem;
  blocks: Block[];
};

export const posts: Post[] = [
  {
    slug: "evaluating-rag-systems",
    title: "How I Evaluate Retrieval-Augmented Systems",
    dek: "Golden sets, failure taxonomies and why a single accuracy number is never enough.",
    date: "2026-10-12",
    readTime: "8 min read",
    tags: ["RAG", "Evaluation"],
    cover: {},
    blocks: [
      {
        type: "text",
        body: "Opening paragraph of your essay. Set up the question you are answering and why it matters.",
      },
      { type: "heading", text: "Start With Failures" },
      {
        type: "text",
        body: "Body text. Add as many paragraphs, lists, code snippets and media as you like.",
      },
      {
        type: "media",
        count: 3,
        caption: "Charts, slides or a short video — any number, any format.",
      },
      {
        type: "quote",
        text: "Measure what users actually ask, not what is easy to measure.",
        cite: "Field note",
      },
    ],
  },
  {
    slug: "notes-on-agents",
    title: "Notes on Building Reliable Agents",
    dek: "Guardrails, tool design and the boring engineering that makes agents trustworthy.",
    date: "2026-08-03",
    readTime: "6 min read",
    tags: ["Agents", "LLMs"],
    blocks: [
      { type: "text", body: "Write your post here." },
      { type: "media", caption: "Attach a diagram, PDF or recording." },
    ],
  },
];

export const experience: { role: string; org: string; period: string; blocks: Block[] }[] = [
  {
    role: "AI Engineer",
    org: "Company Name",
    period: "2024 — Present",
    blocks: [
      {
        type: "list",
        items: ["Shipped an LLM assistant used by 10k people.", "Built the evaluation pipeline."],
      },
    ],
  },
  {
    role: "Software Engineer",
    org: "Previous Company",
    period: "2021 — 2024",
    blocks: [{ type: "text", body: "Short description of responsibilities and impact." }],
  },
];
