"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type CourseLevel = "Beginner" | "Intermediate" | "Advanced" | "All Levels";

interface Lesson {
  _id?: string;
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  durationSeconds: number;
  order: number;
  isFree: boolean;
  isPublished: boolean;
}

interface Section {
  _id?: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
  isPublished: boolean;
}

interface Course {
  _id: string;
  title: string;
  slug: string;
  description: string;
  overview: string;
  subject: string;
  topic: string;
  classLevel: string;
  language: string;
  level: CourseLevel;
  status: string;
  certificateEnabled: boolean;
  thumbnailUrl: string | null;
  previewVideoUrl: string | null;
  previewVideoId: string | null;
  whatYouWillLearn: string[];
  requirements: string[];
  targetAudience: string[];
  sections?: Section[];
  totalLessons: number;
  totalDurationSeconds: number;
  enrollmentsCount: number;
  ratingsAverage: number;
  ratingsCount: number;
  views: number;
  createdAt: string;
  updatedAt: string;
}

interface LessonProgress {
  lessonId: string;
  sectionId: string;
  completedAt: Date | null;
  watchedSeconds: number;
  isCompleted: boolean;
}

interface Enrollment {
  _id: string;
  course: string;
  student: string;
  lessonProgress: LessonProgress[];
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  lastAccessedAt: Date | null;
  lastLessonId: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
  certificateIssuedAt: Date | null;
  certificateId: string | null;
  rating: number | null;
  review: string;
  reviewedAt: Date | null;
  enrolledAt: Date;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBJECTS = [
  "Mathematics",
  "English Language",
  "Integrated Science",
  "Social Studies",
  "ICT",
  "Elective Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
  "Government",
  "History",
  "Geography",
  "Literature",
  "French",
  "Visual Arts",
  "Business Management",
];
const CLASS_LEVELS = ["All", "SHS 1", "SHS 2", "SHS 3"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg
      className={`animate-spin shrink-0 ${sm ? "w-3.5 h-3.5" : "w-5 h-5"}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ─── YouTube Thumbnail ────────────────────────────────────────────────────────
function YTThumb({
  videoId,
  className = "",
}: {
  videoId: string;
  className?: string;
}) {
  return (
    <img
      src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
      alt="video thumbnail"
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────
function ProgressRing({
  percent,
  size = 40,
  stroke = 3,
}: {
  percent: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={percent === 100 ? "#f59e0b" : "#0ea5e9"}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ type }: { type: "browse" | "enrolled" | "filtered" }) {
  const cfg = {
    browse: {
      icon: "🎬",
      title: "No courses available",
      sub: "Check back soon for new courses.",
    },
    enrolled: {
      icon: "📚",
      title: "No enrollments yet",
      sub: "Explore courses below and start learning today.",
    },
    filtered: {
      icon: "🔍",
      title: "No courses match your filters",
      sub: "Try adjusting your search or filters.",
    },
  };
  const c = cfg[type];
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center text-3xl mb-4">
        {c.icon}
      </div>
      <h3 className="font-black text-slate-800 text-base mb-1">{c.title}</h3>
      <p className="text-slate-500 text-sm max-w-xs">{c.sub}</p>
    </div>
  );
}

// ─── Enroll Confirm Modal ─────────────────────────────────────────────────────
function EnrollModal({
  course,
  onClose,
  onEnrolled,
}: {
  course: Course;
  onClose: () => void;
  onEnrolled: (enrollment: Enrollment) => void;
}) {
  const [enrolling, setEnrolling] = useState(false);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/student/courses/${course._id}/enroll`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Enrolled successfully! Start learning 🎉");
      onEnrolled(data.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to enroll.");
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center text-2xl shrink-0">
            🎓
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">
              Enroll in Course
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Free · Instant access
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex gap-3 items-start">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-16 h-12 rounded-xl object-cover shrink-0"
            />
          ) : course.previewVideoId ? (
            <div className="w-16 h-12 rounded-xl overflow-hidden shrink-0">
              <YTThumb
                videoId={course.previewVideoId}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-12 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 text-xl">
              🎬
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
              {course.title}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {course.subject} · {course.totalLessons} lessons ·{" "}
              {formatDuration(course.totalDurationSeconds)}
            </p>
          </div>
        </div>

        {course.whatYouWillLearn?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              What you'll learn
            </p>
            <ul className="flex flex-col gap-1.5">
              {course.whatYouWillLearn.slice(0, 4).map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {course.certificateEnabled && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
            <span className="text-lg">🏆</span>
            <p className="text-xs font-semibold text-amber-800">
              Free certificate upon course completion
            </p>
          </div>
        )}

        <div className="flex gap-3 mt-1">
          <button
            onClick={onClose}
            disabled={enrolling}
            className="flex-1 text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 py-3 rounded-xl transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 disabled:opacity-50 py-3 rounded-xl transition-all shadow-md"
          >
            {enrolling ? (
              <>
                <Spinner sm />
                Enrolling…
              </>
            ) : (
              "🎓 Enroll Free"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rating Modal ─────────────────────────────────────────────────────────────
function RatingModal({
  course,
  enrollment,
  onClose,
  onRated,
}: {
  course: Course;
  enrollment: Enrollment;
  onClose: () => void;
  onRated: (e: Enrollment) => void;
}) {
  const [rating, setRating] = useState(enrollment.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [review, setReview] = useState(enrollment.review ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!rating) {
      toast.error("Please select a rating.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/student/courses/${course._id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Rating submitted! Thank you 🌟");
      onRated(data.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit rating.");
    } finally {
      setSaving(false);
    }
  };

  const labels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl shrink-0">
            ⭐
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">
              Rate this Course
            </h3>
            <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">
              {course.title}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="text-3xl transition-transform hover:scale-110"
              >
                <span
                  className={
                    (hovered || rating) >= star
                      ? "text-amber-400"
                      : "text-slate-200"
                  }
                >
                  ★
                </span>
              </button>
            ))}
          </div>
          {(hovered || rating) > 0 && (
            <p className="text-sm font-bold text-amber-600">
              {labels[hovered || rating]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Write a Review{" "}
            <span className="font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Share your experience with other students…"
            rows={3}
            disabled={saving}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 py-3 rounded-xl transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !rating}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 py-3 rounded-xl transition-all shadow-md"
          >
            {saving ? (
              <>
                <Spinner sm />
                Saving…
              </>
            ) : (
              "⭐ Submit Rating"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Course Details Modal (before enroll) ────────────────────────────────────
function CourseDetailsModal({
  course,
  enrollment,
  onClose,
  onEnroll,
  onWatch,
}: {
  course: Course;
  enrollment: Enrollment | null;
  onClose: () => void;
  onEnroll: () => void;
  onWatch: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header / Thumbnail */}
        <div className="relative h-52 bg-linear-to-br from-sky-800 to-indigo-900 shrink-0">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover opacity-80"
            />
          ) : course.previewVideoId ? (
            <YTThumb
              videoId={course.previewVideoId}
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">
              🎬
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-black/40 hover:bg-black/60 text-white flex items-center justify-center font-bold transition-colors"
          >
            ✕
          </button>
          <div className="absolute bottom-4 left-5 right-16">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-bold bg-sky-500/80 text-white px-2.5 py-1 rounded-full">
                {course.subject}
              </span>
              <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">
                {course.classLevel}
              </span>
              <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">
                {course.level}
              </span>
            </div>
            <h2 className="font-black text-white text-lg leading-snug">
              {course.title}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Stats row */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="flex items-center gap-1 text-slate-600">
              📚{" "}
              <span className="font-bold text-slate-800">
                {course.totalLessons}
              </span>{" "}
              lessons
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              ⏱{" "}
              <span className="font-bold text-slate-800">
                {formatDuration(course.totalDurationSeconds)}
              </span>
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              👥{" "}
              <span className="font-bold text-slate-800">
                {course.enrollmentsCount}
              </span>{" "}
              enrolled
            </span>
            {course.ratingsCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-amber-400">★</span>
                <span className="font-bold text-slate-800">
                  {course.ratingsAverage.toFixed(1)}
                </span>
                <span className="text-slate-500">({course.ratingsCount})</span>
              </span>
            )}
            {course.certificateEnabled && (
              <span className="flex items-center gap-1 text-amber-600 font-bold text-xs">
                🏆 Certificate
              </span>
            )}
          </div>

          {/* Progress bar if enrolled */}
          {enrollment && (
            <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3.5 flex items-center gap-4">
              <ProgressRing
                percent={enrollment.progressPercent}
                size={48}
                stroke={4}
              />
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">
                  {enrollment.isCompleted
                    ? "🏆 Course Completed!"
                    : `${enrollment.progressPercent}% Complete`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {enrollment.completedLessons} of {enrollment.totalLessons}{" "}
                  lessons done
                </p>
              </div>
              {enrollment.isCompleted && enrollment.certificateId && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                  Certificate earned
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {course.description && (
            <p className="text-sm text-slate-600 leading-relaxed">
              {course.description}
            </p>
          )}

          {/* Overview */}
          {course.overview && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Course Overview
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {course.overview}
              </p>
            </div>
          )}

          {/* What you'll learn */}
          {course.whatYouWillLearn?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                What You'll Learn
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {course.whatYouWillLearn.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requirements */}
          {course.requirements?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Requirements
              </p>
              <ul className="flex flex-col gap-1.5">
                {course.requirements.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-600"
                  >
                    <span className="text-slate-400 mt-0.5 shrink-0">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Curriculum preview */}
          {course.sections && course.sections.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Curriculum — {course.sections.length} sections
              </p>
              <div className="flex flex-col gap-2">
                {course.sections.map((sec, si) => (
                  <div
                    key={si}
                    className="border border-slate-100 rounded-xl overflow-hidden"
                  >
                    <div className="bg-slate-50 px-3 py-2.5 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-700">
                        {sec.title || `Section ${si + 1}`}
                      </p>
                      <span className="text-xs text-slate-400">
                        {sec.lessons.length} lessons
                      </span>
                    </div>
                    {sec.lessons.slice(0, 3).map((les, li) => (
                      <div
                        key={li}
                        className="flex items-center gap-2.5 px-3 py-2 border-t border-slate-50"
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${les.isFree ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                        >
                          {les.isFree ? "▶" : "🔒"}
                        </div>
                        <p className="text-xs text-slate-600 flex-1 truncate">
                          {les.title || `Lesson ${li + 1}`}
                        </p>
                        {les.durationSeconds > 0 && (
                          <span className="text-xs text-slate-400 shrink-0">
                            {formatDuration(les.durationSeconds)}
                          </span>
                        )}
                      </div>
                    ))}
                    {sec.lessons.length > 3 && (
                      <div className="px-3 py-2 border-t border-slate-50 text-xs text-slate-400 italic">
                        +{sec.lessons.length - 3} more lessons
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 px-5 py-2.5 rounded-xl transition-all"
          >
            Close
          </button>
          {enrollment ? (
            <button
              onClick={onWatch}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 py-2.5 rounded-xl shadow-md transition-all"
            >
              ▶{" "}
              {enrollment.progressPercent > 0
                ? "Continue Learning"
                : "Start Learning"}
            </button>
          ) : (
            <button
              onClick={onEnroll}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 py-2.5 rounded-xl shadow-md transition-all"
            >
              🎓 Enroll Free
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Course Player ────────────────────────────────────────────────────────────
function CoursePlayer({
  course,
  enrollment,
  onClose,
  onProgressUpdate,
}: {
  course: Course;
  enrollment: Enrollment;
  onClose: () => void;
  onProgressUpdate: (e: Enrollment) => void;
}) {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    new Set(),
  );
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);

  // Build flat lesson list
  const allLessons: {
    lesson: Lesson;
    sectionIdx: number;
    lessonIdx: number;
  }[] = [];
  (course.sections ?? []).forEach((sec, si) => {
    sec.lessons.forEach((les, li) =>
      allLessons.push({ lesson: les, sectionIdx: si, lessonIdx: li }),
    );
  });

  const currentIdx = allLessons.findIndex(
    (x) =>
      x.lesson.youtubeVideoId === activeLesson?.youtubeVideoId &&
      x.lesson.title === activeLesson?.title,
  );
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson =
    currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  // Initialise active lesson from last watched or first available
  useEffect(() => {
    const sections = course.sections ?? [];
    // Try resume from lastLessonId
    if (enrollment.lastLessonId) {
      for (let si = 0; si < sections.length; si++) {
        const li = sections[si].lessons.findIndex(
          (l) => l._id === enrollment.lastLessonId,
        );
        if (li !== -1) {
          setActiveLesson(sections[si].lessons[li]);
          setActiveSectionIdx(si);
          return;
        }
      }
    }
    // Otherwise first lesson
    for (let si = 0; si < sections.length; si++) {
      if (sections[si].lessons.length > 0) {
        setActiveLesson(sections[si].lessons[0]);
        setActiveSectionIdx(si);
        return;
      }
    }
  }, [course, enrollment.lastLessonId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isLessonCompleted = (lessonId?: string) => {
    if (!lessonId) return false;
    return enrollment.lessonProgress?.some(
      (lp) => lp.lessonId === lessonId && lp.isCompleted,
    );
  };

  const goTo = (entry: { lesson: Lesson; sectionIdx: number }) => {
    setActiveLesson(entry.lesson);
    setActiveSectionIdx(entry.sectionIdx);
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.delete(entry.sectionIdx);
      return next;
    });
    setCurriculumOpen(false);
  };

  const toggleSection = (idx: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const markLessonComplete = async () => {
    if (!activeLesson?._id) return;
    setMarkingComplete(true);
    try {
      const res = await fetch(`/api/student/courses/${course._id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: activeLesson._id, isCompleted: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onProgressUpdate(data.data);
      toast.success(
        data.data.isCompleted
          ? "🏆 Course completed! Certificate earned!"
          : "✓ Lesson marked as complete",
      );
      // Auto-advance
      if (nextLesson) goTo(nextLesson);
    } catch (err: any) {
      toast.error(err.message || "Failed to update progress.");
    } finally {
      setMarkingComplete(false);
    }
  };

  const totalLessons = allLessons.length;
  const totalDuration = (course.sections ?? []).reduce(
    (sum, sec) =>
      sum + sec.lessons.reduce((s, l) => s + (l.durationSeconds || 0), 0),
    0,
  );

  // ── Shared curriculum panel ──────────────────────────────────────────────
  const CurriculumPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-800 shrink-0 flex items-center justify-between">
        <div>
          <h3 className="font-black text-white text-sm">Course Curriculum</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} ·{" "}
            {formatDuration(totalDuration)}
          </p>
        </div>
        <button
          onClick={() => setCurriculumOpen(false)}
          className="md:hidden w-7 h-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-400">
            Your Progress
          </span>
          <span
            className={`text-xs font-black ${enrollment.isCompleted ? "text-amber-400" : "text-sky-400"}`}
          >
            {enrollment.progressPercent}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${enrollment.isCompleted ? "bg-amber-400" : "bg-sky-500"}`}
            style={{ width: `${enrollment.progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {enrollment.completedLessons}/{enrollment.totalLessons} completed
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {(course.sections ?? []).map((section, sIdx) => {
          const isCollapsed = collapsedSections.has(sIdx);
          const isActiveSection = sIdx === activeSectionIdx;
          const secDuration = section.lessons.reduce(
            (s, l) => s + (l.durationSeconds || 0),
            0,
          );

          return (
            <div key={sIdx} className="border-b border-slate-800">
              <button
                type="button"
                onClick={() => toggleSection(sIdx)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-800/50 ${isActiveSection ? "bg-slate-800/30" : ""}`}
              >
                <span
                  className={`text-xs font-black shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${isActiveSection ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-400"}`}
                >
                  {sIdx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-bold truncate ${isActiveSection ? "text-sky-400" : "text-slate-200"}`}
                  >
                    {section.title || `Section ${sIdx + 1}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {section.lessons.length} lesson
                    {section.lessons.length !== 1 ? "s" : ""}
                    {secDuration > 0 && ` · ${formatDuration(secDuration)}`}
                  </p>
                </div>
                <span className="text-slate-500 text-xs shrink-0">
                  {isCollapsed ? "▶" : "▼"}
                </span>
              </button>

              {!isCollapsed && (
                <div className="bg-slate-950/40">
                  {section.lessons.map((lesson, lIdx) => {
                    const isActive =
                      activeLesson?.title === lesson.title &&
                      activeLesson?.youtubeVideoId === lesson.youtubeVideoId;
                    const hasVideo = !!lesson.youtubeVideoId;
                    const completed = isLessonCompleted(lesson._id);

                    return (
                      <button
                        key={lIdx}
                        type="button"
                        onClick={() =>
                          hasVideo && goTo({ lesson, sectionIdx: sIdx })
                        }
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-t border-slate-800/50 ${isActive ? "bg-sky-900/30 border-l-2 border-l-sky-500" : hasVideo ? "hover:bg-slate-800/40 cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isActive ? "bg-sky-600 text-white" : completed ? "bg-emerald-600 text-white" : hasVideo ? "bg-slate-700 text-slate-300" : "bg-slate-800 text-slate-600"}`}
                        >
                          {isActive ? (
                            <span className="text-xs">▶</span>
                          ) : completed ? (
                            <span className="text-xs">✓</span>
                          ) : (
                            <span className="text-xs font-bold">
                              {lIdx + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-semibold leading-snug ${isActive ? "text-sky-300" : completed ? "text-emerald-400" : "text-slate-300"}`}
                          >
                            {lesson.title || `Lesson ${lIdx + 1}`}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {lesson.durationSeconds > 0 && (
                              <span className="text-xs text-slate-500">
                                {formatDuration(lesson.durationSeconds)}
                              </span>
                            )}
                            {lesson.isFree && (
                              <span className="text-xs font-bold text-emerald-500">
                                Free
                              </span>
                            )}
                          </div>
                        </div>
                        {lesson.youtubeVideoId && !isActive && (
                          <div className="w-12 h-8 rounded-lg overflow-hidden shrink-0 opacity-60">
                            <YTThumb
                              videoId={lesson.youtubeVideoId}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 md:px-4 md:py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold transition-colors text-sm shrink-0"
        >
          ✕
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-xs md:text-sm truncate">
            {course.title}
          </p>
          {activeLesson && (
            <p className="text-slate-400 text-xs truncate hidden sm:block">
              {activeLesson.title}
              {activeLesson.durationSeconds > 0 && (
                <span className="ml-2">
                  · {formatDuration(activeLesson.durationSeconds)}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Progress in top bar */}
          <div className="hidden sm:flex items-center gap-2">
            <ProgressRing
              percent={enrollment.progressPercent}
              size={28}
              stroke={2.5}
            />
            <span className="text-xs font-bold text-slate-300">
              {enrollment.progressPercent}%
            </span>
          </div>
          <button
            onClick={() => setCurriculumOpen((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-colors"
          >
            <span>📋</span>
            <span className="hidden sm:inline">Curriculum</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Main pane */}
        <div className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden bg-black">
          {/* Video */}
          <div
            className="relative w-full bg-black shrink-0"
            style={{ paddingBottom: "56.25%" }}
          >
            {activeLesson?.youtubeVideoId ? (
              <iframe
                key={activeLesson.youtubeVideoId}
                src={`https://www.youtube.com/embed/${activeLesson.youtubeVideoId}?autoplay=1&rel=0&modestbranding=1`}
                title={activeLesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900">
                {course.previewVideoId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${course.previewVideoId}?rel=0&modestbranding=1`}
                    title="Course preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full border-0"
                  />
                ) : (
                  <>
                    <span className="text-5xl opacity-30">🎬</span>
                    <p className="text-slate-400 text-sm font-medium text-center px-4">
                      {totalLessons === 0
                        ? "No lessons in this course yet"
                        : "Select a lesson to start watching"}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Lesson info */}
          <div className="bg-slate-950 px-4 py-4 md:px-6 md:py-5 flex flex-col gap-4 md:flex-1 md:overflow-y-auto">
            {activeLesson ? (
              <>
                {/* Navigation */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => prevLesson && goTo(prevLesson)}
                    disabled={!prevLesson}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all"
                  >
                    ← Prev
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-slate-500 font-medium">
                      Lesson {currentIdx + 1} of {totalLessons}
                    </span>
                  </div>
                  <button
                    onClick={() => nextLesson && goTo(nextLesson)}
                    disabled={!nextLesson}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all"
                  >
                    Next →
                  </button>
                </div>

                {/* Title + meta */}
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-white font-black text-base md:text-lg leading-snug">
                      {activeLesson.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {activeLesson.durationSeconds > 0 && (
                        <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full font-medium">
                          ⏱ {formatDuration(activeLesson.durationSeconds)}
                        </span>
                      )}
                      {course.sections?.[activeSectionIdx]?.title && (
                        <span className="text-xs text-slate-500">
                          Section:{" "}
                          <span className="text-slate-300 font-medium">
                            {course.sections[activeSectionIdx].title}
                          </span>
                        </span>
                      )}
                      {isLessonCompleted(activeLesson._id) && (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-700/40 px-2.5 py-1 rounded-full">
                          ✓ Completed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mark complete button */}
                  {activeLesson._id && !isLessonCompleted(activeLesson._id) && (
                    <button
                      onClick={markLessonComplete}
                      disabled={markingComplete}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/40 px-3 py-2 rounded-xl transition-all disabled:opacity-50 shrink-0"
                    >
                      {markingComplete ? <Spinner sm /> : "✓"} Mark Done
                    </button>
                  )}
                </div>

                {/* Completion celebration */}
                {enrollment.isCompleted && (
                  <div className="bg-amber-900/30 border border-amber-700/40 rounded-2xl px-4 py-4 flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <p className="font-black text-amber-300 text-sm">
                        Course Completed!
                      </p>
                      <p className="text-xs text-amber-500 mt-0.5">
                        {enrollment.certificateId
                          ? `Certificate ID: ${enrollment.certificateId}`
                          : "Your certificate is being prepared."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Description */}
                {activeLesson.description && (
                  <div className="bg-slate-900 rounded-2xl px-4 py-4 border border-slate-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      About this lesson
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {activeLesson.description}
                    </p>
                  </div>
                )}

                {activeLesson.youtubeVideoId && (
                  <a
                    href={`https://youtube.com/watch?v=${activeLesson.youtubeVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors w-fit"
                  >
                    <span>▶</span> Open on YouTube
                  </a>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-3 opacity-30">📚</span>
                <p className="text-slate-400 text-sm">
                  Select a lesson from the curriculum to begin
                </p>
              </div>
            )}

            {/* Mobile inline curriculum */}
            <div className="md:hidden mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-white text-sm">
                  Course Curriculum
                </h3>
                <span className="text-xs text-slate-400">
                  {totalLessons} lessons · {formatDuration(totalDuration)}
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${enrollment.isCompleted ? "bg-amber-400" : "bg-sky-500"}`}
                  style={{ width: `${enrollment.progressPercent}%` }}
                />
              </div>
              <div className="flex flex-col gap-2">
                {(course.sections ?? []).map((section, sIdx) => {
                  const isCollapsed = collapsedSections.has(sIdx);
                  const isActiveSection = sIdx === activeSectionIdx;
                  return (
                    <div
                      key={sIdx}
                      className="rounded-2xl overflow-hidden border border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(sIdx)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isActiveSection ? "bg-slate-800" : "bg-slate-900 hover:bg-slate-800/60"}`}
                      >
                        <span
                          className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isActiveSection ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-400"}`}
                        >
                          {sIdx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-bold truncate ${isActiveSection ? "text-sky-400" : "text-slate-200"}`}
                          >
                            {section.title || `Section ${sIdx + 1}`}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {section.lessons.length} lesson
                            {section.lessons.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="text-slate-500 text-xs shrink-0">
                          {isCollapsed ? "▶" : "▼"}
                        </span>
                      </button>
                      {!isCollapsed && (
                        <div className="bg-slate-950">
                          {section.lessons.map((lesson, lIdx) => {
                            const isActive =
                              activeLesson?.title === lesson.title &&
                              activeLesson?.youtubeVideoId ===
                                lesson.youtubeVideoId;
                            const hasVideo = !!lesson.youtubeVideoId;
                            const completed = isLessonCompleted(lesson._id);
                            return (
                              <button
                                key={lIdx}
                                type="button"
                                onClick={() =>
                                  hasVideo && goTo({ lesson, sectionIdx: sIdx })
                                }
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-t border-slate-800/60 ${isActive ? "bg-sky-900/30 border-l-4 border-l-sky-500" : hasVideo ? "hover:bg-slate-800/50" : "opacity-40 cursor-not-allowed"}`}
                              >
                                {lesson.youtubeVideoId ? (
                                  <div
                                    className={`w-16 h-10 rounded-lg overflow-hidden shrink-0 ${isActive ? "ring-2 ring-sky-500" : "opacity-80"}`}
                                  >
                                    <YTThumb
                                      videoId={lesson.youtubeVideoId}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-16 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                    <span className="text-slate-600 text-xs">
                                      ▶
                                    </span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-xs font-semibold leading-snug truncate ${isActive ? "text-sky-300" : completed ? "text-emerald-400" : "text-slate-300"}`}
                                  >
                                    {lesson.title || `Lesson ${lIdx + 1}`}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {lesson.durationSeconds > 0 && (
                                      <span className="text-xs text-slate-500">
                                        {formatDuration(lesson.durationSeconds)}
                                      </span>
                                    )}
                                    {completed && (
                                      <span className="text-xs font-bold text-emerald-500">
                                        ✓ Done
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isActive && (
                                  <span className="text-sky-400 text-xs font-bold shrink-0">
                                    ▶
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div
          className={`hidden md:flex flex-col w-80 shrink-0 bg-slate-900 border-l border-slate-800 transition-all duration-300 overflow-hidden ${curriculumOpen ? "md:w-80" : "md:w-0 md:border-0"}`}
        >
          {curriculumOpen && <CurriculumPanel />}
        </div>

        {/* Mobile overlay */}
        {curriculumOpen && (
          <div className="md:hidden fixed inset-0 z-10 flex flex-col bg-slate-900">
            <CurriculumPanel />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Enrolled Course Card ─────────────────────────────────────────────────────
function EnrolledCourseCard({
  course,
  enrollment,
  onWatch,
  onDetails,
  onRate,
}: {
  course: Course;
  enrollment: Enrollment;
  onWatch: () => void;
  onDetails: () => void;
  onRate: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div
        className="relative h-36 bg-linear-to-br from-sky-100 to-indigo-100 shrink-0 cursor-pointer"
        onClick={onDetails}
      >
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : course.previewVideoId ? (
          <YTThumb
            videoId={course.previewVideoId}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">
            🎬
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-3xl">▶</span>
        </div>
        {enrollment.isCompleted && (
          <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
            🏆 Done
          </div>
        )}
        {/* Progress overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
          <div
            className={`h-full transition-all ${enrollment.isCompleted ? "bg-amber-400" : "bg-sky-400"}`}
            style={{ width: `${enrollment.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="p-3.5 flex flex-col gap-2.5 flex-1">
        <div onClick={onDetails} className="cursor-pointer">
          <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 hover:text-sky-700 transition-colors">
            {course.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {course.subject} · {course.classLevel}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2.5">
          <ProgressRing
            percent={enrollment.progressPercent}
            size={32}
            stroke={3}
          />
          <div>
            <p className="text-xs font-bold text-slate-700">
              {enrollment.progressPercent}% complete
            </p>
            <p className="text-xs text-slate-400">
              {enrollment.completedLessons}/{enrollment.totalLessons} lessons
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-1 border-t border-slate-50">
          <button
            onClick={onWatch}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-white bg-linear-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 py-2 rounded-xl transition-all shadow-sm"
          >
            ▶{" "}
            {enrollment.progressPercent > 0 && enrollment.progressPercent < 100
              ? "Continue"
              : enrollment.isCompleted
                ? "Rewatch"
                : "Start"}
          </button>
          {enrollment.isCompleted && !enrollment.rating && (
            <button
              onClick={onRate}
              className="flex items-center justify-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-xl transition-colors"
            >
              ⭐ Rate
            </button>
          )}
          {enrollment.rating && (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-500 px-2">
              {"★".repeat(enrollment.rating)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Browse Course Card ───────────────────────────────────────────────────────
function BrowseCourseCard({
  course,
  enrollment,
  onDetails,
  onEnroll,
  onWatch,
}: {
  course: Course;
  enrollment: Enrollment | null;
  onDetails: () => void;
  onEnroll: () => void;
  onWatch: () => void;
}) {
  const levelColors: Record<string, string> = {
    Beginner: "bg-emerald-100 text-emerald-700",
    Intermediate: "bg-sky-100 text-sky-700",
    Advanced: "bg-violet-100 text-violet-700",
    "All Levels": "bg-slate-100 text-slate-600",
  };
  const classColors: Record<string, string> = {
    "SHS 1": "bg-blue-100 text-blue-700",
    "SHS 2": "bg-indigo-100 text-indigo-700",
    "SHS 3": "bg-violet-100 text-violet-700",
    All: "bg-green-100 text-green-700",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col">
      <div
        className="relative h-40 bg-linear-to-br from-sky-100 to-indigo-100 shrink-0 cursor-pointer"
        onClick={onDetails}
      >
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : course.previewVideoId ? (
          <YTThumb
            videoId={course.previewVideoId}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">
            🎬
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-3xl">▶</span>
        </div>
        {enrollment && (
          <div className="absolute top-2 left-2 bg-sky-600 text-white text-xs font-black px-2.5 py-1 rounded-full">
            Enrolled
          </div>
        )}
        {course.totalDurationSeconds > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
            {formatDuration(course.totalDurationSeconds)}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div onClick={onDetails} className="cursor-pointer">
          <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 hover:text-sky-700 transition-colors">
            {course.title}
          </h3>
          {course.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {course.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
            {course.subject}
          </span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${classColors[course.classLevel] ?? "bg-slate-100 text-slate-600"}`}
          >
            {course.classLevel}
          </span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${levelColors[course.level]}`}
          >
            {course.level}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            📚{" "}
            <span className="font-semibold text-slate-700">
              {course.totalLessons}
            </span>
          </span>
          <span>
            👥{" "}
            <span className="font-semibold text-slate-700">
              {course.enrollmentsCount}
            </span>
          </span>
          {course.certificateEnabled && (
            <span className="text-amber-600 font-semibold">🏆</span>
          )}
          {course.ratingsCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-amber-400">★</span>
              <span className="font-bold text-slate-700">
                {course.ratingsAverage.toFixed(1)}
              </span>
            </span>
          )}
        </div>

        <div className="flex gap-2 mt-auto pt-2 border-t border-slate-50">
          {enrollment ? (
            <button
              onClick={onWatch}
              className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-white bg-linear-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 py-2 rounded-xl transition-all shadow-sm"
            >
              ▶ Continue
            </button>
          ) : (
            <button
              onClick={onEnroll}
              className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-white bg-linear-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 py-2 rounded-xl transition-all shadow-sm"
            >
              🎓 Enroll Free
            </button>
          )}
          <button
            onClick={onDetails}
            className="flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Info
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type ActiveTab = "my-courses" | "browse";

export default function StudentsVideoCoursePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("my-courses");

  // Browse state
  const [browseCourses, setBrowseCourses] = useState<Course[]>([]);
  const [browsePagination, setBrowsePagination] = useState<Pagination | null>(
    null,
  );
  const [browseLoading, setBrowseLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [browsePage, setBrowsePage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // My courses state
  const [submissions, setSubmissions] = useState<Enrollment[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Map<string, Course>>(
    new Map(),
  );
  const [myCoursesLoading, setMyCoursesLoading] = useState(true);

  // Modals
  const [detailsCourse, setDetailsCourse] = useState<Course | null>(null);
  const [enrollCourse, setEnrollCourse] = useState<Course | null>(null);
  const [watchData, setWatchData] = useState<{
    course: Course;
    enrollment: Enrollment;
  } | null>(null);
  const [rateCourse, setRateCourse] = useState<Course | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setBrowsePage(1);
  }, [debouncedSearch, filterSubject, filterClass]);

  // ── Fetch my enrollments ────────────────────────────────────────────────
  const fetchMyEnrollments = useCallback(async () => {
    setMyCoursesLoading(true);
    try {
      const res = await fetch("/api/student/my-submissions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const enrollments: Enrollment[] = data.data ?? [];
      setSubmissions(enrollments);

      // Fetch each enrolled course details
      const courseIds = [
        ...new Set(
          enrollments.map((e) => e.course?.toString?.() ?? String(e.course)),
        ),
      ].filter((id) => id && id !== "undefined" && /^[a-f\d]{24}$/i.test(id));
      const courseMap = new Map<string, Course>();
      await Promise.all(
        courseIds.map(async (id) => {
          try {
            const r2 = await fetch(`/api/student/courses/${id}`);
            const d = await r2.json();
            if (d.success) courseMap.set(id, d.data);
          } catch {}
        }),
      );
      setEnrolledCourses(courseMap);
    } catch (err: any) {
      toast.error(err.message || "Failed to load your courses.");
    } finally {
      setMyCoursesLoading(false);
    }
  }, []);

  // ── Fetch browse courses ────────────────────────────────────────────────
  const fetchBrowseCourses = useCallback(async () => {
    setBrowseLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(browsePage),
        limit: "12",
        status: "published",
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filterSubject && { subject: filterSubject }),
        ...(filterClass && { classLevel: filterClass }),
      });
      const res = await fetch(`/api/student/quizzes?${params}`);

      // Actually use the correct courses endpoint for students
      const res2 = await fetch(`/api/student/courses?${params}`);
      const data = await (res2.ok ? res2 : res).json();
      if (!data.success) throw new Error(data.message);
      setBrowseCourses(data.data);
      setBrowsePagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load courses.");
    } finally {
      setBrowseLoading(false);
    }
  }, [browsePage, debouncedSearch, filterSubject, filterClass]);

  useEffect(() => {
    fetchMyEnrollments();
  }, [fetchMyEnrollments]);
  useEffect(() => {
    fetchBrowseCourses();
  }, [fetchBrowseCourses]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const getEnrollmentForCourse = (courseId: string) =>
    submissions.find((e) => e.course === courseId) ?? null;

  const handleEnrolled = (enrollment: Enrollment) => {
    setSubmissions((prev) => [enrollment, ...prev]);
    if (detailsCourse) {
      setEnrolledCourses((prev) =>
        new Map(prev).set(detailsCourse._id, detailsCourse),
      );
    }
    setEnrollCourse(null);
    // Auto open player
    if (enrollCourse) {
      const fullCourse = detailsCourse ?? enrollCourse;
      if (fullCourse.sections) {
        setWatchData({ course: fullCourse, enrollment });
      } else {
        fetch(`/api/student/courses/${fullCourse._id}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.success) setWatchData({ course: d.data, enrollment });
          });
      }
    }
  };

  const handleProgressUpdate = (updated: Enrollment) => {
    setSubmissions((prev) =>
      prev.map((e) => (e._id === updated._id ? updated : e)),
    );
    if (watchData)
      setWatchData((prev) => (prev ? { ...prev, enrollment: updated } : null));
  };

  const handleRated = (updated: Enrollment) => {
    setSubmissions((prev) =>
      prev.map((e) => (e._id === updated._id ? updated : e)),
    );
    setRateCourse(null);
  };

  const handleWatchClick = async (course: Course, enrollment: Enrollment) => {
    if (course.sections) {
      setWatchData({ course, enrollment });
      return;
    }
    try {
      const res = await fetch(`/api/student/courses/${course._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setWatchData({ course: data.data, enrollment });
    } catch (err: any) {
      toast.error(err.message || "Failed to load course.");
    }
  };

  const handleDetailsClick = async (course: Course) => {
    if (course.sections) {
      setDetailsCourse(course);
      return;
    }
    try {
      const res = await fetch(`/api/student/courses/${course._id}`);
      const data = await res.json();
      if (data.success) setDetailsCourse(data.data);
      else setDetailsCourse(course);
    } catch {
      setDetailsCourse(course);
    }
  };

  const isFiltered = !!(debouncedSearch || filterSubject || filterClass);

  // Enrolled courses list (with course data)
  const myCoursePairs = submissions
    .map((e) => ({ enrollment: e, course: enrolledCourses.get(e.course) }))
    .filter((p): p is { enrollment: Enrollment; course: Course } => !!p.course);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-xl shadow-sm">
            🎓
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Video Courses
            </h1>
            <p className="text-slate-500 text-sm">
              {submissions.length > 0
                ? `${submissions.length} course${submissions.length !== 1 ? "s" : ""} enrolled`
                : "Learn from video lessons at your own pace"}
            </p>
          </div>
        </div>

        {/* Stats badges */}
        {submissions.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
              <span className="text-sky-600 font-black text-sm">
                {submissions.length}
              </span>
              <span className="text-xs text-sky-600 font-medium">Enrolled</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <span className="text-amber-600 font-black text-sm">
                {submissions.filter((e) => e.isCompleted).length}
              </span>
              <span className="text-xs text-amber-600 font-medium">
                Completed
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-0">
        {[
          {
            id: "my-courses" as ActiveTab,
            label: "My Courses",
            icon: "📚",
            count: submissions.length,
          },
          {
            id: "browse" as ActiveTab,
            label: "Browse Courses",
            icon: "🔍",
            count: null,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === tab.id ? "border-sky-600 text-sky-700 bg-sky-50/50" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"}`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span
                className={`text-xs font-black px-2 py-0.5 rounded-full ${activeTab === tab.id ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-600"}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── MY COURSES TAB ─────────────────────────────────────────────────── */}
      {activeTab === "my-courses" && (
        <>
          {myCoursesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-100 h-64 animate-pulse"
                />
              ))}
            </div>
          ) : myCoursePairs.length === 0 ? (
            <div className="flex flex-col items-center gap-6">
              <EmptyState type="enrolled" />
              <button
                onClick={() => setActiveTab("browse")}
                className="flex items-center gap-2 text-sm font-bold text-white bg-linear-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 px-6 py-3 rounded-xl shadow-md transition-all"
              >
                🔍 Browse Courses
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {myCoursePairs.map(({ course, enrollment }) => (
                <EnrolledCourseCard
                  key={enrollment._id}
                  course={course}
                  enrollment={enrollment}
                  onWatch={() => handleWatchClick(course, enrollment)}
                  onDetails={() => handleDetailsClick(course)}
                  onRate={() => setRateCourse(course)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── BROWSE TAB ────────────────────────────────────────────────────── */}
      {activeTab === "browse" && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                🔍
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses…"
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white min-w-40"
            >
              <option value="">All Subjects</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white min-w-32"
            >
              <option value="">All Classes</option>
              {CLASS_LEVELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {isFiltered && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilterSubject("");
                  setFilterClass("");
                }}
                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Grid */}
          {browseLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-100 h-80 animate-pulse"
                />
              ))}
            </div>
          ) : browseCourses.length === 0 ? (
            <EmptyState type={isFiltered ? "filtered" : "browse"} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {browseCourses.map((course) => {
                const enrollment = getEnrollmentForCourse(course._id);
                return (
                  <BrowseCourseCard
                    key={course._id}
                    course={course}
                    enrollment={enrollment}
                    onDetails={() => handleDetailsClick(course)}
                    onEnroll={() => setEnrollCourse(course)}
                    onWatch={() =>
                      enrollment && handleWatchClick(course, enrollment)
                    }
                  />
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {browsePagination && browsePagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3.5">
              <p className="text-xs text-slate-500 font-medium">
                Showing{" "}
                <span className="font-bold text-slate-800">
                  {(browsePagination.page - 1) * browsePagination.limit + 1}–
                  {Math.min(
                    browsePagination.page * browsePagination.limit,
                    browsePagination.total,
                  )}
                </span>{" "}
                of{" "}
                <span className="font-bold text-slate-800">
                  {browsePagination.total}
                </span>{" "}
                courses
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBrowsePage((p) => p - 1)}
                  disabled={!browsePagination.hasPrevPage}
                  className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  ‹
                </button>
                {Array.from(
                  { length: browsePagination.totalPages },
                  (_, i) => i + 1,
                )
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === browsePagination.totalPages ||
                      Math.abs(p - browsePagination.page) <= 1,
                  )
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1)
                      acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span
                        key={`e-${i}`}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setBrowsePage(p as number)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${browsePagination.page === p ? "bg-linear-to-r from-sky-600 to-indigo-600 text-white shadow-md" : "border border-slate-200 text-slate-600 hover:bg-sky-50 hover:text-sky-700"}`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                <button
                  onClick={() => setBrowsePage((p) => p + 1)}
                  disabled={!browsePagination.hasNextPage}
                  className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Course Details */}
      {detailsCourse && !watchData && (
        <CourseDetailsModal
          course={detailsCourse}
          enrollment={getEnrollmentForCourse(detailsCourse._id)}
          onClose={() => setDetailsCourse(null)}
          onEnroll={() => {
            setEnrollCourse(detailsCourse);
            setDetailsCourse(null);
          }}
          onWatch={() => {
            const enrollment = getEnrollmentForCourse(detailsCourse._id);
            if (enrollment) handleWatchClick(detailsCourse, enrollment);
            setDetailsCourse(null);
          }}
        />
      )}

      {/* Enroll confirmation */}
      {enrollCourse && !watchData && (
        <EnrollModal
          course={enrollCourse}
          onClose={() => setEnrollCourse(null)}
          onEnrolled={handleEnrolled}
        />
      )}

      {/* Video Player */}
      {watchData && (
        <CoursePlayer
          course={watchData.course}
          enrollment={watchData.enrollment}
          onClose={() => setWatchData(null)}
          onProgressUpdate={handleProgressUpdate}
        />
      )}

      {/* Rating */}
      {rateCourse && (
        <RatingModal
          course={rateCourse}
          enrollment={getEnrollmentForCourse(rateCourse._id)!}
          onClose={() => setRateCourse(null)}
          onRated={handleRated}
        />
      )}
    </div>
  );
}
