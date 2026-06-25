import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { courses, courseEnrollments, users } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacyList } from "@/lib/serialize";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/course/[id]/stats ───────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { id } = await params;

    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        totalLessons: courses.totalLessons,
        enrollmentsCount: courses.enrollmentsCount,
      })
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.instructorId, auth.userId)))
      .limit(1);

    if (!course)
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 },
      );

    const [aggregate, recentEnrollments] = await Promise.all([
      db
        .select({
          totalEnrolled: sql<number>`count(*)::int`,
          totalCompleted: sql<number>`count(*) filter (where ${courseEnrollments.isCompleted})::int`,
          avgProgress: sql<number>`coalesce(avg(${courseEnrollments.progressPercent}), 0)`,
        })
        .from(courseEnrollments)
        .where(eq(courseEnrollments.courseId, id)),
      db
        .select({
          id: courseEnrollments.id,
          progressPercent: courseEnrollments.progressPercent,
          isCompleted: courseEnrollments.isCompleted,
          enrolledAt: courseEnrollments.enrolledAt,
          lastAccessedAt: courseEnrollments.lastAccessedAt,
          student: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(courseEnrollments)
        .innerJoin(users, eq(courseEnrollments.studentId, users.id))
        .where(eq(courseEnrollments.courseId, id))
        .orderBy(desc(courseEnrollments.enrolledAt))
        .limit(10),
    ]);

    const { totalEnrolled, totalCompleted, avgProgress } = aggregate[0];

    return NextResponse.json({
      success: true,
      data: {
        totalEnrolled,
        totalCompleted,
        completionRate:
          totalEnrolled > 0
            ? Math.round((totalCompleted / totalEnrolled) * 100)
            : 0,
        averageProgress: Math.round(avgProgress ?? 0),
        recentEnrollments: toLegacyList(recentEnrollments),
      },
    });
  } catch (error: any) {
    console.error("[COURSE STATS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch stats." },
      { status: 500 },
    );
  }
}
