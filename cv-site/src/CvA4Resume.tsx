/**
 * Separate A4 résumé surface — download-only React component.
 * Does not render the web portfolio layout; owns PDF generation UX.
 */
import { Download } from "lucide-react";
import { downloadResumePdf } from "./resume-pdf";

type Props = {
  className?: string;
  label?: string;
  variant?: "primary" | "ghost" | "plain";
};

export function CvA4Resume({
  className = "",
  label = "Download A4 résumé",
  variant = "primary",
}: Props) {
  const base =
    variant === "primary"
      ? "cv-btn cv-btn-primary"
      : variant === "ghost"
        ? "cv-btn cv-btn-ghost"
        : "cv-btn";

  return (
    <button
      type="button"
      className={`${base} ${className}`.trim()}
      onClick={downloadResumePdf}
      aria-label="Download A4 résumé PDF"
    >
      <Download className="size-4" aria-hidden />
      {label}
    </button>
  );
}

export { buildResumePdf, downloadResumePdf } from "./resume-pdf";
