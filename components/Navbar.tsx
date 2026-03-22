"use client";
import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-blue-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md">
              <span className="text-white font-black text-sm tracking-tight">
                EL
              </span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-blue-900 text-base tracking-tight">
                EduLearn
              </span>
              <span className="text-[10px] text-blue-400 font-medium tracking-widest uppercase">
                Ghana SHS
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="#subjects"
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
            >
              Subjects
            </Link>
            <Link
              href="#testimonials"
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
            >
              Stories
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900 px-4 py-2 rounded-lg hover:bg-blue-50 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-5 py-2 rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span
              className={`w-5 h-0.5 bg-slate-700 rounded transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
            />
            <span
              className={`w-5 h-0.5 bg-slate-700 rounded transition-all ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`w-5 h-0.5 bg-slate-700 rounded transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-blue-50 px-4 py-4 flex flex-col gap-3 shadow-lg">
          <Link
            href="#features"
            className="text-sm font-medium text-slate-600 py-2 px-3 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-slate-600 py-2 px-3 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            How It Works
          </Link>
          <Link
            href="#subjects"
            className="text-sm font-medium text-slate-600 py-2 px-3 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Subjects
          </Link>
          <div className="flex gap-3 pt-2 border-t border-blue-50">
            <Link
              href="/login"
              className="flex-1 text-center text-sm font-semibold text-blue-700 border border-blue-200 py-2.5 rounded-xl hover:bg-blue-50 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="flex-1 text-center text-sm font-semibold text-white bg-linear-to-r from-blue-600 to-blue-700 py-2.5 rounded-xl shadow-md transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
