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

// ─── Login Page ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // TODO: Connect to API
      // const res = await fetch("/api/auth/login", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(form),
      // });
      // const data = await res.json();
      // if (!res.ok) throw new Error(data.message);
      //
      // API will return role in the token/response.
      // Route accordingly:
      // if (data.user.role === "instructor") router.push("/instructor/dashboard");
      // else router.push("/dashboard");

      await new Promise((r) => setTimeout(r, 1000)); // mock delay — remove when API is connected
    } catch (err: any) {
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
              <span className="text-white font-black text-sm">EL</span>
            </div>
            <span className="font-black text-blue-900 text-xl tracking-tight">
              EduLearn
            </span>
          </Link>
          <p className="text-slate-400 text-[11px] font-semibold tracking-widest uppercase mt-1">
            Ghana Senior High Schools
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-blue-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-6 py-7 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
              👋
            </div>
            <h1 className="text-white font-black text-xl tracking-tight">
              Welcome Back
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              Sign in to continue learning
            </p>
          </div>

          {/* Form Body */}
          <form
            onSubmit={handleSubmit}
            className="px-6 py-6 flex flex-col gap-5"
          >
            {/* Error Banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl px-4 py-3 flex items-center gap-2 animate-pulse">
                <span className="text-base shrink-0">⚠️</span>
                {error}
              </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-[11px] font-bold text-slate-500 uppercase tracking-wider"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="e.g. kofi@school.edu.gh"
                required
                autoComplete="email"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-[11px] font-bold text-slate-500 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-0.5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none -mt-1">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 accent-blue-600"
              />
              <span className="text-xs text-slate-600 font-medium">
                Remember me on this device
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !form.email || !form.password}
              className="w-full bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign In →"
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[11px] text-slate-400 font-medium">
                New to EduLearn?
              </span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Register CTA */}
            <Link
              href="/register"
              className="w-full flex items-center justify-center gap-2 border-2 border-blue-100 hover:border-blue-300 hover:bg-blue-50 text-blue-700 font-bold py-3 rounded-xl transition-all text-sm"
            >
              🎓 Create a Student Account
            </Link>
          </form>
        </div>

        {/* Instructor note */}
        <div className="mt-5 bg-white/60 border border-slate-200 rounded-2xl px-4 py-3.5 flex items-start gap-3">
          <span className="text-lg mt-0.5 shrink-0">👨‍🏫</span>
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-bold text-slate-700">Are you a teacher?</span>{" "}
            Instructor accounts are set up by your school. Use the credentials
            provided to sign in above.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Need help?{" "}
          <Link href="#" className="text-blue-500 hover:underline">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}
