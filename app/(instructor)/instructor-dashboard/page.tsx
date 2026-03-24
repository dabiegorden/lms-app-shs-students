"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardStats {
  assignments: {
    total: number;
    published: number;
    draft: number;
    closed: number;
    totalSubmissions: number;
    totalViews: number;
  };
  quizzes: {
    total: number;
    published: number;
    draft: number;
    totalSubmissions: number;
    totalViews: number;
    totalQuestions: number;
  };
  notes: { total: number; totalViews: number; totalDownloads: number };
  announcements: {
    total: number;
    published: number;
    pinned: number;
    totalViews: number;
    totalComments: number;
  };
  courses: {
    total: number;
    published: number;
    draft: number;
    totalEnrollments: number;
    totalLessons: number;
    totalViews: number;
    avgRating: number;
  };
  enrollments: { total: number; completed: number };
  students: {
    total: number;
    avgOverallPercentage: number;
    topPerformers: number;
    struggling: number;
    totalActivities: number;
  };
  trendData: {
    month: string;
    assignments: number;
    quizzes: number;
    submissions: number;
  }[];
  recentActivity: {
    _id: string;
    title: string;
    subject: string;
    status?: string;
    createdAt: string;
    submissionsCount?: number;
    views?: number;
    downloads?: number;
    contentType: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  href,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  href?: string;
}) {
  const inner = (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-all group ${href ? "cursor-pointer hover:-translate-y-0.5" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center text-xl shadow-sm`}
        >
          {icon}
        </div>
        {href && (
          <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
            View →
          </span>
        )}
      </div>
      <div>
        <p className="font-black text-slate-900 text-2xl leading-none tracking-tight">
          {value.toLocaleString()}
        </p>
        <p className="text-sm font-semibold text-slate-600 mt-1">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Mini Stat Row ────────────────────────────────────────────────────────────
function MiniStat({
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

// ─── Content Type Icon/Color Map ──────────────────────────────────────────────
const CONTENT_META: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  assignment: {
    icon: "📋",
    color: "bg-violet-50 text-violet-700",
    label: "Assignment",
  },
  quiz: { icon: "🧩", color: "bg-emerald-50 text-emerald-700", label: "Quiz" },
  note: { icon: "📄", color: "bg-blue-50 text-blue-700", label: "Note" },
  course: { icon: "🎓", color: "bg-amber-50 text-amber-700", label: "Course" },
  announcement: {
    icon: "📢",
    color: "bg-rose-50 text-rose-700",
    label: "Announcement",
  },
};

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-lg p-3 text-xs">
      <p className="font-black text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 h-32 animate-pulse" />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InstructorDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/dashboard/stats");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setStats(data.data);
      } catch (err: any) {
        toast.error(err.message || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
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
          className="mt-4 text-sm font-bold text-violet-600 hover:text-violet-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const completionRate =
    stats.enrollments.total > 0
      ? Math.round(
          (stats.enrollments.completed / stats.enrollments.total) * 100,
        )
      : 0;

  const totalSubmissions =
    stats.assignments.totalSubmissions + stats.quizzes.totalSubmissions;
  const totalContent =
    stats.assignments.total +
    stats.quizzes.total +
    stats.notes.total +
    stats.courses.total;

  return (
    <div className="space-y-7">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xl shadow-sm">
            🏠
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Dashboard
            </h1>
            <p className="text-slate-500 text-sm">
              Welcome back — here's your overview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-100 rounded-xl px-4 py-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Updated just now
        </div>
      </div>

      {/* ── Primary Stats Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          icon="👥"
          label="Total Students"
          value={stats.students.total}
          sub={`${stats.students.topPerformers} top performers`}
          accent="bg-gradient-to-br from-slate-700 to-slate-900"
          href="/instructor-dashboard/students"
        />
        <StatCard
          icon="📋"
          label="Assignments"
          value={stats.assignments.total}
          sub={`${stats.assignments.published} published`}
          accent="bg-gradient-to-br from-violet-500 to-purple-600"
          href="/instructor-dashboard/assignments"
        />
        <StatCard
          icon="🧩"
          label="Quizzes"
          value={stats.quizzes.total}
          sub={`${stats.quizzes.totalQuestions} total questions`}
          accent="bg-gradient-to-br from-emerald-500 to-teal-600"
          href="/instructor-dashboard/quizzes"
        />
        <StatCard
          icon="📝"
          label="Submissions"
          value={totalSubmissions}
          sub={`${stats.assignments.totalSubmissions}A · ${stats.quizzes.totalSubmissions}Q`}
          accent="bg-gradient-to-br from-blue-500 to-indigo-600"
        />
        <StatCard
          icon="🎓"
          label="Courses"
          value={stats.courses.total}
          sub={`${stats.enrollments.total} enrolled`}
          accent="bg-gradient-to-br from-amber-500 to-orange-500"
          href="/instructor-dashboard/courses"
        />
        <StatCard
          icon="📄"
          label="Lecture Notes"
          value={stats.notes.total}
          sub={`${stats.notes.totalDownloads} downloads`}
          accent="bg-gradient-to-br from-cyan-500 to-sky-600"
          href="/instructor-dashboard/upload"
        />
        <StatCard
          icon="📢"
          label="Announcements"
          value={stats.announcements.total}
          sub={`${stats.announcements.pinned} pinned`}
          accent="bg-gradient-to-br from-rose-500 to-pink-600"
          href="/instructor-dashboard/announcements"
        />
        <StatCard
          icon="📊"
          label="Class Average"
          value={`${stats.students.avgOverallPercentage?.toFixed(1) ?? 0}%`}
          sub={`${stats.students.struggling} need support`}
          accent="bg-gradient-to-br from-indigo-500 to-violet-600"
          href="/instructor-dashboard/performance"
        />
      </div>

      {/* ── Two-column charts row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity Trend — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-black text-slate-800 text-sm">
                📈 Content & Submission Trend
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-violet-500 inline-block" />
                <span className="text-slate-500">Assignments</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-emerald-500 inline-block" />
                <span className="text-slate-500">Quizzes</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-blue-400 inline-block" />
                <span className="text-slate-500">Submissions</span>
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.trendData}>
              <defs>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gQ" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
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
                dataKey="submissions"
                name="Submissions"
                stroke="#60a5fa"
                strokeWidth={2}
                fill="url(#gS)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown — 1/3 width */}
        <div className="flex flex-col gap-4">
          {/* Content breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex-1">
            <h2 className="font-black text-slate-800 text-sm mb-4">
              📦 Content Breakdown
            </h2>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart
                data={[
                  {
                    name: "Assign.",
                    value: stats.assignments.total,
                    fill: "#8b5cf6",
                  },
                  {
                    name: "Quizzes",
                    value: stats.quizzes.total,
                    fill: "#10b981",
                  },
                  { name: "Notes", value: stats.notes.total, fill: "#3b82f6" },
                  {
                    name: "Courses",
                    value: stats.courses.total,
                    fill: "#f59e0b",
                  },
                ]}
                barCategoryGap="20%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f8fafc"
                  vertical={false}
                />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                <Tooltip
                  formatter={(v) => [v, "Items"]}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {[
                    { fill: "#8b5cf6" },
                    { fill: "#10b981" },
                    { fill: "#3b82f6" },
                    { fill: "#f59e0b" },
                  ].map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Student performance summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-black text-slate-800 text-sm mb-3">
              🎯 Performance Summary
            </h2>
            <MiniStat
              label="Class average"
              value={`${stats.students.avgOverallPercentage?.toFixed(1) ?? 0}%`}
              color={
                (stats.students.avgOverallPercentage ?? 0) >= 70
                  ? "text-emerald-600"
                  : (stats.students.avgOverallPercentage ?? 0) >= 50
                    ? "text-amber-600"
                    : "text-red-600"
              }
            />
            <MiniStat
              label="Top performers (≥80%)"
              value={stats.students.topPerformers}
              color="text-emerald-600"
            />
            <MiniStat
              label="Need support (<50%)"
              value={stats.students.struggling}
              color="text-red-500"
            />
            <MiniStat
              label="Total activities graded"
              value={stats.students.totalActivities ?? 0}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Detailed breakdown cards */}
        <div className="grid grid-cols-1 gap-4 lg:col-span-2">
          {/* Row 1: Assignments + Quizzes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Assignment detail */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-base">
                  📋
                </div>
                <h3 className="font-black text-slate-800 text-sm">
                  Assignments
                </h3>
              </div>
              <MiniStat
                label="Published"
                value={stats.assignments.published}
                color="text-emerald-600"
              />
              <MiniStat
                label="Draft"
                value={stats.assignments.draft}
                color="text-amber-600"
              />
              <MiniStat
                label="Closed"
                value={stats.assignments.closed}
                color="text-slate-500"
              />
              <MiniStat
                label="Total submissions"
                value={stats.assignments.totalSubmissions}
                color="text-violet-600"
              />
              <MiniStat
                label="Total views"
                value={stats.assignments.totalViews}
              />
            </div>

            {/* Quiz detail */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-base">
                  🧩
                </div>
                <h3 className="font-black text-slate-800 text-sm">Quizzes</h3>
              </div>
              <MiniStat
                label="Published"
                value={stats.quizzes.published}
                color="text-emerald-600"
              />
              <MiniStat
                label="Draft"
                value={stats.quizzes.draft}
                color="text-amber-600"
              />
              <MiniStat
                label="Total questions"
                value={stats.quizzes.totalQuestions}
              />
              <MiniStat
                label="Total submissions"
                value={stats.quizzes.totalSubmissions}
                color="text-emerald-600"
              />
              <MiniStat label="Total views" value={stats.quizzes.totalViews} />
            </div>
          </div>

          {/* Row 2: Courses + Notes + Announcements */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Courses */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-base">
                  🎓
                </div>
                <h3 className="font-black text-slate-800 text-sm">Courses</h3>
              </div>
              <MiniStat
                label="Published"
                value={stats.courses.published}
                color="text-emerald-600"
              />
              <MiniStat
                label="Draft"
                value={stats.courses.draft}
                color="text-amber-600"
              />
              <MiniStat
                label="Total lessons"
                value={stats.courses.totalLessons}
              />
              <MiniStat
                label="Enrolled"
                value={stats.enrollments.total}
                color="text-amber-600"
              />
              <MiniStat
                label="Completed"
                value={`${completionRate}%`}
                color="text-emerald-600"
              />
              {stats.courses.avgRating > 0 && (
                <MiniStat
                  label="Avg rating"
                  value={`⭐ ${stats.courses.avgRating.toFixed(1)}`}
                />
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-base">
                  📄
                </div>
                <h3 className="font-black text-slate-800 text-sm">Notes</h3>
              </div>
              <MiniStat label="Total notes" value={stats.notes.total} />
              <MiniStat label="Total views" value={stats.notes.totalViews} />
              <MiniStat
                label="Downloads"
                value={stats.notes.totalDownloads}
                color="text-blue-600"
              />
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-base">
                  📢
                </div>
                <h3 className="font-black text-slate-800 text-sm">
                  Announcements
                </h3>
              </div>
              <MiniStat
                label="Published"
                value={stats.announcements.published}
                color="text-emerald-600"
              />
              <MiniStat label="Pinned" value={stats.announcements.pinned} />
              <MiniStat
                label="Total views"
                value={stats.announcements.totalViews}
              />
              <MiniStat
                label="Comments"
                value={stats.announcements.totalComments}
                color="text-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <h2 className="font-black text-slate-800 text-sm">
              🕐 Recent Activity
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Your latest content</p>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">
                No content yet
              </div>
            ) : (
              stats.recentActivity.map((item) => {
                const meta =
                  CONTENT_META[item.contentType] ?? CONTENT_META.assignment;
                return (
                  <div
                    key={`${item.contentType}-${item._id}`}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className={`w-8 h-8 rounded-xl ${meta.color.split(" ")[0]} flex items-center justify-center text-sm shrink-0`}
                    >
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {item.subject}
                        {item.status && ` · ${item.status}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatRelative(item.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Links Row ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-black text-slate-800 text-sm mb-4">
          ⚡ Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            {
              href: "/instructor-dashboard/assignments",
              label: "+ New Assignment",
              color:
                "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200",
            },
            {
              href: "/instructor-dashboard/quizzes",
              label: "+ New Quiz",
              color:
                "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
            },
            {
              href: "/instructor-dashboard/upload",
              label: "+ Upload Note",
              color:
                "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
            },
            {
              href: "/instructor-dashboard/video-course",
              label: "+ New Course",
              color:
                "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
            },
            {
              href: "/instructor-dashboard/announcements",
              label: "+ Announcement",
              color:
                "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200",
            },
            {
              href: "/instructor-dashboard/students",
              label: "Manage Students",
              color:
                "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200",
            },
            {
              href: "/instructor-dashboard/performance",
              label: "View Performance",
              color:
                "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200",
            },
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
