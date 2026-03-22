"use client";
import { useState } from "react";

export default function DashboardPreview() {
  const [activeTab, setActiveTab] = useState<"student" | "instructor">(
    "student",
  );

  return (
    <section className="py-20 lg:py-28 bg-linear-to-br from-blue-900 via-indigo-900 to-slate-900 overflow-hidden relative">
      {/* BG decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block bg-white/10 text-blue-200 text-xs font-bold px-4 py-1.5 rounded-full mb-4 border border-white/10 tracking-wide uppercase">
            Dashboard Preview
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            See it in action
          </h2>
          <p className="mt-4 text-lg text-blue-200 max-w-xl mx-auto">
            Clean, simple dashboards designed for mobile-first use in Ghana's
            schools.
          </p>

          {/* Tab Toggle */}
          <div className="inline-flex bg-white/10 border border-white/10 rounded-2xl p-1 gap-1 mt-8">
            <button
              onClick={() => setActiveTab("student")}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "student" ? "bg-white text-blue-900 shadow-md" : "text-blue-200 hover:text-white"}`}
            >
              🎓 Student Dashboard
            </button>
            <button
              onClick={() => setActiveTab("instructor")}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "instructor" ? "bg-white text-indigo-900 shadow-md" : "text-blue-200 hover:text-white"}`}
            >
              👨‍🏫 Teacher Dashboard
            </button>
          </div>
        </div>

        {/* Dashboard Mockup */}
        {activeTab === "student" ? (
          <StudentDashboardMockup />
        ) : (
          <TeacherDashboardMockup />
        )}
      </div>
    </section>
  );
}

function StudentDashboardMockup() {
  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl mx-auto border border-white/20">
      {/* Top bar */}
      <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base">
            👤
          </div>
          <div>
            <p className="text-white font-black text-sm">Kofi Mensah</p>
            <p className="text-blue-200 text-xs">SHS 2 · Presec-Legon</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="text-xl">🔔</span>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] font-black flex items-center justify-center">
              3
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 bg-slate-50">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {
              label: "Lessons Done",
              value: "24",
              icon: "✅",
              color: "bg-blue-100 text-blue-700",
            },
            {
              label: "Assignments",
              value: "5",
              icon: "📝",
              color: "bg-amber-100 text-amber-700",
            },
            {
              label: "Quiz Score",
              value: "87%",
              icon: "🏆",
              color: "bg-green-100 text-green-700",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.color} rounded-2xl p-3 text-center`}
            >
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="font-black text-lg leading-none">{s.value}</div>
              <div className="text-[10px] font-medium mt-0.5 opacity-75">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Subject list */}
        <h3 className="font-black text-slate-700 text-sm mb-3">My Subjects</h3>
        <div className="flex flex-col gap-2">
          {[
            {
              name: "Mathematics",
              teacher: "Mr. Asante",
              progress: 80,
              color: "bg-blue-500",
            },
            {
              name: "English Language",
              teacher: "Mrs. Boateng",
              progress: 65,
              color: "bg-green-500",
            },
            {
              name: "Integrated Science",
              teacher: "Mr. Darko",
              progress: 92,
              color: "bg-purple-500",
            },
          ].map((s) => (
            <div
              key={s.name}
              className="bg-white rounded-xl p-3.5 border border-slate-100 flex items-center gap-3"
            >
              <div className={`w-2 h-10 ${s.color} rounded-full`} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                <p className="text-xs text-slate-400">{s.teacher}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-slate-700">
                  {s.progress}%
                </p>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${s.color} rounded-full`}
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Nav bar (mobile) */}
      <div className="bg-white border-t border-slate-100 px-6 py-3 flex justify-around items-center">
        {[
          { icon: "🏠", label: "Home", active: true },
          { icon: "📚", label: "Subjects", active: false },
          { icon: "📋", label: "Tasks", active: false },
          { icon: "📊", label: "Progress", active: false },
          { icon: "👤", label: "Profile", active: false },
        ].map((n) => (
          <button
            key={n.label}
            className={`flex flex-col items-center gap-0.5 ${n.active ? "text-blue-600" : "text-slate-400"}`}
          >
            <span className="text-base">{n.icon}</span>
            <span className="text-[9px] font-semibold">{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TeacherDashboardMockup() {
  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl mx-auto border border-white/20">
      {/* Sidebar + Main layout */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-52 bg-linear-to-b from-indigo-900 to-indigo-800 flex flex-col p-4 gap-1 sm:flex">
          <div className="flex items-center gap-2 mb-6 mt-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm">
              EL
            </div>
            <span className="text-white font-black text-sm">EduLearn</span>
          </div>
          {[
            { icon: "📊", label: "Dashboard", active: true },
            { icon: "📤", label: "Upload Notes", active: false },
            { icon: "📝", label: "Assignments", active: false },
            { icon: "🧠", label: "Quizzes", active: false },
            { icon: "📣", label: "Announcements", active: false },
            { icon: "📋", label: "Submissions", active: false },
            { icon: "📈", label: "Performance", active: false },
          ].map((m) => (
            <button
              key={m.label}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${m.active ? "bg-white text-indigo-900" : "text-indigo-200 hover:text-white hover:bg-white/10"}`}
            >
              <span>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 p-5 bg-slate-50">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Good Morning, Mr. Asante 👋
              </h3>
              <p className="text-xs text-slate-400">
                Mathematics · SHS 2 Presec-Legon
              </p>
            </div>
            <button className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors">
              + Upload
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Students", value: "142", icon: "🎓" },
              { label: "Materials", value: "38", icon: "📚" },
              { label: "Submissions", value: "67", icon: "📥" },
              { label: "Avg Score", value: "73%", icon: "📊" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-xl p-3 border border-slate-100 text-center"
              >
                <span className="text-lg">{s.icon}</span>
                <p className="font-black text-slate-900 text-lg mt-1">
                  {s.value}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Recent uploads */}
          <h4 className="font-black text-slate-700 text-xs mb-2">
            Recent Uploads
          </h4>
          <div className="flex flex-col gap-2">
            {[
              {
                title: "Chapter 5: Quadratic Equations",
                type: "PDF",
                date: "Today",
                views: 89,
              },
              {
                title: "Mid-Term Assignment 2",
                type: "DOCX",
                date: "Yesterday",
                views: 142,
              },
              {
                title: "Quiz: Algebra Basics",
                type: "QUIZ",
                date: "2 days ago",
                views: 67,
              },
            ].map((u) => (
              <div
                key={u.title}
                className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3"
              >
                <span
                  className={`text-[10px] font-black px-2 py-1 rounded-lg ${u.type === "PDF" ? "bg-red-100 text-red-600" : u.type === "QUIZ" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}
                >
                  {u.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {u.title}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {u.date} · {u.views} views
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
