import type {
  Block,
  Project,
  SkillsPageContent,
  CertificatesPageContent,
  EducationPageContent,
  AwardPageContent,
  ExperiencePageContent,
  VolunteeringPageContent,
} from "./site";

// Additions only: merged by id/slug into whatever the site already shows.
// Nothing here replaces existing content.

export const projects: Project[] = [
  {
    slug: "agentic-eda-pipeline",
    title: "Agentic EDA Pipeline (DRDO SSPL)",
    dek: "An agentic AI pipeline that turns natural-language circuit specifications into simulated, layout-ready designs.",
    year: "2026",
    category: "Agents",
    stack: ["Python", "LLM agents", "RAG", "Design-rule checking"],
    status: "in-progress",
    featured: true,
    priority: 3,
    role: "Team lead, six interns",
    summary:
      "Built at the Solid State Physics Laboratory (SSPL), DRDO. Covers schematic capture, datasheet retrieval (RAG), layout generation and design-rule validation.",
    blocks: [
      { type: "heading", text: "What it does" },
      {
        type: "text",
        body: "A user describes a circuit in plain language. The pipeline captures a schematic, retrieves component data from datasheets with RAG, generates a layout and validates it against design rules. A working prototype exists and the team is adding capabilities to meet the expectations of the lab's potential users.",
      },
      { type: "heading", text: "Design decisions" },
      {
        type: "list",
        items: [
          "Pass/fail decisions sit in deterministic checks, not in the LLM.",
          "Computational resource use is tracked, and the system is designed for local, on-premises deployment under the lab's security requirements.",
          "I made the major architecture and technical decisions, worked hands-on across the RAG pipeline and design-rule verification, and wrote the pipeline's test harness.",
        ],
      },
    ],
  },
  {
    slug: "fin-bot-financial-rag",
    title: "Fin-Bot: Financial RAG Agent",
    dek: "A citation-aware retrieval-augmented generation system for financial reports.",
    year: "2025",
    category: "LLM Applications",
    stack: ["Python", "LangChain", "Groq", "FAISS"],
    status: "completed",
    featured: true,
    priority: 2,
    summary:
      "Retrieves the top three document chunks per query so that answers stay grounded in source text.",
    blocks: [
      {
        type: "text",
        body: "Fin-Bot answers questions about financial reports and cites the passages it used. A PDF-to-vector pipeline ingests 100+ page reports into FAISS in under 60 seconds and extracts KPIs such as revenue and EBITDA.",
      },
      {
        type: "link",
        href: "https://github.com/amehnd/Fin_ChatBot_RAG",
        title: "Source code",
        source: "GitHub",
        description: "Repository and README.",
      },
    ],
    links: [
      {
        id: "l1",
        label: "GitHub",
        href: "https://github.com/amehnd/Fin_ChatBot_RAG",
        kind: "github",
      },
    ],
  },
  {
    slug: "presentation-inference-agent",
    title: "Presentation Inference Agent",
    dek: "Serverless LLM inference with select-and-click-to-explain for slide content.",
    year: "2025",
    category: "LLM Applications",
    stack: ["Python", "Cloudflare Workers AI", "REST APIs"],
    status: "completed",
    featured: true,
    priority: 1,
    summary: "Parses slide content and explains a selected passage in under 400 ms.",
    blocks: [
      {
        type: "text",
        body: "Built serverless LLM inference on Cloudflare Workers AI and a select-and-click-to-explain feature that parses slide content with under 400 ms latency.",
      },
    ],
  },
  {
    slug: "music-recommendation-system",
    title: "Music Recommendation System",
    dek: "A C++ application that recommends tracks based on user preferences.",
    year: "2024",
    category: "Software Engineering",
    stack: ["C++"],
    status: "completed",
    summary: "Course project, structured as separate cooperating components.",
    blocks: [
      {
        type: "text",
        body: "Designed and implemented a C++ application that recommends music tracks based on user preferences, structured as separate cooperating components.",
      },
      {
        type: "link",
        href: "https://github.com/amehnd/music-recommedation-cpp",
        title: "Source code",
        source: "GitHub",
      },
    ],
    links: [
      {
        id: "l1",
        label: "GitHub",
        href: "https://github.com/amehnd/music-recommedation-cpp",
        kind: "github",
      },
    ],
  },
];

export const skills: SkillsPageContent = {
  kind: "skills",
  categories: [
    { id: "cat-programming", name: "Programming", sort: 0 },
    { id: "cat-ai", name: "AI & Agentic Systems", sort: 1 },
    { id: "cat-systems", name: "Systems & Data", sort: 2 },
    { id: "cat-sim", name: "Networking & Simulation", sort: 3 },
  ],
  skills: [
    {
      id: "s-python",
      name: "Python",
      categoryId: "cat-programming",
      featured: true,
      visible: true,
      sort: 0,
    },
    { id: "s-cpp", name: "C++", categoryId: "cat-programming", visible: true, sort: 1 },
    { id: "s-java", name: "Java", categoryId: "cat-programming", visible: true, sort: 2 },
    { id: "s-js", name: "JavaScript", categoryId: "cat-programming", visible: true, sort: 3 },
    {
      id: "s-fortran",
      name: "Fortran",
      categoryId: "cat-programming",
      detail: "CPT simulations",
      visible: true,
      sort: 4,
    },
    { id: "s-r", name: "R", categoryId: "cat-programming", visible: true, sort: 5 },
    { id: "s-web", name: "HTML/CSS", categoryId: "cat-programming", visible: true, sort: 6 },
    {
      id: "s-agents",
      name: "LLM agent pipelines",
      categoryId: "cat-ai",
      featured: true,
      visible: true,
      sort: 0,
    },
    {
      id: "s-rag",
      name: "RAG",
      categoryId: "cat-ai",
      detail: "LangChain, LangGraph, FAISS",
      featured: true,
      visible: true,
      sort: 1,
    },
    {
      id: "s-harness",
      name: "Agent test harnesses",
      categoryId: "cat-ai",
      detail: "Deterministic verification of LLM output",
      visible: true,
      sort: 2,
    },
    {
      id: "s-cv",
      name: "Computer vision",
      categoryId: "cat-ai",
      detail: "YOLOv8",
      visible: true,
      sort: 3,
    },
    { id: "s-hf", name: "Hugging Face", categoryId: "cat-ai", visible: true, sort: 4 },
    { id: "s-linux", name: "Linux", categoryId: "cat-systems", visible: true, sort: 0 },
    {
      id: "s-docker",
      name: "Docker & Kubernetes",
      categoryId: "cat-systems",
      visible: true,
      sort: 1,
    },
    {
      id: "s-cloud",
      name: "AWS, GCP, OCI",
      categoryId: "cat-systems",
      detail: "EC2, S3, SageMaker",
      visible: true,
      sort: 2,
    },
    { id: "s-db", name: "PostgreSQL & MySQL", categoryId: "cat-systems", visible: true, sort: 3 },
    {
      id: "s-data",
      name: "PySpark & ETL pipelines",
      categoryId: "cat-systems",
      visible: true,
      sort: 4,
    },
    { id: "s-git", name: "Git", categoryId: "cat-systems", visible: true, sort: 5 },
    {
      id: "s-net",
      name: "TCP/IP, Wireshark, NS3, CCNA",
      categoryId: "cat-sim",
      visible: true,
      sort: 0,
    },
    {
      id: "s-quantum",
      name: "QKD and CPT simulation",
      categoryId: "cat-sim",
      visible: true,
      sort: 1,
    },
  ],
};

export const certificates: CertificatesPageContent = {
  kind: "certificates",
  certificates: [
    {
      id: "c-oci-found",
      title: "Oracle Cloud Infrastructure: Foundations Associate",
      issuer: "Oracle",
      credentialId: "1Z0-1122-25",
      category: "Cloud",
      visible: true,
      sort: 0,
    },
    {
      id: "c-oci-ds",
      title: "Oracle Cloud Infrastructure: Data Science Professional",
      issuer: "Oracle",
      credentialId: "1Z0-1110-25",
      category: "Data Science",
      visible: true,
      sort: 1,
    },
    {
      id: "c-oci-genai",
      title: "Oracle Cloud Infrastructure: Generative AI Professional",
      issuer: "Oracle",
      credentialId: "1Z0-1127-25",
      category: "Generative AI",
      featured: true,
      visible: true,
      sort: 2,
    },
    {
      id: "c-ibm-sql",
      title: "Databases and SQL for Data Science with Python",
      issuer: "IBM",
      category: "Data",
      visible: true,
      sort: 3,
    },
  ],
};

export const education: EducationPageContent = {
  kind: "education",
  entries: [
    {
      id: "edu-btech",
      institution: "Bharati Vidyapeeth's College of Engineering, New Delhi",
      degree: "Bachelor of Technology",
      field: "Electronics and Communication Engineering",
      specialization: "Minor in Computer Science Engineering",
      startDate: "2021-08-01",
      endDate: "2025-06-30",
      location: "New Delhi, India",
      status: "completed",
      cgpa: "7.95",
      gradingScale: "10",
      distinctions: [
        "Semesters 5–8 (Dec 2023 – May 2025): 8.61/10, credit-weighted",
        "SGPA 10.0 in semester 8",
      ],
      coursework: [
        {
          category: "Computer Science",
          courses: [
            "Data Structures and Algorithms (with lab)",
            "C++ Programming",
            "Operating Systems",
            "Introduction to Database Management Systems",
            "Introduction to Software Engineering",
          ],
        },
        {
          category: "Networks and Systems",
          courses: [
            "Data Communication and Networking",
            "Next Generation Networks",
            "Introduction to Internet of Things",
          ],
        },
      ],
      visible: true,
      sort: 0,
    },
  ],
};

export const awards: AwardPageContent = {
  kind: "awards",
  entries: [
    {
      id: "award-hackwave",
      title: "3rd place, Machine Learning Hackathon",
      issuer: "HACKWAVE'25",
      date: "2025-01-01",
      category: "Hackathon",
      description: "Third place in the HACKWAVE'25 machine learning hackathon.",
      visible: true,
      sort: 0,
    },
  ],
};

export const experience: ExperiencePageContent = {
  kind: "experience",
  entries: [
    {
      id: "exp-drdo",
      role: "Research Apprentice, Acting Project Lead",
      org: "DRDO: Solid State Physics Laboratory (SSPL) and Quantum Technology Research Centre (QTRC)",
      employmentType: "internship",
      location: "New Delhi, India",
      workMode: "on-site",
      startDate: "2025-10-01",
      current: true,
      period: "Oct 2025 — Present",
      overview:
        "Research apprenticeship across two DRDO laboratories: an agentic AI pipeline for electronic design automation at SSPL, and hardware-control and simulation software for quantum research at QTRC.",
      responsibilities: [
        "SSPL (Feb 2026 – present): initiated and lead a six-intern team building an agentic AI pipeline for EDA that turns natural-language circuit specifications into simulated, layout-ready designs: schematic capture, datasheet retrieval (RAG), layout generation and design-rule validation.",
        "Make the major architecture and technical decisions; work hands-on across the RAG pipeline and design-rule verification; wrote the pipeline's test harness.",
        "Pass/fail decisions are kept in deterministic checks rather than in the LLM. Tracked computational resource use and designed for local, on-premises deployment under the lab's security requirements.",
        "QTRC: developed Python hardware-control software for a laser-locking program supporting atomic-clock research based on Coherent Population Trapping (CPT), and learned and applied Fortran for compute-intensive CPT simulations.",
        "Extended an existing Quantum Key Distribution (QKD) simulation framework, working with teammates to add capabilities.",
      ],
      tech: ["Python", "Fortran", "RAG", "LLM agents"],
      projectSlugs: ["agentic-eda-pipeline"],
      visible: true,
      sort: 0,
    },
    {
      id: "exp-otc",
      role: "Machine Learning and Robotics Systems Intern",
      org: "OTC Daihen",
      employmentType: "internship",
      workMode: "on-site",
      startDate: "2025-01-01",
      endDate: "2025-06-30",
      period: "Jan 2025 — Jun 2025",
      overview: "Machine learning for industrial welding robots.",
      responsibilities: [
        "Built an end-to-end YOLOv8 object-detection pipeline on Amazon SageMaker, with distributed training on GPU EC2 instances and data in S3 (mAP above 0.8, 95% precision).",
        "Evaluated Hugging Face models to choose lightweight architectures for edge deployment, keeping accuracy above 90% at lower compute cost.",
        "Built a sensor-telemetry fault-prediction model for welding machines as my final-year industry project, using synthetic datasets of hazardous scenarios.",
      ],
      tech: ["YOLOv8", "Amazon SageMaker", "EC2", "S3", "Hugging Face"],
      visible: true,
      sort: 1,
    },
    {
      id: "exp-digipaath",
      role: "Full Stack Developer Trainee",
      org: "DigiPaath",
      employmentType: "internship",
      startDate: "2024-07-01",
      endDate: "2024-08-31",
      period: "Jul 2024 — Aug 2024",
      overview: "Built and deployed an e-commerce application.",
      responsibilities: [
        "Built and deployed an e-commerce application with React, Node.js/Express, PostgreSQL and Docker on AWS EC2/ELB, with RESTful APIs.",
      ],
      tech: ["React", "Node.js", "Express", "PostgreSQL", "Docker", "AWS"],
      visible: true,
      sort: 2,
    },
  ],
};

export const volunteering: VolunteeringPageContent = {
  kind: "volunteering",
  introduction: {
    heading: "Community work",
    body: "Alongside engineering, I coordinate community initiatives through Rotaract.",
  },
  entries: [
    {
      id: "vol-rotaract",
      title: "Event Chair",
      organisation: "Rotaract Club of Delhi SouthEast",
      category: "Community",
      shortDescription: "Coordinated community initiatives across 25+ clubs and 5 districts.",
      media: [],
      featured: true,
      visible: true,
      sort: 0,
    },
  ],
  whyVolunteering: {},
  lookingAhead: {},
  interests: [],
  cta: {},
};

export const overviewAdditions: Block[] = [
  {
    type: "text",
    body: "I am a B.Tech graduate in Electronics and Communication Engineering (minor in Computer Science) and a research apprentice at DRDO, New Delhi. I lead a six-intern team building an agentic AI pipeline for electronic design automation, and I write hardware-control and simulation software for quantum research.",
  },
];
