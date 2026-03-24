import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Course from "@/models/Course";
import CourseEnrollment from "@/models/Courseenrollment";

// ─── FILE: /api/student/courses/[id]/enroll/route.ts ─────────────────────────

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// POST /api/student/courses/[id]/enroll
export async function POST(
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
      .select("_id totalLessons title")
      .lean();

    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found or not available." },
        { status: 404 },
      );
    }

    // Prevent double enrolment
    const existing = await CourseEnrollment.findOne({
      course: id,
      student: auth.userId,
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "You are already enrolled in this course." },
        { status: 409 },
      );
    }

    const enrollment = await CourseEnrollment.create({
      course: id,
      student: auth.userId,
      totalLessons: (course as any).totalLessons ?? 0,
      lessonProgress: [],
      completedLessons: 0,
      progressPercent: 0,
    });

    // Increment enrollments count (fire-and-forget)
    Course.findByIdAndUpdate(id, { $inc: { enrollmentsCount: 1 } })
      .exec()
      .catch(() => {});

    return NextResponse.json(
      { success: true, message: "Enrolled successfully.", data: enrollment },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[STUDENT ENROLL ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to enroll." },
      { status: 500 },
    );
  }
}
