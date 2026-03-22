"use client";

import {
  ReactNode,
  useEffect,
  useState,
  createContext,
  useContext,
} from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

// ─── User Context ─────────────────────────────────────────────────────────────
interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
  school?: string;
  classLevel?: string;
  programme?: string;
}

const UserContext = createContext<UserProfile | null>(null);
export const useUser = () => useContext(UserContext);

// ─── Nav Items ────────────────────────────────────────────────────────────────
const navItems = [
  { icon: "🏠", label: "Dashboard", href: "/dashboard" },
  { icon: "📚", label: "Subjects", href: "/dashboard/subjects" },
  { icon: "📋", label: "Assignments", href: "/dashboard/assignments" },
  { icon: "🧠", label: "Quizzes", href: "/dashboard/quizzes" },
  { icon: "📊", label: "Progress", href: "/dashboard/progress" },
  { icon: "📣", label: "Notices", href: "/dashboard/announcements" },
  { icon: "👤", label: "Profile", href: "/dashboard/profile" },
];

// ─── Avatar component ─────────────────────────────────────────────────────────
function UserAvatar({
  user,
  size = "md",
}: {
  user: UserProfile;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-14 h-14 text-xl",
  };
  return user.profilePicture ? (
    <img
      src={user.profilePicture}
      alt={user.name}
      className={`${sizes[size]} rounded-full object-cover ring-2 ring-blue-200 shrink-0`}
    />
  ) : (
    <div
      className={`${sizes[size]} rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black shrink-0 ring-2 ring-blue-200`}
    >
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  user,
  onLogout,
  open,
  onClose,
}: {
  user: UserProfile;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        bg-white border-r border-blue-100 shadow-xl
        transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:shadow-none lg:z-auto
      `}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-blue-50 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-xs">EL</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-blue-900 text-sm tracking-tight">
                EduLearn
              </span>
              <span className="text-[9px] text-blue-400 font-semibold tracking-widest uppercase">
                Ghana SHS
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 mt-4 mb-2 bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-3.5 flex items-center gap-3">
          <UserAvatar user={user} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-800 text-sm truncate">
              {user.name}
            </p>
            <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              {user.classLevel || "Student"}
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-blue-50">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all"
          >
            <span className="text-base">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Top Header ───────────────────────────────────────────────────────────────
function TopHeader({
  user,
  onMenuToggle,
  onLogout,
}: {
  user: UserProfile;
  onMenuToggle: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Current page label for breadcrumb
  const currentPage = navItems.find(
    (n) =>
      pathname === n.href ||
      (n.href !== "/dashboard" && pathname.startsWith(n.href)),
  );

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-blue-100 shadow-sm h-16 flex items-center px-4 sm:px-6 gap-3">
      {/* Hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-blue-50 transition-colors shrink-0"
      >
        <span className="w-4.5 h-0.5 bg-slate-600 rounded" />
        <span className="w-4.5 h-0.5 bg-slate-600 rounded" />
        <span className="w-3 h-0.5 bg-slate-600 rounded" />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-slate-400 text-sm hidden sm:block">EduLearn</span>
        <span className="text-slate-300 hidden sm:block">/</span>
        <span className="font-bold text-slate-800 text-sm truncate">
          {currentPage?.label ?? "Dashboard"}
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Notifications */}
        <Link
          href="/dashboard/notifications"
          className="relative w-9 h-9 rounded-xl hover:bg-blue-50 flex items-center justify-center transition-colors"
        >
          <span className="text-lg">🔔</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white" />
        </Link>

        {/* Avatar + Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((p) => !p)}
            className="flex items-center gap-2 rounded-xl hover:bg-blue-50 p-1.5 transition-colors"
          >
            <UserAvatar user={user} size="sm" />
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-xs font-bold text-slate-800">
                {user.name.split(" ")[0]}
              </span>
              <span className="text-[10px] text-slate-500">
                {user.classLevel || "Student"}
              </span>
            </div>
            <span className="text-slate-400 text-xs hidden sm:block">▾</span>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-blue-100 z-20 overflow-hidden">
                {/* Profile header */}
                <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-4 py-4 flex items-center gap-3">
                  <UserAvatar user={user} size="md" />
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">
                      {user.name}
                    </p>
                    <p className="text-blue-200 text-xs truncate">
                      {user.email}
                    </p>
                    <span className="inline-block mt-1 text-[9px] font-black uppercase text-blue-900 bg-white/80 px-2 py-0.5 rounded-full">
                      {user.role}
                    </span>
                  </div>
                </div>
                {/* Info */}
                {user.school && (
                  <div className="px-4 py-2.5 border-b border-slate-50">
                    <p className="text-[11px] text-slate-500 font-medium">
                      🏫 {user.school}
                    </p>
                    {user.programme && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        📖 {user.programme}
                      </p>
                    )}
                  </div>
                )}
                {/* Links */}
                <div className="p-2">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <span>👤</span> Edit Profile
                  </Link>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg animate-pulse">
          <span className="text-white font-black text-base">EL</span>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-slate-500 text-sm font-medium">
          Loading your dashboard…
        </p>
      </div>
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
function StudentLayoutContent({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/profile");
        const data = await res.json();

        if (!res.ok || !data.user) {
          router.push("/login");
          return;
        }

        // Guard: instructors shouldn't be on student routes
        if (data.user.role === "instructor") {
          router.push("/instructor-dashboard");
          return;
        }

        setUser(data.user);
      } catch {
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out successfully");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <UserContext.Provider value={user}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar
          user={user}
          onLogout={handleLogout}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopHeader
            user={user}
            onMenuToggle={() => setSidebarOpen(true)}
            onLogout={handleLogout}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </UserContext.Provider>
  );
}

export default function StudentDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <StudentLayoutContent>{children}</StudentLayoutContent>;
}
