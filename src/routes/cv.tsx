import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  Briefcase,
  GraduationCap,
  Languages,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Wrench,
  Heart,
  Home,
  Layers,
  Hammer,
} from "lucide-react";

export const Route = createFileRoute("/cv")({
  head: () => ({
    meta: [
      { title: "Muhammad Yousaf Shahzad — HR & Safety Compliance Manager" },
      {
        name: "description",
        content:
          "CV of Muhammad Yousaf Shahzad: HR & Safety Compliance Manager at Shaheen Transport LLC, sales professional and web app builder.",
      },
      { property: "og:title", content: "Muhammad Yousaf Shahzad — CV" },
      { property: "og:description", content: "HR, fleet safety compliance, sales and web app development." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CvPage,
});

const EXPERIENCE = [
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
  },
  {
    role: "Sales Executive",
    company: "Step More In Solution PVT (LTD)",
    time: "Mar 2026 – Jun 2026",
    text: "Executed outbound sales strategies to meet organizational targets and managed end-to-end client communications.",
  },
  {
    role: "Telemarketer & Client Account Handler",
    company: "The Global Estimation",
    time: "Nov 2024 – Apr 2025",
    text: "Proactive lead generation and account handling to secure new business, with a heavy focus on cold calling.",
  },
  {
    role: "Sales Agent",
    company: "Ak Internationals",
    time: "2021 – 2023",
    text: "High-volume outbound calling, product pitching, customer inquiries and foundational sales techniques.",
  },
];

const EDUCATION = [
  { title: "BS Information Technology (BSIT)", place: "Virtual University of Pakistan", note: "Enrolled · 2026" },
  { title: "Intermediate in Computer Science (ICS)", place: "Islamiya Higher Secondary College", note: "Grade C+" },
  { title: "Matriculation in Computer Science", place: "Al-Nasir High School", note: "Grade B+" },
];

const SKILLS: [string, string[]][] = [
  ["HR & Compliance", ["Attendance Tracking", "Safety Compliance", "HOS Logs", "ReguLog ELD", "Rawen", "CDL & Medical Records"]],
  ["Sales & Communication", ["Cold Calling", "Client Acquisition", "Strategic Communication", "Direct Sales", "Lead Generation"]],
  ["Tech & Digital", ["Lovable", "Vercel", "GitHub", "Termux", "Gemini CLI", "CapCut", "VN Editor", "Keyframe Animation"]],
];

const METRICS = [
  { value: "60+", caption: "Drivers managed for DOT/DMV compliance" },
  { value: "100%", caption: "Compliance rate maintained" },
  { value: "500+", caption: "Daily outbound calls executed" },
  { value: "15+", caption: "Enterprise projects secured in one month" },
  { value: "20+", caption: "Employees managed weekly for HR/Payroll" },
] as const;

const NAV = [
  { id: "home", label: "Home", Icon: Home },
  { id: "experience", label: "Experience", Icon: Briefcase },
  { id: "expertise", label: "Expertise", Icon: Layers },
  { id: "tools", label: "Tools", Icon: Hammer },
  { id: "education", label: "Education", Icon: GraduationCap },
] as const;

function downloadCv() {
  window.print();
}

function Section({
  id,
  icon: Icon,
  title,
  children,
  delay = 0,
}: {
  id?: string;
  icon: typeof Briefcase;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <section id={id} className="cv-rise scroll-mt-28" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-6 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.2em] text-primary">
        <Icon className="size-4" /> {title}
      </h2>
      {children}
    </section>
  );
}

function CvPage() {
  return (
    <div className="cv-theme min-h-screen">
      <div className="w-full px-3 pb-16 pt-6 sm:px-4 md:px-5 md:pb-24 md:pt-8 lg:px-6">
        {/* Floating CV nav — full-bleed (edge padding only) */}
        <nav
          aria-label="CV sections"
          className="cv-no-print cv-nav ui-lift sticky top-14 z-40 mb-8 flex w-full flex-wrap items-center gap-3 rounded-full border border-white/80 bg-white/95 px-3 py-2 shadow-[0_10px_40px_-18px_rgba(40,20,0,0.35)] backdrop-blur md:gap-4 md:px-5"
        >
          <a href="#home" className="flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold tracking-wide text-foreground md:text-sm">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">YS</span>
            <span>
              YOUSAF <span className="text-primary">SHAHZAD</span> CV
            </span>
          </a>
          <div className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map(({ id, label, Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-orange-50 hover:text-primary"
              >
                <Icon className="size-3.5" /> {label}
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={downloadCv}
            className="ui-press ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-md md:ml-0"
          >
            <Download className="size-4" /> Download CV
          </button>
        </nav>

        <div id="home" className="scroll-mt-28">
          <Link
            to="/"
            className="cv-no-print inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
          >
            <ArrowLeft className="size-4" /> Back to dashboard
          </Link>

          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:gap-10">
            <div className="cv-rise">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary md:text-sm">
                HR • FLEET COMPLIANCE • SALES
              </p>
              <h1 className="cv-serif mt-3 text-4xl font-medium leading-[1.05] text-foreground md:text-6xl lg:text-7xl">
                Muhammad <span className="text-primary">Yousaf</span> Shahzad
              </h1>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4 text-primary" /> Lahore, Pakistan
                </span>
                <a href="tel:+923196658197" className="inline-flex items-center gap-2 hover:text-primary">
                  <Phone className="size-4 text-primary" /> 03196658197
                </a>
                <a href="mailto:yousafranaitx@gmail.com" className="inline-flex items-center gap-2 hover:text-primary">
                  <Mail className="size-4 text-primary" /> yousafranaitx@gmail.com
                </a>
              </div>
              <p className="mt-6 max-w-4xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Data-driven HR, Fleet Compliance, and Sales professional combining operational oversight with technical automation.
                Proven track record of managing <span className="font-semibold text-foreground">100% compliance for 60+ drivers</span>,
                deploying custom cloud-based workforce dashboards, and executing high-volume digital sales strategies.
              </p>
            </div>

            <aside className="cv-rise ui-lift ui-glow rounded-3xl border border-white bg-white p-6 text-center shadow-[0_24px_60px_-28px_rgba(40,20,0,0.45)]" style={{ animationDelay: "80ms" }}>
              <img src="/logo.jpg" alt="Shaheen Transport LLC" className="mx-auto h-28 w-auto object-contain" />
              <h2 className="cv-serif mt-4 text-2xl font-medium text-foreground md:text-3xl">HR &amp; Safety Compliance</h2>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">Manager · Shaheen Transport LLC</p>
              <button
                type="button"
                onClick={downloadCv}
                className="ui-press cv-no-print mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-base font-bold text-primary-foreground shadow-md"
              >
                <Download className="size-4" /> Download CV
              </button>
            </aside>
          </div>

          <div
            className="cv-rise ui-lift mt-10 grid gap-0 overflow-hidden rounded-3xl border border-white bg-white shadow-[0_18px_50px_-24px_rgba(40,20,0,0.4)] sm:grid-cols-2 lg:grid-cols-5"
            style={{ animationDelay: "140ms" }}
          >
            {METRICS.map((m, i) => (
              <div
                key={m.caption}
                className={`px-5 py-6 text-center ${i > 0 ? "border-t border-orange-100 sm:border-t-0 sm:border-l" : ""}`}
              >
                <p className="cv-serif text-4xl font-medium text-primary md:text-5xl">{m.value}</p>
                <p className="mt-2 text-xs font-medium leading-snug text-muted-foreground md:text-sm">{m.caption}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 grid gap-16">
          <Section id="experience" icon={Briefcase} title="Experience" delay={180}>
            <ol className="relative space-y-6 border-l border-orange-200/80 pl-8">
              {EXPERIENCE.map((e) => (
                <li key={e.company + e.time} className="relative">
                  <span
                    className={`absolute -left-[39px] top-2 size-3.5 rounded-full border-2 border-primary ${e.current ? "bg-primary" : "bg-white"}`}
                  />
                  <div className="ui-lift rounded-2xl border border-orange-100/80 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-lg font-bold">{e.role}</h3>
                      <span className="text-sm font-semibold text-primary">{e.time}</span>
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">{e.company}</p>
                    <p className="mt-2 text-muted-foreground">{e.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="expertise" icon={Wrench} title="Skills & Expertise" delay={220}>
            <div className="grid gap-4 md:grid-cols-3">
              {SKILLS.map(([group, items]) => (
                <div key={group} className="ui-lift rounded-2xl border border-orange-100/80 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 font-bold">{group}</h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((s) => (
                      <span key={s} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <div id="tools" className="scroll-mt-28 grid gap-16 md:grid-cols-2">
            <Section id="education" icon={GraduationCap} title="Education" delay={260}>
              <div className="space-y-4">
                {EDUCATION.map((e) => (
                  <div key={e.title} className="ui-lift rounded-2xl border border-orange-100/80 bg-white p-5 shadow-sm">
                    <h3 className="font-bold">{e.title}</h3>
                    <p className="text-sm text-muted-foreground">{e.place}</p>
                    <p className="mt-1 text-sm text-primary">{e.note}</p>
                  </div>
                ))}
              </div>
            </Section>
            <div className="grid gap-16">
              <Section icon={Languages} title="Languages" delay={300}>
                <div className="space-y-3">
                  {[["English", "Professional"], ["Urdu", "Native"], ["Punjabi", "Native"]].map(([l, lv]) => (
                    <div
                      key={l}
                      className="ui-lift flex items-center justify-between rounded-2xl border border-orange-100/80 bg-white px-5 py-3 shadow-sm"
                    >
                      <span className="font-bold">{l}</span>
                      <span className="text-sm text-muted-foreground">{lv}</span>
                    </div>
                  ))}
                </div>
              </Section>
              <Section icon={Heart} title="Interests" delay={340}>
                <div className="space-y-3 text-muted-foreground">
                  <p className="ui-lift rounded-2xl border border-orange-100/80 bg-white p-5 shadow-sm">
                    <span className="font-bold text-foreground">Video editing &amp; content.</span> High-energy anime edits with beat
                    syncing, velocity and keyframe animation in CapCut and VN Editor.
                  </p>
                  <p className="ui-lift rounded-2xl border border-orange-100/80 bg-white p-5 shadow-sm">
                    <span className="font-bold text-foreground">Tech exploration.</span> Building web apps, AI-assisted development and
                    command-line tools on mobile.
                  </p>
                </div>
              </Section>
            </div>
          </div>
        </div>

        <footer className="mt-20 flex items-center gap-2 border-t border-orange-100 pt-6 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-primary" /> Built by Yousaf — creator of the Shaheen Transport dashboards.
        </footer>
      </div>
    </div>
  );
}
