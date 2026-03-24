"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LectureNote {
  _id: string;
  title: string;
  subject: string;
  topic: string;
  description: string;
  classLevel: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  views: number;
  downloads: number;
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

// Subject colour map for visual variety
const SUBJECT_COLORS: Record<
  string,
  { bg: string; text: string; border: string; accent: string }
> = {
  Mathematics: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    accent: "from-blue-500 to-blue-600",
  },
  "English Language": {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    accent: "from-violet-500 to-violet-600",
  },
  Physics: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    accent: "from-cyan-500 to-cyan-600",
  },
  Chemistry: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    accent: "from-emerald-500 to-emerald-600",
  },
  Biology: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    accent: "from-green-500 to-green-600",
  },
  Economics: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    accent: "from-amber-500 to-amber-600",
  },
  History: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    accent: "from-orange-500 to-orange-600",
  },
  Geography: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    accent: "from-teal-500 to-teal-600",
  },
  ICT: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    accent: "from-indigo-500 to-indigo-600",
  },
  Literature: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    accent: "from-rose-500 to-rose-600",
  },
  French: {
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-200",
    accent: "from-pink-500 to-pink-600",
  },
};

const DEFAULT_COLOR = {
  bg: "bg-slate-50",
  text: "text-slate-700",
  border: "border-slate-200",
  accent: "from-slate-500 to-slate-600",
};

function getSubjectColor(subject: string) {
  return SUBJECT_COLORS[subject] ?? DEFAULT_COLOR;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

// ─── PDF Preview Modal ────────────────────────────────────────────────────────
function PDFPreviewModal({
  note,
  onClose,
  onDownload,
}: {
  note: LectureNote;
  onClose: () => void;
  onDownload: (note: LectureNote) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const previewUrl = `/api/upload/${note._id}/preview`;
  const colors = getSubjectColor(note.subject);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm">
      {/* Header */}
      <div
        className={`bg-linear-to-r ${colors.accent} px-4 py-3 flex items-center gap-3 shrink-0 shadow-lg`}
      >
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-base shrink-0">
          📄
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{note.title}</p>
          <p className="text-white/70 text-xs truncate">
            {note.subject}
            {note.topic ? ` · ${note.topic}` : ""}
            {" · "}
            {note.fileName}
            {" · "}
            {formatFileSize(note.fileSize)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onDownload(note)}
            className="flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
          >
            ⬇ Download
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1 relative overflow-hidden bg-slate-900">
        {loading && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
            <Spinner />
            <p className="text-slate-400 text-sm">Loading PDF…</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="text-5xl">📄</div>
            <p className="text-slate-200 text-base font-bold">
              Cannot render PDF in browser
            </p>
            <p className="text-slate-400 text-sm max-w-xs">
              Your browser may not support inline PDF viewing. Download the file
              to open it locally.
            </p>
            <button
              onClick={() => onDownload(note)}
              className="mt-2 flex items-center gap-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl transition-colors shadow-md"
            >
              ⬇ Download PDF
            </button>
          </div>
        )}
        {/* No sandbox — required for browser PDF plugin to work */}
        <iframe
          src={previewUrl}
          className="w-full h-full border-0"
          title={note.title}
          onLoad={() => {
            setLoading(false);
            setError(false);
          }}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      </div>

      {/* Footer */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center justify-between shrink-0">
        <p className="text-xs text-slate-500">
          {note.views} view{note.views !== 1 ? "s" : ""} · {note.downloads}{" "}
          download{note.downloads !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-slate-500">ESC or ✕ to close</p>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-4xl mb-5 shadow-sm">
        {filtered ? "🔍" : "📚"}
      </div>
      <h3 className="font-black text-slate-800 text-lg mb-2">
        {filtered ? "No notes match your search" : "No lecture notes yet"}
      </h3>
      <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
        {filtered
          ? "Try a different search term or remove filters."
          : "Your instructor hasn't uploaded any notes yet. Check back later."}
      </p>
    </div>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────
function NoteCard({
  note,
  onPreview,
  onDownload,
  downloading,
}: {
  note: LectureNote;
  onPreview: (n: LectureNote) => void;
  onDownload: (n: LectureNote) => void;
  downloading: boolean;
}) {
  const colors = getSubjectColor(note.subject);

  const levelBadge: Record<string, string> = {
    "SHS 1": "bg-blue-100 text-blue-700",
    "SHS 2": "bg-indigo-100 text-indigo-700",
    "SHS 3": "bg-violet-100 text-violet-700",
    All: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
      {/* Coloured top accent */}
      <div className={`h-1.5 bg-linear-to-r ${colors.accent}`} />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Subject chip + class level */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-black px-2.5 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
          >
            {note.subject}
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${levelBadge[note.classLevel] ?? "bg-slate-100 text-slate-600"}`}
          >
            {note.classLevel}
          </span>
        </div>

        {/* Title + topic */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center text-lg shrink-0 mt-0.5`}
          >
            📄
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
              {note.title}
            </h3>
            {note.topic && (
              <p
                className={`text-xs font-semibold mt-0.5 truncate ${colors.text}`}
              >
                {note.topic}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {note.description && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {note.description}
          </p>
        )}

        {/* File info */}
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 mt-auto">
          <span className="text-xs font-black text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg uppercase tracking-wide">
            PDF
          </span>
          <span className="text-xs text-slate-500 truncate flex-1 font-medium">
            {note.fileName}
          </span>
          <span className="text-xs text-slate-400 shrink-0 font-semibold">
            {formatFileSize(note.fileSize)}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              👁 <span className="font-semibold">{note.views}</span>
            </span>
            <span className="flex items-center gap-1">
              ⬇️ <span className="font-semibold">{note.downloads}</span>
            </span>
          </div>
          <span>{formatDate(note.createdAt)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-4 flex gap-2">
        <button
          onClick={() => onPreview(note)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-colors ${colors.bg} ${colors.text} hover:opacity-80 border ${colors.border}`}
        >
          👁 Preview
        </button>
        <button
          onClick={() => onDownload(note)}
          disabled={downloading}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white transition-colors disabled:opacity-60 shadow-sm"
        >
          {downloading ? (
            <>
              <Spinner sm /> Downloading…
            </>
          ) : (
            "⬇ Download"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Subject Filter Pills ─────────────────────────────────────────────────────
function SubjectPills({
  active,
  onChange,
}: {
  active: string;
  onChange: (s: string) => void;
}) {
  const all = ["", ...SUBJECTS];
  return (
    <div className="flex gap-2 flex-wrap">
      {all.map((s) => {
        const isActive = active === s;
        const colors = s ? getSubjectColor(s) : DEFAULT_COLOR;
        return (
          <button
            key={s || "__all"}
            onClick={() => onChange(s)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              isActive
                ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm`
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {s || "All Subjects"}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentsNotesPage() {
  const [notes, setNotes] = useState<LectureNote[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewNote, setPreviewNote] = useState<LectureNote | undefined>(
    undefined,
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [showSubjectPills, setShowSubjectPills] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterSubject, filterClass, sort]);

  // Fetch notes from the existing instructor API — students can read published notes
  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
        sort,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filterSubject && { subject: filterSubject }),
        ...(filterClass && { classLevel: filterClass }),
      });
      // Students hit the student-facing notes endpoint
      const res = await fetch(`/api/notes/student?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setNotes(data.data);
      setPagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, filterSubject, filterClass]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Download handler — triggers browser download via <a> click with download attribute
  const handleDownload = async (note: LectureNote) => {
    setDownloadingId(note._id);
    try {
      const previewUrl = `/api/upload/${note._id}/preview`;
      const res = await fetch(previewUrl);
      if (!res.ok) throw new Error("Download failed.");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = note.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`"${note.title}" downloaded!`);
    } catch (err: any) {
      toast.error(err.message || "Download failed. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const isFiltered = !!(debouncedSearch || filterSubject || filterClass);

  // Grouped by subject for the "browse" view
  const subjectGroups = notes.reduce<Record<string, LectureNote[]>>(
    (acc, n) => {
      if (!acc[n.subject]) acc[n.subject] = [];
      acc[n.subject].push(n);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl shadow-sm">
            📚
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Lecture Notes
            </h1>
            <p className="text-slate-500 text-sm">
              {pagination
                ? `${pagination.total} note${pagination.total !== 1 ? "s" : ""} available`
                : "Browse and download your study materials"}
            </p>
          </div>
        </div>

        {/* View toggle + class filter */}
        <div className="flex items-center gap-2">
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all"
          >
            <option value="">All Classes</option>
            {CLASS_LEVELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Search + Filters ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
        {/* Search + sort row */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, subject, topic…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all min-w-36"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>

        {/* Subject filter toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSubjectPills((p) => !p)}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${showSubjectPills ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"}`}
          >
            {showSubjectPills ? "▲ Hide Subjects" : "▼ Browse by Subject"}
          </button>
          {filterSubject && (
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${getSubjectColor(filterSubject).bg} ${getSubjectColor(filterSubject).text} ${getSubjectColor(filterSubject).border}`}
            >
              {filterSubject}
              <button
                onClick={() => setFilterSubject("")}
                className="ml-2 opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </span>
          )}
          {isFiltered && (
            <button
              onClick={() => {
                setSearch("");
                setFilterSubject("");
                setFilterClass("");
                setSort("newest");
              }}
              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors ml-auto"
            >
              ✕ Clear all
            </button>
          )}
        </div>

        {/* Subject pills */}
        {showSubjectPills && (
          <SubjectPills
            active={filterSubject}
            onChange={(s) => {
              setFilterSubject(s);
              setShowSubjectPills(false);
            }}
          />
        )}
      </div>

      {/* ── Notes Grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 h-72 animate-pulse"
            />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              onPreview={setPreviewNote}
              onDownload={handleDownload}
              downloading={downloadingId === note._id}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────── */}
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
            notes
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      pagination.page === p
                        ? "bg-linear-to-r from-blue-500 to-indigo-600 text-white shadow-md"
                        : "border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* ── PDF Preview Modal ────────────────────────────────────────── */}
      {previewNote && (
        <PDFPreviewModal
          note={previewNote}
          onClose={() => setPreviewNote(undefined)}
          onDownload={(n) => {
            handleDownload(n);
            setPreviewNote(undefined);
          }}
        />
      )}
    </div>
  );
}
