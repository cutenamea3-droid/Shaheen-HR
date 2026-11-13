/**
 * Public VU study rhythm + Dashboard UX from vu-study-patterns.json / deep research §8.
 * Coaching + vocabulary only — remaining work / marks come from student exports.
 */

import patterns from "@/personal/data/vu-study-patterns.json";

export const VU_PATTERNS = patterns;

export type VuRhythmStepId =
  | "lecture"
  | "handout"
  | "mdb"
  | "assignment"
  | "gdb"
  | "quiz"
  | "revise";

export type VuRhythmStep = {
  id: VuRhythmStepId;
  title: string;
  blurb: string;
  minutesHint: number;
};

export const VU_LESSON_RHYTHM: VuRhythmStep[] = [
  {
    id: "handout",
    title: "Handouts first",
    blurb: "Handouts are the exam source. When behind, read the lesson handout before or instead of a full rewatch.",
    minutesHint: patterns.timeBudgetsMinutes.handoutLessonRead.defaultPreset,
  },
  {
    id: "lecture",
    title: "Video lecture",
    blurb: "Watch the Lecture Schedule lesson (or selective rewatch for gaps). ~50m classic; short modules exist.",
    minutesHint: patterns.timeBudgetsMinutes.lectureClassic.defaultPreset,
  },
  {
    id: "mdb",
    title: "MDB (help)",
    blurb: "Moderated Discussion Board — ask tutors about lectures. Ungraded; not a substitute for GDB.",
    minutesHint: 10,
  },
  {
    id: "assignment",
    title: "Assignment",
    blurb: "Download → solve offline → upload early. Last-hour uploads risk VULMS load spikes.",
    minutesHint: patterns.timeBudgetsMinutes.assignmentNonProgramming.defaultPreset,
  },
  {
    id: "gdb",
    title: "GDB",
    blurb: "Graded Discussion Board (aka GDDB). Short original post inside the window — locks with no grace.",
    minutesHint: patterns.timeBudgetsMinutes.gdbDraftAndPost.defaultPreset,
  },
  {
    id: "quiz",
    title: "Quiz",
    blurb: "Revise linked handout lessons, then attempt the timed MCQ while the To-Do Calendar window is open.",
    minutesHint: patterns.timeBudgetsMinutes.quizPrepAndAttempt.defaultPreset,
  },
  {
    id: "revise",
    title: "2-minute recall",
    blurb: "After each Focus block: close notes and self-test one question (active recall).",
    minutesHint: 2,
  },
];

export function normalizeVuTerm(raw: string): string {
  const t = raw.trim();
  const aliases = patterns.terminology.aliases as Record<string, string>;
  for (const [from, to] of Object.entries(aliases)) {
    if (t.toLowerCase() === from.toLowerCase()) return to;
  }
  if (/gddb/i.test(t)) return t.replace(/gddb/gi, "GDB");
  return t;
}

export function rhythmLabelForBlockKind(
  kind: "lecture" | "recovery" | "cs101_catchup" | "handout" | "prep" | string,
  handoutFirst: boolean,
): string {
  if (kind === "lecture" || kind === "cs101_catchup") {
    return handoutFirst ? "Handouts → selective lecture" : "Lecture Schedule slot";
  }
  if (kind === "handout" || kind === "prep") return "Handout prep";
  if (kind === "recovery") return "To-Do Calendar · graded";
  return "Study block";
}

export const VU_DAILY_HABIT =
  "Daily: VULMS → Announcements → To-Do Calendar → each course · then Handouts / Lecture → Assignment · GDB · Quiz.";

export const VU_TIMER_PRESETS = patterns.dashboardUx.timerPresets as {
  id: string;
  minutes: number;
}[];

export const VU_FOCUS_MODES = patterns.dailyRhythm.focusModes as {
  name: string;
  workMinutes: number;
  breakMinutes: number;
}[];

export const VU_PUBLIC_CHANNELS = patterns.publicContentChannels as {
  name: string;
  url?: string;
  official?: boolean;
  private?: boolean;
  linkPolicy?: string;
}[];

export function youtubeSearchUrl(courseCode: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${courseCode} Virtual University of Pakistan lecture`,
  )}`;
}

export function ocwHomeUrl(): string {
  return "https://ocw.vu.edu.pk/";
}

export function vulmsHomeUrl(): string {
  return "https://vulms.vu.edu.pk/";
}

export function handbookUrl(): string {
  return "https://handbook.vu.edu.pk/";
}

export function lectureSchedulePublicUrl(): string {
  return "https://vu.edu.pk/studentservices/LectureSchedule";
}

export function bookshopUrl(): string {
  return "https://bookshop.vu.edu.pk/";
}

export function vutvUrl(): string {
  return "https://vu.edu.pk/vutv/";
}

export function vuHomeUrl(): string {
  return "https://www.vu.edu.pk/";
}

/** Curated official VU Quick Links — search CTAs only; never fabricate lesson video IDs. */
export type VuQuickLink = {
  id: string;
  label: string;
  href: string;
  blurb: string;
};

export function vuQuickLinks(courseCode?: string): VuQuickLink[] {
  const code = (courseCode || "").trim().toUpperCase();
  const links: VuQuickLink[] = [
    {
      id: "vulms",
      label: "VULMS",
      href: vulmsHomeUrl(),
      blurb: "Authoritative graded work · announcements · To-Do Calendar",
    },
    {
      id: "handbook",
      label: "VU Handbook",
      href: handbookUrl(),
      blurb: "Rules, Getting Started, Lectures how-to",
    },
    {
      id: "lecture-schedule",
      label: "Lecture Schedule",
      href: lectureSchedulePublicUrl(),
      blurb: "Public schedule tool · verify against your export",
    },
    {
      id: "ocw",
      label: "Open Courseware",
      href: ocwHomeUrl(),
      blurb: "Public notes — verify course code before deep links",
    },
    {
      id: "youtube",
      label: code ? `YouTube search · ${code}` : "YouTube VU",
      href: code ? youtubeSearchUrl(code) : "https://www.youtube.com/vu",
      blurb: code
        ? `Search only — no fabricated ${code} video IDs`
        : "Official channel · search by course code",
    },
    {
      id: "vutv",
      label: "VUTV",
      href: vutvUrl(),
      blurb: "Broadcast channels tied to Lecture Schedule",
    },
    {
      id: "bookshop",
      label: "Bookshop",
      href: bookshopUrl(),
      blurb: "DVD / print handout packs",
    },
    {
      id: "vu-home",
      label: "vu.edu.pk",
      href: vuHomeUrl(),
      blurb: "Admissions, news, student services",
    },
  ];
  return links;
}
