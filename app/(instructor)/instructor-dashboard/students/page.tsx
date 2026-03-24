"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentPerformance {
  overallPercentage: number;
  totalActivities: number;
  quizCount: number;
  assignmentCount: number;
  lastActivityAt: string | null;
}

interface Student {
  _id: string;
  name: string;
  email: string;
  role: "student";
  school?: string;
  classLevel?: string;
  programme?: string;
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
  performance: StudentPerformance | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const CLASS_LEVELS = ["SHS 1", "SHS 2", "SHS 3"];
const PROGRAMMES = [
  "General Science",
  "General Arts",
  "Business",
  "Visual Arts",
  "Home Economics",
  "Agriculture",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getScoreColor(pct: number) {
  if (pct >= 80)
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    };
  if (pct >= 60)
    return {
      text: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    };
  if (pct >= 50)
    return {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    };
  return { text: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
}

function getGradeLetter(pct: number) {
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
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

// ─── Student Form (shared by Create + Edit modals) ────────────────────────────
interface StudentFormState {
  name: string;
  email: string;
  password: string;
  school: string;
  classLevel: string;
  programme: string;
}

function StudentModal({
  mode,
  student,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  student?: Student;
  onClose: () => void;
  onSaved: (s: Student) => void;
}) {
  const [saving, setSaving] = useState(false);
  const isEdit = mode === "edit";

  const [form, setForm] = useState<StudentFormState>({
    name: student?.name ?? "",
    email: student?.email ?? "",
    password: "",
    school: student?.school ?? "",
    classLevel: student?.classLevel ?? "",
    programme: student?.programme ?? "",
  });

  const set =
    (key: keyof StudentFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        email: form.email.trim(),
        school: form.school.trim(),
        classLevel: form.classLevel,
        programme: form.programme,
      };
      if (!isEdit) payload.password = form.password || "student123";
      if (isEdit && form.password) payload.newPassword = form.password;

      const url = isEdit ? `/api/students/${student!._id}` : "/api/students";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(isEdit ? "Student updated!" : "Student created!");
      onSaved(data.data);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // Close on ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const inputCls =
    "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all disabled:opacity-60 bg-white";
  const labelCls = "text-xs font-bold text-slate-500 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg">
              {isEdit ? "✏️" : "👤"}
            </div>
            <div>
              <h2 className="font-black text-white text-base">
                {isEdit ? "Edit Student" : "Add Student"}
              </h2>
              <p className="text-slate-300 text-xs">
                {isEdit
                  ? "Update student details"
                  : "Create a new student account"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Kwame Mensah"
              disabled={saving}
              required
              className={inputCls}
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="student@school.edu.gh"
              disabled={saving}
              required
              className={inputCls}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>
              {isEdit ? "New Password" : "Password"}
              {!isEdit && (
                <span className="text-slate-400 normal-case font-normal ml-1">
                  (default: student123)
                </span>
              )}
              {isEdit && (
                <span className="text-slate-400 normal-case font-normal ml-1">
                  (leave blank to keep current)
                </span>
              )}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              placeholder={
                isEdit ? "Leave blank to keep current" : "Min. 6 characters"
              }
              disabled={saving}
              className={inputCls}
            />
          </div>

          {/* School */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>School</label>
            <input
              value={form.school}
              onChange={set("school")}
              placeholder="e.g. Prempeh College"
              disabled={saving}
              className={inputCls}
            />
          </div>

          {/* Class Level + Programme */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Class Level</label>
              <select
                value={form.classLevel}
                onChange={set("classLevel")}
                disabled={saving}
                className={inputCls}
              >
                <option value="">Select class</option>
                {CLASS_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Programme</label>
              <select
                value={form.programme}
                onChange={set("programme")}
                disabled={saving}
                className={inputCls}
              >
                <option value="">Select programme</option>
                {PROGRAMMES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black disabled:opacity-50 py-3 rounded-xl shadow-md transition-all"
            >
              {saving ? (
                <>
                  <Spinner sm />
                  {isEdit ? "Saving…" : "Creating…"}
                </>
              ) : isEdit ? (
                "💾 Save Changes"
              ) : (
                "👤 Add Student"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({
  student,
  onClose,
  onDeleted,
}: {
  student: Student;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/students/${student._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Student deleted.");
      onDeleted(student._id);
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
              Delete Student?
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
          <p className="font-bold text-slate-800 text-sm truncate">
            {student.name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{student.email}</p>
        </div>
        <p className="text-sm text-slate-600">
          The student's account and all associated performance data will be
          permanently removed.
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

// ─── Student Card ─────────────────────────────────────────────────────────────
function StudentCard({
  student,
  rank,
  onEdit,
  onDelete,
}: {
  student: Student;
  rank: number;
  onEdit: (s: Student) => void;
  onDelete: (s: Student) => void;
}) {
  const perf = student.performance;
  const scoreColors = perf ? getScoreColor(perf.overallPercentage) : null;
  const grade = perf ? getGradeLetter(perf.overallPercentage) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
      <div className="h-1 bg-linear-to-r from-slate-700 to-slate-500" />
      <div className="p-4 flex flex-col gap-3">
        {/* Avatar + info row */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {student.profilePicture ? (
              <img
                src={student.profilePicture}
                alt={student.name}
                className="w-11 h-11 rounded-full object-cover"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-linear-to-br from-slate-600 to-slate-800 flex items-center justify-center font-black text-white text-sm">
                {getInitials(student.name)}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 text-xs bg-white rounded-full px-1 border border-slate-100 font-bold text-slate-500">
              #{rank}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">
              {student.name}
            </p>
            <p className="text-xs text-slate-400 truncate">{student.email}</p>
          </div>
          {perf && scoreColors && grade && (
            <div
              className={`w-10 h-10 rounded-xl ${scoreColors.bg} border ${scoreColors.border} flex items-center justify-center shrink-0`}
            >
              <span className={`font-black text-sm ${scoreColors.text}`}>
                {grade}
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          {student.classLevel && (
            <span className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
              {student.classLevel}
            </span>
          )}
          {student.programme && (
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full truncate max-w-30">
              {student.programme}
            </span>
          )}
        </div>

        {/* School */}
        {student.school && (
          <p className="text-xs text-slate-500 truncate">🏫 {student.school}</p>
        )}

        {/* Performance */}
        {perf ? (
          <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-600">Overall</span>
                <span className={`font-black ${scoreColors?.text}`}>
                  {perf.overallPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${perf.overallPercentage}%`,
                    backgroundColor:
                      perf.overallPercentage >= 70
                        ? "#10b981"
                        : perf.overallPercentage >= 50
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-black text-slate-700">
                {perf.totalActivities}
              </p>
              <p className="text-xs text-slate-400">activities</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-slate-400 italic">No activity yet</p>
          </div>
        )}

        {/* Joined date */}
        <p className="text-xs text-slate-400">
          Joined {formatDate(student.createdAt)}
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-slate-50">
          <button
            onClick={() => onEdit(student)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-xl transition-colors"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => onDelete(student)}
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
export default function InstructorStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | undefined>(
    undefined,
  );
  const [deleteStudent, setDeleteStudent] = useState<Student | undefined>(
    undefined,
  );

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterClass, sort]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "18",
        sort,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filterClass && { classLevel: filterClass }),
      });
      const res = await fetch(`/api/students?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStudents(data.data);
      setPagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load students.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, filterClass]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleSaved = (saved: Student) => {
    if (editStudent) {
      setStudents((prev) =>
        prev.map((s) => (s._id === saved._id ? { ...s, ...saved } : s)),
      );
      setEditStudent(undefined);
    } else {
      setStudents((prev) => [{ ...saved, performance: null }, ...prev]);
      setPagination((prev) =>
        prev ? { ...prev, total: prev.total + 1 } : prev,
      );
      setShowCreate(false);
    }
  };

  const handleDeleted = (id: string) => {
    setDeleteStudent(undefined);
    setStudents((prev) => prev.filter((s) => s._id !== id));
    setPagination((prev) =>
      prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev,
    );
  };

  const isFiltered = !!(debouncedSearch || filterClass);

  // Summary stats from current page data
  const withPerf = students.filter((s) => s.performance !== null);
  const avgPerf = withPerf.length
    ? withPerf.reduce(
        (s, st) => s + (st.performance?.overallPercentage ?? 0),
        0,
      ) / withPerf.length
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xl shadow-sm">
            👥
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Students
            </h1>
            <p className="text-slate-500 text-sm">
              {pagination
                ? `${pagination.total} student${pagination.total !== 1 ? "s" : ""} registered`
                : "Manage and monitor your students"}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditStudent(undefined);
            setShowCreate(true);
          }}
          className="flex items-center gap-2 bg-linear-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm shrink-0"
        >
          + Add Student
        </button>
      </div>

      {/* ── Summary Chips ────────────────────────────────────────────── */}
      {!loading && students.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm">
            <span className="text-base">👥</span>
            <span className="text-xs font-bold text-slate-700">
              {pagination?.total ?? 0} total
            </span>
          </div>
          {withPerf.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm">
              <span className="text-base">🎯</span>
              <span className="text-xs font-bold text-slate-700">
                {avgPerf.toFixed(1)}% avg (this page)
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm">
            <span className="text-base">✅</span>
            <span className="text-xs font-bold text-slate-700">
              {
                students.filter(
                  (s) => (s.performance?.overallPercentage ?? 0) >= 50,
                ).length
              }{" "}
              passing
            </span>
          </div>
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            <span className="text-base">⚠️</span>
            <span className="text-xs font-bold text-red-700">
              {
                students.filter(
                  (s) =>
                    s.performance !== null &&
                    (s.performance?.overallPercentage ?? 100) < 50,
                ).length
              }{" "}
              need support
            </span>
          </div>
        </div>
      )}

      {/* ── Filters Bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all"
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
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white transition-all min-w-36"
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
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white transition-all min-w-44"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name A–Z</option>
          <option value="topPerformers">Top Performers</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => {
              setSearch("");
              setFilterClass("");
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
              className="bg-white rounded-2xl border border-slate-100 h-64 animate-pulse"
            />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl mb-4">
            {isFiltered ? "🔍" : "👥"}
          </div>
          <h3 className="font-black text-slate-800 text-base mb-1">
            {isFiltered ? "No students match your search" : "No students yet"}
          </h3>
          <p className="text-slate-500 text-sm max-w-xs">
            {isFiltered
              ? "Try adjusting your filters."
              : "Add your first student to get started."}
          </p>
          {!isFiltered && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 text-sm font-bold text-white bg-linear-to-r from-slate-700 to-slate-900 px-5 py-2.5 rounded-xl shadow-md"
            >
              + Add Student
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s, i) => (
            <StudentCard
              key={s._id}
              student={s}
              rank={(page - 1) * 18 + i + 1}
              onEdit={(s) => setEditStudent(s)}
              onDelete={(s) => setDeleteStudent(s)}
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
            students
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${pagination.page === p ? "bg-linear-to-r from-slate-700 to-slate-900 text-white shadow-md" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {(showCreate || editStudent) && (
        <StudentModal
          mode={editStudent ? "edit" : "create"}
          student={editStudent}
          onClose={() => {
            setShowCreate(false);
            setEditStudent(undefined);
          }}
          onSaved={handleSaved}
        />
      )}
      {deleteStudent && (
        <DeleteConfirm
          student={deleteStudent}
          onClose={() => setDeleteStudent(undefined)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
