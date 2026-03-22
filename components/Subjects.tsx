"use client";

const subjects = [
  {
    name: "Mathematics",
    icon: "📐",
    color: "from-blue-500 to-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-100",
    tag: "Core",
  },
  {
    name: "English Language",
    icon: "📖",
    color: "from-green-500 to-emerald-700",
    bg: "bg-green-50",
    border: "border-green-100",
    tag: "Core",
  },
  {
    name: "Integrated Science",
    icon: "🔬",
    color: "from-violet-500 to-purple-700",
    bg: "bg-violet-50",
    border: "border-violet-100",
    tag: "Core",
  },
  {
    name: "Social Studies",
    icon: "🌍",
    color: "from-orange-500 to-amber-600",
    bg: "bg-orange-50",
    border: "border-orange-100",
    tag: "Core",
  },
  {
    name: "ICT",
    icon: "💻",
    color: "from-sky-500 to-cyan-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
    tag: "Elective",
  },
  {
    name: "Elective Maths",
    icon: "🧮",
    color: "from-blue-600 to-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    tag: "Elective",
  },
  {
    name: "Physics",
    icon: "⚡",
    color: "from-yellow-500 to-orange-500",
    bg: "bg-yellow-50",
    border: "border-yellow-100",
    tag: "Science",
  },
  {
    name: "Chemistry",
    icon: "🧪",
    color: "from-pink-500 to-rose-600",
    bg: "bg-pink-50",
    border: "border-pink-100",
    tag: "Science",
  },
  {
    name: "Biology",
    icon: "🌱",
    color: "from-lime-500 to-green-600",
    bg: "bg-lime-50",
    border: "border-lime-100",
    tag: "Science",
  },
  {
    name: "Economics",
    icon: "📈",
    color: "from-teal-500 to-cyan-600",
    bg: "bg-teal-50",
    border: "border-teal-100",
    tag: "Business",
  },
  {
    name: "Government",
    icon: "🏛️",
    color: "from-slate-500 to-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-100",
    tag: "Arts",
  },
  {
    name: "History",
    icon: "📜",
    color: "from-amber-600 to-yellow-700",
    bg: "bg-amber-50",
    border: "border-amber-100",
    tag: "Arts",
  },
];

export default function Subjects() {
  return (
    <section id="subjects" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 border border-green-200 tracking-wide uppercase">
            Subjects Covered
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            All your{" "}
            <span className="bg-linear-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              SHS subjects
            </span>{" "}
            in one place
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            Core, elective, science, business, and arts — every subject taught
            in Ghana's Senior High Schools is covered.
          </p>
        </div>

        {/* Subjects Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {subjects.map((s) => (
            <div
              key={s.name}
              className={`relative ${s.bg} ${s.border} border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group`}
            >
              {/* Tag */}
              <span
                className="absolute top-3 right-3 text-[9px] font-black text-white uppercase px-2 py-0.5 rounded-full bg-linear-to-r opacity-80"
                style={{ background: "rgba(100,116,139,0.5)" }}
              >
                {s.tag}
              </span>

              {/* Icon circle */}
              <div
                className={`w-12 h-12 rounded-xl bg-linear-to-br ${s.color} flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 transition-transform`}
              >
                {s.icon}
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-sm leading-tight">
                  {s.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Tap to explore →
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-sm text-slate-400 mt-10 font-medium">
          + More elective subjects added regularly based on school curriculum
        </p>
      </div>
    </section>
  );
}
