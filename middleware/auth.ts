import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

// Routes that require authentication
const PROTECTED_STUDENT_ROUTES = [
  "/dashboard",
  "/subjects",
  "/assignments",
  "/progress",
  "/profile",
];
const PROTECTED_INSTRUCTOR_ROUTES = [
  "/instructor-dashboard",
  "/instructor-dashboard/upload",
  "/instructor-dashboard/assignments",
  "/instructor-dashboard/quizzes",
  "/instructor-dashboard/announcements",
  "/instructor-dashboard/submissions",
  "/instructor-dashboard/performance",
];

// Routes only accessible when NOT logged in
const AUTH_ROUTES = ["/login", "/register"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;
  const user = token ? verifyToken(token) : null;

  // ── Redirect logged-in users away from auth pages ──────────────────────
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    if (user) {
      const redirectTo =
        user.role === "instructor" ? "/instructor-dashboard" : "/dashboard";
      return NextResponse.redirect(new URL(redirectTo, req.url));
    }
    return NextResponse.next();
  }

  // ── Protect student routes ─────────────────────────────────────────────
  if (PROTECTED_STUDENT_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    // Instructors trying to access student pages → send to their dashboard
    if (user.role === "instructor") {
      return NextResponse.redirect(new URL("/instructor-dashboard", req.url));
    }
    return NextResponse.next();
  }

  // ── Protect instructor routes ──────────────────────────────────────────
  if (PROTECTED_INSTRUCTOR_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    // Students trying to access instructor pages → send to their dashboard
    if (user.role === "student") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/subjects/:path*",
    "/assignments/:path*",
    "/progress/:path*",
    "/profile/:path*",
    "/instructor/:path*",
    "/login",
    "/register",
  ],
};
