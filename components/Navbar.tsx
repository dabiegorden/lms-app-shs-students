"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
}

function UserAvatar({ user }: { user: UserProfile }) {
  return user.profilePicture ? (
    <img
      src={user.profilePicture}
      alt={user.name}
      className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-200"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs ring-2 ring-blue-200">
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/profile");
        const data = await res.json();
        if (res.ok && data.user) setUser(data.user);
      } catch {
        // Not logged in — fine on the landing page
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setDropdownOpen(false);
      toast.success("Signed out successfully");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const dashboardHref =
    user?.role === "instructor" ? "/instructor-dashboard" : "/dashboard";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-blue-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
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
            {["#features", "#how-it-works", "#subjects", "#testimonials"].map(
              (href, i) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
                >
                  {["Features", "How It Works", "Subjects", "Stories"][i]}
                </Link>
              ),
            )}
          </div>

          {/* Desktop Right */}
          <div className="hidden md:flex items-center gap-3">
            {!authChecked ? (
              <div className="w-28 h-9 rounded-xl bg-blue-100 animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((p) => !p)}
                  className="flex items-center gap-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-200 rounded-xl px-3 py-1.5 transition-all"
                >
                  <UserAvatar user={user} />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-xs font-bold text-slate-800">
                      {user.name.split(" ")[0]}
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold capitalize">
                      {user.role}
                    </span>
                  </div>
                  <span className="text-slate-400 text-xs ml-1">▾</span>
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-blue-100 z-20 overflow-hidden">
                      <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-4 py-3.5 flex items-center gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">
                            {user.name}
                          </p>
                          <p className="text-blue-200 text-[11px] truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <div className="p-2">
                        <Link
                          href={dashboardHref}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <span>📊</span> Go to Dashboard
                        </Link>
                        <Link
                          href={`${dashboardHref}/profile`}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <span>👤</span> Edit Profile
                        </Link>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <span>🚪</span> Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-blue-700 hover:text-blue-900 px-4 py-2 rounded-lg hover:bg-blue-50 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold text-white bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 px-5 py-2 rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile right */}
          <div className="md:hidden flex items-center gap-2">
            {authChecked && user && (
              <Link href={dashboardHref} className="mr-1">
                <UserAvatar user={user} />
              </Link>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <span
                className={`w-5 h-0.5 bg-slate-700 rounded transition-all duration-200 ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
              />
              <span
                className={`w-5 h-0.5 bg-slate-700 rounded transition-all duration-200 ${menuOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`w-5 h-0.5 bg-slate-700 rounded transition-all duration-200 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-blue-50 px-4 py-4 flex flex-col gap-2 shadow-lg">
          {["#features", "#how-it-works", "#subjects", "#testimonials"].map(
            (href, i) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium text-slate-600 py-2 px-3 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {["Features", "How It Works", "Subjects", "Stories"][i]}
              </Link>
            ),
          )}
          <div className="border-t border-blue-50 pt-2 mt-1">
            {user ? (
              <>
                <Link
                  href={dashboardHref}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 w-full text-sm font-semibold text-blue-700 bg-blue-50 py-2.5 px-3 rounded-xl mb-2"
                >
                  <UserAvatar user={user} />
                  <span>Go to Dashboard</span>
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-center text-sm font-semibold text-red-600 border border-red-100 py-2.5 rounded-xl hover:bg-red-50 transition-all"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-3">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 text-center text-sm font-semibold text-blue-700 border border-blue-200 py-2.5 rounded-xl hover:bg-blue-50 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 text-center text-sm font-semibold text-white bg-linear-to-r from-blue-600 to-blue-700 py-2.5 rounded-xl shadow-md transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
