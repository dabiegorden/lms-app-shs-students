"use client";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50 pt-16">
      {/* Background decorative shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-80 h-80 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-sky-200/40 blur-3xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23334155' fill-opacity='1'%3E%3Cpath d='M0 0h1v40H0V0zm40 0v1H0V0h40zM0 20h40v1H0v-1z'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text Content */}
          <div className="flex flex-col gap-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-bold px-3.5 py-1.5 rounded-full w-fit border border-blue-200">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              🇬🇭 Built for Ghana Senior High Schools
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.08] tracking-tight">
              Learn Smarter,{" "}
              <span className="relative">
                <span className="relative z-10 bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Anywhere
                </span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-yellow-300/50 rounded z-0 skew-x-1" />
              </span>{" "}
              Anytime
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed max-w-xl">
              EduLearn connects Ghana's SHS students with their teachers —
              access lecture notes, submit assignments, take quizzes, and track
              your progress, all from your phone.
            </p>

            {/* Stats Row */}
            <div className="flex items-center gap-6 py-2">
              {[
                { num: "5,000+", label: "Students" },
                { num: "200+", label: "Teachers" },
                { num: "12", label: "Subjects" },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <span className="text-2xl font-black text-blue-700">
                    {stat.num}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-7 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm"
              >
                <span>🎓</span>
                Start Learning Free
              </Link>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-bold px-7 py-3.5 rounded-xl shadow-md hover:shadow-lg border border-slate-200 transition-all text-sm"
              >
                <span>👨‍🏫</span>
                Teacher Portal
              </Link>
            </div>

            {/* Trust line */}
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Free for all SHS students · Works on any phone · No app download
              needed
            </p>
          </div>

          {/* Right: Dashboard Preview Card */}
          <div className="relative flex justify-center lg:justify-end">
            {/* Floating card: Student Dashboard */}
            <div className="relative w-full max-w-sm lg:max-w-md">
              {/* Shadow card behind */}
              <div className="absolute inset-0 translate-x-4 translate-y-4 bg-blue-200 rounded-3xl" />

              {/* Main card */}
              <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-blue-100">
                {/* Card Header */}
                <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-xs font-medium">
                      Welcome back 👋
                    </p>
                    <p className="text-white font-bold text-base">
                      Kofi Mensah
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">
                    👤
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="px-5 pt-4 pb-2">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Weekly Progress
                    </span>
                    <span className="text-xs font-bold text-blue-600">74%</span>
                  </div>
                  <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full w-[74%] bg-linear-to-r from-blue-500 to-indigo-500 rounded-full" />
                  </div>
                </div>

                {/* Subject Cards */}
                <div className="px-5 py-3 grid grid-cols-2 gap-2.5">
                  {[
                    {
                      name: "Mathematics",
                      icon: "📐",
                      color: "bg-blue-50 border-blue-100",
                      progress: 80,
                    },
                    {
                      name: "English",
                      icon: "📖",
                      color: "bg-green-50 border-green-100",
                      progress: 65,
                    },
                    {
                      name: "Science",
                      icon: "🔬",
                      color: "bg-purple-50 border-purple-100",
                      progress: 90,
                    },
                    {
                      name: "ICT",
                      icon: "💻",
                      color: "bg-orange-50 border-orange-100",
                      progress: 55,
                    },
                  ].map((s) => (
                    <div
                      key={s.name}
                      className={`${s.color} border rounded-xl p-3 flex flex-col gap-1.5`}
                    >
                      <span className="text-xl">{s.icon}</span>
                      <span className="text-xs font-bold text-slate-700">
                        {s.name}
                      </span>
                      <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-blue-400 to-indigo-400 rounded-full"
                          style={{ width: `${s.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom notification */}
                <div className="mx-5 mb-4 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <span className="text-base">🔔</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">
                      New Assignment!
                    </p>
                    <p className="text-[10px] text-amber-600">
                      Mr. Asante uploaded Math HW
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -top-4 -right-4 bg-green-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg rotate-6">
                LIVE DEMO →
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
