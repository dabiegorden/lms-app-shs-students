"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Eye Icon ────────────────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4.5 h-4.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4.5 h-4.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

// ─── Password Strength Bar ────────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ chars", pass: password.length >= 8 },
    { label: "Uppercase", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /\d/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const barColors = ["bg-red-400", "bg-amber-400", "bg-green-500"];
  const strengthLabels = ["Weak", "Fair", "Strong"];
  const strengthTextColors = [
    "text-red-500",
    "text-amber-500",
    "text-green-600",
  ];

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {/* Bar */}
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < score ? barColors[score - 1] : "bg-slate-100"
            }`}
          />
        ))}
      </div>
      {/* Labels */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {checks.map((c) => (
            <span
              key={c.label}
              className={`text-[10px] font-semibold flex items-center gap-0.5 transition-colors ${c.pass ? "text-green-600" : "text-slate-400"}`}
            >
              <span>{c.pass ? "✓" : "·"}</span> {c.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span
            className={`text-[10px] font-black tracking-wide ${strengthTextColors[score - 1]}`}
          >
            {strengthLabels[score - 1]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Register Page ────────────────────────────────────────────────────────────
export default function StudentRegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    school: "",
    classLevel: "",
    programme: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Connect to API
    console.log("Register payload:", form);
  };

  const passwordMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const passwordMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-slate-100 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-7">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
              <span className="text-white font-black text-sm">EL</span>
            </div>
            <span className="font-black text-blue-900 text-xl tracking-tight">
              EduLearn
            </span>
          </Link>
          <p className="text-slate-400 text-[11px] font-semibold tracking-widest uppercase">
            Ghana Senior High Schools
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-blue-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-6 py-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
              🎓
            </div>
            <h1 className="text-white font-black text-xl tracking-tight">
              Create Your Account
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              Join thousands of SHS students across Ghana
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="px-6 py-6 flex flex-col gap-4"
          >
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Full Name
              </label>
              <input
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Kofi Mensah"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Email Address
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="your.email@school.edu.gh"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Class + Programme */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Class
                </label>
                <select
                  name="classLevel"
                  value={form.classLevel}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                >
                  <option value="">Select</option>
                  <option>SHS 1</option>
                  <option>SHS 2</option>
                  <option>SHS 3</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Programme
                </label>
                <select
                  name="programme"
                  value={form.programme}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                >
                  <option value="">Select</option>
                  <option>General Science</option>
                  <option>Business</option>
                  <option>Visual Arts</option>
                  <option>General Arts</option>
                </select>
              </div>
            </div>

            {/* School */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                School Name
              </label>
              <input
                name="school"
                type="text"
                value={form.school}
                onChange={handleChange}
                placeholder="e.g. Presec-Legon"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Create a strong password"
                  required
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {form.password && <PasswordStrength password={form.password} />}
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  required
                  className={`w-full border rounded-xl px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    passwordMismatch
                      ? "border-red-300 focus:ring-red-400 bg-red-50/40"
                      : passwordMatch
                        ? "border-green-300 focus:ring-green-400 bg-green-50/40"
                        : "border-slate-200 focus:ring-blue-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {passwordMismatch && (
                <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
                  ✗ Passwords do not match
                </p>
              )}
              {passwordMatch && (
                <p className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
                  ✓ Passwords match
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 pt-1" />

            {/* Submit */}
            <button
              type="submit"
              disabled={passwordMismatch}
              className="w-full bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
            >
              🎓 Create Student Account
            </button>

            <p className="text-center text-xs text-slate-500 pb-1">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-blue-600 font-bold hover:underline"
              >
                Sign in here
              </Link>
            </p>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 mt-5">
          By registering, you agree to our{" "}
          <Link href="#" className="text-blue-500 hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-blue-500 hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
