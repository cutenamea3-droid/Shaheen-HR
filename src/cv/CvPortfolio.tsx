import { Download } from "lucide-react";
import {
  EDUCATION,
  EXPERIENCE,
  LANGUAGES,
  METRICS,
  PROFILE,
  PROJECTS,
  SKILL_GROUPS,
} from "./content";
import { downloadResumePdf } from "./resume-pdf";
import "./cv-portfolio.css";

export function CvPortfolio() {
  return (
    <div className="cv-theme">
      <div className="cv-toolbar cv-no-print">
        <a href="#top" className="cv-toolbar-brand">
          {PROFILE.brand} <span>{PROFILE.brandAccent}</span> — CV
        </a>
        <button type="button" className="cv-btn" onClick={downloadResumePdf}>
          <Download className="size-4" aria-hidden />
          Download A4 PDF
        </button>
      </div>

      <article id="top" className="cv-page" aria-label="Curriculum vitae">
        <header className="cv-header">
          <h1>{PROFILE.fullName}</h1>
          <p className="cv-role">
            {PROFILE.role} · {PROFILE.company}
          </p>
          <div className="cv-contact">
            <span>{PROFILE.location}</span>
            <a href={PROFILE.phoneHref}>{PROFILE.phone}</a>
            <a href={PROFILE.emailHref}>{PROFILE.email}</a>
          </div>
        </header>

        <section className="cv-section" aria-labelledby="summary-h">
          <h2 id="summary-h">Professional summary</h2>
          <p className="cv-summary">{PROFILE.summary}</p>
          <div className="cv-metrics">
            <strong>Selected highlights</strong>
            <ul>
              {METRICS.map((m) => (
                <li key={m.caption}>
                  <strong>{m.value}</strong> — {m.caption}
                </li>
              ))}
            </ul>
            {METRICS.some((m) => m.unverified) ? (
              <p className="cv-flag">
                Metrics flagged for confirmation — carried from the prior CV page; not independently
                verified in this redesign.
              </p>
            ) : null}
          </div>
        </section>

        <section className="cv-section" aria-labelledby="skills-h">
          <h2 id="skills-h">Core skills</h2>
          <dl className="cv-skills">
            {SKILL_GROUPS.map((group) => (
              <div key={group.id} className="cv-skill-row">
                <dt>{group.label}</dt>
                <dd>{group.items.join(" · ")}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="cv-section" aria-labelledby="exp-h">
          <h2 id="exp-h">Experience</h2>
          {EXPERIENCE.map((job) => (
            <div key={`${job.company}-${job.time}`} className="cv-job">
              <div className="cv-job-top">
                <h3>{job.role}</h3>
                <span className="cv-job-time">{job.time}</span>
              </div>
              <p className="cv-job-co">{job.company}</p>
              <p>{job.text}</p>
            </div>
          ))}
        </section>

        <section className="cv-section" aria-labelledby="proj-h">
          <h2 id="proj-h">Projects</h2>
          {PROJECTS.map((project) => (
            <div key={project.id} className="cv-project">
              <h3>{project.name}</h3>
              <p>{project.summary}</p>
              <p className="cv-stack">{project.stack.join(" · ")}</p>
            </div>
          ))}
        </section>

        <section className="cv-section" aria-labelledby="edu-h">
          <h2 id="edu-h">Education</h2>
          {EDUCATION.map((ed) => (
            <div key={ed.title} className="cv-edu">
              <h3>{ed.title}</h3>
              <p>
                {ed.place} · <span className="note">{ed.note}</span>
              </p>
            </div>
          ))}
        </section>

        <section className="cv-section" aria-labelledby="lang-h">
          <h2 id="lang-h">Languages</h2>
          <ul className="cv-langs">
            {LANGUAGES.map((lang) => (
              <li key={lang.name}>
                <strong>{lang.name}</strong> — {lang.level}
              </li>
            ))}
          </ul>
        </section>

        <footer className="cv-footer cv-no-print">
          Public CV — isolated from Compliance &amp; Admin dashboards. Prefer the A4 PDF for
          applications.
        </footer>
      </article>
    </div>
  );
}
