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

export type ProjectStatus = "completed" | "in-progress" | "upcoming" | "archived";

export type ProjectLink = {
  id: string;
  label: string;
  href: string;
  kind: "live" | "github" | "docs" | "demo" | "other";
};

export type Project = {
  slug: string;
  title: string;
  dek: string;
  year: string;
  category: string;
  stack: string[];
  blocks: Block[];
  summary?: string;
  status?: ProjectStatus;
  featured?: boolean;
  priority?: number;
  duration?: string;
  role?: string;
  achievements?: string[];
  challenges?: string;
  thumbnail?: MediaItem;
  cover?: MediaItem;
  gallery?: MediaItem[];
  video?: MediaItem;
  links?: ProjectLink[];
  skillIds?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export type SkillCategory = {
  id: string;
  name: string;
  sort: number;
  visible?: boolean;
};

export type Skill = {
  id: string;
  name: string;
  categoryId: string;
  detail?: string;
  description?: string;
  level?: SkillLevel;
  years?: number;
  icon?: MediaItem;
  featured?: boolean;
  visible?: boolean;
  projectSlugs?: string[];
  sort: number;
};

export type Certificate = {
  id: string;
  title: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  description?: string;
  category?: string;
  featured?: boolean;
  visible?: boolean;
  sort: number;
  image?: MediaItem;
  file?: MediaItem;
  skillIds?: string[];
};

export type ExperienceEmploymentType =
  "full-time" | "part-time" | "contract" | "freelance" | "internship";

export type ExperienceWorkMode = "on-site" | "remote" | "hybrid";

export type ExperienceEntry = {
  id: string;
  role: string;
  org: string;
  employmentType?: ExperienceEmploymentType;
  location?: string;
  workMode?: ExperienceWorkMode;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  period?: string;
  overview?: string;
  responsibilities?: string[];
  achievements?: string[];
  tech?: string[];
  skillIds?: string[];
  projectSlugs?: string[];
  logo?: MediaItem;
  website?: string;
  links?: ProjectLink[];
  media?: MediaItem[];
  visible?: boolean;
  sort: number;
  blocks?: Block[];
};

export type SkillsPageContent = {
  kind: "skills";
  categories: SkillCategory[];
  skills: Skill[];
};

export type CertificatesPageContent = {
  kind: "certificates";
  certificates: Certificate[];
};

export type ExperiencePageContent = {
  kind: "experience";
  entries: ExperienceEntry[];
};

export type VolunteeringEntry = {
  id: string;
  title: string;
  organisation: string;
  date?: string;
  location?: string;
  category?: string;
  shortDescription?: string;
  narrative?: string;
  contribution?: string;
  reflections?: string;
  takeaways?: string[];
  media: MediaItem[];
  featuredImage?: MediaItem;
  featured?: boolean;
  visible?: boolean;
  sort: number;
  links?: ProjectLink[];
};

export type VolunteeringPageContent = {
  kind: "volunteering";
  introduction: {
    heading?: string;
    body?: string;
    image?: MediaItem;
  };
  entries: VolunteeringEntry[];
  whyVolunteering: {
    heading?: string;
    body?: string;
  };
  lookingAhead: {
    heading?: string;
    body?: string;
  };
  interests: string[];
  cta: {
    heading?: string;
    body?: string;
    buttonText?: string;
  };
};

/** A single academic qualification (degree / diploma / certificate of study). */
export type EducationEntry = {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  specialization?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  location?: string;
  status?: string;
  logo?: MediaItem;
  cgpa?: string;
  gradingScale?: string;
  distinctions?: string[];
  scholarships?: string[];
  coursework: { category: string; courses: string[] }[];
  research?: Array<{
    title: string;
    description?: string;
    area?: string;
    technologies?: string[];
    publications?: string[];
    projectLinks?: string[];
    supervisor?: string;
  }>;
  visible?: boolean;
  sort: number;
};

export type EducationPageContent = {
  kind: "education";
  entries: EducationEntry[];
};

/** An academic award, scholarship, honour, or competition recognition. */
export type Award = {
  id: string;
  title: string;
  issuer?: string;
  date?: string;
  category?: string;
  description?: string;
  reason?: string;
  document?: MediaItem;
  image?: MediaItem;
  relatedEducation?: string;
  relatedProject?: string;
  referenceUrl?: string;
  visible?: boolean;
  sort: number;
};

export type AwardPageContent = {
  kind: "awards";
  entries: Award[];
};

/** A page body. `kind` tells the admin editor which form shape to render. */
export type PageContent =
  | { kind: "blocks"; blocks: Block[] }
  | SkillsPageContent
  | CertificatesPageContent
  | ExperiencePageContent
  | VolunteeringPageContent
  | EducationPageContent
  | AwardPageContent;

export type PageKind = PageContent["kind"];

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
  {
    slug: "sample-knowledge-graph",
    title: "Sample Knowledge Graph Builder",
    dek: "A demo pipeline that extracts entities and relations from unstructured text.",
    year: "2025",
    category: "Data Engineering",
    stack: ["Python", "spaCy", "Neo4j", "FastAPI"],
    blocks: [
      { type: "heading", text: "Overview" },
      {
        type: "text",
        body: "Fictional sample project. Builds a knowledge graph from sample documents using named-entity recognition and relation extraction.",
      },
      {
        type: "callout",
        title: "Note",
        body: "This is fictional sample data for the portfolio template.",
      },
    ],
    skillIds: ["skill-rag", "skill-computer-vision"],
    status: "completed",
  },
  {
    slug: "demo-timeseries-forecasting",
    title: "Demo Time-Series Forecasting",
    dek: "A sample forecasting dashboard for synthetic retail demand data.",
    year: "2024",
    category: "Machine Learning",
    stack: ["Python", "scikit-learn", "Prophet", "Streamlit"],
    blocks: [
      { type: "heading", text: "Overview" },
      {
        type: "text",
        body: "Fictional sample project. Forecasts demand using synthetic time-series data with uncertainty intervals.",
      },
      {
        type: "callout",
        title: "Note",
        body: "This is fictional sample data for the portfolio template.",
      },
    ],
    skillIds: ["skill-deep-learning", "skill-mlops"],
    status: "archived",
  },
];

export const skills: SkillsPageContent = {
  kind: "skills",
  categories: [
    { id: "cat-llms-agents", name: "LLMs & Agents", sort: 0 },
    { id: "cat-retrieval", name: "Retrieval", sort: 1 },
    { id: "cat-machine-learning", name: "Machine Learning", sort: 2 },
    { id: "cat-engineering", name: "Engineering", sort: 3 },
  ],
  skills: [
    {
      id: "skill-prompt-tool-design",
      name: "Prompt & tool design",
      categoryId: "cat-llms-agents",
      detail: "Function calling, structured output",
      level: "advanced",
      years: 3,
      featured: true,
      visible: true,
      sort: 0,
    },
    {
      id: "skill-agents",
      name: "Agents",
      categoryId: "cat-llms-agents",
      detail: "Planning, memory, multi-step workflows",
      level: "advanced",
      years: 2,
      visible: true,
      sort: 1,
    },
    {
      id: "skill-evaluation",
      name: "Evaluation",
      categoryId: "cat-llms-agents",
      detail: "Golden sets, LLM-as-judge, regression tests",
      level: "intermediate",
      years: 2,
      visible: true,
      sort: 2,
    },
    {
      id: "skill-rag",
      name: "RAG",
      categoryId: "cat-retrieval",
      detail: "Chunking, hybrid search, reranking",
      level: "advanced",
      years: 3,
      visible: true,
      sort: 0,
    },
    {
      id: "skill-vector-databases",
      name: "Vector databases",
      categoryId: "cat-retrieval",
      detail: "pgvector, Pinecone, FAISS",
      level: "intermediate",
      years: 2,
      visible: true,
      sort: 1,
    },
    {
      id: "skill-deep-learning",
      name: "Deep learning",
      categoryId: "cat-machine-learning",
      detail: "PyTorch, fine-tuning, LoRA",
      level: "intermediate",
      years: 2,
      visible: true,
      sort: 0,
    },
    {
      id: "skill-computer-vision",
      name: "Computer vision",
      categoryId: "cat-machine-learning",
      detail: "Detection, segmentation",
      level: "intermediate",
      years: 2,
      visible: true,
      sort: 1,
    },
    {
      id: "skill-languages",
      name: "Languages",
      categoryId: "cat-engineering",
      detail: "Python, TypeScript, SQL",
      level: "expert",
      years: 5,
      visible: true,
      sort: 0,
    },
    {
      id: "skill-mlops",
      name: "MLOps",
      categoryId: "cat-engineering",
      detail: "Docker, CI/CD, monitoring",
      level: "advanced",
      years: 3,
      visible: true,
      sort: 1,
    },
  ],
};

export const certificates: CertificatesPageContent = {
  kind: "certificates",
  certificates: [
    {
      id: "cert-ml-specialization",
      title: "Machine Learning Specialization",
      issuer: "Sample University of Technology",
      issueDate: "2024-01-15",
      credentialId: "SUT-ML-2024-0001",
      credentialUrl: "https://sampletech.edu/verify/SUT-ML-2024-0001",
      description: "Foundations of machine learning and supervised/unsupervised algorithms.",
      category: "Machine Learning",
      featured: true,
      visible: true,
      sort: 0,
    },
    {
      id: "cert-cloud-ai-practitioner",
      title: "Cloud AI Practitioner",
      issuer: "Cloud Platform Academy",
      issueDate: "2024-06-01",
      expiryDate: "2026-06-01",
      credentialId: "CPA-CLOUDAI-2024-0442",
      description: "Introductory cloud AI services and managed ML workloads.",
      category: "Cloud",
      visible: true,
      sort: 1,
    },
    {
      id: "cert-data-science",
      title: "Data Science Fundamentals",
      issuer: "Data Science Institute",
      issueDate: "2023-11-10",
      credentialId: "DSI-DSF-2023-0881",
      credentialUrl: "https://datascienceinstitute.example/verify/DSF-2023-0881",
      description: "Statistics, data wrangling and exploratory analysis with Python.",
      category: "Data Science",
      featured: true,
      visible: true,
      sort: 2,
      image: {
        src: "/images/certs/data-science-fundamentals.png",
        alt: "Data Science Fundamentals certificate",
        caption: "Sample certificate badge.",
        ratio: "16/9",
      },
      skillIds: ["skill-deep-learning"],
    },
    {
      id: "cert-mlops",
      title: "MLOps Engineering",
      issuer: "Northridge Institute",
      issueDate: "2025-03-20",
      expiryDate: "2027-03-20",
      description: "CI/CD, model serving and monitoring for production ML systems.",
      category: "MLOps",
      visible: true,
      sort: 3,
      skillIds: ["skill-mlops"],
    },
    {
      id: "cert-computer-vision",
      title: "Computer Vision with PyTorch",
      issuer: "Meridian College",
      issueDate: "2025-09-05",
      file: {
        href: "/files/certs/computer-vision-pytorch.pdf",
        name: "computer-vision-pytorch.pdf",
        kind: "pdf",
        description: "Certificate of completion.",
      },
      description: "Image classification, object detection and transfer learning.",
      category: "Computer Vision",
      visible: true,
      sort: 4,
    },
  ],
};

export const education: EducationPageContent = {
  kind: "education",
  entries: [
    {
      id: "edu-bachelor",
      institution: "Sample University of Technology",
      degree: "Bachelor of Science",
      field: "Computer Science",
      specialization: "Artificial Intelligence",
      startDate: "2019-09-01",
      endDate: "2023-05-15",
      location: "Sampleville, ST",
      status: "completed",
      cgpa: "3.72",
      gradingScale: "4.00",
      distinctions: ["Dean's List (2020–2023)", "Graduated with Honors"],
      scholarships: ["SampleTech Merit Scholarship"],
      coursework: [
        { category: "Core", courses: ["Data Structures", "Algorithms", "Operating Systems"] },
        {
          category: "AI",
          courses: ["Machine Learning", "Deep Learning", "Natural Language Processing"],
        },
      ],
      research: [
        {
          title: "Retrieval-Augmented Question Answering",
          description: "A capstone project grounding LLM answers in a curated document corpus.",
          area: "NLP / RAG",
          technologies: ["Python", "LangChain", "pgvector"],
          supervisor: "Dr. Ada Sample",
        },
      ],
      visible: true,
      sort: 0,
    },
    {
      id: "edu-master",
      institution: "Northridge Institute",
      degree: "Master of Science",
      field: "Data Science",
      specialization: "Machine Learning",
      startDate: "2023-09-01",
      current: true,
      location: "Northridge, ST",
      status: "in-progress",
      coursework: [{ category: "Core", courses: ["Statistical Inference", "Big Data Systems"] }],
      visible: true,
      sort: 1,
    },
    {
      id: "edu-associate",
      institution: "Meridian College",
      degree: "Associate of Applied Science",
      field: "Information Technology",
      startDate: "2017-09-01",
      endDate: "2019-06-30",
      location: "Meridian, ST",
      status: "completed",
      coursework: [
        { category: "Core", courses: ["Introduction to Programming", "Database Fundamentals"] },
      ],
      visible: true,
      sort: 2,
    },
  ],
};

export const awards: AwardPageContent = {
  kind: "awards",
  entries: [
    {
      id: "award-rag-competition",
      title: "Best RAG System",
      issuer: "Sample University of Technology",
      date: "2023-04-20",
      category: "Competition",
      description: "First place in the annual student AI hackathon.",
      reason: "Built the highest-scoring retrieval-augmented QA system on the held-out test set.",
      relatedEducation: "edu-bachelor",
      relatedProject: "rag-research-assistant",
      referenceUrl: "https://sampletech.edu/awards/rag-2023",
      visible: true,
      sort: 0,
    },
    {
      id: "award-dean-scholarship",
      title: "Dean's Merit Scholarship",
      issuer: "Sample University of Technology",
      date: "2021-09-01",
      category: "Scholarship",
      description: "Merit-based scholarship awarded for academic excellence.",
      reason: "Top 5% of entering class based on entrance examination and prior grades.",
      relatedEducation: "edu-bachelor",
      visible: true,
      sort: 1,
    },
    {
      id: "award-vision-paper",
      title: "Outstanding Paper Award",
      issuer: "Data Science Institute",
      date: "2024-11-12",
      category: "Publication",
      description: "Recognized at the Sample Data Science Symposium.",
      reason: "Clear exposition and reproducible experiments on synthetic defect detection.",
      relatedProject: "vision-defect-detection",
      referenceUrl: "https://datascienceinstitute.example/symposium/2024",
      visible: true,
      sort: 2,
    },
    {
      id: "award-hackathon",
      title: "Innovation Prize",
      issuer: "Cloud Platform Academy",
      date: "2025-02-18",
      category: "Hackathon",
      description: "Second place in the inter-college cloud innovation challenge.",
      reason: "Best use of managed AI services in a sample serverless application.",
      visible: true,
      sort: 3,
    },
    {
      id: "award-service",
      title: "Community Service Recognition",
      issuer: "Meridian College",
      date: "2019-05-05",
      category: "Service",
      description: "Recognized for volunteer tutoring in introductory programming.",
      reason: "Over 100 hours of peer tutoring delivered during the associate program.",
      relatedEducation: "edu-associate",
      visible: true,
      sort: 4,
    },
  ],
};

export type PostBody = {
  /** Lexical editor state (Koenig / Ghost). Opaque to the rest of the app. */
  lexical: Record<string, unknown>;
  /** Rendered HTML captured from the editor; what the public site displays. */
  html: string;
};

export type PostSEO = {
  title?: string;
  description?: string;
  canonical?: string;
  socialImage?: string;
};

/** Who can read a published post. */
export type PostVisibility = "public" | "unlisted" | "private";

export type Post = {
  slug: string;
  title: string;
  /** Short description / excerpt. */
  dek: string;
  /** ISO date, e.g. "2026-10-12" */
  date: string;
  readTime?: string;
  tags: string[];
  /** Optional cover — any file type. Leave src empty for a placeholder. */
  cover: MediaItem | undefined;
  /** Legacy structured body. Kept for pages written before the Koenig editor. */
  blocks: Block[];
  /** Rich body written with the Koenig editor. Takes precedence over `blocks`. */
  body?: PostBody;
  author: string | undefined;
  /** Featured on the blog index when blog settings enable a featured post. */
  featured: boolean | undefined;
  /** public = listed and readable; unlisted = readable by URL; private = admin only. */
  visibility?: PostVisibility;
  seo: PostSEO | undefined;
};

export const posts: Post[] = [
  {
    slug: "evaluating-rag-systems",
    title: "How I Evaluate Retrieval-Augmented Systems",
    dek: "Golden sets, failure taxonomies and why a single accuracy number is never enough.",
    date: "2026-10-12",
    readTime: "8 min read",
    tags: ["RAG", "Evaluation"],
    author: undefined,
    cover: {},
    featured: undefined,
    seo: undefined,
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
    author: undefined,
    cover: {},
    featured: undefined,
    seo: undefined,
    blocks: [
      { type: "text", body: "Write your post here." },
      { type: "media", caption: "Attach a diagram, PDF or recording." },
    ],
  },
  {
    slug: "sample-vector-databases",
    title: "Choosing a Vector Database for RAG",
    dek: "A fictional sample post comparing pgvector, Pinecone and FAISS.",
    date: "2026-06-18",
    readTime: "7 min read",
    tags: ["RAG", "Vector Databases"],
    author: undefined,
    cover: {},
    featured: undefined,
    seo: undefined,
    blocks: [{ type: "text", body: "Fictional sample post content for the portfolio template." }],
  },
  {
    slug: "demo-mlops-practices",
    title: "Demo MLOps Practices",
    dek: "Notes on model monitoring and CI/CD for ML systems.",
    date: "2026-04-02",
    readTime: "5 min read",
    tags: ["MLOps", "Engineering"],
    author: undefined,
    cover: {},
    featured: undefined,
    seo: undefined,
    blocks: [{ type: "text", body: "Fictional sample post content for the portfolio template." }],
  },
];

export const experience: ExperiencePageContent = {
  kind: "experience",
  entries: [
    {
      id: "exp-ai-engineer",
      role: "AI Engineer",
      org: "Demo Corp",
      employmentType: "full-time",
      location: "Remote",
      workMode: "remote",
      startDate: "2024-01-01",
      current: true,
      period: "2024 — Present",
      overview:
        "Designing and building applied AI systems — retrieval-augmented assistants, computer-vision pipelines, and MLOps — with a focus on reliability, evaluation and thoughtful product craft.",
      responsibilities: [
        "Shipped an LLM assistant used by thousands of users, grounding answers in a curated document corpus.",
        "Owned the end-to-end evaluation pipeline, including golden sets, LLM-as-judge and regression tests.",
        "Deployed and monitored computer-vision models in production with ONNX runtime and Docker.",
      ],
      achievements: [
        "Reduced hallucination rate by 40%",
        "Cut median latency to under 1.2s",
        "Shipped 3 production features serving 10k+ monthly active users",
      ],
      tech: ["Python", "LangChain", "pgvector", "OpenAI", "FastAPI", "ONNX", "Docker"],
      skillIds: ["skill-prompt-tool-design", "skill-agents", "skill-rag", "skill-evaluation"],
      projectSlugs: ["rag-research-assistant", "vision-defect-detection"],
      visible: true,
      sort: 0,
      blocks: [
        {
          type: "list",
          items: [
            "Shipped an LLM assistant used by thousands of users.",
            "Owned the end-to-end evaluation pipeline.",
            "Deployed computer-vision models in production.",
          ],
        },
      ],
    },
    {
      id: "exp-freelance",
      role: "Freelance AI Consultant",
      org: "Sample Technologies",
      employmentType: "freelance",
      location: "Remote",
      workMode: "remote",
      startDate: "2023-01-01",
      endDate: "2023-12-31",
      period: "2023",
      overview:
        "Helped small businesses adopt AI tools for customer support and internal automation on a project basis.",
      responsibilities: [
        "Designed and deployed RAG-based support bots for three clients.",
        "Trained client teams on prompt engineering and tool-use best practices.",
      ],
      achievements: [
        "Reduced support ticket volume by ~30% for a pilot client",
        "Delivered 5 client projects on schedule",
      ],
      tech: ["TypeScript", "OpenAI", "FastAPI", "Postgres"],
      skillIds: ["skill-agents", "skill-rag"],
      visible: true,
      sort: 1,
      blocks: [
        {
          type: "text",
          body: "Helped small businesses adopt AI tools for customer support and internal automation.",
        },
      ],
    },
    {
      id: "exp-research-assistant",
      role: "Research Assistant",
      org: "Northridge Institute",
      employmentType: "part-time",
      location: "Northridge, ST",
      workMode: "hybrid",
      startDate: "2022-09-01",
      endDate: "2023-05-15",
      period: "2022 — 2023",
      overview:
        "Assisted faculty with research on retrieval-augmented generation and evaluation methodology.",
      responsibilities: [
        "Collected and annotated datasets for benchmarking retrieval quality.",
        "Ran experiments comparing dense and hybrid retrieval strategies.",
      ],
      achievements: [
        "Co-authored a sample technical report on retrieval evaluation",
        "Curated a 2k-document evaluation corpus",
      ],
      tech: ["Python", "LangChain", "pgvector"],
      skillIds: ["skill-rag", "skill-evaluation"],
      projectSlugs: ["rag-research-assistant"],
      visible: true,
      sort: 2,
      blocks: [
        {
          type: "text",
          body: "Assisted faculty with research on retrieval-augmented generation and evaluation methodology.",
        },
      ],
    },
    {
      id: "exp-software-engineer",
      role: "Software Engineer",
      org: "Sample Technologies",
      employmentType: "full-time",
      location: "Meridian, ST",
      workMode: "on-site",
      startDate: "2021-01-01",
      endDate: "2023-12-31",
      period: "2021 — 2023",
      overview:
        "Built internal tooling and APIs for a sample B2B software product, focusing on reliability and maintainability.",
      responsibilities: [
        "Built and maintained internal APIs and tooling used by engineering and support teams.",
        "Improved test coverage and CI pipeline reliability.",
      ],
      achievements: [
        "Increased API test coverage from 60% to 90%",
        "Reduced CI build times by 25%",
      ],
      tech: ["TypeScript", "Postgres", "Docker", "GitHub Actions"],
      visible: true,
      sort: 3,
      blocks: [
        {
          type: "text",
          body: "Built internal tooling and APIs for a sample B2B software product.",
        },
      ],
    },
    {
      id: "exp-intern",
      role: "Software Engineering Intern",
      org: "Demo Corp",
      employmentType: "internship",
      location: "Remote",
      workMode: "remote",
      startDate: "2020-06-01",
      endDate: "2020-08-31",
      period: "2020",
      overview:
        "Supported the platform team on internal tooling and bug fixes during a summer internship.",
      responsibilities: [
        "Fixed bugs in the internal dashboard",
        "Wrote unit tests for core services",
      ],
      achievements: [
        "Shipped 3 bug fixes to production",
        "Added test coverage for 2 core services",
      ],
      tech: ["TypeScript", "Postgres", "Docker"],
      visible: true,
      sort: 4,
      blocks: [
        {
          type: "text",
          body: "Supported the platform team on internal tooling and bug fixes during a summer internship.",
        },
      ],
    },
  ],
};

export const volunteering: VolunteeringPageContent = {
  kind: "volunteering",
  introduction: {
    heading: "Why I volunteer",
    body: "I believe in sharing knowledge and making technology accessible to everyone, regardless of formal training or background.",
  },
  entries: [
    {
      id: "volunteer-tutor",
      title: "Code Tutor",
      organisation: "Sample Community Code Club",
      date: "2023-01-01",
      location: "Sampleville, ST",
      category: "Education",
      shortDescription: "Weekly tutoring for beginners learning to code.",
      narrative:
        "I volunteer every Saturday helping high-school students write their first Python programs and build confidence with computers.",
      contribution: "Designed and taught a 10-week introductory programming curriculum.",
      takeaways: [
        "Patience and clear communication matter most.",
        "Teaching reinforces your own fundamentals.",
      ],
      media: [],
      featured: true,
      visible: true,
      sort: 0,
    },
    {
      id: "volunteer-organizer",
      title: "Event Organizer",
      organisation: "Northridge AI Meetup",
      date: "2024-06-15",
      location: "Northridge, ST",
      category: "Community",
      shortDescription: "Helped organize a monthly AI and machine learning meetup.",
      narrative:
        "Co-organized talks, handled speaker outreach, and managed venue logistics for a local practitioner community.",
      contribution: "Organized 6 monthly events with 30–50 attendees each.",
      takeaways: [
        "Event logistics and community building.",
        "Running inclusive, accessible events takes deliberate effort.",
      ],
      media: [],
      featured: false,
      visible: true,
      sort: 1,
    },
  ],
  whyVolunteering: {
    heading: "Giving back",
    body: "Technology should be accessible to everyone, not just those with formal training.",
  },
  lookingAhead: {
    heading: "Looking ahead",
    body: "I want to mentor more people entering the AI field and keep supporting community-focused events.",
  },
  interests: ["AI literacy", "Open source", "Community building"],
  cta: {
    heading: "Get in touch",
    body: "Open to collaborations on community-focused projects.",
    buttonText: "Contact me",
  },
};
