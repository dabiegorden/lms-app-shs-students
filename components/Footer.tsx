"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <span className="text-white font-black text-sm">EL</span>
              </div>
              <div>
                <span className="font-black text-white text-base">
                  EduLearn
                </span>
                <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
                  Ghana SHS
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              A modern Learning Management System built specifically for Senior
              High Schools in Ghana. Simple, mobile-friendly, and free.
            </p>
            <div className="flex items-center gap-1">
              <span className="text-sm">🇬🇭</span>
              <span className="text-xs text-slate-500 font-medium">
                Made with love for Ghana's students
              </span>
            </div>
          </div>

          {/* Students */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">For Students</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              {[
                "Register",
                "Login",
                "View Subjects",
                "My Assignments",
                "Take Quizzes",
                "Track Progress",
                "Announcements",
              ].map((l) => (
                <li key={l}>
                  <Link
                    href="#"
                    className="hover:text-blue-400 transition-colors"
                  >
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Teachers */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">For Teachers</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              {[
                "Teacher Login",
                "Upload Notes",
                "Create Quiz",
                "Post Announcement",
                "View Submissions",
                "Student Performance",
              ].map((l) => (
                <li key={l}>
                  <Link
                    href="#"
                    className="hover:text-blue-400 transition-colors"
                  >
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Support</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              {[
                "Help Center",
                "Contact Us",
                "Privacy Policy",
                "Terms of Service",
                "FAQ",
              ].map((l) => (
                <li key={l}>
                  <Link
                    href="#"
                    className="hover:text-blue-400 transition-colors"
                  >
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">
                Contact
              </p>
              <p className="text-sm">support@edulearn.gh</p>
              <p className="text-sm mt-1">+233 XX XXX XXXX</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} EduLearn Ghana. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs">
            <Link href="#" className="hover:text-blue-400 transition-colors">
              Privacy
            </Link>
            <Link href="#" className="hover:text-blue-400 transition-colors">
              Terms
            </Link>
            <Link href="#" className="hover:text-blue-400 transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
