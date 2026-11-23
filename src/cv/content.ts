/**
 * Shared CV facts — source of truth from the existing `/cv` page.
 * Web portfolio and A4 PDF are separate React surfaces that both read this file.
 *
 * Unverified metrics stay in data for later approval but MUST NOT appear on
 * public web or PDF until the owner confirms (`METRICS_PUBLIC = false`).
 */

export const METRICS_PUBLIC = false;

export const PROFILE = {
  fullName: "Muhammad Yousaf Shahzad",
  shortName: "Yousaf Shahzad",
  brand: "YOUSAF",
  brandAccent: "SHAHZAD",
  monogram: "YS",
  role: "HR & Safety Compliance Manager",
  company: "Shaheen Transport LLC",
  location: "Lahore, Pakistan",
  phone: "03196658197",
  phoneHref: "tel:+923196658197",
  email: "yousafranaitx@gmail.com",
  emailHref: "mailto:yousafranaitx@gmail.com",
  tags: ["HR", "Fleet Compliance", "Sales", "Web Apps"] as const,
  summary:
    "Data-driven HR, Fleet Compliance, and Sales professional combining operational oversight with technical automation. Builds cloud workforce dashboards while keeping driver compliance and attendance systems reliable day to day.",
} as const;

export const EXPERIENCE = [
  {
    role: "Human Resources & Safety Compliance Manager",
    company: "Shaheen Transport LLC",
    time: "Sep 2026 – Present",
    text: "Overseeing employee attendance, managing driver CDL and medical records, handling compliance files and fleet Hours of Service (HOS) logs using ReguLog ELD and Rawen software.",
    current: true,
  },
  {
    role: "Sales Executive",
    company: "ULP Digital",
    time: "Jul 2026 – Sep 2026",
    text: "Executing outbound sales and digital marketing strategies.",
    current: false,
  },
  {
    role: "Sales Executive",
    company: "Step More In Solution PVT (LTD)",
    time: "Mar 2026 – Jun 2026",
    text: "Executed outbound sales strategies to meet organizational targets and managed end-to-end client communications.",
    current: false,
  },
  {
    role: "Telemarketer & Client Account Handler",
    company: "The Global Estimation",
    time: "Nov 2024 – Apr 2025",
    text: "Proactive lead generation and account handling to secure new business, with a heavy focus on cold calling.",
    current: false,
  },
  {
    role: "Sales Agent",
    company: "Ak Internationals",
    time: "2021 – 2023",
    text: "High-volume outbound calling, product pitching, customer inquiries and foundational sales techniques.",
    current: false,
  },
] as const;

/** Sanitized product case studies — no internal credentials, schemas, or prod IDs. */
export const PROJECTS = [
  {
    id: "compliance",
    name: "Driver Compliance Portal",
    eyebrow: "Product",
    summary:
      "A fleet compliance workspace for tracking driver documents, medical cards, drug tests, and future renewal plans — designed so HR can see what needs action today without digging through folders.",
    outcomes: [
      "Unified driver dossiers with expiry-aware alerts",
      "Today / future-plan views for renewal workload",
      "Operational history and readiness summaries for audits",
    ],
    stack: ["React", "TanStack Router", "Supabase", "Vite"],
  },
  {
    id: "admin",
    name: "Admin & Attendance Desk",
    eyebrow: "Product",
    summary:
      "An isolated HR desk for employee attendance, directory, expenses, and payroll-adjacent workflows — visually and architecturally separated from the driver compliance module.",
    outcomes: [
      "Attendance tracking with clear employee records",
      "Directory, expenses, and activity logging in one shell",
      "Module isolation so Compliance and Admin never share stores",
    ],
    stack: ["React", "Zustand", "Supabase Auth", "jsPDF"],
  },
] as const;

export const EDUCATION = [
  {
    title: "BS Information Technology (BSIT)",
    place: "Virtual University of Pakistan",
    note: "Enrolled · 2026",
  },
  {
    title: "Intermediate in Computer Science (ICS)",
    place: "Islamiya Higher Secondary College",
    note: "Grade C+",
  },
  {
    title: "Matriculation in Computer Science",
    place: "Al-Nasir High School",
    note: "Grade B+",
  },
] as const;

export const SKILL_GROUPS: { id: string; label: string; items: string[] }[] = [
  {
    id: "hr",
    label: "HR & Compliance",
    items: [
      "Attendance Tracking",
      "Safety Compliance",
      "HOS Logs",
      "ReguLog ELD",
      "Rawen",
      "CDL & Medical Records",
    ],
  },
  {
    id: "sales",
    label: "Sales & Communication",
    items: [
      "Cold Calling",
      "Client Acquisition",
      "Strategic Communication",
      "Direct Sales",
      "Lead Generation",
    ],
  },
  {
    id: "tech",
    label: "Tech & Digital",
    items: [
      "Lovable",
      "Vercel",
      "GitHub",
      "Termux",
      "Gemini CLI",
      "CapCut",
      "VN Editor",
      "Keyframe Animation",
    ],
  },
];

export const LANGUAGES = [
  { name: "English", level: "Professional" },
  { name: "Urdu", level: "Native" },
  { name: "Punjabi", level: "Native" },
] as const;

export const INTERESTS = [
  {
    title: "Video editing & content",
    text: "High-energy anime edits with beat syncing, velocity and keyframe animation in CapCut and VN Editor.",
  },
  {
    title: "Tech exploration",
    text: "Building web apps, AI-assisted development and command-line tools on mobile.",
  },
] as const;

/**
 * Held back from public web + PDF until owner approval (`METRICS_PUBLIC`).
 * `unverified: true` = from prior CV page, not independently validated.
 */
export const METRICS = [
  {
    value: "60+",
    caption: "Drivers managed for DOT/DMV compliance",
    unverified: true,
  },
  {
    value: "100%",
    caption: "Compliance rate maintained",
    unverified: true,
  },
  {
    value: "500+",
    caption: "Daily outbound calls executed",
    unverified: true,
  },
  {
    value: "15+",
    caption: "Enterprise projects secured in one month",
    unverified: true,
  },
  {
    value: "20+",
    caption: "Employees managed weekly for HR/Payroll",
    unverified: true,
  },
] as const;

export const FAQ = [
  {
    q: "What do you focus on day to day?",
    a: "Driver document compliance, attendance oversight, and keeping the Shaheen Transport HR systems accurate and usable for the team.",
  },
  {
    q: "Do you build the software you use?",
    a: "Yes — I designed and ship the Driver Compliance and Admin & Attendance web apps used internally, from UX through deployment.",
  },
  {
    q: "How can I reach you?",
    a: "Email yousafranaitx@gmail.com or call 03196658197. Based in Lahore, Pakistan.",
  },
] as const;

export const NAV = [
  { id: "home", label: "Home" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
  { id: "education", label: "Education" },
  { id: "contact", label: "Contact" },
] as const;
