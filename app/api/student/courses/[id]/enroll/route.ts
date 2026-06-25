import { type NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { courses, courseEnrollments } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { isUuid } from "@/lib/validation";
import { toLegacy } from "@/lib/serialize";

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

    if (!isUuid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid course ID." },
        { status: 400 },
      );
    }

    const [course] = await db
      .select({
        id: courses.id,
        totalLessons: courses.totalLessons,
        title: courses.title,
      })
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.status, "published")))
      .limit(1);

    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found or not available." },
        { status: 404 },
      );
    }

    // Prevent double enrolment
    const [existing] = await db
      .select({ id: courseEnrollments.id })
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.courseId, id),
          eq(courseEnrollments.studentId, auth.userId),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, message: "You are already enrolled in this course." },
        { status: 409 },
      );
    }

    const [enrollment] = await db
      .insert(courseEnrollments)
      .values({
        courseId: id,
        studentId: auth.userId,
        totalLessons: course.totalLessons ?? 0,
        lessonProgress: [],
        completedLessons: 0,
        progressPercent: 0,
      })
      .returning();

    // Increment enrollments count (fire-and-forget)
    db.update(courses)
      .set({ enrollmentsCount: sql`${courses.enrollmentsCount} + 1` })
      .where(eq(courses.id, id))
      .catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: "Enrolled successfully.",
        data: toLegacy(enrollment),
      },
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
