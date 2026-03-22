"use client";

const studentSteps = [
  {
    step: "01",
    title: "Register Your Account",
    desc: "Sign up with your name, class level, and school email. Takes less than 2 minutes.",
    icon: "✏️",
  },
  {
    step: "02",
    title: "Choose Your Subjects",
    desc: "Select the subjects you study — Maths, English, Science, ICT, and more.",
    icon: "📚",
  },
  {
    step: "03",
    title: "Access Materials",
    desc: "Open lecture notes, download study files, and view assignments uploaded by your teachers.",
    icon: "📖",
  },
  {
    step: "04",
    title: "Learn & Track Progress",
    desc: "Take quizzes, submit assignments, and watch your academic progress grow daily.",
    icon: "📊",
  },
];

const teacherSteps = [
  {
    step: "01",
    title: "Login to Dashboard",
    desc: "Access your secure teacher dashboard with a single sign-in.",
    icon: "🔐",
  },
  {
    step: "02",
    title: "Upload Your Materials",
    desc: "Upload lecture notes, assignments, and quizzes organized by subject and topic.",
    icon: "📤",
  },
  {
    step: "03",
    title: "Engage Your Students",
    desc: "Post announcements, create quizzes, and send notifications to keep students active.",
    icon: "📣",
  },
  {
    step: "04",
    title: "Monitor Performance",
    desc: "Review student submissions, quiz scores, and track class-wide academic progress.",
    icon: "📈",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 lg:py-28 bg-linear-to-br from-slate-50 to-blue-50/60"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 border border-indigo-200 tracking-wide uppercase">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Up and running in{" "}
            <span className="bg-linear-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
              minutes
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            No technical skills needed. If you can use WhatsApp, you can use
            EduLearn.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Student Flow */}
          <div>
            <div className="flex items-center gap-2 mb-8">
              <span className="text-2xl">🎓</span>
              <h3 className="text-2xl font-black text-slate-900">
                Student Journey
              </h3>
            </div>
            <div className="flex flex-col gap-0">
              {studentSteps.map((s, i) => (
                <div key={s.step} className="flex gap-4">
                  {/* Step connector */}
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shadow-md shrink-0">
                      {s.step}
                    </div>
                    {i < studentSteps.length - 1 && (
                      <div className="w-0.5 flex-1 bg-linear-to-b from-blue-300 to-blue-100 my-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div
                    className={`pb-8 ${i === studentSteps.length - 1 ? "pb-0" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{s.icon}</span>
                      <h4 className="font-bold text-slate-800">{s.title}</h4>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Teacher Flow */}
          <div>
            <div className="flex items-center gap-2 mb-8">
              <span className="text-2xl">👨‍🏫</span>
              <h3 className="text-2xl font-black text-slate-900">
                Teacher Journey
              </h3>
            </div>
            <div className="flex flex-col gap-0">
              {teacherSteps.map((s, i) => (
                <div key={s.step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shadow-md shrink-0">
                      {s.step}
                    </div>
                    {i < teacherSteps.length - 1 && (
                      <div className="w-0.5 flex-1 bg-linear-to-b from-indigo-300 to-indigo-100 my-1" />
                    )}
                  </div>
                  <div
                    className={`pb-8 ${i === teacherSteps.length - 1 ? "pb-0" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{s.icon}</span>
                      <h4 className="font-bold text-slate-800">{s.title}</h4>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
