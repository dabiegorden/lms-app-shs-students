import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Course from "@/models/Course";
import CourseEnrollment from "@/models/Courseenrollment";
import mongoose from "mongoose";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// ─── GET /api/student/courses/[id] ───────────────────────────────────────────
// Returns the full published course with sections/lessons (no answers).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    // Guard: reject obviously invalid IDs before hitting MongoDB
    if (!id || id === "undefined" || !id.match(/^[a-f\d]{24}$/i)) {
      return NextResponse.json(
        { success: false, message: "Invalid course ID." },
        { status: 400 },
      );
    }

    await connectDB();

    const course = await Course.findOne({ _id: id, status: "published" })
      .select("-thumbnailPath -instructor")
      .lean();

    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found or not available." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: course }, { status: 200 });
  } catch (error: any) {
    console.error("[STUDENT GET COURSE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch course." },
      { status: 500 },
    );
  }
}
