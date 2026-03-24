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

interface Submission {
  _id: string;
  assignment: string;
  submittedAt: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  note: string;
  status: "submitted" | "graded" | "returned";
  score: number | null;
  feedback: string | null;
  isLate: boolean;
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDueInfo(iso: string): {
  label: string;
  badge: "overdue" | "today" | "soon" | "normal";
  isPast: boolean;
} {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formatted = formatDateTime(iso);

  if (diffDays < 0)
    return { label: `Overdue · ${formatted}`, badge: "overdue", isPast: true };
  if (diffDays === 0)
    return { label: "Due today", badge: "today", isPast: false };
  if (diffDays <= 3)
    return {
      label: `${diffDays}d left · ${formatted}`,
      badge: "soon",
      isPast: false,
    };
  return { label: formatted, badge: "normal", isPast: false };
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
          ? "Try adjusting your filters."
          : "Your instructor hasn't posted any assignments yet. Check back soon."}
      </p>
    </div>
  );
}

// ─── PDF Preview Modal ────────────────────────────────────────────────────────
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
      <div className="bg-linear-to-r from-violet-600 to-purple-700 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-base shrink-0">
          📋
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">
            {assignment.title}
          </p>
          <p className="text-purple-200 text-xs">
            {assignment.subject} · {assignment.fileName}
            {assignment.fileSize
              ? ` · ${formatFileSize(assignment.fileSize)}`
              : ""}
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
        <p className="text-xs text-slate-500">Press ESC or ✕ to close</p>
        <p className="text-xs text-slate-500">{assignment.subject}</p>
      </div>
    </div>
  );
}

// ─── Assignment Detail Modal ──────────────────────────────────────────────────
// Shows full details + submission status + submit form
function AssignmentDetailModal({
  assignment,
  submission,
  onClose,
  onSubmitted,
  onPreviewPdf,
}: {
  assignment: Assignment;
  submission: Submission | null;
  onClose: () => void;
  onSubmitted: (sub: Submission) => void;
  onPreviewPdf: (a: Assignment) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "submit" | "result">(
    submission?.status === "graded" || submission?.status === "returned"
      ? "result"
      : submission
        ? "submit"
        : "details",
  );

  const due = getDueInfo(assignment.dueDate);
  const isClosed = assignment.status === "closed";
  const isSubmitted = !!submission;
  const canSubmit =
    !isClosed &&
    (!isSubmitted || submission?.status === "returned") &&
    (!due.isPast || assignment.allowLateSubmission);

  const dueBadgeClass: Record<string, string> = {
    overdue: "bg-red-100 text-red-700",
    today: "bg-orange-100 text-orange-700",
    soon: "bg-amber-100 text-amber-700",
    normal: "bg-slate-100 text-slate-600",
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleFile = (file: File) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Accepted file types: PDF, JPG, PNG, WEBP, DOC, DOCX");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File must be smaller than 25MB.");
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !note.trim()) {
      toast.error("Please attach a file or write a note before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("assignmentId", assignment._id);
      fd.append("note", note.trim());
      if (selectedFile) fd.append("file", selectedFile);

      const res = await fetch("/api/submission", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Assignment submitted successfully! 🎉");
      onSubmitted(data.data);
      setActiveTab("submit");
    } catch (err: any) {
      toast.error(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const TABS = [
    { id: "details" as const, label: "Details", icon: "📋" },
    {
      id: "submit" as const,
      label: isSubmitted ? "My Submission" : "Submit",
      icon: isSubmitted ? "✅" : "📤",
    },
    ...(submission?.status === "graded" || submission?.status === "returned"
      ? [{ id: "result" as const, label: "Result", icon: "🏆" }]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-violet-600 to-purple-700 px-5 py-4 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold text-purple-200 bg-white/15 px-2 py-0.5 rounded-full">
                {assignment.subject}
              </span>
              <span className="text-xs font-bold text-purple-200 bg-white/15 px-2 py-0.5 rounded-full">
                {assignment.classLevel}
              </span>
              {assignment.status === "closed" && (
                <span className="text-xs font-bold text-red-200 bg-red-500/30 px-2 py-0.5 rounded-full">
                  Closed
                </span>
              )}
            </div>
            <h2 className="font-black text-white text-base leading-snug">
              {assignment.title}
            </h2>
            {assignment.topic && (
              <p className="text-purple-200 text-xs mt-0.5">
                {assignment.topic}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-slate-100 bg-slate-50 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 ${
                activeTab === tab.id
                  ? "border-violet-600 text-violet-700 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── DETAILS TAB ─────────────────────────────────────────── */}
          {activeTab === "details" && (
            <div className="px-5 py-5 flex flex-col gap-4">
              {/* Meta row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-2xl p-3 flex flex-col gap-1 border border-slate-100">
                  <p className="text-xs text-slate-400 font-semibold">
                    Due Date
                  </p>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-lg w-fit ${dueBadgeClass[due.badge]}`}
                  >
                    📅{" "}
                    {due.badge === "overdue"
                      ? "Overdue"
                      : due.badge === "today"
                        ? "Today"
                        : due.badge === "soon"
                          ? `${Math.ceil((new Date(assignment.dueDate).getTime() - Date.now()) / 86400000)}d left`
                          : "On time"}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDateTime(assignment.dueDate)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 flex flex-col gap-1 border border-slate-100">
                  <p className="text-xs text-slate-400 font-semibold">
                    Total Marks
                  </p>
                  <p className="text-2xl font-black text-violet-700">
                    {assignment.totalMarks}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 flex flex-col gap-1 border border-slate-100">
                  <p className="text-xs text-slate-400 font-semibold">
                    Late Work
                  </p>
                  <p
                    className={`text-sm font-bold ${assignment.allowLateSubmission ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {assignment.allowLateSubmission
                      ? "✓ Allowed"
                      : "✗ Not allowed"}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 flex flex-col gap-1 border border-slate-100">
                  <p className="text-xs text-slate-400 font-semibold">
                    My Status
                  </p>
                  {isSubmitted ? (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit">
                      ✅ Submitted
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg w-fit">
                      ⏳ Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Instructions */}
              {assignment.instructions && (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Instructions
                  </h3>
                  <div className="bg-violet-50 border border-violet-100 rounded-2xl px-4 py-4">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {assignment.instructions}
                    </p>
                  </div>
                </div>
              )}

              {/* Attached PDF */}
              {assignment.fileName && (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Assignment Sheet
                  </h3>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-red-600">
                        PDF
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">
                        {assignment.fileName}
                      </p>
                      {assignment.fileSize && (
                        <p className="text-xs text-slate-400">
                          {formatFileSize(assignment.fileSize)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onPreviewPdf(assignment)}
                      className="text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-2 rounded-xl transition-colors shrink-0"
                    >
                      👁 View PDF
                    </button>
                  </div>
                </div>
              )}

              {/* CTA */}
              {!isSubmitted && canSubmit && (
                <button
                  onClick={() => setActiveTab("submit")}
                  className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 py-3.5 rounded-2xl shadow-md transition-all"
                >
                  📤 Submit Assignment
                </button>
              )}
              {isClosed && !isSubmitted && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3.5">
                  <span className="text-xl shrink-0">🔒</span>
                  <p className="text-sm text-red-700 font-semibold">
                    This assignment is closed. Submissions are no longer
                    accepted.
                  </p>
                </div>
              )}
              {due.isPast &&
                !assignment.allowLateSubmission &&
                !isSubmitted &&
                !isClosed && (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5">
                    <span className="text-xl shrink-0">⚠️</span>
                    <p className="text-sm text-amber-700 font-semibold">
                      The due date has passed and late submissions are not
                      allowed.
                    </p>
                  </div>
                )}
            </div>
          )}

          {/* ── SUBMIT TAB ──────────────────────────────────────────── */}
          {activeTab === "submit" && (
            <div className="px-5 py-5 flex flex-col gap-4">
              {/* Already submitted — show submission details */}
              {isSubmitted && submission && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4">
                    <span className="text-2xl shrink-0">✅</span>
                    <div>
                      <p className="font-bold text-emerald-800 text-sm">
                        Submitted successfully
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {formatDateTime(submission.submittedAt)}
                        {submission.isLate && (
                          <span className="ml-2 font-bold text-amber-600">
                            · Late submission
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Submitted file */}
                  {submission.fileName && (
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Submitted File
                      </h3>
                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 text-sm">
                          📎
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">
                            {submission.fileName}
                          </p>
                          {submission.fileSize && (
                            <p className="text-xs text-slate-400">
                              {formatFileSize(submission.fileSize)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submitted note */}
                  {submission.note && (
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        My Note
                      </h3>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {submission.note}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex-1">
                      Grading Status
                    </p>
                    {submission.status === "submitted" && (
                      <span className="text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 px-3 py-1 rounded-full">
                        ⏳ Awaiting review
                      </span>
                    )}
                    {submission.status === "graded" && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                        ✅ Graded
                      </span>
                    )}
                    {submission.status === "returned" && (
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                        🔄 Returned for revision
                      </span>
                    )}
                  </div>

                  {/* Re-submit if returned */}
                  {submission.status === "returned" && canSubmit && (
                    <div className="flex flex-col gap-3 border-2 border-dashed border-amber-300 bg-amber-50 rounded-2xl p-4">
                      <p className="text-sm font-bold text-amber-800">
                        🔄 Your submission was returned. You can resubmit below.
                      </p>
                      {submission.feedback && (
                        <div className="bg-white border border-amber-200 rounded-xl px-3 py-3">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Instructor feedback
                          </p>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {submission.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit form */}
              {canSubmit && (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <h3 className="text-sm font-black text-slate-800">
                    {isSubmitted && submission?.status === "returned"
                      ? "Resubmit Assignment"
                      : "Submit Your Work"}
                  </h3>

                  {/* File upload */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Attach File{" "}
                      <span className="text-slate-400 normal-case font-normal">
                        (PDF, Word, Image · max 25MB)
                      </span>
                    </label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files[0];
                        if (file) handleFile(file);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl px-4 py-6 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                        dragOver
                          ? "border-violet-400 bg-violet-50"
                          : selectedFile
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/40"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFile(f);
                        }}
                      />
                      <span className="text-3xl">
                        {selectedFile ? "✅" : dragOver ? "📂" : "📎"}
                      </span>
                      {selectedFile ? (
                        <>
                          <p className="text-sm font-bold text-emerald-700 text-center truncate max-w-xs">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-emerald-600">
                            {formatFileSize(selectedFile.size)}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
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
                            <span className="text-violet-600 font-bold">
                              browse
                            </span>
                          </p>
                          <p className="text-xs text-slate-400">
                            PDF, Word, JPG, PNG · Max 25MB
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Note */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Note to instructor{" "}
                      <span className="text-slate-400 normal-case font-normal">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add any comments or notes about your submission…"
                      rows={3}
                      disabled={submitting}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 resize-none"
                    />
                  </div>

                  {/* Late warning */}
                  {due.isPast && assignment.allowLateSubmission && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <span className="text-base shrink-0">⚠️</span>
                      <p className="text-xs text-amber-700 font-semibold">
                        The due date has passed. This will be marked as a late
                        submission.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || (!selectedFile && !note.trim())}
                    className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 rounded-2xl shadow-md transition-all"
                  >
                    {submitting ? (
                      <>
                        <Spinner sm />
                        Submitting…
                      </>
                    ) : (
                      "📤 Submit Assignment"
                    )}
                  </button>
                </form>
              )}

              {/* Cannot submit messaging */}
              {!canSubmit && !isSubmitted && (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <span className="text-4xl">🔒</span>
                  <p className="font-bold text-slate-700">
                    Submissions not available
                  </p>
                  <p className="text-sm text-slate-500 max-w-xs">
                    {isClosed
                      ? "This assignment has been closed by your instructor."
                      : "The due date has passed and late submissions are not allowed."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── RESULT TAB ──────────────────────────────────────────── */}
          {activeTab === "result" && submission && (
            <div className="px-5 py-5 flex flex-col gap-4">
              {submission.score !== null ? (
                <>
                  {/* Score card */}
                  <div className="bg-linear-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-3xl p-6 text-center">
                    <p className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-2">
                      Your Score
                    </p>
                    <div className="flex items-end justify-center gap-2">
                      <span className="text-6xl font-black text-violet-700">
                        {submission.score}
                      </span>
                      <span className="text-2xl font-bold text-slate-400 mb-2">
                        / {assignment.totalMarks}
                      </span>
                    </div>
                    <div className="mt-3 w-full bg-violet-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-violet-500 to-purple-600 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (submission.score / assignment.totalMarks) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-violet-500 mt-2 font-semibold">
                      {Math.round(
                        (submission.score / assignment.totalMarks) * 100,
                      )}
                      % ·{" "}
                      {submission.score / assignment.totalMarks >= 0.8
                        ? "Excellent work! 🌟"
                        : submission.score / assignment.totalMarks >= 0.6
                          ? "Good effort! 👍"
                          : "Keep working hard! 💪"}
                    </p>
                  </div>

                  {/* Feedback */}
                  {submission.feedback && (
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Instructor Feedback
                      </h3>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4">
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {submission.feedback}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <span className="text-4xl">⏳</span>
                  <p className="font-bold text-slate-700">
                    Grading in progress
                  </p>
                  <p className="text-sm text-slate-500">
                    Your instructor hasn't added a score yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3.5 flex items-center justify-between bg-white shrink-0">
          <p className="text-xs text-slate-400">
            Posted {formatDate(assignment.createdAt)}
          </p>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assignment Card ──────────────────────────────────────────────────────────
function AssignmentCard({
  assignment,
  submission,
  onClick,
}: {
  assignment: Assignment;
  submission: Submission | null;
  onClick: () => void;
}) {
  const due = getDueInfo(assignment.dueDate);

  const dueBadgeClass: Record<string, string> = {
    overdue: "bg-red-100 text-red-700",
    today: "bg-orange-100 text-orange-700",
    soon: "bg-amber-100 text-amber-700",
    normal: "bg-slate-100 text-slate-600",
  };

  const levelColors: Record<string, string> = {
    "SHS 1": "bg-blue-100 text-blue-700",
    "SHS 2": "bg-indigo-100 text-indigo-700",
    "SHS 3": "bg-violet-100 text-violet-700",
    All: "bg-green-100 text-green-700",
  };

  const getSubmissionBadge = () => {
    if (!submission) return null;
    if (submission.status === "graded" && submission.score !== null) {
      return (
        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
          🏆 {submission.score}/{assignment.totalMarks}
        </span>
      );
    }
    if (submission.status === "returned") {
      return (
        <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full">
          🔄 Returned
        </span>
      );
    }
    return (
      <span className="text-xs font-bold text-sky-700 bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-full">
        ✅ Submitted
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden cursor-pointer group"
    >
      {/* Accent bar */}
      <div
        className={`h-1 ${assignment.status === "closed" ? "bg-slate-300" : "bg-linear-to-r from-violet-500 to-purple-500"}`}
      />

      <div className="p-4 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-colors ${submission ? "bg-emerald-50 border border-emerald-100" : "bg-violet-50 border border-violet-100"}`}
          >
            {submission ? "✅" : "📋"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-violet-700 transition-colors">
              {assignment.title}
            </h3>
            {assignment.topic && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {assignment.topic}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-full">
            {assignment.subject}
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${levelColors[assignment.classLevel] ?? "bg-slate-100 text-slate-600"}`}
          >
            {assignment.classLevel}
          </span>
          {assignment.status === "closed" && (
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              🔒 Closed
            </span>
          )}
          {getSubmissionBadge()}
        </div>

        {/* Instructions preview */}
        {assignment.instructions && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {assignment.instructions}
          </p>
        )}

        {/* Due + marks */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${dueBadgeClass[due.badge]}`}
          >
            📅 {due.label}
          </span>
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
            {assignment.totalMarks} marks
          </span>
          {assignment.allowLateSubmission && !submission && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              Late OK
            </span>
          )}
        </div>

        {/* File chip */}
        {assignment.fileName && (
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
            <span className="text-xs font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded-lg border border-red-100">
              PDF
            </span>
            <span className="text-xs text-slate-500 truncate flex-1">
              {assignment.fileName}
            </span>
          </div>
        )}

        {/* CTA row */}
        <div className="pt-1 border-t border-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {formatDate(assignment.createdAt)}
          </span>
          <span className="text-xs font-bold text-violet-600 group-hover:text-violet-700 flex items-center gap-1">
            {submission ? "View details" : "Open →"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentsAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  // Map of assignmentId → submission (null = not submitted)
  const [submissionsMap, setSubmissionsMap] = useState<
    Record<string, Submission | null>
  >({});

  // Filters
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterStatus, setFilterStatus] = useState(""); // "pending" | "submitted" | ""
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modals
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);
  const [previewAssignment, setPreviewAssignment] = useState<Assignment | null>(
    null,
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterSubject, filterClass, filterStatus, sort]);

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
        status: "published", // students only see published
      });
      const res = await fetch(`/api/students/assignment?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAssignments(data.data);
      setPagination(data.pagination);

      // Fetch submission status for all returned assignments
      if (data.data.length > 0) {
        const ids: string[] = data.data.map((a: Assignment) => a._id);
        fetchSubmissions(ids);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, filterSubject, filterClass]);

  const fetchSubmissions = async (assignmentIds: string[]) => {
    try {
      const res = await fetch(
        `/api/submission/bulk?ids=${assignmentIds.join(",")}`,
      );
      const data = await res.json();
      if (res.ok && data.data) {
        const map: Record<string, Submission | null> = {};
        assignmentIds.forEach((id) => {
          map[id] = null;
        });
        data.data.forEach((sub: Submission) => {
          map[sub.assignment] = sub;
        });
        setSubmissionsMap((prev) => ({ ...prev, ...map }));
      }
    } catch {
      // silently ignore — submissions are non-critical to rendering
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSubmitted = (sub: Submission) => {
    setSubmissionsMap((prev) => ({ ...prev, [sub.assignment]: sub }));
    if (selectedAssignment) {
      // Refresh the selected assignment data (view count etc.)
      setSelectedAssignment((prev) => prev);
    }
  };

  const isFiltered = !!(
    debouncedSearch ||
    filterSubject ||
    filterClass ||
    filterStatus
  );

  // Client-side filter for submitted/pending (since API gives published ones)
  const filteredAssignments =
    filterStatus === "submitted"
      ? assignments.filter((a) => !!submissionsMap[a._id])
      : filterStatus === "pending"
        ? assignments.filter((a) => !submissionsMap[a._id])
        : assignments;

  const submittedCount = assignments.filter(
    (a) => !!submissionsMap[a._id],
  ).length;
  const pendingCount = assignments.filter((a) => !submissionsMap[a._id]).length;

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
                : "View and submit your assignments"}
            </p>
          </div>
        </div>

        {/* Summary chips */}
        {!loading && assignments.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setFilterStatus(filterStatus === "pending" ? "" : "pending")
              }
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                filterStatus === "pending"
                  ? "bg-amber-100 border-amber-300 text-amber-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-amber-50"
              }`}
            >
              ⏳ {pendingCount} pending
            </button>
            <button
              onClick={() =>
                setFilterStatus(filterStatus === "submitted" ? "" : "submitted")
              }
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                filterStatus === "submitted"
                  ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-emerald-50"
              }`}
            >
              ✅ {submittedCount} submitted
            </button>
          </div>
        )}
      </div>

      {/* ── Filters Bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
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
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-40"
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
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-32"
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
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-36"
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

      {/* ── Grid ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 h-72 animate-pulse"
            />
          ))}
        </div>
      ) : filteredAssignments.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map((a) => (
            <AssignmentCard
              key={a._id}
              assignment={a}
              submission={submissionsMap[a._id] ?? null}
              onClick={() => setSelectedAssignment(a)}
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
                        : "border border-slate-200 text-slate-600 hover:bg-violet-50 hover:text-violet-700"
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
      {selectedAssignment && (
        <AssignmentDetailModal
          assignment={selectedAssignment}
          submission={submissionsMap[selectedAssignment._id] ?? null}
          onClose={() => setSelectedAssignment(null)}
          onSubmitted={handleSubmitted}
          onPreviewPdf={(a) => {
            setPreviewAssignment(a);
          }}
        />
      )}
      {previewAssignment && (
        <PDFPreviewModal
          assignment={previewAssignment}
          onClose={() => setPreviewAssignment(null)}
        />
      )}
    </div>
  );
}
