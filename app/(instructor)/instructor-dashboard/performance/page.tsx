"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentInfo {
  name: string;
  email: string;
  profilePicture?: string;
  classLevel?: string;
  school?: string;
}

interface ActivityRecord {
  type: "quiz" | "assignment";
  title: string;
  subject: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
  gradedAt: string | null;
}

interface SubjectStat {
  subject: string;
  totalActivities: number;
  averagePercentage: number;
  quizCount: number;
  assignmentCount: number;
}

interface StudentPerformance {
  _id: string;
  student: string;
  studentInfo?: StudentInfo;
  totalActivities: number;
  overallPercentage: number;
  totalScore: number;
  totalMaxScore: number;
  quizCount: number;
  quizAveragePercentage: number;
  assignmentCount: number;
  assignmentAveragePercentage: number;
  subjectStats: SubjectStat[];
  recentActivity: ActivityRecord[];
  lastActivityAt: string | null;
  aiInsight: string;
  aiInsightGeneratedAt: string | null;
}

interface ClassSummary {
  classAvgPercentage: number;
  totalStudents: number;
  passing: number;
  topPerformers: number;
  struggling: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getGrade(pct: number) {
  if (pct >= 80)
    return {
      label: "A",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    };
  if (pct >= 70)
    return {
      label: "B",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    };
  if (pct >= 60)
    return {
      label: "C",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
    };
  if (pct >= 50)
    return {
      label: "D",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    };
  return {
    label: "F",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  };
}

function getScoreColor(pct: number) {
  if (pct >= 80) return "#10b981";
  if (pct >= 60) return "#3b82f6";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({
  percentage,
  size = 56,
}: {
  percentage: number;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = getScoreColor(percentage);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#f1f5f9"
          strokeWidth={6}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black" style={{ color }}>
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ─── Mini Spark Line ──────────────────────────────────────────────────────────
function SparkLine({ data }: { data: ActivityRecord[] }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-8 flex items-center text-xs text-slate-400 italic">
        No trend data
      </div>
    );
  }

  const chartData = data.slice(-10).map((a, i) => ({
    i,
    pct: Math.round(a.percentage),
  }));

  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="pct"
          stroke="#6366f1"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── AI Insight Panel ─────────────────────────────────────────────────────────
function AIInsightPanel({
  studentId,
  insight,
  generatedAt,
  onRefresh,
}: {
  studentId: string;
  insight: string;
  generatedAt: string | null;
  onRefresh: (studentId: string, insight: string, generatedAt: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/performance/${studentId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onRefresh(studentId, data.insight, data.generatedAt);
      toast.success("AI insight generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate insight.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-linear-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-xs font-black text-violet-700 uppercase tracking-wider">
            AI Performance Insight
          </span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-100 hover:bg-violet-200 disabled:opacity-50 px-3 py-1.5 rounded-xl transition-colors"
        >
          {loading ? <Spinner sm /> : "🔄"}
          {loading ? "Analysing…" : insight ? "Refresh" : "Generate"}
        </button>
      </div>

      {insight ? (
        <>
          <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
          {generatedAt && (
            <p className="text-xs text-slate-400">
              Generated {formatDate(generatedAt)}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500 italic">
          Click "Generate" to get an AI-powered analysis of this student's
          performance.
        </p>
      )}
    </div>
  );
}

// ─── Student Detail Modal ─────────────────────────────────────────────────────
function StudentDetailModal({
  studentPerf,
  onClose,
  onInsightRefresh,
}: {
  studentPerf: StudentPerformance;
  onClose: () => void;
  onInsightRefresh: (
    studentId: string,
    insight: string,
    generatedAt: string,
  ) => void;
}) {
  const [fullPerf, setFullPerf] = useState<StudentPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const fetchFull = async () => {
      try {
        const res = await fetch(`/api/performance/${studentPerf.student}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setFullPerf(data.data);
      } catch {
        setFullPerf(studentPerf); // fallback to partial data
      } finally {
        setLoading(false);
      }
    };
    fetchFull();
  }, [studentPerf.student]);

  const perf = fullPerf ?? studentPerf;
  const grade = getGrade(perf.overallPercentage);
  const info = perf.studentInfo ?? (studentPerf.studentInfo as any);

  // Chart data
  const trendData = perf.recentActivity.map((a, i) => ({
    name: `#${i + 1}`,
    score: Math.round(a.percentage),
    type: a.type,
  }));

  const subjectRadarData = perf.subjectStats.map((s) => ({
    subject: s.subject.length > 10 ? s.subject.slice(0, 10) + "…" : s.subject,
    score: Math.round(s.averagePercentage),
    fullSubject: s.subject,
  }));

  const quizVsAssignData = perf.subjectStats.map((s) => ({
    subject: s.subject.length > 8 ? s.subject.slice(0, 8) + "…" : s.subject,
    fullSubject: s.subject,
    quizAvg: Math.round(s.averagePercentage),
    quizCount: s.quizCount,
    assignCount: s.assignmentCount,
  }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="bg-linear-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center gap-4 shrink-0">
        <div className="w-10 h-10 rounded-full bg-linear-to-br from-violet-400 to-purple-500 flex items-center justify-center font-black text-white text-sm shrink-0">
          {info ? getInitials(info.name) : "??"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-sm truncate">
            {info?.name ?? "Student"} — Performance Report
          </p>
          <p className="text-slate-400 text-xs">
            {info?.email} {info?.classLevel && `· ${info.classLevel}`}
          </p>
        </div>
        <div
          className={`w-10 h-10 rounded-xl ${grade.bg} border ${grade.border} flex items-center justify-center shrink-0`}
        >
          <span className={`font-black text-lg ${grade.color}`}>
            {grade.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center font-bold"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : (
          <>
            {/* ── Stats Overview ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Overall",
                  value: `${perf.overallPercentage.toFixed(1)}%`,
                  sub: `${perf.totalScore}/${perf.totalMaxScore} marks`,
                  icon: "🎯",
                  color: "from-violet-500 to-purple-600",
                },
                {
                  label: "Quiz Avg",
                  value: `${perf.quizAveragePercentage.toFixed(1)}%`,
                  sub: `${perf.quizCount} quiz${perf.quizCount !== 1 ? "zes" : ""}`,
                  icon: "🧩",
                  color: "from-emerald-500 to-teal-600",
                },
                {
                  label: "Assignment Avg",
                  value: `${perf.assignmentAveragePercentage.toFixed(1)}%`,
                  sub: `${perf.assignmentCount} assignment${perf.assignmentCount !== 1 ? "s" : ""}`,
                  icon: "📋",
                  color: "from-blue-500 to-indigo-600",
                },
                {
                  label: "Activities",
                  value: String(perf.totalActivities),
                  sub: perf.lastActivityAt
                    ? `Last: ${formatDate(perf.lastActivityAt)}`
                    : "No activity yet",
                  icon: "📊",
                  color: "from-amber-500 to-orange-600",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-2"
                >
                  <div
                    className={`w-8 h-8 rounded-xl bg-linear-to-br ${stat.color} flex items-center justify-center text-base`}
                  >
                    {stat.icon}
                  </div>
                  <p className="font-black text-slate-800 text-xl leading-none">
                    {stat.value}
                  </p>
                  <div>
                    <p className="text-xs font-bold text-slate-600">
                      {stat.label}
                    </p>
                    <p className="text-xs text-slate-400">{stat.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Charts Row ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Score Trend */}
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <h3 className="font-black text-slate-800 text-sm mb-4">
                  📈 Score Trend
                </h3>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient
                          id="scoreGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#8b5cf6"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor="#8b5cf6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v) => [`${v}%`, "Score"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#scoreGrad)"
                        dot={{ fill: "#8b5cf6", r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                    No activity data yet
                  </div>
                )}
              </div>

              {/* Subject Radar */}
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <h3 className="font-black text-slate-800 text-sm mb-4">
                  🕸️ Subject Breakdown
                </h3>
                {subjectRadarData.length >= 3 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={subjectRadarData}>
                      <PolarGrid stroke="#f1f5f9" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fontSize: 9 }}
                      />
                      <PolarRadiusAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 8 }}
                      />
                      <Radar
                        dataKey="score"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Tooltip
                        formatter={(v, _n, props) => [
                          `${v}%`,
                          props.payload?.fullSubject ?? "Score",
                        ]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : subjectRadarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={subjectRadarData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        dataKey="subject"
                        type="category"
                        tick={{ fontSize: 9 }}
                        width={80}
                      />
                      <Tooltip
                        formatter={(v) => [`${v}%`, "Avg Score"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                        {subjectRadarData.map((entry, i) => (
                          <Cell key={i} fill={getScoreColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                    No subject data yet
                  </div>
                )}
              </div>
            </div>

            {/* ── AI Insight ──────────────────────────────────────────────── */}
            <AIInsightPanel
              studentId={perf.student}
              insight={perf.aiInsight}
              generatedAt={perf.aiInsightGeneratedAt}
              onRefresh={onInsightRefresh}
            />

            {/* ── Subject Stats Table ─────────────────────────────────────── */}
            {perf.subjectStats.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-50">
                  <h3 className="font-black text-slate-800 text-sm">
                    📚 Subject Performance
                  </h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {perf.subjectStats
                    .sort((a, b) => b.averagePercentage - a.averagePercentage)
                    .map((s) => {
                      const g = getGrade(s.averagePercentage);
                      return (
                        <div
                          key={s.subject}
                          className="px-4 py-3 flex items-center gap-3"
                        >
                          <div
                            className={`w-7 h-7 rounded-lg ${g.bg} border ${g.border} flex items-center justify-center shrink-0`}
                          >
                            <span className={`text-xs font-black ${g.color}`}>
                              {g.label}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700 truncate">
                              {s.subject}
                            </p>
                            <p className="text-xs text-slate-400">
                              {s.quizCount} quiz{s.quizCount !== 1 ? "zes" : ""}{" "}
                              · {s.assignmentCount} assignment
                              {s.assignmentCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-black ${g.color}`}>
                              {s.averagePercentage.toFixed(1)}%
                            </p>
                            <p className="text-xs text-slate-400">
                              {s.totalActivities} activities
                            </p>
                          </div>
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${s.averagePercentage}%`,
                                backgroundColor: getScoreColor(
                                  s.averagePercentage,
                                ),
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── Recent Activity Log ─────────────────────────────────────── */}
            {perf.recentActivity.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-50">
                  <h3 className="font-black text-slate-800 text-sm">
                    🕐 Recent Activity
                  </h3>
                </div>
                <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {[...perf.recentActivity]
                    .reverse()
                    .slice(0, 20)
                    .map((a, i) => {
                      const g = getGrade(a.percentage);
                      return (
                        <div
                          key={i}
                          className="px-4 py-3 flex items-center gap-3"
                        >
                          <div className="shrink-0">
                            <span className="text-base">
                              {a.type === "quiz" ? "🧩" : "📋"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {a.title}
                            </p>
                            <p className="text-xs text-slate-400">
                              {a.subject} · {formatDate(a.submittedAt)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-black ${g.color}`}>
                              {a.percentage.toFixed(1)}%
                            </p>
                            <p className="text-xs text-slate-400">
                              {a.score}/{a.maxScore}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────
function StudentCard({
  perf,
  rank,
  onClick,
}: {
  perf: StudentPerformance;
  rank: number;
  onClick: () => void;
}) {
  const info = perf.studentInfo;
  const grade = getGrade(perf.overallPercentage);

  const rankBadge =
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden"
    >
      <div className="h-1 bg-linear-to-r from-violet-500 to-purple-500" />
      <div className="p-4 flex flex-col gap-3">
        {/* Student info row */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {info?.profilePicture ? (
              <img
                src={info.profilePicture}
                alt={info.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-violet-400 to-purple-500 flex items-center justify-center font-black text-white text-sm">
                {info ? getInitials(info.name) : "??"}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 text-xs">
              {rankBadge}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">
              {info?.name ?? "Unknown"}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {info?.classLevel && `${info.classLevel} · `}
              {info?.school ?? info?.email}
            </p>
          </div>
          <ScoreRing percentage={perf.overallPercentage} size={52} />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-black px-2.5 py-1 rounded-full border ${grade.bg} ${grade.border} ${grade.color}`}
          >
            Grade {grade.label}
          </span>
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
            {perf.quizCount}Q · {perf.assignmentCount}A
          </span>
          {perf.totalActivities > 0 && (
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
              {perf.totalActivities} activities
            </span>
          )}
        </div>

        {/* Sparkline */}
        <div className="h-8">
          <SparkLine data={perf.recentActivity} />
        </div>

        {/* Mini subject pills */}
        {perf.subjectStats.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {perf.subjectStats
              .sort((a, b) => b.averagePercentage - a.averagePercentage)
              .slice(0, 3)
              .map((s) => {
                const sg = getGrade(s.averagePercentage);
                return (
                  <span
                    key={s.subject}
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${sg.bg} ${sg.color}`}
                  >
                    {s.subject.split(" ")[0]} {s.averagePercentage.toFixed(0)}%
                  </span>
                );
              })}
          </div>
        )}

        {/* AI insight preview */}
        {perf.aiInsight && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed border-t border-slate-50 pt-2">
            ✨ {perf.aiInsight}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-50 pt-2">
          <span>
            Last active:{" "}
            {perf.lastActivityAt ? formatDate(perf.lastActivityAt) : "—"}
          </span>
          <span className="text-violet-600 font-bold">View details →</span>
        </div>
      </div>
    </div>
  );
}

// ─── Distribution Chart ───────────────────────────────────────────────────────
function DistributionChart({ students }: { students: StudentPerformance[] }) {
  const bands = [
    { label: "80–100%", min: 80, max: 101, color: "#10b981" },
    { label: "60–79%", min: 60, max: 80, color: "#3b82f6" },
    { label: "50–59%", min: 50, max: 60, color: "#f59e0b" },
    { label: "0–49%", min: 0, max: 50, color: "#ef4444" },
  ];

  const data = bands.map((b) => ({
    ...b,
    count: students.filter(
      (s) => s.overallPercentage >= b.min && s.overallPercentage < b.max,
    ).length,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#f1f5f9"
          vertical={false}
        />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v) => [v, "Students"]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InstructorStudentsPerfomancePage() {
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentPerformance | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [sort, setSort] = useState("top");
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterSubject, sort]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "18",
        sort,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filterSubject && { subject: filterSubject }),
      });
      const res = await fetch(`/api/performance?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStudents(data.data);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load performance data.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, filterSubject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInsightRefresh = (
    studentId: string,
    insight: string,
    generatedAt: string,
  ) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.student === studentId
          ? { ...s, aiInsight: insight, aiInsightGeneratedAt: generatedAt }
          : s,
      ),
    );
    if (selectedStudent?.student === studentId) {
      setSelectedStudent((prev) =>
        prev
          ? { ...prev, aiInsight: insight, aiInsightGeneratedAt: generatedAt }
          : prev,
      );
    }
  };

  const isFiltered = !!(debouncedSearch || filterSubject);

  // Unique subjects from loaded data
  const allSubjects = Array.from(
    new Set(students.flatMap((s) => s.subjectStats.map((sub) => sub.subject))),
  ).sort();

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl shadow-sm">
            📊
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Student Performance
            </h1>
            <p className="text-slate-500 text-sm">
              {pagination
                ? `${pagination.total} student${pagination.total !== 1 ? "s" : ""} tracked`
                : "Track, analyse, and improve student outcomes"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            {
              label: "Class Average",
              value: `${summary.classAvgPercentage.toFixed(1)}%`,
              icon: "🎯",
              color: "from-violet-500 to-purple-600",
            },
            {
              label: "Total Students",
              value: String(summary.totalStudents),
              icon: "👥",
              color: "from-slate-500 to-slate-700",
            },
            {
              label: "Top Performers",
              value: String(summary.topPerformers),
              icon: "🏆",
              color: "from-emerald-500 to-teal-600",
            },
            {
              label: "Passing",
              value: String(summary.passing),
              icon: "✅",
              color: "from-blue-500 to-indigo-600",
            },
            {
              label: "Need Support",
              value: String(summary.struggling),
              icon: "⚠️",
              color: "from-red-500 to-rose-600",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3"
            >
              <div
                className={`w-9 h-9 rounded-xl bg-linear-to-br ${stat.color} flex items-center justify-center text-base shrink-0 shadow-sm`}
              >
                {stat.icon}
              </div>
              <div className="min-w-0">
                <p className="font-black text-slate-800 text-lg leading-none">
                  {stat.value}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Distribution Chart + Quick Stats ────────────────────────── */}
      {students.length > 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-black text-slate-800 text-sm mb-4">
            📊 Score Distribution
          </h2>
          <DistributionChart students={students} />
        </div>
      )}

      {/* ── Filters Bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
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
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white transition-all min-w-40"
        >
          <option value="">All Subjects</option>
          {allSubjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white transition-all min-w-44"
        >
          <option value="top">🏆 Top Performers</option>
          <option value="bottom">⚠️ Needs Support</option>
          <option value="recent">🕐 Most Recent</option>
          <option value="name">🔤 Name A–Z</option>
        </select>

        {isFiltered && (
          <button
            onClick={() => {
              setSearch("");
              setFilterSubject("");
              setSort("top");
            }}
            className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Student Grid ─────────────────────────────────────────────── */}
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
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center text-3xl mb-4">
            {isFiltered ? "🔍" : "📊"}
          </div>
          <h3 className="font-black text-slate-800 text-base mb-1">
            {isFiltered
              ? "No students match your filters"
              : "No performance data yet"}
          </h3>
          <p className="text-slate-500 text-sm max-w-xs">
            {isFiltered
              ? "Try adjusting your search or filters."
              : "Performance data will appear here once students submit quizzes or assignments."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s, i) => (
            <StudentCard
              key={s._id}
              perf={s}
              rank={(page - 1) * 18 + i + 1}
              onClick={() => setSelectedStudent(s)}
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
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${pagination.page === p ? "bg-linear-to-r from-violet-600 to-purple-600 text-white shadow-md" : "border border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700"}`}
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

      {/* ── Student Detail Modal ─────────────────────────────────────── */}
      {selectedStudent && (
        <StudentDetailModal
          studentPerf={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onInsightRefresh={handleInsightRefresh}
        />
      )}
    </div>
  );
}
