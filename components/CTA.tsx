"use client";
import Link from "next/link";

export default function CTA() {
  return (
    <section className="py-20 lg:py-28 bg-linear-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
      {/* Decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-900/30 rounded-full translate-x-1/3 translate-y-1/3" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-block bg-white/15 text-white text-xs font-bold px-4 py-1.5 rounded-full mb-6 border border-white/20 tracking-wide uppercase">
          🇬🇭 Free for all Ghana SHS schools
        </span>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-6">
          Ready to transform <br className="hidden sm:block" />
          how your school learns?
        </h2>

        <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-10">
          Join thousands of students and teachers across Ghana already using
          EduLearn. No setup fees. No downloads. Just learning.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-blue-700 font-black px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:bg-blue-50 transition-all text-base"
          >
            🎓 Join as Student — It's Free
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 px-8 py-4 rounded-2xl transition-all text-base"
          >
            👨‍🏫 Teacher Portal
          </Link>
        </div>

        <p className="text-blue-200 text-sm mt-8 font-medium">
          No credit card needed · Works on all phones · Designed for Ghana
        </p>
      </div>
    </section>
  );
}
