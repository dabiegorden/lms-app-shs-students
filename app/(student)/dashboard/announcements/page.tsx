"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type TargetType = "all" | "class" | "subject" | "course";

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
  status: string;
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
  liked?: boolean;
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
const MAX_FILE_MB = 25;
const MAX_COMMENT_FILES = 3;

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
function Avatar({
  user,
  size = "sm",
}: {
  user: Author;
  size?: "sm" | "md" | "lg";
}) {
  const sz =
    size === "lg"
      ? "w-11 h-11 text-sm"
      : size === "md"
        ? "w-9 h-9 text-xs"
        : "w-7 h-7 text-xs";
  const gradient =
    user.name.charCodeAt(0) % 3 === 0
      ? "from-emerald-400 to-teal-500"
      : user.name.charCodeAt(0) % 3 === 1
        ? "from-sky-400 to-blue-500"
        : "from-violet-400 to-purple-500";

  return user.avatar ? (
    <img
      src={user.avatar}
      alt={user.name}
      className={`${sz} rounded-full object-cover shrink-0 ring-2 ring-white`}
    />
  ) : (
    <div
      className={`${sz} rounded-full bg-linear-to-br ${gradient} flex items-center justify-center font-black text-white shrink-0 ring-2 ring-white shadow-sm`}
    >
      {getInitials(user.name)}
    </div>
  );
}

// ─── Attachment Display ───────────────────────────────────────────────────────
function AttachmentDisplay({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;

  const images = attachments.filter((a) => a.resourceType === "image");
  const files = attachments.filter((a) => a.resourceType !== "image");

  return (
    <div className="flex flex-col gap-2 mt-3">
      {images.length > 0 && (
        <div
          className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
        >
          {images.map((img, i) => (
            <a
              key={i}
              href={img.url}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <img
                src={img.url}
                alt={img.originalName}
                className="rounded-xl object-cover w-full hover:opacity-90 transition-opacity cursor-zoom-in border border-slate-100"
                style={{
                  maxHeight: images.length === 1 ? 320 : 180,
                  minHeight: 120,
                }}
              />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <a
              key={i}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 transition-colors group max-w-64"
            >
              <span className="text-xl shrink-0">
                {getFileIcon(f.format, f.resourceType)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-slate-900">
                  {f.originalName}
                </p>
                <p className="text-xs text-slate-400">{formatBytes(f.bytes)}</p>
              </div>
              <span className="text-slate-300 group-hover:text-slate-500 text-xs shrink-0 ml-1">
                ↗
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File Picker (for comments) ───────────────────────────────────────────────
function CommentFilePicker({
  files,
  onAdd,
  onRemove,
  disabled,
}: {
  files: (File & { preview?: string })[];
  onAdd: (f: File[]) => void;
  onRemove: (i: number) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} exceeds ${MAX_FILE_MB}MB`);
        return false;
      }
      return true;
    });
    onAdd(valid);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {files.map((f, i) => {
        const isImg = f.type.startsWith("image/");
        return (
          <div key={i} className="relative group">
            {isImg && (f as any).preview ? (
              <div className="w-14 h-10 rounded-lg overflow-hidden border border-slate-200">
                <img
                  src={(f as any).preview}
                  alt={f.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 max-w-32">
                <span>
                  {getFileIcon(
                    f.name.split(".").pop() ?? "",
                    f.type.startsWith("image") ? "image" : "raw",
                  )}
                </span>
                <span className="truncate font-medium">{f.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        );
      })}

      {files.length < MAX_COMMENT_FILES && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40 px-2 py-1.5 rounded-lg hover:bg-slate-50"
          >
            📎 {files.length > 0 ? "Add more" : "Attach"}
          </button>
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
        </>
      )}
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
  compact = false,
}: {
  announcementId: string;
  parentCommentId?: string | null;
  onPosted: (comment: Comment) => void;
  onCancel?: () => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<(File & { preview?: string })[]>([]);
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAddFiles = (incoming: File[]) => {
    const withPreviews = incoming.map((f) => {
      const ff = f as File & { preview?: string };
      if (f.type.startsWith("image/")) ff.preview = URL.createObjectURL(f);
      return ff;
    });
    setFiles((prev) => [...prev, ...withPreviews].slice(0, MAX_COMMENT_FILES));
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
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
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      onPosted(data.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment.");
    } finally {
      setPosting(false);
    }
  };

  const canPost = (body.trim().length > 0 || files.length > 0) && !posting;

  return (
    <div
      className={`flex flex-col gap-2 ${compact ? "" : "bg-slate-50/60 rounded-2xl p-3 border border-slate-100"}`}
    >
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          autoResize();
        }}
        placeholder={placeholder}
        rows={compact ? 1 : 2}
        disabled={posting}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none disabled:opacity-60 transition-all leading-relaxed"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost();
        }}
        style={{ minHeight: compact ? 36 : 64, overflow: "hidden" }}
      />

      <div className="flex items-center justify-between gap-2">
        <CommentFilePicker
          files={files}
          onAdd={handleAddFiles}
          onRemove={(i) => setFiles((p) => p.filter((_, idx) => idx !== i))}
          disabled={posting}
        />
        <div className="flex items-center gap-2 shrink-0">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={posting}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors px-2 py-1.5"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handlePost}
            disabled={!canPost}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-1.5 rounded-xl transition-all"
          >
            {posting ? (
              <>
                <Spinner sm />
                Posting…
              </>
            ) : parentCommentId ? (
              "↩ Reply"
            ) : (
              "Post"
            )}
          </button>
        </div>
      </div>
      {body.length > 0 && (
        <p className="text-xs text-slate-400 text-right">Ctrl+Enter to post</p>
      )}
    </div>
  );
}

// ─── Like Button ──────────────────────────────────────────────────────────────
function LikeButton({
  commentId,
  announcementId,
  initialCount,
  initialLiked,
}: {
  commentId: string;
  announcementId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));
    try {
      const res = await fetch(
        `/api/announcement/${announcementId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ like: true }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setLiked(!newLiked);
        setCount((c) => c + (newLiked ? -1 : 1));
        throw new Error(data.message);
      }
      setLiked(data.data.liked);
      setCount(data.data.likesCount);
    } catch (err: any) {
      toast.error(err.message || "Failed to like.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1 text-xs font-semibold transition-all rounded-lg px-2 py-1 ${liked ? "text-rose-500 bg-rose-50" : "text-slate-400 hover:text-rose-500 hover:bg-rose-50"}`}
    >
      <span className={`transition-transform ${liked ? "scale-110" : ""}`}>
        {liked ? "❤️" : "🤍"}
      </span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

// ─── Comment Thread ───────────────────────────────────────────────────────────
function CommentThread({
  comment,
  announcementId,
  currentUserId,
  depth = 0,
  onDeleted,
  onReplyPosted,
}: {
  comment: Comment;
  announcementId: string;
  currentUserId: string;
  depth?: number;
  onDeleted: (id: string) => void;
  onReplyPosted?: (parentId: string, reply: Comment) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replies, setReplies] = useState<Comment[]>(comment.replies ?? []);
  const [showReplies, setShowReplies] = useState(
    depth === 0 && (comment.replies?.length ?? 0) > 0,
  );
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [localComment, setLocalComment] = useState(comment);

  const isOwn = localComment.author._id === currentUserId;
  const isInstructor = localComment.authorRole === "instructor";

  const handleDelete = async () => {
    if (!confirm("Delete this comment?")) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/announcement/${announcementId}/comments/${localComment._id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onDeleted(localComment._id);
      toast.success("Comment deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = async () => {
    if (!editBody.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/announcement/${announcementId}/comments/${localComment._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: editBody }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setLocalComment((prev) => ({
        ...prev,
        body: data.data.body,
        isEdited: true,
      }));
      setEditing(false);
      toast.success("Comment updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update comment.");
    } finally {
      setSaving(false);
    }
  };

  const handleReplyPosted = (newReply: Comment) => {
    setReplies((prev) => [...prev, newReply]);
    setShowReply(false);
    setShowReplies(true);
    onReplyPosted?.(localComment._id, newReply);
  };

  return (
    <div className={`flex gap-2.5 ${depth > 0 ? "pl-0" : ""}`}>
      <div className="shrink-0 flex flex-col items-center gap-1">
        <Avatar user={localComment.author} size={depth === 0 ? "md" : "sm"} />
        {replies.length > 0 && showReplies && (
          <div className="w-0.5 flex-1 bg-slate-100 rounded-full mt-1" />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-1">
        {/* Bubble */}
        <div
          className={`rounded-2xl px-3.5 py-3 ${isInstructor ? "bg-indigo-50 border border-indigo-100" : "bg-white border border-slate-100 shadow-sm"}`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-bold text-slate-800 text-sm">
              {localComment.author.name}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${isInstructor ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {isInstructor ? "Instructor" : "Student"}
            </span>
            <span className="text-xs text-slate-400">
              {formatDate(localComment.createdAt)}
            </span>
            {localComment.isEdited && (
              <span className="text-xs text-slate-400 italic">(edited)</span>
            )}
          </div>

          {/* Body */}
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={2}
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={saving || !editBody.trim()}
                  className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-all"
                >
                  {saving ? (
                    <>
                      <Spinner sm />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {localComment.body}
            </p>
          )}

          {/* Attachments */}
          {localComment.attachments.length > 0 && !editing && (
            <AttachmentDisplay attachments={localComment.attachments} />
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-1 mt-1.5 px-1">
          <LikeButton
            commentId={localComment._id}
            announcementId={announcementId}
            initialCount={localComment.likesCount}
            initialLiked={localComment.liked ?? false}
          />

          <button
            type="button"
            onClick={() => setShowReply((p) => !p)}
            className="text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
          >
            ↩ Reply
          </button>

          {replies.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReplies((p) => !p)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-lg hover:bg-slate-50"
            >
              {showReplies ? "▲" : "▼"} {replies.length}{" "}
              {replies.length === 1 ? "reply" : "replies"}
            </button>
          )}

          {isOwn && !editing && (
            <>
              <button
                onClick={() => {
                  setEditing(true);
                  setEditBody(localComment.body);
                }}
                className="text-xs font-semibold text-slate-400 hover:text-indigo-500 transition-colors px-2 py-1 rounded-lg hover:bg-slate-50 ml-auto"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-40"
              >
                {deleting ? "…" : "Delete"}
              </button>
            </>
          )}
        </div>

        {/* Reply input */}
        {showReply && (
          <div className="mt-2 ml-1">
            <CommentInput
              announcementId={announcementId}
              parentCommentId={localComment._id}
              onPosted={handleReplyPosted}
              onCancel={() => setShowReply(false)}
              placeholder={`Reply to ${localComment.author.name}…`}
              compact
            />
          </div>
        )}

        {/* Nested replies */}
        {showReplies && replies.length > 0 && (
          <div className="mt-3 flex flex-col gap-3 pl-3 border-l-2 border-slate-100">
            {replies.map((reply) => (
              <CommentThread
                key={reply._id}
                comment={reply}
                announcementId={announcementId}
                currentUserId={currentUserId}
                depth={depth + 1}
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

// ─── Announcement Card ────────────────────────────────────────────────────────
function AnnouncementCard({
  announcement,
  currentUserId,
}: {
  announcement: Announcement;
  currentUserId: string;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsPagination, setCommentsPagination] =
    useState<Pagination | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [localCount, setLocalCount] = useState(announcement.commentsCount);

  const isLong = announcement.body.length > 350;
  const displayBody =
    !expanded && isLong
      ? announcement.body.slice(0, 350) + "…"
      : announcement.body;

  const loadComments = useCallback(
    async (page = 1, append = false) => {
      if (page === 1) setCommentsLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetch(
          `/api/announcement/${announcement._id}/comments?limit=15&page=${page}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setComments((prev) => (append ? [...prev, ...data.data] : data.data));
        setCommentsPagination(data.pagination);
      } catch (err: any) {
        toast.error(err.message || "Failed to load comments.");
      } finally {
        setCommentsLoading(false);
        setLoadingMore(false);
      }
    },
    [announcement._id],
  );

  const handleToggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) loadComments();
  };

  const handleCommentPosted = (c: Comment) => {
    setComments((prev) => [c, ...prev]);
    setLocalCount((n) => n + 1);
  };

  const targetLabel = () => {
    if (announcement.targetType === "all")
      return {
        text: "All Students",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-100",
      };
    if (announcement.targetType === "class")
      return {
        text: announcement.targetClassLevel.join(", ") || "Class",
        cls: "bg-sky-50 text-sky-700 border-sky-100",
      };
    if (announcement.targetType === "subject")
      return {
        text: announcement.targetSubjects.join(", ") || "Subject",
        cls: "bg-violet-50 text-violet-700 border-violet-100",
      };
    return {
      text: "Custom",
      cls: "bg-slate-50 text-slate-600 border-slate-200",
    };
  };

  const tl = targetLabel();

  return (
    <article
      className={`bg-white rounded-2xl border shadow-sm transition-shadow hover:shadow-md ${announcement.isPinned ? "border-amber-200" : "border-slate-100"}`}
    >
      {/* Pinned stripe */}
      {announcement.isPinned && (
        <div className="h-1 bg-linear-to-r from-amber-400 to-orange-400 rounded-t-2xl" />
      )}

      <div className="p-5 flex flex-col gap-0">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar user={announcement.instructor} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">
                {announcement.instructor.name}
              </span>
              <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                Instructor
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-400">
                {formatDate(announcement.createdAt)}
              </span>
              {announcement.isPinned && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  📌 Pinned
                </span>
              )}
            </div>
            <h2 className="font-black text-slate-900 text-base mt-1 leading-snug">
              {announcement.title}
            </h2>
          </div>
        </div>

        {/* Target badge */}
        <div className="mb-3">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tl.cls}`}
          >
            👥 {tl.text}
          </span>
        </div>

        {/* Body */}
        <div className="mb-1">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {displayBody}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-1.5 transition-colors"
            >
              {expanded ? "Show less ▲" : "Read more ▼"}
            </button>
          )}
        </div>

        {/* Attachments */}
        {announcement.attachments.length > 0 && (
          <AttachmentDisplay attachments={announcement.attachments} />
        )}

        {/* Footer bar */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <span>👁</span>
            <span className="font-semibold">{announcement.viewsCount}</span>
          </span>

          {!announcement.allowComments ? (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <span>💬</span>
              <span>Comments closed</span>
            </span>
          ) : (
            <button
              onClick={handleToggleComments}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors rounded-lg px-2 py-1.5 ${showComments ? "text-indigo-600 bg-indigo-50" : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"}`}
            >
              <span>💬</span>
              <span>{localCount}</span>
              <span>{localCount !== 1 ? "comments" : "comment"}</span>
              <span className="text-xs opacity-60">
                {showComments ? "▲" : "▼"}
              </span>
            </button>
          )}
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col gap-4">
            {/* Comment input */}
            {announcement.allowComments && (
              <CommentInput
                announcementId={announcement._id}
                onPosted={handleCommentPosted}
                placeholder="Share your thoughts…"
              />
            )}

            {/* Comments list */}
            {commentsLoading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4 italic">
                No comments yet — be the first to comment!
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {comments.map((c) => (
                  <CommentThread
                    key={c._id}
                    comment={c}
                    announcementId={announcement._id}
                    currentUserId={currentUserId}
                    onDeleted={(id) => {
                      setComments((p) => p.filter((x) => x._id !== id));
                      setLocalCount((n) => Math.max(0, n - 1));
                    }}
                  />
                ))}
                {commentsPagination?.hasNextPage && (
                  <button
                    onClick={() =>
                      loadComments((commentsPagination.page ?? 1) + 1, true)
                    }
                    disabled={loadingMore}
                    className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 py-2 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Spinner sm />
                        Loading…
                      </>
                    ) : (
                      "Load more comments ▼"
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function AnnouncementSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-slate-100 shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-3 bg-slate-100 rounded-full w-1/3" />
          <div className="h-4 bg-slate-100 rounded-full w-2/3" />
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded-full w-full" />
      <div className="h-3 bg-slate-100 rounded-full w-5/6" />
      <div className="h-3 bg-slate-100 rounded-full w-4/6" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentsAnnouncementPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Placeholder — replace with your real auth context / session
  const currentUserId = "";

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [filterTarget]);

  const fetchAnnouncements = useCallback(
    async (pageNum: number, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: "10",
          sort: "newest",
          status: "published",
          ...(debouncedSearch && { search: debouncedSearch }),
          ...(filterTarget && { targetType: filterTarget }),
        });
        const res = await fetch(`/api/announcement?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setAnnouncements((prev) =>
          append ? [...prev, ...data.data] : data.data,
        );
        setPagination(data.pagination);
      } catch (err: any) {
        toast.error(err.message || "Failed to load announcements.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, filterTarget],
  );

  useEffect(() => {
    fetchAnnouncements(page, page > 1);
  }, [fetchAnnouncements, page]);

  const pinnedCount = announcements.filter((a) => a.isPinned).length;
  const isFiltered = !!(debouncedSearch || filterTarget);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl shadow-sm shrink-0">
            📢
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Announcements
            </h1>
            <p className="text-slate-500 text-sm">
              {pagination
                ? `${pagination.total} announcement${pagination.total !== 1 ? "s" : ""}${pinnedCount > 0 ? ` · ${pinnedCount} pinned` : ""}`
                : "Stay updated with your class"}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search announcements…"
            className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all bg-slate-50 focus:bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={filterTarget}
          onChange={(e) => setFilterTarget(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 focus:bg-white min-w-36"
        >
          <option value="">All Audiences</option>
          <option value="all">🌐 Everyone</option>
          <option value="class">🏫 My Class</option>
          <option value="subject">📚 My Subject</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => {
              setSearch("");
              setFilterTarget("");
            }}
            className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Pinned section hint */}
      {!isFiltered && pinnedCount > 0 && !loading && (
        <div className="flex items-center gap-2 px-1">
          <div className="h-px flex-1 bg-amber-100" />
          <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
            📌 {pinnedCount} pinned
          </span>
          <div className="h-px flex-1 bg-amber-100" />
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <AnnouncementSkeleton key={i} />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl mb-4">
            {isFiltered ? "🔍" : "📭"}
          </div>
          <h3 className="font-black text-slate-800 text-base mb-1">
            {isFiltered ? "No announcements match" : "No announcements yet"}
          </h3>
          <p className="text-slate-500 text-sm max-w-xs">
            {isFiltered
              ? "Try adjusting your filters."
              : "Your instructor hasn't posted any announcements yet."}
          </p>
          {isFiltered && (
            <button
              onClick={() => {
                setSearch("");
                setFilterTarget("");
              }}
              className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {announcements.map((a) => (
            <AnnouncementCard
              key={a._id}
              announcement={a}
              currentUserId={currentUserId}
            />
          ))}

          {/* Load more */}
          {pagination?.hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
                className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Spinner sm />
                    Loading…
                  </>
                ) : (
                  "Load more ▼"
                )}
              </button>
            </div>
          )}

          {/* End of feed */}
          {!pagination?.hasNextPage && announcements.length > 0 && (
            <p className="text-xs text-slate-400 text-center py-3">
              You're all caught up ✓
            </p>
          )}
        </div>
      )}
    </div>
  );
}
