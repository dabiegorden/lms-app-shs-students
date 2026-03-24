"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type CourseStatus = "draft" | "published" | "archived";
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
  status: CourseStatus;
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
const LEVELS: CourseLevel[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "All Levels",
];
const LANGUAGES = ["English", "French", "Twi", "Ga", "Hausa", "Ewe"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

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

function totalSectionDuration(section: Section) {
  return section.lessons.reduce((s, l) => s + (l.durationSeconds || 0), 0);
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg
      className={`animate-spin shrink-0 ${sm ? "w-3.5 h-3.5" : "w-4 h-4"}`}
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

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center text-3xl mb-4">
        {filtered ? "🔍" : "🎬"}
      </div>
      <h3 className="font-black text-slate-800 text-base mb-1">
        {filtered ? "No courses match your filters" : "No courses yet"}
      </h3>
      <p className="text-slate-500 text-sm max-w-xs">
        {filtered
          ? "Try adjusting your search."
          : "Create your first video course to get started."}
      </p>
    </div>
  );
}

// ─── Bullet List Editor ───────────────────────────────────────────────────────
function BulletListEditor({
  label,
  placeholder,
  items,
  onChange,
  disabled,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
}) {
  const add = () => onChange([...items, ""]);
  const update = (i: number, val: string) =>
    onChange(items.map((x, idx) => (idx === i ? val : x)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="text-xs font-bold text-sky-600 hover:text-sky-700 disabled:opacity-40"
        >
          + Add
        </button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-slate-400 text-xs shrink-0">✓</span>
          <input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 bg-white"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={disabled}
            className="text-slate-300 hover:text-red-500 font-bold text-sm transition-colors"
          >
            ✕
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-slate-400 italic pl-5">None added yet</p>
      )}
    </div>
  );
}

// ─── Lesson Editor Row ────────────────────────────────────────────────────────
type LessonRowProps = {
  lesson: Lesson;
  lessonIdx: number;
  sectionIdx: number;
  onUpdate: (patch: Partial<Lesson>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  totalLessons: number;
  disabled: boolean;
};

function LessonRow({
  lesson,
  lessonIdx,
  sectionIdx,
  onUpdate,
  onRemove,
  onMove,
  totalLessons,
  disabled,
}: LessonRowProps) {
  const [expanded, setExpanded] = useState(false);

  const videoId =
    lesson.youtubeVideoId || extractYouTubeId(lesson.youtubeUrl) || "";

  const handleUrlBlur = (url: string) => {
    const id = extractYouTubeId(url);
    if (id) {
      onUpdate({ youtubeUrl: url, youtubeVideoId: id });
    } else {
      onUpdate({ youtubeUrl: url, youtubeVideoId: "" });
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all ${expanded ? "border-sky-200 bg-sky-50/30" : "border-slate-100 bg-white"}`}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-slate-400 text-xs font-bold shrink-0 w-5">
          {lessonIdx + 1}.
        </span>

        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={disabled || lessonIdx === 0}
            className="text-slate-300 hover:text-slate-600 disabled:opacity-20 leading-none text-xs"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={disabled || lessonIdx === totalLessons - 1}
            className="text-slate-300 hover:text-slate-600 disabled:opacity-20 leading-none text-xs"
          >
            ▼
          </button>
        </div>

        {videoId ? (
          <div className="w-10 h-7 rounded-md overflow-hidden shrink-0 bg-slate-200">
            <YTThumb videoId={videoId} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-10 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
            <span className="text-xs text-slate-400">▶</span>
          </div>
        )}

        <input
          value={lesson.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Lesson title"
          disabled={disabled}
          className="flex-1 min-w-0 text-sm font-medium text-slate-800 placeholder-slate-400 bg-transparent border-none outline-none focus:bg-white focus:border focus:border-sky-300 focus:rounded-lg focus:px-2 transition-all disabled:opacity-60"
        />

        <div className="flex items-center gap-1.5 shrink-0">
          {lesson.durationSeconds > 0 && (
            <span className="text-xs text-slate-400">
              {formatDuration(lesson.durationSeconds)}
            </span>
          )}
          <button
            type="button"
            onClick={() => onUpdate({ isFree: !lesson.isFree })}
            disabled={disabled}
            className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-all ${lesson.isFree ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}
          >
            {lesson.isFree ? "Free" : "Locked"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            disabled={disabled}
            className="text-slate-400 hover:text-sky-600 text-xs font-bold px-1"
          >
            {expanded ? "▲" : "▼"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="text-slate-300 hover:text-red-500 font-bold text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-3 border-t border-sky-100 pt-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500">
              YouTube URL
            </label>
            <div className="flex gap-2 items-center">
              <input
                value={lesson.youtubeUrl}
                onChange={(e) => onUpdate({ youtubeUrl: e.target.value })}
                onBlur={(e) => handleUrlBlur(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={disabled}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 bg-white"
              />
              {videoId && (
                <a
                  href={`https://youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 whitespace-nowrap"
                >
                  ▶ Preview
                </a>
              )}
            </div>
            {videoId && (
              <p className="text-xs text-emerald-600 font-medium">
                ✓ Video ID: {videoId}
              </p>
            )}
            {lesson.youtubeUrl && !videoId && (
              <p className="text-xs text-amber-600">
                ⚠ Could not extract video ID from this URL
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">
                Duration (seconds)
              </label>
              <input
                type="number"
                min={0}
                value={lesson.durationSeconds || ""}
                onChange={(e) =>
                  onUpdate({ durationSeconds: parseInt(e.target.value) || 0 })
                }
                placeholder="e.g. 480 = 8 min"
                disabled={disabled}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 bg-white"
              />
              {lesson.durationSeconds > 0 && (
                <p className="text-xs text-slate-400">
                  = {formatDuration(lesson.durationSeconds)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500">
                Visibility
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onUpdate({ isPublished: !lesson.isPublished })}
                  disabled={disabled}
                  className={`flex-1 text-xs font-bold py-2 rounded-xl border transition-all ${lesson.isPublished ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-500"}`}
                >
                  {lesson.isPublished ? "Published" : "Hidden"}
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ isFree: !lesson.isFree })}
                  disabled={disabled}
                  className={`flex-1 text-xs font-bold py-2 rounded-xl border transition-all ${lesson.isFree ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}
                >
                  {lesson.isFree ? "Free Preview" : "Locked"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500">
              Lesson description (optional)
            </label>
            <textarea
              value={lesson.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Brief description of what this lesson covers…"
              rows={2}
              disabled={disabled}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 resize-none bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Curriculum Builder ───────────────────────────────────────────────────────
function CurriculumBuilder({
  sections,
  onChange,
  disabled,
}: {
  sections: Section[];
  onChange: (s: Section[]) => void;
  disabled: boolean;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    new Set(),
  );

  const toggleSection = (idx: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const addSection = () => {
    onChange([
      ...sections,
      {
        title: "",
        description: "",
        order: sections.length,
        lessons: [],
        isPublished: true,
      },
    ]);
  };

  const updateSection = (idx: number, patch: Partial<Section>) => {
    onChange(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSection = (idx: number) => {
    onChange(
      sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })),
    );
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= sections.length) return;
    const arr = [...sections];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr.map((s, i) => ({ ...s, order: i })));
  };

  const addLesson = (sIdx: number) => {
    const section = sections[sIdx];
    const newLesson: Lesson = {
      title: "",
      description: "",
      youtubeUrl: "",
      youtubeVideoId: "",
      durationSeconds: 0,
      order: section.lessons.length,
      isFree: false,
      isPublished: true,
    };
    updateSection(sIdx, { lessons: [...section.lessons, newLesson] });
  };

  const updateLesson = (sIdx: number, lIdx: number, patch: Partial<Lesson>) => {
    const section = sections[sIdx];
    updateSection(sIdx, {
      lessons: section.lessons.map((l, i) =>
        i === lIdx ? { ...l, ...patch } : l,
      ),
    });
  };

  const removeLesson = (sIdx: number, lIdx: number) => {
    const section = sections[sIdx];
    updateSection(sIdx, {
      lessons: section.lessons
        .filter((_, i) => i !== lIdx)
        .map((l, i) => ({ ...l, order: i })),
    });
  };

  const moveLesson = (sIdx: number, lIdx: number, dir: -1 | 1) => {
    const section = sections[sIdx];
    const next = lIdx + dir;
    if (next < 0 || next >= section.lessons.length) return;
    const arr = [...section.lessons];
    [arr[lIdx], arr[next]] = [arr[next], arr[lIdx]];
    updateSection(sIdx, { lessons: arr.map((l, i) => ({ ...l, order: i })) });
  };

  const totalLessons = sections.reduce((s, sec) => s + sec.lessons.length, 0);
  const totalDuration = sections.reduce(
    (s, sec) => s + totalSectionDuration(sec),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {sections.length > 0 && (
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
          <span className="font-bold text-slate-700">{sections.length}</span>{" "}
          sections
          <span className="text-slate-300">·</span>
          <span className="font-bold text-slate-700">{totalLessons}</span>{" "}
          lessons
          <span className="text-slate-300">·</span>
          <span className="font-bold text-slate-700">
            {formatDuration(totalDuration)}
          </span>{" "}
          total
        </div>
      )}

      {sections.map((section, sIdx) => {
        const isCollapsed = collapsedSections.has(sIdx);
        const secDuration = totalSectionDuration(section);

        return (
          <div
            key={sIdx}
            className="border-2 border-slate-100 rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-3">
              <span className="text-xs font-black text-slate-400 shrink-0">
                S{sIdx + 1}
              </span>

              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveSection(sIdx, -1)}
                  disabled={disabled || sIdx === 0}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs leading-none"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(sIdx, 1)}
                  disabled={disabled || sIdx === sections.length - 1}
                  className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs leading-none"
                >
                  ▼
                </button>
              </div>

              <input
                value={section.title}
                onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                placeholder={`Section ${sIdx + 1} title, e.g. Introduction`}
                disabled={disabled}
                className="flex-1 font-bold text-sm text-slate-800 placeholder-slate-400 bg-transparent border-none outline-none focus:bg-white focus:border focus:border-sky-300 focus:rounded-lg focus:px-2 transition-all disabled:opacity-60"
              />

              <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400">
                {section.lessons.length > 0 && (
                  <span>
                    {section.lessons.length} lesson
                    {section.lessons.length !== 1 ? "s" : ""} ·{" "}
                    {formatDuration(secDuration)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggleSection(sIdx)}
                  className="font-bold text-slate-400 hover:text-slate-700 px-1"
                >
                  {isCollapsed ? "▶" : "▼"}
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(sIdx)}
                  disabled={disabled}
                  className="text-slate-300 hover:text-red-500 font-bold transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="p-3 flex flex-col gap-2">
                {section.lessons.map((lesson, lIdx) => (
                  <LessonRow
                    key={lIdx}
                    lesson={lesson}
                    lessonIdx={lIdx}
                    sectionIdx={sIdx}
                    onUpdate={(patch) => updateLesson(sIdx, lIdx, patch)}
                    onRemove={() => removeLesson(sIdx, lIdx)}
                    onMove={(dir) => moveLesson(sIdx, lIdx, dir)}
                    totalLessons={section.lessons.length}
                    disabled={disabled}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => addLesson(sIdx)}
                  disabled={disabled}
                  className="flex items-center gap-2 text-xs font-bold text-sky-600 hover:text-sky-700 border-2 border-dashed border-sky-200 hover:border-sky-400 rounded-xl px-4 py-2.5 transition-all disabled:opacity-50 justify-center"
                >
                  + Add Lesson
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addSection}
        disabled={disabled}
        className="flex items-center justify-center gap-2 text-sm font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 hover:border-slate-400 px-4 py-3.5 rounded-2xl transition-all disabled:opacity-50"
      >
        + Add Section / Chapter
      </button>
    </div>
  );
}

// ─── Course Modal ─────────────────────────────────────────────────────────────
type ModalTab = "basics" | "curriculum" | "details";

function CourseModal({
  mode,
  course,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  course?: Course;
  onClose: () => void;
  onSaved: (c: Course) => void;
}) {
  const isEdit = mode === "edit";
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>("basics");
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(course?.title ?? "");
  const [subject, setSubject] = useState(course?.subject ?? "");
  const [topic, setTopic] = useState(course?.topic ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [overview, setOverview] = useState(course?.overview ?? "");
  const [classLevel, setClassLevel] = useState(course?.classLevel ?? "All");
  const [language, setLanguage] = useState(course?.language ?? "English");
  const [level, setLevel] = useState<CourseLevel>(
    course?.level ?? "All Levels",
  );
  const [status, setStatus] = useState<CourseStatus>(course?.status ?? "draft");
  const [certEnabled, setCertEnabled] = useState(
    course?.certificateEnabled !== false,
  );
  const [previewVideoUrl, setPreviewVideoUrl] = useState(
    course?.previewVideoUrl ?? "",
  );
  const [whatYouWillLearn, setWhatYouWillLearn] = useState<string[]>(
    course?.whatYouWillLearn ?? [""],
  );
  const [requirements, setRequirements] = useState<string[]>(
    course?.requirements ?? [],
  );
  const [targetAudience, setTargetAudience] = useState<string[]>(
    course?.targetAudience ?? [],
  );
  const [sections, setSections] = useState<Section[]>(course?.sections ?? []);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    course?.thumbnailUrl ?? null,
  );
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const previewVideoId = extractYouTubeId(previewVideoUrl);

  const handleThumbnail = (file: File) => {
    if (
      !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
        file.type,
      )
    ) {
      toast.error("Thumbnail must be a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Thumbnail must be under 5MB.");
      return;
    }
    setThumbnailFile(file);
    setRemoveThumbnail(false);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const TABS: { id: ModalTab; label: string; icon: string }[] = [
    { id: "basics", label: "Basics", icon: "📝" },
    { id: "curriculum", label: "Curriculum", icon: "🎬" },
    { id: "details", label: "Details", icon: "⚙️" },
  ];

  const validate = (): boolean => {
    if (!title.trim()) {
      toast.error("Course title is required.");
      setActiveTab("basics");
      return false;
    }
    if (!subject) {
      toast.error("Subject is required.");
      setActiveTab("basics");
      return false;
    }
    if (!description.trim()) {
      toast.error("Short description is required.");
      setActiveTab("basics");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("subject", subject);
      fd.append("topic", topic.trim());
      fd.append("description", description.trim());
      fd.append("overview", overview.trim());
      fd.append("classLevel", classLevel);
      fd.append("language", language);
      fd.append("level", level);
      fd.append("status", status);
      fd.append("certificateEnabled", String(certEnabled));
      fd.append("previewVideoUrl", previewVideoUrl.trim());
      fd.append(
        "whatYouWillLearn",
        JSON.stringify(whatYouWillLearn.filter(Boolean)),
      );
      fd.append("requirements", JSON.stringify(requirements.filter(Boolean)));
      fd.append(
        "targetAudience",
        JSON.stringify(targetAudience.filter(Boolean)),
      );
      fd.append("sections", JSON.stringify(sections));
      if (thumbnailFile) fd.append("thumbnail", thumbnailFile);
      if (removeThumbnail) fd.append("removeThumbnail", "true");

      const url = isEdit ? `/api/course/${course!._id}` : "/api/course";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(isEdit ? "Course updated!" : "Course created!");
      onSaved(data.data);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-sky-600 to-indigo-700 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              🎬
            </div>
            <div>
              <h2 className="font-black text-white text-base">
                {isEdit ? "Edit Course" : "Create Video Course"}
              </h2>
              <p className="text-sky-200 text-xs">
                YouTube links · Sections & Lessons · Free certificates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-slate-100 bg-slate-50 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-all border-b-2 ${
                activeTab === tab.id
                  ? "border-sky-600 text-sky-700 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 flex flex-col gap-5">
            {/* ── BASICS TAB ──────────────────────────────────────────────── */}
            {activeTab === "basics" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Course Thumbnail{" "}
                    <span className="text-slate-400 normal-case font-normal">
                      (JPEG/PNG/WebP · max 5MB)
                    </span>
                  </label>
                  <div className="flex gap-4 items-start">
                    <div
                      className={`w-48 h-28 rounded-2xl overflow-hidden border-2 border-dashed flex items-center justify-center shrink-0 cursor-pointer transition-all ${dragOver ? "border-sky-400 bg-sky-50" : thumbnailPreview ? "border-sky-200" : "border-slate-200 hover:border-sky-300 bg-slate-50"}`}
                      onClick={() => thumbnailInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const f = e.dataTransfer.files[0];
                        if (f) handleThumbnail(f);
                      }}
                    >
                      {thumbnailPreview && !removeThumbnail ? (
                        <img
                          src={thumbnailPreview}
                          alt="thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <span className="text-2xl">🖼️</span>
                          <span className="text-xs font-medium">
                            Click or drag
                          </span>
                        </div>
                      )}
                    </div>
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleThumbnail(f);
                      }}
                    />
                    <div className="flex flex-col gap-2 flex-1">
                      <p className="text-xs text-slate-500">
                        Recommended: 16:9 ratio, 1280×720px minimum. This is the
                        first thing students see.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => thumbnailInputRef.current?.click()}
                          disabled={saving}
                          className="text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {thumbnailPreview && !removeThumbnail
                            ? "Replace"
                            : "Upload"}
                        </button>
                        {thumbnailPreview && !removeThumbnail && (
                          <button
                            type="button"
                            onClick={() => {
                              setRemoveThumbnail(true);
                              setThumbnailPreview(null);
                              setThumbnailFile(null);
                            }}
                            disabled={saving}
                            className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Course Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Complete SHS Physics — From Basics to WASSCE"
                    disabled={saving}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all disabled:opacity-60"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Subject <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={saving}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all bg-white disabled:opacity-60"
                    >
                      <option value="">Select subject</option>
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Class Level
                    </label>
                    <select
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      disabled={saving}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all bg-white disabled:opacity-60"
                    >
                      {CLASS_LEVELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Topic
                  </label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Waves, Optics, Electricity"
                    disabled={saving}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all disabled:opacity-60"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Short Description <span className="text-red-400">*</span>
                    <span className="text-slate-400 normal-case font-normal ml-1">
                      (tagline shown on card · max 300 chars)
                    </span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this course about? What will students achieve?"
                    rows={2}
                    maxLength={300}
                    disabled={saving}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all disabled:opacity-60 resize-none"
                  />
                  <p className="text-xs text-slate-400 text-right">
                    {description.length}/300
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Course Preview Video{" "}
                    <span className="text-slate-400 normal-case font-normal">
                      (YouTube trailer URL)
                    </span>
                  </label>
                  <input
                    value={previewVideoUrl}
                    onChange={(e) => setPreviewVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    disabled={saving}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all disabled:opacity-60"
                  />
                  {previewVideoId && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-14 rounded-xl overflow-hidden shrink-0">
                        <YTThumb
                          videoId={previewVideoId}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-emerald-600 font-medium">
                        ✓ Preview video detected (ID: {previewVideoId})
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── CURRICULUM TAB ───────────────────────────────────────────── */}
            {activeTab === "curriculum" && (
              <>
                <div className="flex items-center gap-3">
                  <h3 className="font-black text-slate-800 text-sm">
                    Course Curriculum
                  </h3>
                  <p className="text-xs text-slate-400">
                    Build sections (chapters) and add YouTube lesson links
                  </p>
                </div>
                <CurriculumBuilder
                  sections={sections}
                  onChange={setSections}
                  disabled={saving}
                />
              </>
            )}

            {/* ── DETAILS TAB ──────────────────────────────────────────────── */}
            {activeTab === "details" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Level
                    </label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value as CourseLevel)}
                      disabled={saving}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white disabled:opacity-60"
                    >
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      disabled={saving}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white disabled:opacity-60"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as CourseStatus)
                      }
                      disabled={saving}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white disabled:opacity-60"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-4">
                  <div className="text-3xl shrink-0">🏆</div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 text-sm">
                      Completion Certificate
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Students who complete 100% of lessons will receive a
                      beautifully designed PDF certificate for free.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCertEnabled((p) => !p)}
                    disabled={saving}
                    className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border shrink-0 transition-all ${certEnabled ? "border-amber-300 bg-amber-100 text-amber-800" : "border-slate-200 bg-white text-slate-500"}`}
                  >
                    <div
                      className={`w-9 h-5 rounded-full relative transition-colors ${certEnabled ? "bg-amber-500" : "bg-slate-300"}`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${certEnabled ? "left-4" : "left-0.5"}`}
                      />
                    </div>
                    {certEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Full Course Overview{" "}
                    <span className="text-slate-400 normal-case font-normal">
                      (shown on course landing page)
                    </span>
                  </label>
                  <textarea
                    value={overview}
                    onChange={(e) => setOverview(e.target.value)}
                    placeholder="Detailed description — what topics are covered, teaching style, exam preparation tips…"
                    rows={5}
                    disabled={saving}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all disabled:opacity-60 resize-none"
                  />
                </div>

                <BulletListEditor
                  label="What Students Will Learn"
                  placeholder="e.g. Solve quadratic equations confidently"
                  items={whatYouWillLearn}
                  onChange={setWhatYouWillLearn}
                  disabled={saving}
                />

                <BulletListEditor
                  label="Requirements / Prerequisites"
                  placeholder="e.g. Basic algebra knowledge"
                  items={requirements}
                  onChange={setRequirements}
                  disabled={saving}
                />

                <BulletListEditor
                  label="Target Audience"
                  placeholder="e.g. SHS 2 students preparing for WASSCE"
                  items={targetAudience}
                  onChange={setTargetAudience}
                  disabled={saving}
                />
              </>
            )}
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
            <div className="flex gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${activeTab === tab.id ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 px-5 py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 text-sm font-bold text-white bg-linear-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 disabled:opacity-50 px-6 py-2.5 rounded-xl shadow-md transition-all"
              >
                {saving ? (
                  <>
                    <Spinner sm />
                    {isEdit ? "Saving…" : "Creating…"}
                  </>
                ) : isEdit ? (
                  "💾 Save Course"
                ) : (
                  "🎬 Create Course"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Stats Modal ──────────────────────────────────────────────────────────────
function StatsModal({
  course,
  onClose,
}: {
  course: Course;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    fetch(`/api/course/${course._id}/stats`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStats(d.data);
      })
      .catch(() => toast.error("Failed to load stats."))
      .finally(() => setLoading(false));
  }, [course._id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        <div className="bg-linear-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-sm truncate">
              {course.title}
            </p>
            <p className="text-slate-400 text-xs">Enrollment Statistics</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : stats ? (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Total Enrolled",
                    value: stats.totalEnrolled,
                    icon: "👥",
                    color: "bg-sky-50 text-sky-700",
                  },
                  {
                    label: "Completed",
                    value: stats.totalCompleted,
                    icon: "🏆",
                    color: "bg-amber-50 text-amber-700",
                  },
                  {
                    label: "Completion Rate",
                    value: `${stats.completionRate}%`,
                    icon: "📊",
                    color: "bg-emerald-50 text-emerald-700",
                  },
                  {
                    label: "Avg Progress",
                    value: `${stats.averageProgress}%`,
                    icon: "📈",
                    color: "bg-violet-50 text-violet-700",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`${s.color} rounded-2xl p-4 flex flex-col gap-1`}
                  >
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-2xl font-black">{s.value}</span>
                    <span className="text-xs font-semibold opacity-70">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {stats.recentEnrollments.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Recent Students
                  </h4>
                  {stats.recentEnrollments.map((e: any) => (
                    <div
                      key={e._id}
                      className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-linear-to-br from-sky-200 to-indigo-200 flex items-center justify-center font-black text-sky-700 text-sm shrink-0">
                        {e.student?.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {e.student?.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-500 rounded-full"
                              style={{ width: `${e.progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">
                            {e.progressPercent}%
                          </span>
                        </div>
                      </div>
                      {e.isCompleted && (
                        <span className="text-xs font-bold text-amber-600 shrink-0">
                          🏆
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">
              No data available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({
  course,
  onClose,
  onDeleted,
}: {
  course: Course;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/course/${course._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Course deleted.");
      onDeleted(course._id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-2xl shrink-0">
            🗑️
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">
              Delete Course?
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              This cannot be undone.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
          <p className="font-bold text-slate-800 text-sm truncate">
            {course.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {course.subject} · {course.totalLessons} lessons ·{" "}
            {course.enrollmentsCount} enrolled
          </p>
        </div>
        <p className="text-sm text-slate-600">
          All student enrollments and progress data will also be permanently
          removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 py-3 rounded-xl transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 py-3 rounded-xl transition-all"
          >
            {deleting ? (
              <>
                <Spinner sm />
                Deleting…
              </>
            ) : (
              "🗑️ Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Course Player Modal ──────────────────────────────────────────────────────
// Mobile-first: video on top, curriculum list below (collapsible on mobile).
// On desktop: side-by-side layout is restored.
function CoursePlayerModal({
  course,
  onClose,
}: {
  course: Course;
  onClose: () => void;
}) {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeSectionIdx, setActiveSectionIdx] = useState<number>(0);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    new Set(),
  );
  // On mobile the curriculum panel is toggled via a bottom sheet button.
  // On desktop it remains as a sidebar.
  const [curriculumOpen, setCurriculumOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (course.sections && course.sections.length > 0) {
      for (let s = 0; s < course.sections.length; s++) {
        const section = course.sections[s];
        if (section.lessons.length > 0) {
          setActiveLesson(section.lessons[0]);
          setActiveSectionIdx(s);
          return;
        }
      }
    }
  }, [course]);

  const allLessons: {
    lesson: Lesson;
    sectionIdx: number;
    lessonIdx: number;
  }[] = [];
  (course.sections ?? []).forEach((sec, si) => {
    sec.lessons.forEach((les, li) => {
      allLessons.push({ lesson: les, sectionIdx: si, lessonIdx: li });
    });
  });

  const currentIdx = allLessons.findIndex(
    (x) =>
      x.lesson.youtubeVideoId === activeLesson?.youtubeVideoId &&
      x.lesson.title === activeLesson?.title,
  );
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson =
    currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  const goTo = (entry: { lesson: Lesson; sectionIdx: number }) => {
    setActiveLesson(entry.lesson);
    setActiveSectionIdx(entry.sectionIdx);
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.delete(entry.sectionIdx);
      return next;
    });
    // Close curriculum panel on mobile after selecting a lesson
    setCurriculumOpen(false);
  };

  const toggleSection = (idx: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const totalLessons = allLessons.length;
  const totalDuration = (course.sections ?? []).reduce(
    (sum, sec) =>
      sum + sec.lessons.reduce((s, l) => s + (l.durationSeconds || 0), 0),
    0,
  );

  // ── Curriculum panel (shared between sidebar on desktop and sheet on mobile)
  const CurriculumPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="px-4 py-3.5 border-b border-slate-800 shrink-0 flex items-center justify-between">
        <div>
          <h3 className="font-black text-white text-sm">Course Curriculum</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} ·{" "}
            {formatDuration(totalDuration)}
          </p>
        </div>
        {/* Close button visible only on mobile panel */}
        <button
          onClick={() => setCurriculumOpen(false)}
          className="md:hidden w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center text-xs font-bold"
        >
          ✕
        </button>
      </div>

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto">
        {(course.sections ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <span className="text-3xl mb-2 opacity-30">📋</span>
            <p className="text-slate-500 text-xs">No sections yet</p>
          </div>
        ) : (
          (course.sections ?? []).map((section, sIdx) => {
            const isCollapsed = collapsedSections.has(sIdx);
            const secDuration = section.lessons.reduce(
              (s, l) => s + (l.durationSeconds || 0),
              0,
            );
            const isActiveSection = sIdx === activeSectionIdx;

            return (
              <div key={sIdx} className="border-b border-slate-800">
                {/* Section header */}
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

                {/* Lessons list */}
                {!isCollapsed && (
                  <div className="bg-slate-950/40">
                    {section.lessons.length === 0 ? (
                      <p className="text-xs text-slate-600 italic px-10 py-3">
                        No lessons
                      </p>
                    ) : (
                      section.lessons.map((lesson, lIdx) => {
                        const isActive =
                          activeLesson?.title === lesson.title &&
                          activeLesson?.youtubeVideoId ===
                            lesson.youtubeVideoId;
                        const hasVideo = !!lesson.youtubeVideoId;

                        return (
                          <button
                            key={lIdx}
                            type="button"
                            onClick={() =>
                              hasVideo && goTo({ lesson, sectionIdx: sIdx })
                            }
                            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-t border-slate-800/50 ${
                              isActive
                                ? "bg-sky-900/30 border-l-2 border-l-sky-500"
                                : hasVideo
                                  ? "hover:bg-slate-800/40 cursor-pointer"
                                  : "opacity-40 cursor-not-allowed"
                            }`}
                          >
                            {/* Play icon / index */}
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                isActive
                                  ? "bg-sky-600 text-white"
                                  : hasVideo
                                    ? "bg-slate-700 text-slate-300"
                                    : "bg-slate-800 text-slate-600"
                              }`}
                            >
                              {isActive ? (
                                <span className="text-xs">▶</span>
                              ) : (
                                <span className="text-xs font-bold">
                                  {lIdx + 1}
                                </span>
                              )}
                            </div>

                            {/* Lesson details */}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs font-semibold leading-snug ${isActive ? "text-sky-300" : "text-slate-300"}`}
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
                                {!hasVideo && (
                                  <span className="text-xs text-slate-600 italic">
                                    No video
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* YT mini thumb */}
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
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
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
          <span className="text-xs text-slate-400 font-medium hidden sm:block">
            {totalLessons} lessons · {formatDuration(totalDuration)}
          </span>
          {/* Curriculum toggle — visible on all sizes but styled differently */}
          <button
            onClick={() => setCurriculumOpen((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-colors"
          >
            <span>📋</span>
            <span className="hidden sm:inline">Curriculum</span>
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {/*
        Mobile  : single column — video on top, lesson info below, curriculum as overlay
        Desktop : side-by-side — video+info on left, curriculum sidebar on right
      */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Left / main pane ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden bg-black">
          {/* Video embed — responsive 16:9 */}
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
                        ? "No lessons added to this course yet"
                        : "Select a lesson from the curriculum to start watching"}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Lesson info + navigation — scrollable on mobile */}
          <div className="bg-slate-950 px-4 py-4 md:px-6 md:py-5 flex flex-col gap-4 md:flex-1 md:overflow-y-auto">
            {activeLesson ? (
              <>
                {/* Navigation row */}
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

                {/* Lesson title + meta */}
                <div>
                  <h2 className="text-white font-black text-base md:text-lg leading-snug">
                    {activeLesson.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {activeLesson.durationSeconds > 0 && (
                      <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full font-medium">
                        ⏱ {formatDuration(activeLesson.durationSeconds)}
                      </span>
                    )}
                    {activeLesson.isFree && (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-700/40 px-2.5 py-1 rounded-full">
                        Free Preview
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
                  </div>
                </div>

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

                {/* External link */}
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

            {/* ── Mobile-only inline curriculum ──────────────────────────────
                On mobile, after the lesson info we render all lessons inline
                so the user can scroll down and tap without needing a sidebar.
            ── */}
            <div className="md:hidden mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-white text-sm">
                  Course Curriculum
                </h3>
                <span className="text-xs text-slate-400">
                  {totalLessons} lessons · {formatDuration(totalDuration)}
                </span>
              </div>

              {(course.sections ?? []).length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-6">
                  No sections yet
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {(course.sections ?? []).map((section, sIdx) => {
                    const isCollapsed = collapsedSections.has(sIdx);
                    const secDuration = section.lessons.reduce(
                      (s, l) => s + (l.durationSeconds || 0),
                      0,
                    );
                    const isActiveSection = sIdx === activeSectionIdx;

                    return (
                      <div
                        key={sIdx}
                        className="rounded-2xl overflow-hidden border border-slate-800"
                      >
                        {/* Section header */}
                        <button
                          type="button"
                          onClick={() => toggleSection(sIdx)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActiveSection ? "bg-slate-800" : "bg-slate-900 hover:bg-slate-800/60"}`}
                        >
                          <span
                            className={`text-xs font-black shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isActiveSection ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-400"}`}
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
                              {secDuration > 0 &&
                                ` · ${formatDuration(secDuration)}`}
                            </p>
                          </div>
                          <span className="text-slate-500 text-xs shrink-0">
                            {isCollapsed ? "▶" : "▼"}
                          </span>
                        </button>

                        {/* Lessons */}
                        {!isCollapsed && (
                          <div className="bg-slate-950">
                            {section.lessons.length === 0 ? (
                              <p className="text-xs text-slate-600 italic px-10 py-3">
                                No lessons
                              </p>
                            ) : (
                              section.lessons.map((lesson, lIdx) => {
                                const isActive =
                                  activeLesson?.title === lesson.title &&
                                  activeLesson?.youtubeVideoId ===
                                    lesson.youtubeVideoId;
                                const hasVideo = !!lesson.youtubeVideoId;

                                return (
                                  <button
                                    key={lIdx}
                                    type="button"
                                    onClick={() =>
                                      hasVideo &&
                                      goTo({ lesson, sectionIdx: sIdx })
                                    }
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-t border-slate-800/60 ${
                                      isActive
                                        ? "bg-sky-900/30 border-l-4 border-l-sky-500"
                                        : hasVideo
                                          ? "hover:bg-slate-800/50 active:bg-slate-800"
                                          : "opacity-40 cursor-not-allowed"
                                    }`}
                                  >
                                    {/* Thumbnail */}
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

                                    {/* Lesson info */}
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`text-xs font-semibold leading-snug truncate ${isActive ? "text-sky-300" : "text-slate-300"}`}
                                      >
                                        {lesson.title || `Lesson ${lIdx + 1}`}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {lesson.durationSeconds > 0 && (
                                          <span className="text-xs text-slate-500">
                                            {formatDuration(
                                              lesson.durationSeconds,
                                            )}
                                          </span>
                                        )}
                                        {lesson.isFree && (
                                          <span className="text-xs font-bold text-emerald-500">
                                            Free
                                          </span>
                                        )}
                                        {!hasVideo && (
                                          <span className="text-xs text-slate-600 italic">
                                            No video
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Active indicator */}
                                    {isActive && (
                                      <span className="text-sky-400 text-xs shrink-0 font-bold">
                                        ▶
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Desktop sidebar curriculum ────────────────────────────────────── */}
        {/*
          Hidden on mobile (md:flex handles show/hide).
          The curriculum is always visible as a sidebar on md+ when curriculumOpen is true.
        */}
        <div
          className={`
            hidden md:flex flex-col
            w-80 shrink-0 bg-slate-900 border-l border-slate-800
            transition-all duration-300 overflow-hidden
            ${curriculumOpen ? "md:w-80" : "md:w-0 md:border-0"}
          `}
        >
          {curriculumOpen && <CurriculumPanel />}
        </div>

        {/* ── Mobile curriculum overlay (full-screen bottom drawer) ───────── */}
        {curriculumOpen && (
          <div className="md:hidden fixed inset-0 z-10 flex flex-col bg-slate-900">
            <CurriculumPanel />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Course Card ──────────────────────────────────────────────────────────────
function CourseCard({
  course,
  onEdit,
  onDelete,
  onStats,
  onWatch,
}: {
  course: Course;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
  onStats: (c: Course) => void;
  onWatch: (c: Course) => void;
}) {
  const statusCfg: Record<CourseStatus, { label: string; cls: string }> = {
    published: { label: "Published", cls: "bg-green-100 text-green-700" },
    draft: { label: "Draft", cls: "bg-amber-100 text-amber-700" },
    archived: { label: "Archived", cls: "bg-slate-100 text-slate-600" },
  };
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
  const sc = statusCfg[course.status] ?? statusCfg.draft;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="relative h-40 bg-linear-to-br from-sky-100 to-indigo-100 shrink-0">
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
        <div className="absolute top-2 right-2">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${sc.cls}`}
          >
            {sc.label}
          </span>
        </div>
        {course.totalDurationSeconds > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
            {formatDuration(course.totalDurationSeconds)}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
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
            </span>{" "}
            lessons
          </span>
          <span>
            👥{" "}
            <span className="font-semibold text-slate-700">
              {course.enrollmentsCount}
            </span>{" "}
            enrolled
          </span>
          {course.certificateEnabled && (
            <span className="text-amber-600 font-semibold">🏆 Certificate</span>
          )}
        </div>

        {course.ratingsCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-amber-500">★</span>
            <span className="font-bold text-slate-700">
              {course.ratingsAverage.toFixed(1)}
            </span>
            <span className="text-slate-400">
              ({course.ratingsCount} ratings)
            </span>
          </div>
        )}

        <div className="text-xs text-slate-400 mt-auto">
          {formatDate(course.createdAt)}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-slate-50 mt-auto">
          <button
            onClick={() => onWatch(course)}
            disabled={course.totalLessons === 0 && !course.previewVideoId}
            title={
              course.totalLessons === 0 && !course.previewVideoId
                ? "Add lessons first"
                : "Watch course"
            }
            className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 disabled:opacity-40 disabled:cursor-not-allowed py-2 rounded-xl transition-colors"
          >
            ▶ Watch
          </button>
          <button
            onClick={() => onStats(course)}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 py-2 rounded-xl transition-colors"
          >
            📊 Stats
          </button>
          <button
            onClick={() => onEdit(course)}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-xl transition-colors"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => onDelete(course)}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-xl transition-colors"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InstructorVideoCoursePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | undefined>(undefined);
  const [deleteCourse, setDeleteCourse] = useState<Course | undefined>(
    undefined,
  );
  const [statsCourse, setStatsCourse] = useState<Course | undefined>(undefined);
  const [watchCourse, setWatchCourse] = useState<Course | undefined>(undefined);
  const [loadingEdit, setLoadingEdit] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    filterSubject,
    filterClass,
    filterStatus,
    filterLevel,
    sort,
  ]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
        sort,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filterSubject && { subject: filterSubject }),
        ...(filterClass && { classLevel: filterClass }),
        ...(filterStatus && { status: filterStatus }),
        ...(filterLevel && { level: filterLevel }),
      });
      const res = await fetch(`/api/course?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCourses(data.data);
      setPagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    sort,
    debouncedSearch,
    filterSubject,
    filterClass,
    filterStatus,
    filterLevel,
  ]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleEditClick = async (course: Course) => {
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/course/${course._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setEditCourse(data.data);
      setShowModal(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to load course.");
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleWatchClick = async (course: Course) => {
    if (course.sections) {
      setWatchCourse(course);
      return;
    }
    try {
      const res = await fetch(`/api/course/${course._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setWatchCourse(data.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load course.");
    }
  };

  const handleSaved = (saved: Course) => {
    setShowModal(false);
    setEditCourse(undefined);
    if (editCourse) {
      setCourses((prev) =>
        prev.map((c) => (c._id === saved._id ? { ...c, ...saved } : c)),
      );
    } else {
      setCourses((prev) => [saved, ...prev]);
      setPagination((prev) =>
        prev ? { ...prev, total: prev.total + 1 } : prev,
      );
    }
  };

  const handleDeleted = (id: string) => {
    setDeleteCourse(undefined);
    setCourses((prev) => prev.filter((c) => c._id !== id));
    setPagination((prev) =>
      prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev,
    );
  };

  const isFiltered = !!(
    debouncedSearch ||
    filterSubject ||
    filterClass ||
    filterStatus ||
    filterLevel
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-xl shadow-sm">
            🎬
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Video Courses
            </h1>
            <p className="text-slate-500 text-sm">
              {pagination
                ? `${pagination.total} course${pagination.total !== 1 ? "s" : ""}`
                : "Build structured video courses with sections and lessons"}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditCourse(undefined);
            setShowModal(true);
          }}
          disabled={loadingEdit}
          className="flex items-center gap-2 bg-linear-to-r from-sky-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm shrink-0 disabled:opacity-60"
        >
          {loadingEdit ? <Spinner sm /> : null}+ Create Course
        </button>
      </div>

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
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white min-w-32"
        >
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white min-w-36"
        >
          <option value="">All Levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white min-w-36"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="title">Title A–Z</option>
          <option value="popular">Most Enrolled</option>
        </select>
        {isFiltered && (
          <button
            onClick={() => {
              setSearch("");
              setFilterSubject("");
              setFilterClass("");
              setFilterStatus("");
              setFilterLevel("");
              setSort("newest");
            }}
            className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 h-80 animate-pulse"
            />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courses.map((c) => (
            <CourseCard
              key={c._id}
              course={c}
              onEdit={handleEditClick}
              onDelete={setDeleteCourse}
              onStats={setStatsCourse}
              onWatch={handleWatchClick}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3.5">
          <p className="text-xs text-slate-500 font-medium">
            Showing{" "}
            <span className="font-bold text-slate-800">
              {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of{" "}
            <span className="font-bold text-slate-800">{pagination.total}</span>{" "}
            courses
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ‹
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === pagination.totalPages ||
                  Math.abs(p - pagination.page) <= 1,
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
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${pagination.page === p ? "bg-linear-to-r from-sky-600 to-indigo-600 text-white shadow-md" : "border border-slate-200 text-slate-600 hover:bg-sky-50 hover:text-sky-700"}`}
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <CourseModal
          mode={editCourse ? "edit" : "create"}
          course={editCourse}
          onClose={() => {
            setShowModal(false);
            setEditCourse(undefined);
          }}
          onSaved={handleSaved}
        />
      )}
      {deleteCourse && (
        <DeleteConfirm
          course={deleteCourse}
          onClose={() => setDeleteCourse(undefined)}
          onDeleted={handleDeleted}
        />
      )}
      {statsCourse && (
        <StatsModal
          course={statsCourse}
          onClose={() => setStatsCourse(undefined)}
        />
      )}
      {watchCourse && (
        <CoursePlayerModal
          course={watchCourse}
          onClose={() => setWatchCourse(undefined)}
        />
      )}
    </div>
  );
}
