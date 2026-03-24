"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Assignment {
  _id: string;
  title: string;
  subject: string;
  topic: string;
  instructions: string;
  classLevel: string;
  dueDate: string;
  totalMarks: number;
  allowLateSubmission: boolean;
  status: "draft" | "published" | "closed";
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  views: number;
  submissionsCount: number;
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

const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "closed", label: "Closed" },
];

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

function formatDueDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (diffDays < 0) return { label: formatted, badge: "overdue" };
  if (diffDays === 0) return { label: "Due today", badge: "today" };
  if (diffDays <= 3) return { label: `${diffDays}d left`, badge: "soon" };
  return { label: formatted, badge: "normal" };
}

// Local ISO string for datetime-local input (strips timezone)
function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
// Route: app/api/assignment/[id]/preview/route.ts
// NO sandbox on iframe — sandbox blocks the browser's built-in PDF renderer.
function PDFPreviewModal({
  assignment,
  onClose,
}: {
  assignment: Assignment;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const previewUrl = `/api/assignment/${assignment._id}/preview`;

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
      <div className="bg-linear-to-r from-violet-600 to-purple-700 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-base shrink-0">
          📋
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">
            {assignment.title}
          </p>
          <p className="text-purple-200 text-xs">
            {assignment.subject} · {assignment.fileName} ·{" "}
            {assignment.fileSize ? formatFileSize(assignment.fileSize) : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={previewUrl}
            download={assignment.fileName ?? "assignment.pdf"}
            className="text-xs font-bold text-purple-200 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
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

      {/* Viewer */}
      <div className="flex-1 relative overflow-hidden bg-slate-900">
        {loading && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
            <Spinner />
            <p className="text-slate-400 text-sm">Loading PDF…</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
            <div className="text-4xl">⚠️</div>
            <p className="text-slate-300 text-sm font-semibold">
              Could not render PDF in browser
            </p>
            <a
              href={previewUrl}
              download={assignment.fileName ?? "assignment.pdf"}
              className="mt-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-xl transition-colors"
            >
              ⬇ Download PDF
            </a>
          </div>
        )}
        {/* No sandbox — required for browser PDF plugin to work */}
        <iframe
          src={previewUrl}
          className="w-full h-full border-0"
          title={assignment.title}
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
      <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center text-3xl mb-4">
        {filtered ? "🔍" : "📋"}
      </div>
      <h3 className="font-black text-slate-800 text-base mb-1">
        {filtered ? "No assignments match your search" : "No assignments yet"}
      </h3>
      <p className="text-slate-500 text-sm max-w-xs">
        {filtered
          ? "Try adjusting your search terms or filters."
          : "Create your first assignment to get started."}
      </p>
    </div>
  );
}

// ─── Assignment Modal (Create / Edit) ─────────────────────────────────────────
function AssignmentModal({
  mode,
  assignment,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  assignment?: Assignment;
  onClose: () => void;
  onSaved: (saved: Assignment) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [removeFile, setRemoveFile] = useState(false);

  const isEdit = mode === "edit";

  // Form state
  const [title, setTitle] = useState(assignment?.title ?? "");
  const [subject, setSubject] = useState(assignment?.subject ?? "");
  const [topic, setTopic] = useState(assignment?.topic ?? "");
  const [instructions, setInstructions] = useState(
    assignment?.instructions ?? "",
  );
  const [classLevel, setClassLevel] = useState(assignment?.classLevel ?? "All");
  const [dueDate, setDueDate] = useState(
    assignment?.dueDate ? toDatetimeLocal(assignment.dueDate) : "",
  );
  const [totalMarks, setTotalMarks] = useState(
    String(assignment?.totalMarks ?? 100),
  );
  const [allowLate, setAllowLate] = useState(
    assignment?.allowLateSubmission ?? false,
  );
  const [status, setStatus] = useState<"draft" | "published" | "closed">(
    assignment?.status ?? "published",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
    setRemoveFile(false);
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
    if (!dueDate) {
      toast.error("Due date is required.");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("subject", subject);
      fd.append("topic", topic.trim());
      fd.append("instructions", instructions.trim());
      fd.append("classLevel", classLevel);
      fd.append("dueDate", new Date(dueDate).toISOString());
      fd.append("totalMarks", totalMarks);
      fd.append("allowLateSubmission", String(allowLate));
      fd.append("status", status);
      if (selectedFile) fd.append("file", selectedFile);
      if (removeFile) fd.append("removeFile", "true");

      const url = isEdit
        ? `/api/assignment/${assignment!._id}`
        : "/api/assignment";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(
        isEdit ? "Assignment updated!" : "Assignment created successfully!",
      );
      onSaved(data.data);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const currentFileName = assignment?.fileName;
  const hasExistingFile = isEdit && currentFileName && !removeFile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-violet-600 to-purple-700 px-6 py-5 flex items-center justify-between rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              {isEdit ? "✏️" : "📋"}
            </div>
            <div>
              <h2 className="font-black text-white text-base">
                {isEdit ? "Edit Assignment" : "Create Assignment"}
              </h2>
              <p className="text-purple-200 text-xs">
                Optional PDF attachment · Max 20MB
              </p>
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
              placeholder="e.g. End of Term Mathematics Assignment"
              required
              disabled={saving}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all disabled:opacity-60"
            />
          </div>

          {/* Subject + Class Level */}
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
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all bg-white disabled:opacity-60"
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
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all bg-white disabled:opacity-60"
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
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all disabled:opacity-60"
            />
          </div>

          {/* Due Date + Total Marks */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Due Date <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Marks
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {/* Status + Allow Late */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Status
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "draft" | "published" | "closed")
                }
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all bg-white disabled:opacity-60"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Late Submissions
              </label>
              <button
                type="button"
                onClick={() => setAllowLate((p) => !p)}
                disabled={saving}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all disabled:opacity-60 ${
                  allowLate
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span>{allowLate ? "Allowed" : "Not allowed"}</span>
                <div
                  className={`w-9 h-5 rounded-full transition-colors relative ${allowLate ? "bg-violet-500" : "bg-slate-300"}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${allowLate ? "left-4" : "left-0.5"}`}
                  />
                </div>
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Describe what students need to do, submission requirements, marking criteria…"
              rows={4}
              disabled={saving}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all disabled:opacity-60 resize-none"
            />
          </div>

          {/* File Attachment */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              PDF Attachment{" "}
              <span className="text-slate-400 normal-case font-normal ml-1">
                (optional)
              </span>
            </label>

            {/* Show existing file chip in edit mode */}
            {hasExistingFile && (
              <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-lg">
                  PDF
                </span>
                <span className="text-xs text-violet-700 truncate flex-1 font-medium">
                  {currentFileName}
                </span>
                <button
                  type="button"
                  onClick={() => setRemoveFile(true)}
                  className="text-xs text-red-500 hover:text-red-700 font-bold shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Drop zone — shown when no existing file, or when replacing */}
            {(!hasExistingFile || selectedFile) && (
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
                    ? "border-violet-400 bg-violet-50"
                    : selectedFile
                      ? "border-green-300 bg-green-50"
                      : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/40"
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
                        if (removeFile) setRemoveFile(false);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
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
                      <span className="text-violet-600 font-bold">browse</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      PDF only · Max 20MB
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Replace button when existing file is present and no new file selected */}
            {hasExistingFile && !selectedFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-violet-600 hover:text-violet-700 underline text-left"
              >
                Replace with a different PDF
              </button>
            )}
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
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl shadow-md transition-all"
            >
              {saving ? (
                <>
                  <Spinner sm />
                  {isEdit ? "Saving…" : "Creating…"}
                </>
              ) : isEdit ? (
                "💾 Save Changes"
              ) : (
                "📋 Create Assignment"
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
  assignment,
  onClose,
  onDeleted,
}: {
  assignment: Assignment;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/assignment/${assignment._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Assignment deleted.");
      onDeleted(assignment._id);
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
              Delete Assignment?
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
          <p className="font-bold text-slate-800 text-sm truncate">
            {assignment.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {assignment.subject} · Due {formatDate(assignment.dueDate)}
          </p>
        </div>
        <p className="text-sm text-slate-600">
          All student submissions for this assignment will also be permanently
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

// ─── Assignment Card ──────────────────────────────────────────────────────────
function AssignmentCard({
  assignment,
  onPreview,
  onEdit,
  onDelete,
}: {
  assignment: Assignment;
  onPreview: (a: Assignment) => void;
  onEdit: (a: Assignment) => void;
  onDelete: (a: Assignment) => void;
}) {
  const levelColors: Record<string, string> = {
    "SHS 1": "bg-blue-100 text-blue-700",
    "SHS 2": "bg-indigo-100 text-indigo-700",
    "SHS 3": "bg-violet-100 text-violet-700",
    All: "bg-green-100 text-green-700",
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    published: {
      label: "Published",
      className: "bg-green-100 text-green-700",
    },
    draft: { label: "Draft", className: "bg-amber-100 text-amber-700" },
    closed: { label: "Closed", className: "bg-slate-100 text-slate-600" },
  };

  const due = formatDueDate(assignment.dueDate);
  const dueBadgeClass: Record<string, string> = {
    overdue: "bg-red-100 text-red-700",
    today: "bg-orange-100 text-orange-700",
    soon: "bg-amber-100 text-amber-700",
    normal: "bg-slate-100 text-slate-600",
  };

  const sc = statusConfig[assignment.status] ?? statusConfig.published;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1 bg-linear-to-r from-violet-500 to-purple-500" />

      <div className="p-4 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-lg shrink-0">
            📋
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
              {assignment.title}
            </h3>
            {assignment.topic && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {assignment.topic}
              </p>
            )}
          </div>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-full">
            {assignment.subject}
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${levelColors[assignment.classLevel] ?? "bg-slate-100 text-slate-600"}`}
          >
            {assignment.classLevel}
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${sc.className}`}
          >
            {sc.label}
          </span>
        </div>

        {/* Instructions preview */}
        {assignment.instructions && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {assignment.instructions}
          </p>
        )}

        {/* Due date + marks row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${dueBadgeClass[due.badge]}`}
          >
            📅 {due.label}
          </span>
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
            {assignment.totalMarks} marks
          </span>
          {assignment.allowLateSubmission && (
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
              Late allowed
            </span>
          )}
        </div>

        {/* Attached file row (if any) */}
        {assignment.fileName && (
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
            <span className="text-xs font-bold text-violet-600 uppercase bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100">
              PDF
            </span>
            <span className="text-xs text-slate-500 truncate flex-1">
              {assignment.fileName}
            </span>
            {assignment.fileSize && (
              <span className="text-xs text-slate-400 shrink-0">
                {formatFileSize(assignment.fileSize)}
              </span>
            )}
          </div>
        )}

        {/* Stats + date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              👁 <span className="font-semibold">{assignment.views}</span>
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              📝{" "}
              <span className="font-semibold">
                {assignment.submissionsCount}
              </span>{" "}
              submitted
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {formatDate(assignment.createdAt)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1 border-t border-slate-50">
          {/* Preview only enabled when there's an attached file */}
          <button
            onClick={() => assignment.fileName && onPreview(assignment)}
            disabled={!assignment.fileName}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl transition-colors ${
              assignment.fileName
                ? "text-violet-700 bg-violet-50 hover:bg-violet-100"
                : "text-slate-400 bg-slate-50 cursor-not-allowed"
            }`}
            title={
              assignment.fileName ? "Preview PDF" : "No attachment to preview"
            }
          >
            👁 Preview
          </button>
          <button
            onClick={() => onEdit(assignment)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-xl transition-colors"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => onDelete(assignment)}
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
export default function InstructorAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editAssignment, setEditAssignment] = useState<Assignment | undefined>(
    undefined,
  );
  const [deleteAssignment, setDeleteAssignment] = useState<
    Assignment | undefined
  >(undefined);
  const [previewAssignment, setPreviewAssignment] = useState<
    Assignment | undefined
  >(undefined);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterSubject, filterClass, filterStatus, sort]);

  // Fetch assignments
  const fetchAssignments = useCallback(async () => {
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
      });
      const res = await fetch(`/api/assignment?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAssignments(data.data);
      setPagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, filterSubject, filterClass, filterStatus]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSaved = (saved: Assignment) => {
    setShowModal(false);
    setEditAssignment(undefined);
    if (editAssignment) {
      setAssignments((prev) =>
        prev.map((a) => (a._id === saved._id ? saved : a)),
      );
    } else {
      setAssignments((prev) => [saved, ...prev]);
      setPagination((prev) =>
        prev ? { ...prev, total: prev.total + 1 } : prev,
      );
    }
  };

  const handleDeleted = (id: string) => {
    setDeleteAssignment(undefined);
    setAssignments((prev) => prev.filter((a) => a._id !== id));
    setPagination((prev) =>
      prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev,
    );
  };

  const isFiltered = !!(
    debouncedSearch ||
    filterSubject ||
    filterClass ||
    filterStatus
  );

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl shadow-sm">
            📋
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Assignments
            </h1>
            <p className="text-slate-500 text-sm">
              {pagination
                ? `${pagination.total} assignment${pagination.total !== 1 ? "s" : ""}`
                : "Create and manage assignments for students"}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditAssignment(undefined);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-linear-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm shrink-0"
        >
          + Create Assignment
        </button>
      </div>

      {/* ── Filters Bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
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
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white transition-all min-w-40"
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
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white transition-all min-w-36"
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
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white transition-all min-w-36"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white transition-all min-w-36"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="title">Title A–Z</option>
          <option value="dueDate">Due Date</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => {
              setSearch("");
              setFilterSubject("");
              setFilterClass("");
              setFilterStatus("");
              setSort("newest");
            }}
            className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Assignments Grid ─────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 h-72 animate-pulse"
            />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((a) => (
            <AssignmentCard
              key={a._id}
              assignment={a}
              onPreview={(a) => setPreviewAssignment(a)}
              onEdit={(a) => {
                setEditAssignment(a);
                setShowModal(true);
              }}
              onDelete={(a) => setDeleteAssignment(a)}
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
            assignments
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                        ? "bg-linear-to-r from-violet-600 to-purple-600 text-white shadow-md"
                        : "border border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {showModal && (
        <AssignmentModal
          mode={editAssignment ? "edit" : "create"}
          assignment={editAssignment}
          onClose={() => {
            setShowModal(false);
            setEditAssignment(undefined);
          }}
          onSaved={handleSaved}
        />
      )}
      {deleteAssignment && (
        <DeleteConfirm
          assignment={deleteAssignment}
          onClose={() => setDeleteAssignment(undefined)}
          onDeleted={handleDeleted}
        />
      )}
      {previewAssignment && (
        <PDFPreviewModal
          assignment={previewAssignment}
          onClose={() => setPreviewAssignment(undefined)}
        />
      )}
    </div>
  );
}
