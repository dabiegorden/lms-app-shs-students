"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type TargetType = "all" | "class" | "subject" | "course";
type AnnouncementStatus = "draft" | "published";

interface Attachment {
  publicId: string;
  url: string;
  originalName: string;
  resourceType: "image" | "video" | "raw";
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

interface Author {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface Announcement {
  _id: string;
  title: string;
  body: string;
  attachments: Attachment[];
  instructor: Author;
  targetType: TargetType;
  targetClassLevel: string[];
  targetSubjects: string[];
  isPinned: boolean;
  allowComments: boolean;
  status: AnnouncementStatus;
  publishedAt: string | null;
  viewsCount: number;
  commentsCount: number;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  _id: string;
  announcement: string;
  author: Author;
  authorRole: "student" | "instructor";
  body: string;
  attachments: Attachment[];
  parentComment: string | null;
  repliesCount: number;
  likesCount: number;
  isEdited: boolean;
  editedAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  replies?: Comment[];
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
const CLASS_LEVELS = ["SHS 1", "SHS 2", "SHS 3"];
const MAX_FILES = 5;
const MAX_FILE_MB = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(format: string, resourceType: string) {
  if (resourceType === "image") return "🖼️";
  if (resourceType === "video") return "🎬";
  const f = format.toLowerCase();
  if (f === "pdf") return "📄";
  if (["doc", "docx"].includes(f)) return "📝";
  if (["xls", "xlsx"].includes(f)) return "📊";
  if (["ppt", "pptx"].includes(f)) return "📑";
  return "📎";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = "sm" }: { user: Author; size?: "sm" | "md" }) {
  const sz = size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  return user.avatar ? (
    <img
      src={user.avatar}
      alt={user.name}
      className={`${sz} rounded-full object-cover shrink-0`}
    />
  ) : (
    <div
      className={`${sz} rounded-full bg-linear-to-br from-violet-400 to-indigo-500 flex items-center justify-center font-black text-white shrink-0`}
    >
      {getInitials(user.name)}
    </div>
  );
}

// ─── Attachment Preview Strip ─────────────────────────────────────────────────
function AttachmentStrip({
  attachments,
  onRemove,
}: {
  attachments: (Attachment & { preview?: string; isNew?: boolean })[];
  onRemove?: (idx: number) => void;
}) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att, i) => (
        <div key={i} className="relative group">
          {att.resourceType === "image" ? (
            <div className="w-20 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <img
                src={att.preview || att.url}
                alt={att.originalName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 max-w-45">
              <span className="text-lg shrink-0">
                {getFileIcon(att.format, att.resourceType)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">
                  {att.originalName}
                </p>
                <p className="text-xs text-slate-400">
                  {formatBytes(att.bytes)}
                </p>
              </div>
            </div>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── File Picker Zone ─────────────────────────────────────────────────────────
function FilePickerZone({
  files,
  onAdd,
  onRemove,
  disabled,
  maxFiles = MAX_FILES,
}: {
  files: (File & { preview?: string })[];
  onAdd: (newFiles: File[]) => void;
  onRemove: (idx: number) => void;
  disabled: boolean;
  maxFiles?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (newFiles: File[]) => {
    const valid = newFiles.filter((f) => {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name}: must be under ${MAX_FILE_MB}MB`);
        return false;
      }
      return true;
    });
    if (files.length + valid.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed.`);
      return;
    }
    onAdd(valid);
  };

  if (files.length === 0) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-2 text-xs font-bold cursor-pointer px-3 py-2 rounded-xl border-2 border-dashed transition-all ${dragOver ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:border-slate-400 hover:bg-slate-50"}`}
      >
        <span>📎</span> Attach files
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) handleFiles(Array.from(e.target.files));
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => {
          const isImage = f.type.startsWith("image/");
          return (
            <div key={i} className="relative group">
              {isImage && (f as any).preview ? (
                <div className="w-20 h-16 rounded-xl overflow-hidden border border-slate-200">
                  <img
                    src={(f as any).preview}
                    alt={f.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 max-w-45">
                  <span className="text-base">
                    {getFileIcon(
                      f.name.split(".").pop() ?? "",
                      f.type.startsWith("image")
                        ? "image"
                        : f.type.startsWith("video")
                          ? "video"
                          : "raw",
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">
                      {f.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatBytes(f.size)}
                    </p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                ✕
              </button>
            </div>
          );
        })}
        {files.length < maxFiles && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="w-20 h-16 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-400 text-slate-400 hover:text-violet-600 flex items-center justify-center text-2xl transition-all"
          >
            +
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files) handleFiles(Array.from(e.target.files));
        }}
      />
    </div>
  );
}

// ─── Announcement Composer Modal ──────────────────────────────────────────────
function AnnouncementComposer({
  mode,
  announcement,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  announcement?: Announcement;
  onClose: () => void;
  onSaved: (a: Announcement) => void;
}) {
  const isEdit = mode === "edit";
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [status, setStatus] = useState<AnnouncementStatus>(
    announcement?.status ?? "published",
  );
  const [isPinned, setIsPinned] = useState(announcement?.isPinned ?? false);
  const [allowComments, setAllowComments] = useState(
    announcement?.allowComments !== false,
  );
  const [targetType, setTargetType] = useState<TargetType>(
    announcement?.targetType ?? "all",
  );
  const [targetClassLevel, setTargetClassLevel] = useState<string[]>(
    announcement?.targetClassLevel ?? [],
  );
  const [targetSubjects, setTargetSubjects] = useState<string[]>(
    announcement?.targetSubjects ?? [],
  );

  // Existing attachments (for edit mode)
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>(
    announcement?.attachments ?? [],
  );
  const [removedPublicIds, setRemovedPublicIds] = useState<string[]>([]);

  // New files to upload
  const [newFiles, setNewFiles] = useState<(File & { preview?: string })[]>([]);

  const handleAddFiles = (files: File[]) => {
    const withPreviews = files.map((f) => {
      const ff = f as File & { preview?: string };
      if (f.type.startsWith("image/")) {
        ff.preview = URL.createObjectURL(f);
      }
      return ff;
    });
    setNewFiles((prev) => [...prev, ...withPreviews]);
  };

  const handleRemoveNewFile = (idx: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveExisting = (publicId: string) => {
    setRemovedPublicIds((prev) => [...prev, publicId]);
    setExistingAttachments((prev) =>
      prev.filter((a) => a.publicId !== publicId),
    );
  };

  const totalAttachments = existingAttachments.length + newFiles.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!body.trim()) {
      toast.error("Body is required.");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("body", body.trim());
      fd.append("status", status);
      fd.append("isPinned", String(isPinned));
      fd.append("allowComments", String(allowComments));
      fd.append("targetType", targetType);
      fd.append("targetClassLevel", JSON.stringify(targetClassLevel));
      fd.append("targetSubjects", JSON.stringify(targetSubjects));
      newFiles.forEach((f) => fd.append("files", f));
      if (isEdit && removedPublicIds.length > 0) {
        fd.append("removeAttachments", JSON.stringify(removedPublicIds));
      }

      const url = isEdit
        ? `/api/announcement/${announcement!._id}`
        : "/api/announcement";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(isEdit ? "Announcement updated!" : "Announcement posted!");
      onSaved(data.data);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayItem = (
    arr: string[],
    setArr: (v: string[]) => void,
    item: string,
  ) => {
    setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const remainingFiles = MAX_FILES - totalAttachments;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-violet-600 to-purple-700 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              📢
            </div>
            <div>
              <h2 className="font-black text-white text-base">
                {isEdit ? "Edit Announcement" : "New Announcement"}
              </h2>
              <p className="text-violet-200 text-xs">
                Cloudinary · Up to 5 files · 25MB each
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 flex flex-col gap-5">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Important: Class schedule change for next week"
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all disabled:opacity-60"
              />
            </div>

            {/* Body */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Message <span className="text-red-400">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your announcement here. You can share updates, reminders, resources, or any important information for your students…"
                rows={6}
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all disabled:opacity-60 resize-none"
              />
              <p className="text-xs text-slate-400 text-right">
                {body.length}/10000
              </p>
            </div>

            {/* File attachments */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Attachments{" "}
                  <span className="text-slate-400 normal-case font-normal">
                    ({totalAttachments}/{MAX_FILES})
                  </span>
                </label>
                {totalAttachments > 0 && (
                  <span className="text-xs text-slate-400">
                    {remainingFiles} slot{remainingFiles !== 1 ? "s" : ""}{" "}
                    remaining
                  </span>
                )}
              </div>

              {/* Existing attachments in edit mode */}
              {isEdit && existingAttachments.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-slate-400 font-medium">
                    Current attachments:
                  </p>
                  <AttachmentStrip
                    attachments={existingAttachments}
                    onRemove={(i) =>
                      handleRemoveExisting(existingAttachments[i].publicId)
                    }
                  />
                </div>
              )}

              {/* New file picker */}
              {remainingFiles > 0 && (
                <FilePickerZone
                  files={newFiles}
                  onAdd={handleAddFiles}
                  onRemove={handleRemoveNewFile}
                  disabled={saving}
                  maxFiles={remainingFiles}
                />
              )}
            </div>

            {/* Targeting */}
            <div className="flex flex-col gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Audience
              </label>
              <div className="flex gap-2 flex-wrap">
                {(["all", "class", "subject"] as TargetType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTargetType(t)}
                    disabled={saving}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${targetType === t ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"}`}
                  >
                    {t === "all"
                      ? "🌐 All Students"
                      : t === "class"
                        ? "🏫 By Class"
                        : "📚 By Subject"}
                  </button>
                ))}
              </div>

              {targetType === "class" && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-slate-500 font-medium">
                    Select classes:
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {CLASS_LEVELS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          toggleArrayItem(
                            targetClassLevel,
                            setTargetClassLevel,
                            c,
                          )
                        }
                        disabled={saving}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${targetClassLevel.includes(c) ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {targetType === "subject" && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-slate-500 font-medium">
                    Select subjects:
                  </p>
                  <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          toggleArrayItem(targetSubjects, setTargetSubjects, s)
                        }
                        disabled={saving}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${targetSubjects.includes(s) ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Settings row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as AnnouncementStatus)
                  }
                  disabled={saving}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:opacity-60"
                >
                  <option value="published">Published</option>
                  <option value="draft">Save as Draft</option>
                </select>
              </div>

              {/* Pin */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pin
                </label>
                <button
                  type="button"
                  onClick={() => setIsPinned((p) => !p)}
                  disabled={saving}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all disabled:opacity-60 ${isPinned ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  <span>{isPinned ? "📌 Pinned" : "Pin"}</span>
                  <div
                    className={`w-8 h-4 rounded-full relative transition-colors ${isPinned ? "bg-amber-500" : "bg-slate-300"}`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${isPinned ? "left-4" : "left-0.5"}`}
                    />
                  </div>
                </button>
              </div>

              {/* Comments */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Comments
                </label>
                <button
                  type="button"
                  onClick={() => setAllowComments((p) => !p)}
                  disabled={saving}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all disabled:opacity-60 ${allowComments ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  <span>{allowComments ? "Open" : "Closed"}</span>
                  <div
                    className={`w-8 h-4 rounded-full relative transition-colors ${allowComments ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${allowComments ? "left-4" : "left-0.5"}`}
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 shrink-0">
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
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 disabled:opacity-50 py-3 rounded-xl shadow-md transition-all"
            >
              {saving ? (
                <>
                  <Spinner sm />
                  {isEdit ? "Saving…" : "Posting…"}
                </>
              ) : isEdit ? (
                "💾 Save Changes"
              ) : (
                "📢 Post Announcement"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Comment Input ────────────────────────────────────────────────────────────
function CommentInput({
  announcementId,
  parentCommentId = null,
  onPosted,
  onCancel,
  placeholder = "Write a comment…",
}: {
  announcementId: string;
  parentCommentId?: string | null;
  onPosted: (comment: Comment) => void;
  onCancel?: () => void;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<(File & { preview?: string })[]>([]);
  const [posting, setPosting] = useState(false);

  const handleFiles = (newFiles: File[]) => {
    const withPreviews = newFiles.map((f) => {
      const ff = f as File & { preview?: string };
      if (f.type.startsWith("image/")) ff.preview = URL.createObjectURL(f);
      return ff;
    });
    setFiles((prev) => [...prev, ...withPreviews].slice(0, 3));
  };

  const handlePost = async () => {
    if (!body.trim() && files.length === 0) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append("body", body.trim());
      if (parentCommentId) fd.append("parentComment", parentCommentId);
      files.forEach((f) => fd.append("files", f));

      const res = await fetch(`/api/announcement/${announcementId}/comments`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setBody("");
      setFiles([]);
      onPosted(data.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={2}
        disabled={posting}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none disabled:opacity-60 transition-all"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost();
        }}
      />

      <FilePickerZone
        files={files}
        onAdd={handleFiles}
        onRemove={(i) => setFiles((p) => p.filter((_, idx) => idx !== i))}
        disabled={posting}
        maxFiles={3}
      />

      <div className="flex items-center gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={posting}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handlePost}
          disabled={posting || (!body.trim() && files.length === 0)}
          className="flex items-center gap-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 rounded-xl transition-all"
        >
          {posting ? (
            <>
              <Spinner sm />
              Posting…
            </>
          ) : (
            "Post"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Comment Thread ───────────────────────────────────────────────────────────
function CommentThread({
  comment,
  announcementId,
  currentUserId,
  onDeleted,
}: {
  comment: Comment;
  announcementId: string;
  currentUserId: string;
  onDeleted: (id: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replies, setReplies] = useState<Comment[]>(comment.replies ?? []);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this comment?")) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/announcement/${announcementId}/comments/${comment._id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onDeleted(comment._id);
      toast.success("Comment deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const isOwn = comment.author._id === currentUserId;
  const roleColor =
    comment.authorRole === "instructor"
      ? "bg-violet-100 text-violet-700"
      : "bg-sky-100 text-sky-700";

  return (
    <div className="flex gap-3">
      <Avatar user={comment.author} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800 text-sm">
            {comment.author.name}
          </span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${roleColor}`}
          >
            {comment.authorRole}
          </span>
          <span className="text-xs text-slate-400">
            {formatDate(comment.createdAt)}
          </span>
          {comment.isEdited && (
            <span className="text-xs text-slate-400 italic">(edited)</span>
          )}
        </div>

        <p className="text-sm text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </p>

        {comment.attachments.length > 0 && (
          <AttachmentStrip attachments={comment.attachments} />
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => setShowReply((p) => !p)}
            className="text-xs font-bold text-slate-500 hover:text-violet-600 transition-colors"
          >
            ↩ Reply
          </button>
          {replies.length > 0 && (
            <span className="text-xs text-slate-400">
              {replies.length} repl{replies.length !== 1 ? "ies" : "y"}
            </span>
          )}
          {isOwn && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-bold text-slate-400 hover:text-red-600 transition-colors ml-auto disabled:opacity-40"
            >
              {deleting ? "…" : "Delete"}
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReply && (
          <div className="mt-3 pl-2 border-l-2 border-violet-100">
            <CommentInput
              announcementId={announcementId}
              parentCommentId={comment._id}
              onPosted={(newReply) => {
                setReplies((p) => [...p, newReply]);
                setShowReply(false);
              }}
              onCancel={() => setShowReply(false)}
              placeholder={`Reply to ${comment.author.name}…`}
            />
          </div>
        )}

        {/* Nested replies */}
        {replies.length > 0 && (
          <div className="mt-3 flex flex-col gap-3 pl-3 border-l-2 border-slate-100">
            {replies.map((reply) => (
              <CommentThread
                key={reply._id}
                comment={reply}
                announcementId={announcementId}
                currentUserId={currentUserId}
                onDeleted={(rid) =>
                  setReplies((p) => p.filter((r) => r._id !== rid))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Announcement Card (Feed Item) ────────────────────────────────────────────
function AnnouncementCard({
  announcement,
  currentUserId,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  announcement: Announcement;
  currentUserId: string;
  onEdit: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
  onTogglePin: (a: Announcement) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsPagination, setCommentsPagination] =
    useState<Pagination | null>(null);
  const [expanded, setExpanded] = useState(false);

  const isLong = announcement.body.length > 280;
  const displayBody =
    !expanded && isLong
      ? announcement.body.slice(0, 280) + "…"
      : announcement.body;

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(
        `/api/announcement/${announcement._id}/comments?limit=20`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setComments(data.data);
      setCommentsPagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load comments.");
    } finally {
      setCommentsLoading(false);
    }
  }, [announcement._id]);

  const handleToggleComments = () => {
    if (!showComments && comments.length === 0) loadComments();
    setShowComments((p) => !p);
  };

  const targetBadge = () => {
    if (announcement.targetType === "all")
      return { label: "All Students", cls: "bg-green-100 text-green-700" };
    if (announcement.targetType === "class")
      return {
        label: announcement.targetClassLevel.join(", ") || "Class",
        cls: "bg-blue-100 text-blue-700",
      };
    if (announcement.targetType === "subject")
      return {
        label: announcement.targetSubjects.join(", ") || "Subject",
        cls: "bg-purple-100 text-purple-700",
      };
    return { label: "Custom", cls: "bg-slate-100 text-slate-600" };
  };

  const tb = targetBadge();

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm transition-all ${announcement.isPinned ? "border-amber-200 shadow-amber-50" : "border-slate-100"}`}
    >
      {/* Pin stripe */}
      {announcement.isPinned && (
        <div className="h-1 bg-linear-to-r from-amber-400 to-orange-400 rounded-t-2xl" />
      )}

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar user={announcement.instructor} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-sm">
                {announcement.instructor.name}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-400">
                {formatDate(announcement.createdAt)}
              </span>
              {announcement.status === "draft" && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  Draft
                </span>
              )}
              {announcement.isPinned && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  📌 Pinned
                </span>
              )}
            </div>
            <h3 className="font-black text-slate-900 text-base mt-0.5 leading-snug">
              {announcement.title}
            </h3>
          </div>

          {/* Actions menu */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onTogglePin(announcement)}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors ${announcement.isPinned ? "text-amber-700 bg-amber-50 hover:bg-amber-100" : "text-slate-500 hover:text-amber-600 hover:bg-amber-50"}`}
              title={announcement.isPinned ? "Unpin" : "Pin"}
            >
              📌
            </button>
            <button
              onClick={() => onEdit(announcement)}
              className="text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-xl transition-colors"
            >
              ✏️
            </button>
            <button
              onClick={() => onDelete(announcement)}
              className="text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-xl transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Audience badge */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${tb.cls}`}
          >
            👥 {tb.label}
          </span>
          {!announcement.allowComments && (
            <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
              💬 Comments off
            </span>
          )}
        </div>

        {/* Body */}
        <div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {displayBody}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="text-xs font-bold text-violet-600 hover:text-violet-700 mt-1"
            >
              {expanded ? "Show less ▲" : "Read more ▼"}
            </button>
          )}
        </div>

        {/* Attachments */}
        {announcement.attachments.length > 0 && (
          <div className="flex flex-col gap-2">
            <AttachmentStrip attachments={announcement.attachments} />
          </div>
        )}

        {/* Footer stats + comment toggle */}
        <div className="flex items-center gap-4 pt-2 border-t border-slate-50">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            👁 <span className="font-semibold">{announcement.viewsCount}</span>
          </span>
          <button
            onClick={handleToggleComments}
            className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${showComments ? "text-violet-600" : "text-slate-500 hover:text-violet-600"}`}
          >
            💬 <span>{announcement.commentsCount}</span>
            <span>
              {announcement.commentsCount !== 1 ? "comments" : "comment"}
            </span>
            <span>{showComments ? "▲" : "▼"}</span>
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="flex flex-col gap-4 border-t border-slate-100 pt-4">
            {/* New comment input */}
            {announcement.allowComments && (
              <CommentInput
                announcementId={announcement._id}
                onPosted={(c) => {
                  setComments((p) => [c, ...p]);
                }}
              />
            )}

            {/* Comments list */}
            {commentsLoading ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3 italic">
                No comments yet
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {comments.map((c) => (
                  <CommentThread
                    key={c._id}
                    comment={c}
                    announcementId={announcement._id}
                    currentUserId={currentUserId}
                    onDeleted={(id) =>
                      setComments((p) => p.filter((x) => x._id !== id))
                    }
                  />
                ))}
                {commentsPagination?.hasNextPage && (
                  <button
                    onClick={loadComments}
                    className="text-xs font-bold text-violet-600 hover:text-violet-700 text-center py-2"
                  >
                    Load more comments
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({
  announcement,
  onClose,
  onDeleted,
}: {
  announcement: Announcement;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/announcement/${announcement._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Announcement deleted.");
      onDeleted(announcement._id);
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
              Delete Announcement?
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              This cannot be undone. All comments and attachments will be
              removed.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
          <p className="font-bold text-slate-800 text-sm truncate">
            {announcement.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {announcement.commentsCount} comments ·{" "}
            {announcement.attachments.length} attachments
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 py-3 rounded-xl disabled:opacity-50"
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InstructorAnnouncementPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
  const [filterPinned, setFilterPinned] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modals
  const [showComposer, setShowComposer] = useState(false);
  const [editAnnouncement, setEditAnnouncement] = useState<
    Announcement | undefined
  >(undefined);
  const [deleteAnnouncement, setDeleteAnnouncement] = useState<
    Announcement | undefined
  >(undefined);

  // Placeholder currentUserId — replace with real auth context
  const currentUserId = "";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, filterTarget, filterPinned, sort]);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
        sort,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filterStatus && { status: filterStatus }),
        ...(filterTarget && { targetType: filterTarget }),
        ...(filterPinned && { isPinned: filterPinned }),
      });
      const res = await fetch(`/api/announcement?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAnnouncements(data.data);
      setPagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, filterStatus, filterTarget, filterPinned]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleSaved = (saved: Announcement) => {
    setShowComposer(false);
    setEditAnnouncement(undefined);
    if (editAnnouncement) {
      setAnnouncements((prev) =>
        prev.map((a) => (a._id === saved._id ? saved : a)),
      );
    } else {
      setAnnouncements((prev) => {
        const pinned = [saved, ...prev].sort(
          (a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0),
        );
        return pinned;
      });
      setPagination((prev) =>
        prev ? { ...prev, total: prev.total + 1 } : prev,
      );
    }
  };

  const handleDeleted = (id: string) => {
    setDeleteAnnouncement(undefined);
    setAnnouncements((prev) => prev.filter((a) => a._id !== id));
    setPagination((prev) =>
      prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev,
    );
  };

  const handleTogglePin = async (announcement: Announcement) => {
    try {
      const fd = new FormData();
      fd.append("isPinned", String(!announcement.isPinned));
      const res = await fetch(`/api/announcement/${announcement._id}`, {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAnnouncements((prev) =>
        prev
          .map((a) =>
            a._id === announcement._id ? { ...a, isPinned: !a.isPinned } : a,
          )
          .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)),
      );
      toast.success(announcement.isPinned ? "Unpinned." : "Pinned to top!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update.");
    }
  };

  const isFiltered = !!(
    debouncedSearch ||
    filterStatus ||
    filterTarget ||
    filterPinned
  );
  const pinnedCount = announcements.filter((a) => a.isPinned).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl shadow-sm">
            📢
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Announcements
            </h1>
            <p className="text-slate-500 text-sm">
              {pagination
                ? `${pagination.total} announcement${pagination.total !== 1 ? "s" : ""}${pinnedCount > 0 ? ` · ${pinnedCount} pinned` : ""}`
                : "Share updates, reminders, and resources with students"}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditAnnouncement(undefined);
            setShowComposer(true);
          }}
          className="flex items-center gap-2 bg-linear-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm shrink-0"
        >
          + New Announcement
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
            placeholder="Search announcements…"
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
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-36"
        >
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={filterTarget}
          onChange={(e) => setFilterTarget(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-36"
        >
          <option value="">All Audiences</option>
          <option value="all">All Students</option>
          <option value="class">By Class</option>
          <option value="subject">By Subject</option>
        </select>
        <select
          value={filterPinned}
          onChange={(e) => setFilterPinned(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-32"
        >
          <option value="">All Posts</option>
          <option value="true">📌 Pinned only</option>
          <option value="false">Unpinned only</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-36"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="popular">Most Commented</option>
          <option value="pinned">Pinned First</option>
        </select>
        {isFiltered && (
          <button
            onClick={() => {
              setSearch("");
              setFilterStatus("");
              setFilterTarget("");
              setFilterPinned("");
              setSort("newest");
            }}
            className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 h-48 animate-pulse"
            />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center text-3xl mb-4">
            {isFiltered ? "🔍" : "📢"}
          </div>
          <h3 className="font-black text-slate-800 text-base mb-1">
            {isFiltered
              ? "No announcements match your filters"
              : "No announcements yet"}
          </h3>
          <p className="text-slate-500 text-sm max-w-xs">
            {isFiltered
              ? "Try adjusting your search."
              : "Post your first announcement to keep students informed."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-3xl">
          {announcements.map((a) => (
            <AnnouncementCard
              key={a._id}
              announcement={a}
              currentUserId={currentUserId}
              onEdit={(a) => {
                setEditAnnouncement(a);
                setShowComposer(true);
              }}
              onDelete={setDeleteAnnouncement}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3.5 max-w-3xl">
          <p className="text-xs text-slate-500 font-medium">
            Showing{" "}
            <span className="font-bold text-slate-800">
              {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of{" "}
            <span className="font-bold text-slate-800">{pagination.total}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${pagination.page === p ? "bg-linear-to-r from-violet-600 to-purple-600 text-white shadow-md" : "border border-slate-200 text-slate-600 hover:bg-violet-50 hover:text-violet-700"}`}
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showComposer && (
        <AnnouncementComposer
          mode={editAnnouncement ? "edit" : "create"}
          announcement={editAnnouncement}
          onClose={() => {
            setShowComposer(false);
            setEditAnnouncement(undefined);
          }}
          onSaved={handleSaved}
        />
      )}
      {deleteAnnouncement && (
        <DeleteConfirm
          announcement={deleteAnnouncement}
          onClose={() => setDeleteAnnouncement(undefined)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
