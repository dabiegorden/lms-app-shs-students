"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

// ─── PDF Preview Modal ────────────────────────────────────────────────────────
//
// KEY FIXES vs previous version:
//  1. Route matches what the frontend calls: /api/upload/[id]/preview
//     Make sure your file is at: app/api/upload/[id]/preview/route.ts
//  2. NO sandbox attribute on the iframe — sandbox strips the browser's
//     built-in PDF plugin permissions, causing a blank/download result.
//  3. No Google Docs fallback — it only works on publicly reachable servers.
//     The native browser renderer is sufficient once sandbox is removed.
//
function PDFPreviewModal({
  note,
  onClose,
}: {
  note: LectureNote;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // This URL must match your Next.js route file location:
  // app/api/upload/[id]/preview/route.ts
  const previewUrl = `/api/upload/${note._id}/preview`;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-base shrink-0">
          📄
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{note.title}</p>
          <p className="text-blue-200 text-xs">
            {note.subject} · {note.fileName} · {formatFileSize(note.fileSize)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Download uses the same route — browser triggers download via <a download> */}
          <a
            href={previewUrl}
            download={note.fileName}
            className="text-xs font-bold text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            ⬇ Download
          </a>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Viewer area */}
      <div className="flex-1 relative overflow-hidden bg-slate-900">
        {/* Loading overlay */}
        {loading && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
            <Spinner />
            <p className="text-slate-400 text-sm">Loading PDF…</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
            <div className="text-4xl">⚠️</div>
            <p className="text-slate-300 text-sm font-semibold">
              Could not render PDF in browser
            </p>
            <p className="text-slate-500 text-xs max-w-xs text-center">
              Your browser may not support inline PDF viewing. Use the download
              button to open it.
            </p>
            <a
              href={previewUrl}
              download={note.fileName}
              className="mt-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors"
            >
              ⬇ Download PDF
            </a>
          </div>
        )}

        {/*
          IMPORTANT: No `sandbox` attribute here.
          The sandbox attribute blocks the browser's built-in PDF plugin,
          which causes the PDF to either render blank or prompt a download
          instead of displaying inline. Since this iframe loads from our own
          authenticated API route (/api/upload/[id]/preview), there is no
          cross-origin risk and sandbox is not needed.
        */}
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
        <p className="text-xs text-slate-500">Direct browser PDF renderer</p>
        <p className="text-xs text-slate-500">ESC or ✕ to close</p>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl mb-4">
        {filtered ? "🔍" : "📄"}
      </div>
      <h3 className="font-black text-slate-800 text-base mb-1">
        {filtered ? "No notes match your search" : "No lecture notes yet"}
      </h3>
      <p className="text-slate-500 text-sm max-w-xs">
        {filtered
          ? "Try adjusting your search terms or filters."
          : "Upload your first PDF lecture note to get started."}
      </p>
    </div>
  );
}

// ─── Upload / Edit Modal ──────────────────────────────────────────────────────
function NoteModal({
  mode,
  note,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  note?: LectureNote;
  onClose: () => void;
  onSaved: (saved: LectureNote) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [title, setTitle] = useState(note?.title ?? "");
  const [subject, setSubject] = useState(note?.subject ?? "");
  const [topic, setTopic] = useState(note?.topic ?? "");
  const [description, setDescription] = useState(note?.description ?? "");
  const [classLevel, setClassLevel] = useState(note?.classLevel ?? "All");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isEdit = mode === "edit";

  const handleFile = (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF must be smaller than 20MB.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject) {
      toast.error("Title and subject are required.");
      return;
    }
    if (!isEdit && !selectedFile) {
      toast.error("Please select a PDF file to upload.");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("subject", subject);
      fd.append("topic", topic.trim());
      fd.append("description", description.trim());
      fd.append("classLevel", classLevel);
      if (selectedFile) fd.append("file", selectedFile);

      const url = isEdit ? `/api/upload/${note!._id}` : "/api/upload";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(isEdit ? "Note updated!" : "Note uploaded successfully!");
      onSaved(data.data);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-6 py-5 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              {isEdit ? "✏️" : "📤"}
            </div>
            <div>
              <h2 className="font-black text-white text-base">
                {isEdit ? "Edit Lecture Note" : "Upload Lecture Note"}
              </h2>
              <p className="text-blue-200 text-xs">PDF files only · Max 20MB</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 5: Quadratic Equations"
              required
              disabled={saving}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60"
            />
          </div>

          {/* Subject + Class */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Subject <span className="text-red-400">*</span>
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white disabled:opacity-60"
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
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white disabled:opacity-60"
              >
                {CLASS_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Topic */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Topic / Chapter
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Algebra – Quadratic Equations"
              disabled={saving}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what this note covers…"
              rows={3}
              disabled={saving}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 resize-none"
            />
          </div>

          {/* File Drop Zone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              PDF File {!isEdit && <span className="text-red-400">*</span>}
              {isEdit && (
                <span className="text-slate-400 normal-case ml-1">
                  (leave empty to keep current)
                </span>
              )}
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl px-4 py-6 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                dragOver
                  ? "border-blue-400 bg-blue-50"
                  : selectedFile
                    ? "border-green-300 bg-green-50"
                    : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <span className="text-3xl">
                {selectedFile ? "✅" : dragOver ? "📂" : "📄"}
              </span>
              {selectedFile ? (
                <>
                  <p className="text-sm font-bold text-green-700 text-center truncate max-w-xs">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-green-600">
                    {formatFileSize(selectedFile.size)}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-red-500 hover:underline mt-1"
                  >
                    Remove file
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-600">
                    Drag & drop or{" "}
                    <span className="text-blue-600 font-bold">browse</span>
                  </p>
                  <p className="text-xs text-slate-400">PDF only · Max 20MB</p>
                  {isEdit && note && (
                    <p className="text-xs text-slate-500 mt-1 text-center">
                      Current:{" "}
                      <span className="font-semibold">{note.fileName}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 py-3 rounded-xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl shadow-md transition-all"
            >
              {saving ? (
                <>
                  <Spinner sm />
                  {isEdit ? "Saving…" : "Uploading…"}
                </>
              ) : isEdit ? (
                "💾 Save Changes"
              ) : (
                "📤 Upload Note"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────
function DeleteConfirm({
  note,
  onClose,
  onDeleted,
}: {
  note: LectureNote;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/upload/${note._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Note deleted.");
      onDeleted(note._id);
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
              Delete Note?
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
          <p className="font-bold text-slate-800 text-sm truncate">
            {note.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {note.subject} · {note.fileName}
          </p>
        </div>
        <p className="text-sm text-slate-600">
          The PDF file will also be permanently removed from storage.
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
            className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl transition-all"
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

// ─── Note Card ────────────────────────────────────────────────────────────────
function NoteCard({
  note,
  onPreview,
  onEdit,
  onDelete,
}: {
  note: LectureNote;
  onPreview: (n: LectureNote) => void;
  onEdit: (n: LectureNote) => void;
  onDelete: (n: LectureNote) => void;
}) {
  const levelColors: Record<string, string> = {
    "SHS 1": "bg-blue-100 text-blue-700",
    "SHS 2": "bg-indigo-100 text-indigo-700",
    "SHS 3": "bg-violet-100 text-violet-700",
    All: "bg-green-100 text-green-700",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1 bg-linear-to-r from-blue-500 to-indigo-500" />

      <div className="p-4 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-lg shrink-0">
            📄
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
              {note.title}
            </h3>
            {note.topic && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {note.topic}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
            {note.subject}
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${levelColors[note.classLevel] ?? "bg-slate-100 text-slate-600"}`}
          >
            {note.classLevel}
          </span>
        </div>

        {/* Description */}
        {note.description && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {note.description}
          </p>
        )}

        {/* File info row */}
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
            PDF
          </span>
          <span className="text-xs text-slate-500 truncate flex-1">
            {note.fileName}
          </span>
          <span className="text-xs text-slate-400 shrink-0">
            {formatFileSize(note.fileSize)}
          </span>
        </div>

        {/* Stats + date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              👁 <span className="font-semibold">{note.views}</span>
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              ⬇️ <span className="font-semibold">{note.downloads}</span>
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {formatDate(note.createdAt)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1 border-t border-slate-50">
          <button
            onClick={() => onPreview(note)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 py-2 rounded-xl transition-colors"
          >
            👁 Preview
          </button>
          <button
            onClick={() => onEdit(note)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-xl transition-colors"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => onDelete(note)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-xl transition-colors"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InstructorUploadPage() {
  const [notes, setNotes] = useState<LectureNote[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState<LectureNote | undefined>(undefined);
  const [deleteNote, setDeleteNote] = useState<LectureNote | undefined>(
    undefined,
  );
  const [previewNote, setPreviewNote] = useState<LectureNote | undefined>(
    undefined,
  );

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterSubject, filterClass, sort]);

  // Fetch notes
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
      const res = await fetch(`/api/upload?${params}`);
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

  const handleSaved = (saved: LectureNote) => {
    setShowModal(false);
    setEditNote(undefined);
    if (editNote) {
      setNotes((prev) => prev.map((n) => (n._id === saved._id ? saved : n)));
    } else {
      setNotes((prev) => [saved, ...prev]);
      setPagination((prev) =>
        prev ? { ...prev, total: prev.total + 1 } : prev,
      );
    }
  };

  const handleDeleted = (id: string) => {
    setDeleteNote(undefined);
    setNotes((prev) => prev.filter((n) => n._id !== id));
    setPagination((prev) =>
      prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev,
    );
  };

  const isFiltered = !!(debouncedSearch || filterSubject || filterClass);

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
                ? `${pagination.total} note${pagination.total !== 1 ? "s" : ""}`
                : "Upload and manage PDFs for students"}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditNote(undefined);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm shrink-0"
        >
          + Upload Note
        </button>
      </div>

      {/* ── Filters Bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all min-w-40"
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
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all min-w-36"
        >
          <option value="">All Classes</option>
          {CLASS_LEVELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all min-w-36"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="title">Title A–Z</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => {
              setSearch("");
              setFilterSubject("");
              setFilterClass("");
              setSort("newest");
            }}
            className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Notes Grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 h-64 animate-pulse"
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
              onPreview={(n) => setPreviewNote(n)}
              onEdit={(n) => {
                setEditNote(n);
                setShowModal(true);
              }}
              onDelete={(n) => setDeleteNote(n)}
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
                        ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-md"
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

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {showModal && (
        <NoteModal
          mode={editNote ? "edit" : "create"}
          note={editNote}
          onClose={() => {
            setShowModal(false);
            setEditNote(undefined);
          }}
          onSaved={handleSaved}
        />
      )}
      {deleteNote && (
        <DeleteConfirm
          note={deleteNote}
          onClose={() => setDeleteNote(undefined)}
          onDeleted={handleDeleted}
        />
      )}
      {previewNote && (
        <PDFPreviewModal
          note={previewNote}
          onClose={() => setPreviewNote(undefined)}
        />
      )}
    </div>
  );
}
