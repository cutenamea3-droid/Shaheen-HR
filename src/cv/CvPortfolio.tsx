/**
 * Premium interactive WEB portfolio (Framer-quality craft).
 * Separate from A4 résumé — see CvA4Resume.
 * No empty initials panel. Metrics gated by METRICS_PUBLIC.
 */
import { useEffect, useEffectEvent, useId, useRef, useState, type FormEvent } from "react";
import {
  Building2,
  Calendar,
  GraduationCap,
  Mail,
  MapPin,
  Minus,
  Phone,
  Plus,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
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

const NAV_OFFSET = 112;

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

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const reduce = useReducedMotion();

  return (
    <div className="cv-faq-item">
      <button
        type="button"
        className="cv-faq-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cv-faq-q">{q}</span>
        <span className="cv-faq-icon" aria-hidden>
          {open ? <Minus className="cv-ico" strokeWidth={2.25} /> : <Plus className="cv-ico" strokeWidth={2.25} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            key="panel"
            className="cv-faq-panel"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: reduce ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.26, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <p>{a}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function CvPortfolio() {
  const [skillId, setSkillId] = useState(SKILL_GROUPS[0]?.id ?? "hr");
  const [activeNav, setActiveNav] = useState("home");
  const [formSent, setFormSent] = useState(false);
  const reduce = useReducedMotion();
  const skillGroup = SKILL_GROUPS.find((g) => g.id === skillId) ?? SKILL_GROUPS[0];

  const onScrollSpy = useEffectEvent(() => {
    const ids = NAV.map((n) => n.id);
    const nearBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 72;
    if (nearBottom) {
      setActiveNav(ids[ids.length - 1] ?? "contact");
      return;
    }
    let current = ids[0] ?? "home";
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= NAV_OFFSET) current = id;
    }
    setActiveNav(current);
  });

  useEffect(() => {
    onScrollSpy();
    window.addEventListener("scroll", onScrollSpy, { passive: true });
    window.addEventListener("hashchange", onScrollSpy);
    return () => {
      window.removeEventListener("scroll", onScrollSpy);
      window.removeEventListener("hashchange", onScrollSpy);
    };
  }, [onScrollSpy]);

  function onNavClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const y = el.getBoundingClientRect().top + window.scrollY - (NAV_OFFSET - 24);
    window.history.pushState(null, "", `#${id}`);
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
    setActiveNav(id);
  }

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

  void METRICS_PUBLIC;

  return (
    <div className="cv-theme">
      <div className="cv-nav-chrome cv-no-print">
        <div className="cv-shell">
          <nav aria-label="Portfolio sections" className="cv-nav">
            <a
              href="#home"
              className="cv-nav-brand"
              onClick={(e) => onNavClick(e, "home")}
            >
              {PROFILE.brand} <span className="accent">{PROFILE.brandAccent}</span>
            </a>
            <LayoutGroup id="cv-nav-tabs">
              <div className="cv-nav-links">
                {NAV.map((item) => {
                  const active = activeNav === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      aria-current={active ? "true" : undefined}
                      onClick={(e) => onNavClick(e, item.id)}
                    >
                      {active ? (
                        <motion.span
                          layoutId="cv-nav-pill"
                          className="cv-nav-pill"
                          transition={
                            reduce
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 420, damping: 36, mass: 0.7 }
                          }
                        />
                      ) : null}
                      <span className="cv-nav-label">{item.label}</span>
                    </a>
                  );
                })}
              </div>
            </LayoutGroup>
            <CvA4Resume label="Download Resume" />
          </nav>
        </div>
      </div>
      <div className="cv-shell">
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
              <span className="cv-meta-row">
                <MapPin className="cv-ico" aria-hidden />
                {PROFILE.location}
              </span>
              <a href={PROFILE.phoneHref} className="cv-meta-row">
                <Phone className="cv-ico" aria-hidden />
                {PROFILE.phone}
              </a>
              <a href={PROFILE.emailHref} className="cv-meta-row">
                <Mail className="cv-ico" aria-hidden />
                {PROFILE.email}
              </a>
            </div>
            <div className="cv-hero-actions cv-no-print">
              <a href="#projects" className="cv-btn cv-btn-ghost" onClick={(e) => onNavClick(e as unknown as React.MouseEvent<HTMLAnchorElement>, "projects")}>
                View projects
              </a>
              <a href="#contact" className="cv-btn cv-btn-primary" onClick={(e) => onNavClick(e as unknown as React.MouseEvent<HTMLAnchorElement>, "contact")}>
                Contact
              </a>
            </div>
          </Rise>

          <Rise className="cv-portrait-wrap">
            <figure className="cv-portrait">
              <picture>
                <source srcSet="/cv/portrait.webp" type="image/webp" />
                <img
                  src="/cv/portrait.jpg"
                  alt="Portrait of Muhammad Yousaf Shahzad"
                  width={840}
                  height={840}
                  decoding="async"
                  fetchPriority="high"
                />
              </picture>
            </figure>
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
                  <p className="cv-exp-when">
                    <Calendar className="cv-ico" aria-hidden />
                    {job.time}
                  </p>
                  <div className="cv-exp-main">
                    <h3>{job.role}</h3>
                    <p className="co">
                      <Building2 className="cv-ico" aria-hidden />
                      {job.company}
                    </p>
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
              <p>Stylish skill tiles — tools and methods used weekly.</p>
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
                <div className="cv-skill-tiles">
                  {(skillGroup?.items ?? []).map((item) => (
                    <div key={item.label} className="cv-skill-tile" data-tone={item.tone}>
                      <span className="ico" aria-hidden>
                        {item.icon}
                      </span>
                      <span className="lbl">{item.label}</span>
                    </div>
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
              <div className="cv-edu-col">
                <p className="cv-edu-col-label">Education</p>
                {EDUCATION.map((ed) => (
                  <div key={ed.title} className="cv-edu-item">
                    <h3>
                      <GraduationCap className="cv-ico cv-ico-inline" aria-hidden />
                      {ed.title}
                    </h3>
                    <p className="cv-edu-meta">
                      {ed.place} · <span className="note">{ed.note}</span>
                    </p>
                    <p className="cv-edu-detail">{ed.detail}</p>
                  </div>
                ))}
              </div>
              <div className="cv-edu-col">
                <p className="cv-edu-col-label">Languages</p>
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
                <FaqItem key={item.q} q={item.q} a={item.a} />
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
                resume — a separate A4 PDF, not a screenshot of this page.
              </p>
              <div className="cv-meta">
                <a href={PROFILE.emailHref} className="cv-meta-row">
                  <Mail className="cv-ico" aria-hidden />
                  {PROFILE.email}
                </a>
                <a href={PROFILE.phoneHref} className="cv-meta-row">
                  <Phone className="cv-ico" aria-hidden />
                  {PROFILE.phone}
                </a>
              </div>
              <div className="cv-contact-dl cv-no-print">
                <CvA4Resume label="Download Resume" />
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
            © {new Date().getFullYear()} {PROFILE.shortName}. Interactive portfolio — resume download
            is available under Contact.
          </p>
        </footer>
      </div>
    </div>
  );
}
