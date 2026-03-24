import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import CourseEnrollment from "@/models/Courseenrollment";

// ─── FILE: /api/student/my-enrollments/route.ts ───────────────────────────────
// GET /api/student/my-enrollments
// Returns all course enrollments for the authenticated student.

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    await connectDB();

    const enrollments = await CourseEnrollment.find({ student: auth.userId })
      .sort({ lastAccessedAt: -1, enrolledAt: -1 })
      .lean();

    return NextResponse.json(
      { success: true, data: enrollments },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[STUDENT MY ENROLLMENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch enrollments." },
      { status: 500 },
    );
  }
}
