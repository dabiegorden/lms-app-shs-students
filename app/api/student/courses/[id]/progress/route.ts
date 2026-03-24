import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Course from "@/models/Course";
import CourseEnrollment from "@/models/Courseenrollment";

// ─── FILE: /api/student/courses/[id]/progress/route.ts ───────────────────────

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// POST /api/student/courses/[id]/progress
// Body: { lessonId: string, isCompleted?: boolean, watchedSeconds?: number }
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
    const body = await req.json();
    const { lessonId, isCompleted = true, watchedSeconds } = body;

    if (!lessonId) {
      return NextResponse.json(
        { success: false, message: "lessonId is required." },
        { status: 400 },
      );
    }

    await connectDB();

    const enrollment = await CourseEnrollment.findOne({
      course: id,
      student: auth.userId,
    });

    if (!enrollment) {
      return NextResponse.json(
        { success: false, message: "Not enrolled in this course." },
        { status: 404 },
      );
    }

    // Resolve sectionId by looking up the lesson in the course structure
    const course = await Course.findById(id)
      .select("sections certificateEnabled")
      .lean();
    let sectionId: any = null;
    for (const sec of (course as any)?.sections ?? []) {
      const lesson = sec.lessons.find(
        (l: any) => l._id.toString() === lessonId,
      );
      if (lesson) {
        sectionId = sec._id;
        break;
      }
    }

    // Update or insert progress entry
    const idx = enrollment.lessonProgress.findIndex(
      (lp: any) => lp.lessonId.toString() === lessonId,
    );

    if (idx === -1) {
      enrollment.lessonProgress.push({
        lessonId,
        sectionId,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        watchedSeconds: watchedSeconds ?? 0,
      } as any);
    } else {
      if (isCompleted && !enrollment.lessonProgress[idx].isCompleted) {
        enrollment.lessonProgress[idx].isCompleted = true;
        enrollment.lessonProgress[idx].completedAt = new Date();
      }
      if (watchedSeconds !== undefined) {
        enrollment.lessonProgress[idx].watchedSeconds = watchedSeconds;
      }
    }

    // Update resume pointer
    enrollment.lastLessonId = lessonId as any;
    enrollment.lastAccessedAt = new Date();

    // Recompute aggregate progress
    const totalLessons = enrollment.totalLessons || 1;
    const completedCount = enrollment.lessonProgress.filter(
      (lp: any) => lp.isCompleted,
    ).length;
    enrollment.completedLessons = completedCount;
    enrollment.progressPercent = Math.min(
      100,
      Math.round((completedCount / totalLessons) * 100),
    );

    // Mark course complete and issue certificate when 100% reached
    if (enrollment.progressPercent >= 100 && !enrollment.isCompleted) {
      enrollment.isCompleted = true;
      enrollment.completedAt = new Date();

      if ((course as any)?.certificateEnabled) {
        enrollment.certificateId = `CERT-${Date.now()}-${auth.userId
          .toString()
          .slice(-6)
          .toUpperCase()}`;
        enrollment.certificateIssuedAt = new Date();
      }
    }

    await enrollment.save();

    return NextResponse.json(
      { success: true, data: enrollment },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[STUDENT PROGRESS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update progress." },
      { status: 500 },
    );
  }
}
