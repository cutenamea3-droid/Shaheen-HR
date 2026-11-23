/**
 * Premium interactive WEB portfolio (Framer-quality craft).
 * Separate from A4 résumé — see CvA4Resume.
 * No empty initials panel. Metrics gated by METRICS_PUBLIC.
 */
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import {
  EDUCATION,
  EXPERIENCE,
  FAQ,
  INTERESTS,
  LANGUAGES,
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
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
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
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div id={id} ref={ref} className={`cv-rise ${className}`.trim()}>
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
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 64;
    if (nearBottom) {
      setActiveNav(ids[ids.length - 1] ?? "contact");
      return;
    }
    let current = ids[0] ?? "home";
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= 130) current = id;
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
    const subject = encodeURIComponent(`Portfolio inquiry from ${name || "visitor"}`);
    const body = encodeURIComponent(`${message}\n\n— ${name}\n${email}`);
    window.location.href = `${PROFILE.emailHref}?subject=${subject}&body=${body}`;
    setFormSent(true);
  }

  // Metrics intentionally unused while METRICS_PUBLIC is false
  void METRICS_PUBLIC;

  return (
    <div className="cv-theme">
      <div className="cv-shell">
        <nav aria-label="Portfolio sections" className="cv-nav cv-no-print">
          <a href="#home" className="cv-nav-brand">
            {PROFILE.brand} <span className="accent">{PROFILE.brandAccent}</span>
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
            <p className="cv-role-line">
              {PROFILE.role} <span>· {PROFILE.company}</span>
            </p>
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
                <MapPin className="size-4 text-[var(--cv-violet-mid)]" aria-hidden />
                {PROFILE.location}
              </span>
              <a href={PROFILE.phoneHref} className="inline-flex items-center gap-2">
                <Phone className="size-4 text-[var(--cv-violet-mid)]" aria-hidden />
                {PROFILE.phone}
              </a>
              <a href={PROFILE.emailHref} className="inline-flex items-center gap-2">
                <Mail className="size-4 text-[var(--cv-violet-mid)]" aria-hidden />
                {PROFILE.email}
              </a>
            </div>
            <div className="cv-hero-actions cv-no-print">
              <CvA4Resume />
              <a href="#projects" className="cv-btn cv-btn-ghost">
                View projects
              </a>
            </div>
          </Rise>

          <Rise className="cv-now" aria-label="Current focus">
            <div className="cv-now-inner">
              <p className="cv-now-kicker">Currently</p>
              <h2>
                Leading HR &amp; safety compliance for a growing fleet operation.
              </h2>
              <p>
                Building the systems I use daily — driver compliance and admin attendance —
                while keeping records audit-ready.
              </p>
              <ul className="cv-now-list">
                <li>Driver document &amp; HOS oversight</li>
                <li>Attendance &amp; workforce operations</li>
                <li>Internal product design &amp; shipping</li>
              </ul>
            </div>
          </Rise>
        </header>

        <Rise id="experience" className="cv-section">
          <section aria-labelledby="experience-heading">
            <div className="cv-section-head">
              <h2 id="experience-heading">Experience</h2>
              <p>Editorial timeline — operations, compliance, and sales.</p>
            </div>
            <div className="cv-exp-list">
              {EXPERIENCE.map((job) => (
                <article key={`${job.company}-${job.time}`} className="cv-exp-row">
                  <p className="cv-exp-when">{job.time}</p>
                  <div className="cv-exp-main">
                    <h3>{job.role}</h3>
                    <p className="co">{job.company}</p>
                    <p className="body">{job.text}</p>
                  </div>
                  <p className="cv-exp-status" data-current={job.current}>
                    {job.current ? "Current" : "Past"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </Rise>

        <Rise id="projects" className="cv-section">
          <section aria-labelledby="projects-heading">
            <div className="cv-section-head">
              <h2 id="projects-heading">Selected work</h2>
              <p>Sanitized product case studies — no credentials, schemas, or prod IDs.</p>
            </div>
            {PROJECTS.map((project, index) => (
              <article key={project.id} className="cv-case">
                <div className="cv-case-index" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <p className="cv-case-eyebrow">{project.eyebrow}</p>
                  <h3>{project.name}</h3>
                  <p className="cv-case-lead">{project.summary}</p>
                  <ul className="cv-case-points">
                    {project.outcomes.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                  <div className="cv-case-stack">
                    {project.stack.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </section>
        </Rise>

        <Rise id="skills" className="cv-section">
          <section aria-labelledby="skills-heading">
            <div className="cv-section-head">
              <h2 id="skills-heading">Skills</h2>
              <p>Refined category lists — tools and methods used weekly.</p>
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
              <div
                className="cv-skill-panel"
                role="tabpanel"
                aria-label={skillGroup?.label ?? "Skills"}
              >
                <h3>{skillGroup?.label}</h3>
                <div className="cv-skill-flow">
                  {(skillGroup?.items ?? []).map((item, i, arr) => (
                    <span key={item}>
                      {item}
                      {i < arr.length - 1 ? <span className="sep"> · </span> : null}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </Rise>

        <Rise id="education" className="cv-section">
          <section aria-labelledby="education-heading">
            <div className="cv-section-head">
              <h2 id="education-heading">Education &amp; languages</h2>
            </div>
            <div className="cv-edu-grid">
              <div>
                {EDUCATION.map((ed) => (
                  <div key={ed.title} className="cv-edu-item">
                    <h3>{ed.title}</h3>
                    <p>
                      {ed.place} · <span className="note">{ed.note}</span>
                    </p>
                  </div>
                ))}
              </div>
              <div>
                <ul className="cv-lang-list">
                  {LANGUAGES.map((lang) => (
                    <li key={lang.name}>
                      <strong>{lang.name}</strong>
                      <span>{lang.level}</span>
                    </li>
                  ))}
                </ul>
                {INTERESTS.map((interest) => (
                  <div key={interest.title} className="cv-interest">
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
              <p>Short answers for recruiters and collaborators.</p>
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
                Let’s talk compliance, systems, or sales.
              </h3>
              <p className="lead">
                Prefer email or phone? Use the details below. For applications, download the
                separate A4 résumé — it is not a screenshot of this page.
              </p>
              <div className="cv-meta">
                <a href={PROFILE.emailHref} className="inline-flex items-center gap-2">
                  <Mail className="size-4 text-[var(--cv-violet-mid)]" aria-hidden />
                  {PROFILE.email}
                </a>
                <a href={PROFILE.phoneHref} className="inline-flex items-center gap-2">
                  <Phone className="size-4 text-[var(--cv-violet-mid)]" aria-hidden />
                  {PROFILE.phone}
                </a>
              </div>
              <div className="mt-6 cv-no-print">
                <CvA4Resume variant="ghost" />
              </div>
            </div>
            <form className="cv-form" onSubmit={onContactSubmit}>
              <label>
                Name
                <input name="name" type="text" autoComplete="name" required />
              </label>
              <label>
                Email
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                Message
                <textarea name="message" required />
              </label>
              <button type="submit" className="cv-btn cv-btn-primary w-fit">
                Send message
              </button>
              <p className="cv-form-note">
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
