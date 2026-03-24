"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentStats {
  enrollments: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    avgProgress: number;
    totalLessonsCompleted: number;
    certificatesEarned: number;
  };
  quizzes: {
    total: number;
    graded: number;
    pending: number;
    avgScore: number;
    highestScore: number;
    passed: number;
    passRate: number;
  };
  assignments: {
    total: number;
    graded: number;
    pending: number;
    avgScore: number;
    highestScore: number;
    onTime: number;
    late: number;
    onTimeRate: number;
  };
  performance: {
    overallPercentage: number;
    totalActivities: number;
    subjectBreakdown: { subject: string; percentage: number; total: number }[];
    grade: string | null;
    lastUpdated: string | null;
  };
  resources: {
    announcements: number;
    lectureNotes: number;
  };
  trendData: {
    month: string;
    quizzes: number;
    assignments: number;
    avgScore: number;
  }[];
  topCourses: {
    enrollmentId: string;
    courseId: string;
    title: string;
    subject: string;
    thumbnailUrl: string | null;
    previewVideoId: string | null;
    totalLessons: number;
    totalDurationSeconds: number;
    certificateEnabled: boolean;
    progressPercent: number;
    completedLessons: number;
    totalEnrolledLessons: number;
    isCompleted: boolean;
    certificateId: string | null;
    enrolledAt: string;
    lastAccessedAt: string | null;
  }[];
  recentQuizSubmissions: {
    _id: string;
    quizTitle: string;
    subject: string;
    totalMarks: number;
    totalScore: number;
    percentage: number;
    isGraded: boolean;
    submittedAt: string;
    timeSpentSeconds: number;
  }[];
  recentAssignmentSubmissions: {
    _id: string;
    assignmentTitle: string;
    subject: string;
    totalMarks: number;
    totalScore: number;
    percentage: number;
    isGraded: boolean;
    isLate: boolean;
    grade: string | null;
    submittedAt: string;
  }[];
  recentActivity: any[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
  });
}

function formatDuration(seconds: number) {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function gradeColor(pct: number) {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 65) return "text-sky-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-500";
}

function gradeLabel(pct: number) {
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

function gradeBg(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 65) return "bg-sky-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      className="animate-spin w-5 h-5 text-slate-400"
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

// ─── Progress Ring ────────────────────────────────────────────────────────────
function ProgressRing({
  percent,
  size = 56,
  stroke = 4,
  color = "#0ea5e9",
  bg = "#e2e8f0",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  bg?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, percent) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={bg}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  gradient,
  href,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  href?: string;
}) {
  const inner = (
    <div
      className={`relative rounded-2xl p-5 flex flex-col gap-3 overflow-hidden group transition-all hover:shadow-lg hover:-translate-y-0.5 ${href ? "cursor-pointer" : ""} ${gradient}`}
    >
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
          {icon}
        </div>
        {href && (
          <span className="text-xs font-bold text-white/60 group-hover:text-white/90 transition-colors">
            →
          </span>
        )}
      </div>
      <div>
        <p className="font-black text-white text-2xl leading-none tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-sm font-semibold text-white/80 mt-1">{label}</p>
        {sub && <p className="text-xs text-white/60 mt-0.5">{sub}</p>}
      </div>
      {/* Decorative circle */}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10" />
      <div className="absolute -right-1 -top-6 w-12 h-12 rounded-full bg-white/5" />
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard({ h = "h-28" }: { h?: string }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 ${h} animate-pulse`}
    />
  );
}

// ─── Custom Chart Tooltip ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-lg p-3 text-xs">
      <p className="font-black text-slate-700 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
          {p.name === "Avg Score" ? "%" : ""}
        </p>
      ))}
    </div>
  );
}

// ─── Overall Score Ring Widget ────────────────────────────────────────────────
function OverallScoreRing({
  percent,
  grade,
}: {
  percent: number;
  grade: string | null;
}) {
  const ringColor =
    percent >= 80
      ? "#10b981"
      : percent >= 65
        ? "#0ea5e9"
        : percent >= 50
          ? "#f59e0b"
          : "#ef4444";
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative">
        <ProgressRing
          percent={percent}
          size={100}
          stroke={7}
          color={ringColor}
          bg="#f1f5f9"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-black ${gradeColor(percent)}`}>
            {percent}%
          </span>
          <span className={`text-xs font-bold ${gradeColor(percent)}`}>
            Grade {grade ?? gradeLabel(percent)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Mini Row ─────────────────────────────────────────────────────────────────
function MiniRow({
  label,
  value,
  color = "text-slate-700",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-black ${color}`}>{value}</span>
    </div>
  );
}

// ─── Course Progress Card ─────────────────────────────────────────────────────
function CourseProgressCard({
  course,
}: {
  course: StudentStats["topCourses"][0];
}) {
  const ringColor = course.isCompleted
    ? "#f59e0b"
    : course.progressPercent > 60
      ? "#10b981"
      : "#0ea5e9";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-3 hover:shadow-md transition-all hover:-translate-y-0.5">
      {/* Thumbnail / ring */}
      <div className="relative shrink-0">
        {course.thumbnailUrl || course.previewVideoId ? (
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
            <img
              src={
                course.thumbnailUrl ??
                `https://img.youtube.com/vi/${course.previewVideoId}/mqdefault.jpg`
              }
              alt={course.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-xl bg-linear-to-br from-sky-100 to-indigo-100 flex items-center justify-center text-2xl">
            🎬
          </div>
        )}
        <div className="absolute -bottom-1.5 -right-1.5">
          <ProgressRing
            percent={course.progressPercent}
            size={26}
            stroke={3}
            color={ringColor}
            bg="#e2e8f0"
          />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-1">
          {course.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{course.subject}</p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${course.progressPercent}%`,
                background: ringColor,
              }}
            />
          </div>
          <span
            className={`text-xs font-black shrink-0 ${gradeColor(course.progressPercent)}`}
          >
            {course.progressPercent}%
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {course.completedLessons}/{course.totalEnrolledLessons} lessons
          {course.isCompleted && (
            <span className="ml-1.5 text-amber-500 font-bold">🏆 Complete</span>
          )}
          {course.lastAccessedAt && !course.isCompleted && (
            <span className="ml-1.5">
              · {formatRelative(course.lastAccessedAt)}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Score Badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ pct, isGraded }: { pct: number; isGraded: boolean }) {
  if (!isGraded)
    return (
      <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
        Pending
      </span>
    );
  const bg =
    pct >= 80
      ? "bg-emerald-100 text-emerald-700"
      : pct >= 65
        ? "bg-sky-100 text-sky-700"
        : pct >= 50
          ? "bg-amber-100 text-amber-700"
          : "bg-red-100 text-red-700";
  return (
    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${bg}`}>
      {pct}%
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentsDashboardPage() {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/dashboard/stats")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.message);
        setStats(d.data);
      })
      .catch((err) => toast.error(err.message || "Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SkeletonCard h="h-64" />
          <SkeletonCard h="h-64" />
          <SkeletonCard h="h-64" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-3">😕</div>
        <p className="font-black text-slate-800">Failed to load dashboard</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-sm font-bold text-sky-600 hover:text-sky-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const {
    enrollments,
    quizzes,
    assignments,
    performance,
    resources,
    trendData,
    topCourses,
    recentQuizSubmissions,
    recentAssignmentSubmissions,
  } = stats;
  const totalSubmissions = quizzes.total + assignments.total;
  const pendingGrades = quizzes.pending + assignments.pending;

  return (
    <div className="space-y-7">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-xl shadow-sm">
            🎓
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              My Dashboard
            </h1>
            <p className="text-slate-500 text-sm">
              Your learning overview at a glance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-100 rounded-xl px-4 py-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Updated just now
        </div>
      </div>

      {/* ── Primary Stat Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 ">
        <StatCard
          icon="🎬"
          label="Courses Enrolled"
          value={enrollments.total}
          sub={`${enrollments.completed} completed`}
          gradient="bg-gradient-to-br from-sky-500 to-indigo-600 "
          href="/dashboard/video-course"
        />
        <StatCard
          icon="🧩"
          label="Quizzes Taken"
          value={quizzes.total}
          sub={`${quizzes.passRate}% pass rate`}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          href="/dashboard/quizzes"
        />
        <StatCard
          icon="📋"
          label="Assignments"
          value={assignments.total}
          sub={`${assignments.onTimeRate}% on time`}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          href="/dashboard/assignments"
        />
        <StatCard
          icon="📊"
          label="Overall Score"
          value={`${performance.overallPercentage}%`}
          sub={`Grade ${performance.grade ?? gradeLabel(performance.overallPercentage)}`}
          gradient={
            performance.overallPercentage >= 80
              ? "bg-gradient-to-br from-emerald-600 to-green-700"
              : performance.overallPercentage >= 50
                ? "bg-gradient-to-br from-amber-500 to-orange-600"
                : "bg-gradient-to-br from-red-500 to-rose-600"
          }
          href="/dashboard/performance"
        />
        <StatCard
          icon="🏆"
          label="Certificates"
          value={enrollments.certificatesEarned}
          sub={`${enrollments.totalLessonsCompleted} lessons done`}
          gradient="bg-gradient-to-br from-amber-500 to-orange-500"
        />
        <StatCard
          icon="⏳"
          label="Pending Grades"
          value={pendingGrades}
          sub={`${quizzes.pending}Q · ${assignments.pending}A`}
          gradient="bg-gradient-to-br from-slate-600 to-slate-800"
        />
        <StatCard
          icon="📢"
          label="Announcements"
          value={resources.announcements}
          sub="From your instructor"
          gradient="bg-gradient-to-br from-rose-500 to-pink-600"
          href="/dashboard/announcements"
        />
        <StatCard
          icon="📄"
          label="Lecture Notes"
          value={resources.lectureNotes}
          sub="Available to read"
          gradient="bg-gradient-to-br from-cyan-500 to-sky-600"
          href="/dashboard/notes"
        />
      </div>

      {/* ── Middle Row: Chart + Score + Breakdown ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity Trend Chart — 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-black text-slate-800 text-sm">
                📈 Activity Trend
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Submissions & scores over 6 months
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {[
                { color: "#8b5cf6", label: "Assignments" },
                { color: "#10b981", label: "Quizzes" },
                { color: "#f59e0b", label: "Avg Score" },
              ].map((l) => (
                <span
                  key={l.label}
                  className="flex items-center gap-1.5 text-slate-500"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ background: l.color }}
                  />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                {[
                  { id: "gA", color: "#8b5cf6" },
                  { id: "gQ", color: "#10b981" },
                  { id: "gS", color: "#f59e0b" },
                ].map((g) => (
                  <linearGradient
                    key={g.id}
                    id={g.id}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={g.color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={g.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="assignments"
                name="Assignments"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#gA)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="quizzes"
                name="Quizzes"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gQ)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="avgScore"
                name="Avg Score"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#gS)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Overall Score + Quick Stats — 1/3 */}
        <div className="flex flex-col gap-4">
          {/* Overall ring */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col items-center gap-4">
            <h2 className="font-black text-slate-800 text-sm self-start">
              🎯 Overall Performance
            </h2>
            <OverallScoreRing
              percent={performance.overallPercentage}
              grade={performance.grade}
            />
            <div className="w-full">
              <MiniRow
                label="Total activities"
                value={performance.totalActivities}
              />
              <MiniRow
                label="Quiz avg"
                value={`${quizzes.avgScore}%`}
                color={gradeColor(quizzes.avgScore)}
              />
              <MiniRow
                label="Assignment avg"
                value={`${assignments.avgScore}%`}
                color={gradeColor(assignments.avgScore)}
              />
              <MiniRow
                label="Best quiz"
                value={`${quizzes.highestScore}%`}
                color="text-emerald-600"
              />
              <MiniRow
                label="Best assignment"
                value={`${assignments.highestScore}%`}
                color="text-emerald-600"
              />
            </div>
          </div>

          {/* Submission split */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-black text-slate-800 text-sm mb-3">
              📦 Submission Summary
            </h2>
            <div className="flex gap-3">
              <div className="flex-1 text-center bg-violet-50 rounded-xl p-3">
                <p className="font-black text-violet-700 text-xl">
                  {assignments.total}
                </p>
                <p className="text-xs text-violet-600 font-semibold mt-0.5">
                  Assignments
                </p>
                <p className="text-xs text-violet-400 mt-0.5">
                  {assignments.onTimeRate}% on time
                </p>
              </div>
              <div className="flex-1 text-center bg-emerald-50 rounded-xl p-3">
                <p className="font-black text-emerald-700 text-xl">
                  {quizzes.total}
                </p>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                  Quizzes
                </p>
                <p className="text-xs text-emerald-400 mt-0.5">
                  {quizzes.passRate}% passed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* My Courses Progress — 1/3 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-800 text-sm">
                🎬 My Courses
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {enrollments.inProgress} in progress · {enrollments.completed}{" "}
                done
              </p>
            </div>
            <Link
              href="/dashboard/video-course"
              className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
            >
              View all →
            </Link>
          </div>

          {topCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
              <span className="text-3xl mb-2 opacity-30">🎬</span>
              <p className="text-sm text-slate-400">No courses enrolled yet</p>
              <Link
                href="/dashboard/video-course"
                className="mt-3 text-xs font-bold text-sky-600 hover:text-sky-700"
              >
                Browse courses →
              </Link>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {topCourses.map((c) => (
                <CourseProgressCard key={c.enrollmentId} course={c} />
              ))}
            </div>
          )}

          {/* Course breakdown */}
          {enrollments.total > 0 && (
            <div className="px-5 pb-4 pt-2 border-t border-slate-50 flex gap-3">
              {[
                {
                  label: "Done",
                  count: enrollments.completed,
                  color: "bg-emerald-500",
                },
                {
                  label: "Active",
                  count: enrollments.inProgress,
                  color: "bg-sky-500",
                },
                {
                  label: "New",
                  count: enrollments.notStarted,
                  color: "bg-slate-300",
                },
              ].map((s) => (
                <div key={s.label} className="flex-1 text-center">
                  <div
                    className={`h-1 rounded-full ${s.color} mb-1.5`}
                    style={{ opacity: s.count > 0 ? 1 : 0.3 }}
                  />
                  <p className="font-black text-slate-700 text-sm">{s.count}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Submissions — 2/3 */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Quiz submissions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="font-black text-slate-800 text-sm">
                  🧩 Recent Quiz Results
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Latest {recentQuizSubmissions.length} submissions
                </p>
              </div>
              <Link
                href="/dashboard/quizzes"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                View all →
              </Link>
            </div>

            {recentQuizSubmissions.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-400 italic">
                No quiz submissions yet
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentQuizSubmissions.map((s) => (
                  <div
                    key={s._id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-base shrink-0">
                      🧩
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {s.quizTitle}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {s.subject} · {formatRelative(s.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.isGraded && s.timeSpentSeconds > 0 && (
                        <span className="text-xs text-slate-400">
                          {formatTime(s.timeSpentSeconds)}
                        </span>
                      )}
                      <ScoreBadge pct={s.percentage} isGraded={s.isGraded} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignment submissions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="font-black text-slate-800 text-sm">
                  📋 Recent Assignment Results
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Latest {recentAssignmentSubmissions.length} submissions
                </p>
              </div>
              <Link
                href="/dashboard/assignments"
                className="text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors"
              >
                View all →
              </Link>
            </div>

            {recentAssignmentSubmissions.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-400 italic">
                No assignment submissions yet
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentAssignmentSubmissions.map((s) => (
                  <div
                    key={s._id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-base shrink-0">
                      📋
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {s.assignmentTitle}
                      </p>
                      <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                        {s.subject} · {formatRelative(s.submittedAt)}
                        {s.isLate && (
                          <span className="text-amber-500 font-bold">
                            · Late
                          </span>
                        )}
                        {s.grade && (
                          <span className="text-slate-600 font-bold">
                            · {s.grade}
                          </span>
                        )}
                      </p>
                    </div>
                    <ScoreBadge pct={s.percentage} isGraded={s.isGraded} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Subject Breakdown ────────────────────────────────────────────────── */}
      {performance.subjectBreakdown?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-black text-slate-800 text-sm">
                📚 Performance by Subject
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Your scores across subjects
              </p>
            </div>
            <Link
              href="/dashboard/performance"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Full report →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {performance.subjectBreakdown.slice(0, 6).map((sub) => (
              <div key={sub.subject} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 w-36 shrink-0 truncate">
                  {sub.subject}
                </span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${gradeBg(sub.percentage)}`}
                    style={{ width: `${sub.percentage}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-black w-12 text-right shrink-0 ${gradeColor(sub.percentage)}`}
                >
                  {sub.percentage}%
                </span>
                <span className="text-xs text-slate-400 w-8 text-right shrink-0">
                  {gradeLabel(sub.percentage)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Links ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-black text-slate-800 text-sm mb-4">
          ⚡ Quick Links
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            {
              href: "/dashboard/video-course",
              label: "🎬 My Courses",
              color: "bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200",
            },
            {
              href: "/dashboard/quizzes",
              label: "🧩 Take a Quiz",
              color:
                "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
            },
            {
              href: "/dashboard/assignments",
              label: "📋 Assignments",
              color:
                "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200",
            },
            {
              href: "/dashboard/notes",
              label: "📄 Lecture Notes",
              color:
                "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
            },
            {
              href: "/dashboard/announcements",
              label: "📢 Announcements",
              color:
                "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200",
            },
            // {
            //   href: "/dashboard/performance",
            //   label: "📊 My Performance",
            //   color:
            //     "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
            // },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-colors ${link.color}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
