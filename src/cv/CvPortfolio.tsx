/**
 * Premium interactive WEB portfolio — full-width, Framer-quality craft.
 * Intentionally NOT a centered print sheet. PDF is a separate component (CvA4Resume).
 */
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import {
  EDUCATION,
  EXPERIENCE,
  FAQ,
  INTERESTS,
  LANGUAGES,
  METRICS,
  METRICS_PUBLIC,
  NAV,
  PROFILE,
  PROJECTS,
  SKILL_GROUPS,
} from "./content";
import { CvA4Resume } from "./CvA4Resume";
import "./cv-portfolio.css";

function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add("is-in");
          io.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Rise({
  children,
  className = "",
  id,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div id={id} ref={ref} className={`cv-rise ${className}`.trim()} aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export function CvPortfolio() {
  const [skillId, setSkillId] = useState(SKILL_GROUPS[0]?.id ?? "hr");
  const [activeNav, setActiveNav] = useState("home");
  const [formSent, setFormSent] = useState(false);
  const skillGroup = SKILL_GROUPS.find((g) => g.id === skillId) ?? SKILL_GROUPS[0];

  const onScrollSpy = useEffectEvent(() => {
    const ids = NAV.map((n) => n.id);
    const nearBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 48;
    if (nearBottom) {
      setActiveNav(ids[ids.length - 1] ?? "contact");
      return;
    }
    let current = ids[0] ?? "home";
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= 120) current = id;
    }
    setActiveNav(current);
  });

  useEffect(() => {
    onScrollSpy();
    window.addEventListener("scroll", onScrollSpy, { passive: true });
    return () => window.removeEventListener("scroll", onScrollSpy);
  }, [onScrollSpy]);

  function onContactSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const subject = encodeURIComponent(`CV inquiry from ${name || "visitor"}`);
    const body = encodeURIComponent(`${message}\n\n— ${name}\n${email}`);
    window.location.href = `${PROFILE.emailHref}?subject=${subject}&body=${body}`;
    setFormSent(true);
  }

  return (
    <div className="cv-theme">
      <div className="cv-shell pb-2">
        <nav aria-label="Portfolio sections" className="cv-nav cv-no-print">
          <a href="#home" className="cv-nav-brand">
            <span className="cv-nav-mono">{PROFILE.monogram}</span>
            <span>
              {PROFILE.brand} <span className="accent">{PROFILE.brandAccent}</span>
            </span>
          </a>
          <div className="cv-nav-links">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={activeNav === item.id ? "true" : undefined}
              >
                {item.label}
              </a>
            ))}
          </div>
          <CvA4Resume label="Download CV" />
        </nav>

        <header id="home" className="cv-hero">
          <Rise>
            <p className="cv-kicker">Personal portfolio</p>
            <h1>
              Muhammad <span className="accent">Yousaf</span>
              <br />
              <span className="italic">Shahzad</span>
            </h1>
            <div className="cv-pills" aria-label="Focus areas">
              {PROFILE.tags.map((tag) => (
                <span key={tag} className="cv-pill">
                  {tag}
                </span>
              ))}
            </div>
            <p className="cv-bio">{PROFILE.summary}</p>
            <div className="cv-meta">
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-[var(--cv-accent)]" aria-hidden />
                {PROFILE.location}
              </span>
              <a href={PROFILE.phoneHref} className="inline-flex items-center gap-2">
                <Phone className="size-4 text-[var(--cv-accent)]" aria-hidden />
                {PROFILE.phone}
              </a>
              <a href={PROFILE.emailHref} className="inline-flex items-center gap-2">
                <Mail className="size-4 text-[var(--cv-accent)]" aria-hidden />
                {PROFILE.email}
              </a>
            </div>
            <div className="cv-hero-actions cv-no-print" style={{ justifyContent: "flex-start" }}>
              <CvA4Resume />
              <a href="#contact" className="cv-btn cv-btn-ghost">
                Get in touch
              </a>
            </div>
          </Rise>

          <Rise className="cv-stage" aria-label="Typographic portrait">
            <div className="cv-stage-inner">
              <div className="cv-stage-mono">{PROFILE.monogram}</div>
              <p className="cv-stage-role">
                {PROFILE.role}
                <br />
                {PROFILE.company}
              </p>
            </div>
          </Rise>
        </header>

        {METRICS_PUBLIC ? (
          <Rise className="cv-section" aria-label="Highlights">
            <div className="cv-section-head">
              <h2>Highlights</h2>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {METRICS.map((m) => (
                <li key={m.caption} className="cv-card">
                  <h3 className="text-[var(--cv-accent)]">{m.value}</h3>
                  <p>{m.caption}</p>
                </li>
              ))}
            </ul>
          </Rise>
        ) : null}

        <Rise id="experience" className="cv-section">
          <section aria-labelledby="experience-heading">
            <div className="cv-section-head">
              <h2 id="experience-heading">Experience</h2>
              <p>Operations, compliance, and sales — newest first.</p>
            </div>
            <ol className="cv-timeline">
              {EXPERIENCE.map((job) => (
                <li key={`${job.company}-${job.time}`} className="cv-job" data-current={job.current}>
                  <div className="cv-job-top">
                    <h3>{job.role}</h3>
                    <span className="cv-job-time">{job.time}</span>
                  </div>
                  <p className="cv-job-co">{job.company}</p>
                  <p>{job.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </Rise>

        <Rise id="projects" className="cv-section">
          <section aria-labelledby="projects-heading">
            <div className="cv-section-head">
              <h2 id="projects-heading">Projects</h2>
              <p>Sanitized case studies — no internal credentials or prod wiring.</p>
            </div>
            <div className="cv-projects">
              {PROJECTS.map((project) => (
                <article key={project.id} className="cv-project">
                  <p className="cv-project-eyebrow">{project.eyebrow}</p>
                  <h3>{project.name}</h3>
                  <p>{project.summary}</p>
                  <ul>
                    {project.outcomes.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                  <div className="cv-stack">
                    {project.stack.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </Rise>

        <Rise id="skills" className="cv-section">
          <section aria-labelledby="skills-heading">
            <div className="cv-section-head">
              <h2 id="skills-heading">Skills</h2>
              <p>Category tabs with tools and methods used weekly.</p>
            </div>
            <div className="cv-skills">
              <div className="cv-skill-tabs" role="tablist" aria-label="Skill categories">
                {SKILL_GROUPS.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    role="tab"
                    className="cv-skill-tab"
                    aria-selected={skillId === group.id}
                    onClick={() => setSkillId(group.id)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
              <div className="cv-skill-grid" role="tabpanel" aria-label={skillGroup?.label ?? "Skills"}>
                {(skillGroup?.items ?? []).map((item) => (
                  <div key={item} className="cv-skill-chip">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Rise>

        <Rise id="education" className="cv-section">
          <section aria-labelledby="education-heading">
            <div className="cv-section-head">
              <h2 id="education-heading">Education &amp; more</h2>
            </div>
            <div className="cv-edu-grid">
              <div className="cv-edu-list">
                {EDUCATION.map((ed) => (
                  <div key={ed.title} className="cv-card">
                    <h3>{ed.title}</h3>
                    <p>{ed.place}</p>
                    <p className="note">{ed.note}</p>
                  </div>
                ))}
              </div>
              <div className="cv-side-list">
                <div className="cv-card">
                  <h3>Languages</h3>
                  {LANGUAGES.map((lang) => (
                    <div key={lang.name} className="cv-lang-row">
                      <span className="font-bold text-[var(--cv-ink)]">{lang.name}</span>
                      <span className="text-sm text-[var(--cv-muted)]">{lang.level}</span>
                    </div>
                  ))}
                </div>
                {INTERESTS.map((interest) => (
                  <div key={interest.title} className="cv-card">
                    <h3>{interest.title}</h3>
                    <p>{interest.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Rise>

        <Rise className="cv-section">
          <section aria-labelledby="faq-heading">
            <div className="cv-section-head">
              <h2 id="faq-heading">FAQ</h2>
              <p>Quick answers for recruiters and collaborators.</p>
            </div>
            <div className="cv-faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </Rise>

        <Rise id="contact" className="cv-section">
          <section aria-labelledby="contact-heading" className="cv-contact">
            <div>
              <p className="cv-kicker">Contact</p>
              <h3 id="contact-heading">
                Let’s talk <span className="italic">compliance,</span> systems, or sales.
              </h3>
              <p>
                Prefer email or phone? Details below — the form opens your mail client with a drafted
                message. For applications, download the separate A4 résumé PDF.
              </p>
              <div className="cv-meta">
                <a href={PROFILE.emailHref} className="inline-flex items-center gap-2">
                  <Mail className="size-4 text-[var(--cv-accent)]" aria-hidden />
                  {PROFILE.email}
                </a>
                <a href={PROFILE.phoneHref} className="inline-flex items-center gap-2">
                  <Phone className="size-4 text-[var(--cv-accent)]" aria-hidden />
                  {PROFILE.phone}
                </a>
              </div>
              <div className="mt-5 cv-no-print">
                <CvA4Resume variant="ghost" />
              </div>
            </div>
            <form
              className="cv-card grid gap-3"
              style={{ padding: "1.35rem" }}
              onSubmit={onContactSubmit}
            >
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[var(--cv-muted)]">
                Name
                <input
                  name="name"
                  required
                  autoComplete="name"
                  className="rounded-xl border border-[var(--cv-line)] bg-white px-3 py-2.5 text-base font-medium normal-case tracking-normal text-[var(--cv-ink)]"
                />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[var(--cv-muted)]">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="rounded-xl border border-[var(--cv-line)] bg-white px-3 py-2.5 text-base font-medium normal-case tracking-normal text-[var(--cv-ink)]"
                />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[var(--cv-muted)]">
                Message
                <textarea
                  name="message"
                  required
                  rows={4}
                  className="rounded-xl border border-[var(--cv-line)] bg-white px-3 py-2.5 text-base font-medium normal-case tracking-normal text-[var(--cv-ink)]"
                />
              </label>
              <button type="submit" className="cv-btn cv-btn-primary w-fit">
                Send message
              </button>
              <p className="m-0 text-sm text-[var(--cv-muted)]">
                {formSent
                  ? "Mail client opened — if nothing appeared, email me directly."
                  : "Opens mailto: — no server storage."}
              </p>
            </form>
          </section>
        </Rise>

        <footer className="cv-footer">
          <p>
            © {new Date().getFullYear()} {PROFILE.shortName}. Interactive portfolio — A4 résumé is a
            separate download.
          </p>
          <CvA4Resume variant="ghost" label="A4 PDF" className="cv-no-print" />
        </footer>
      </div>
    </div>
  );
}
