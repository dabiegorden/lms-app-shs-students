"use client";

const studentFeatures = [
  {
    icon: "📚",
    title: "View Subjects",
    desc: "Access all your SHS subjects — Maths, English, Science, ICT, and more in one place.",
  },
  {
    icon: "📥",
    title: "Download Materials",
    desc: "Download lecture notes, PDFs, PowerPoints, and Word documents anytime, even offline.",
  },
  {
    icon: "✍️",
    title: "Submit Assignments",
    desc: "Upload and submit your assignments directly to your teacher with ease.",
  },
  {
    icon: "🧠",
    title: "Take Quizzes",
    desc: "Test your knowledge with quizzes created by your instructors and see instant results.",
  },
  {
    icon: "📊",
    title: "Track Progress",
    desc: "See your scores, quiz results, and which lessons you've completed at a glance.",
  },
  {
    icon: "🔔",
    title: "Notifications",
    desc: "Get notified instantly when your teacher uploads new materials or posts an announcement.",
  },
];

const teacherFeatures = [
  {
    icon: "📤",
    title: "Upload Materials",
    desc: "Upload lecture notes, assignments, and study materials in PDF, Word, or PowerPoint formats.",
  },
  {
    icon: "📝",
    title: "Create Quizzes",
    desc: "Build multiple-choice quizzes for your students and track their performance automatically.",
  },
  {
    icon: "📣",
    title: "Post Announcements",
    desc: "Send important updates and announcements directly to all your students.",
  },
  {
    icon: "📋",
    title: "View Submissions",
    desc: "Review and manage student assignment submissions in one organized dashboard.",
  },
  {
    icon: "📈",
    title: "Student Performance",
    desc: "See quiz scores, assignment results, and track each student's academic progress.",
  },
  {
    icon: "🗂️",
    title: "Organize by Subject",
    desc: "Keep all materials neatly organized by subject and topic for easy student access.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 border border-blue-200 tracking-wide uppercase">
            Platform Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Everything you need to{" "}
            <span className="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              teach & learn
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            A complete learning platform designed specifically for Ghana's
            Senior High Schools — simple, fast, and works on any device.
          </p>
        </div>

        {/* Two Tabs: Students / Teachers */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Student Features */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg shadow-md">
                🎓
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  For Students
                </h3>
                <p className="text-sm text-slate-500">
                  Simple, clean, and friendly
                </p>
              </div>
            </div>
            <div className="grid gap-4">
              {studentFeatures.map((f, i) => (
                <div
                  key={f.title}
                  className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                    {f.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      {f.title}
                    </h4>
                    <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Teacher Features */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg shadow-md">
                👨‍🏫
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  For Teachers
                </h3>
                <p className="text-sm text-slate-500">
                  Powerful, professional, easy to use
                </p>
              </div>
            </div>
            <div className="grid gap-4">
              {teacherFeatures.map((f, i) => (
                <div
                  key={f.title}
                  className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                    {f.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      {f.title}
                    </h4>
                    <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                      {f.desc}
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
