import { type NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull, sql } from "drizzle-orm";
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

// POST /api/student/courses/[id]/rate
// Body: { rating: number (1–5), review?: string }
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
    const { rating, review = "" } = await req.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Rating must be between 1 and 5." },
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

    if (!enrollment.isCompleted) {
      return NextResponse.json(
        {
          success: false,
          message: "Complete the course before submitting a rating.",
        },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(courseEnrollments)
      .set({
        rating,
        review: review.trim(),
        reviewedAt: new Date(),
      })
      .where(eq(courseEnrollments.id, enrollment.id))
      .returning();

    // Recompute course average rating (fire-and-forget)
    db.select({
      avg: sql<number>`avg(${courseEnrollments.rating})`,
      count: sql<number>`count(*)::int`,
    })
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.courseId, id),
          isNotNull(courseEnrollments.rating),
        ),
      )
      .then(([result]) => {
        if (result && result.count > 0) {
          return db
            .update(courses)
            .set({
              ratingsAverage: Math.round((result.avg ?? 0) * 10) / 10,
              ratingsCount: result.count,
            })
            .where(eq(courses.id, id));
        }
      })
      .catch(() => {});

    return NextResponse.json(
      { success: true, message: "Rating submitted.", data: toLegacy(updated) },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[STUDENT RATE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit rating." },
      { status: 500 },
    );
  }
}
