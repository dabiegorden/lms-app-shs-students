import { randomUUID } from "crypto";
import type { Section, Lesson } from "@/src/schema";

// ─── YouTube video ID extractor ───────────────────────────────────────────────
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // raw ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ─── Format seconds to "Xh Ym" ───────────────────────────────────────────────
export function formatDuration(seconds: number): string {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Slug generator (mirrors the old Mongoose pre-validate hook) ──────────────
export function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 100) +
    "-" +
    Date.now()
  );
}

// ─── Recompute denormalised curriculum totals (mirrors pre-save hook) ─────────
export function computeCourseTotals(sections: Section[]): {
  totalLessons: number;
  totalDurationSeconds: number;
} {
  let totalLessons = 0;
  let totalDurationSeconds = 0;
  for (const section of sections) {
    totalLessons += section.lessons.length;
    for (const lesson of section.lessons) {
      totalDurationSeconds += lesson.durationSeconds ?? 0;
    }
  }
  return { totalLessons, totalDurationSeconds };
}

// ─── Normalise an incoming sections payload into the stored Section[] shape ───
export function normalizeSections(parsedSections: any[]): Section[] {
  const now = new Date().toISOString();
  return parsedSections.map((sec: any, sIdx: number): Section => ({
    id: sec.id || randomUUID(),
    title: sec.title?.trim() ?? `Section ${sIdx + 1}`,
    description: sec.description?.trim() ?? "",
    order: sec.order ?? sIdx,
    isPublished: sec.isPublished !== false,
    lessons: (sec.lessons ?? []).map((les: any, lIdx: number): Lesson => {
      const youtubeUrl = les.youtubeUrl?.trim() ?? "";
      const youtubeVideoId =
        les.youtubeVideoId?.trim() ||
        (youtubeUrl ? (extractYouTubeId(youtubeUrl) ?? "") : "");
      return {
        id: les.id || randomUUID(),
        title: les.title?.trim() ?? `Lesson ${lIdx + 1}`,
        description: les.description?.trim() ?? "",
        youtubeUrl,
        youtubeVideoId,
        durationSeconds: Number(les.durationSeconds) || 0,
        order: les.order ?? lIdx,
        isFree: Boolean(les.isFree),
        isPublished: les.isPublished !== false,
        createdAt: les.createdAt || now,
        updatedAt: now,
      };
    }),
  }));
}
