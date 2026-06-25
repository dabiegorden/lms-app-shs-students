import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { courses, courseEnrollments } from "@/src/schema";
import type { LessonProgress } from "@/src/schema";
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

    if (!isUuid(id)) {
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

    const [enrollment] = await db
      .select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.courseId, id),
          eq(courseEnrollments.studentId, auth.userId),
        ),
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json(
        { success: false, message: "Not enrolled in this course." },
        { status: 404 },
      );
    }

    // Resolve sectionId by looking up the lesson in the course structure
    const [course] = await db
      .select({
        sections: courses.sections,
        certificateEnabled: courses.certificateEnabled,
      })
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    let sectionId: string | null = null;
    for (const sec of course?.sections ?? []) {
      const lesson = sec.lessons.find((l) => l.id === lessonId);
      if (lesson) {
        sectionId = sec.id;
        break;
      }
    }

    // Work on a mutable copy of the progress array
    const lessonProgress: LessonProgress[] = [...enrollment.lessonProgress];
    const idx = lessonProgress.findIndex((lp) => lp.lessonId === lessonId);

    if (idx === -1) {
      lessonProgress.push({
        lessonId,
        sectionId: sectionId ?? "",
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : null,
        watchedSeconds: watchedSeconds ?? 0,
      });
    } else {
      if (isCompleted && !lessonProgress[idx].isCompleted) {
        lessonProgress[idx].isCompleted = true;
        lessonProgress[idx].completedAt = new Date().toISOString();
      }
      if (watchedSeconds !== undefined) {
        lessonProgress[idx].watchedSeconds = watchedSeconds;
      }
    }

    // Recompute aggregate progress
    const totalLessons = enrollment.totalLessons || 1;
    const completedCount = lessonProgress.filter((lp) => lp.isCompleted).length;
    const progressPercent = Math.min(
      100,
      Math.round((completedCount / totalLessons) * 100),
    );

    const updates: Partial<typeof courseEnrollments.$inferInsert> = {
      lessonProgress,
      lastLessonId: lessonId,
      lastAccessedAt: new Date(),
      completedLessons: completedCount,
      progressPercent,
    };

    // Mark course complete and issue certificate when 100% reached
    if (progressPercent >= 100 && !enrollment.isCompleted) {
      updates.isCompleted = true;
      updates.completedAt = new Date();

      if (course?.certificateEnabled) {
        updates.certificateId = `CERT-${Date.now()}-${auth.userId
          .slice(-6)
          .toUpperCase()}`;
        updates.certificateIssuedAt = new Date();
      }
    }

    const [updated] = await db
      .update(courseEnrollments)
      .set(updates)
      .where(eq(courseEnrollments.id, enrollment.id))
      .returning();

    return NextResponse.json(
      { success: true, data: toLegacy(updated) },
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
