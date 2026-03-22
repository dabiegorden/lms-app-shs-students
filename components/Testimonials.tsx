"use client";

const testimonials = [
  {
    name: "Abena Mensah",
    role: "SHS 3 Student",
    school: "Achimota School",
    avatar: "👩🏾‍🎓",
    quote:
      "EduLearn changed how I study. I can access my notes at midnight and review everything on my phone. My grades have improved so much this term!",
    rating: 5,
    color: "border-blue-200 bg-blue-50/50",
  },
  {
    name: "Mr. Kofi Darko",
    role: "Science Teacher",
    school: "Presec-Legon",
    avatar: "👨🏾‍🏫",
    quote:
      "Finally a platform that works on our students' phones. Uploading notes is very easy and I can see which students actually opened the materials. Brilliant!",
    rating: 5,
    color: "border-indigo-200 bg-indigo-50/50",
  },
  {
    name: "Kweku Asante",
    role: "SHS 2 Student",
    school: "GSTS",
    avatar: "👦🏾",
    quote:
      "The quizzes help me prepare for exams. I love seeing my score go up. EduLearn is like having extra lessons without paying extra fees.",
    rating: 5,
    color: "border-green-200 bg-green-50/50",
  },
  {
    name: "Mrs. Akua Boateng",
    role: "English Instructor",
    school: "Wesley Girls High",
    avatar: "👩🏾‍💼",
    quote:
      "My students are more engaged than ever. I post an announcement and all 80 students see it in minutes. This platform saves me so much time.",
    rating: 5,
    color: "border-purple-200 bg-purple-50/50",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block bg-yellow-100 text-yellow-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 border border-yellow-200 tracking-wide uppercase">
            Real Stories
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Loved by students{" "}
            <span className="bg-linear-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
              &
            </span>{" "}
            teachers
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            Hear from the students and teachers already using EduLearn across
            Ghana.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className={`${t.color} border rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md transition-all`}
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <span key={i} className="text-yellow-400 text-sm">
                    ★
                  </span>
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm text-slate-700 leading-relaxed flex-1 italic">
                "{t.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <span className="text-3xl">{t.avatar}</span>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {t.school}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
