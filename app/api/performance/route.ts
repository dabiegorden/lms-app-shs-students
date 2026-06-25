import { type NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { performances, users } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/performance ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim().toLowerCase() ?? "";
    const sort = searchParams.get("sort") ?? "top";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );

    const conditions = [eq(performances.instructorId, auth.userId)];
    if (search) {
      conditions.push(
        or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))!,
      );
    }
    const whereClause = and(...conditions);

    const orderByMap: Record<string, any> = {
      top: desc(performances.overallPercentage),
      bottom: asc(performances.overallPercentage),
      recent: desc(performances.lastActivityAt),
      name: asc(users.name),
    };
    const orderBy = orderByMap[sort] ?? orderByMap.top;

    // Fetch all matching rows (with student joined). Subject filter is applied
    // in JS because subjectStats lives in a JSONB array.
    const allRows = await db
      .select({
        id: performances.id,
        student: performances.studentId,
        totalActivities: performances.totalActivities,
        overallPercentage: performances.overallPercentage,
        totalScore: performances.totalScore,
        totalMaxScore: performances.totalMaxScore,
        quizCount: performances.quizCount,
        quizAveragePercentage: performances.quizAveragePercentage,
        assignmentCount: performances.assignmentCount,
        assignmentAveragePercentage: performances.assignmentAveragePercentage,
        subjectStats: performances.subjectStats,
        recentActivity: performances.recentActivity,
        lastActivityAt: performances.lastActivityAt,
        aiInsight: performances.aiInsight,
        aiInsightGeneratedAt: performances.aiInsightGeneratedAt,
        studentInfo: {
          name: users.name,
          email: users.email,
          profilePicture: users.profilePicture,
          classLevel: users.classLevel,
          school: users.school,
        },
      })
      .from(performances)
      .innerJoin(users, eq(performances.studentId, users.id))
      .where(whereClause)
      .orderBy(orderBy);

    const filtered = subject
      ? allRows.filter((r) =>
          r.subjectStats.some((s) =>
            s.subject.toLowerCase().includes(subject),
          ),
        )
      : allRows;

    const total = filtered.length;
    const paginated = filtered
      .slice((page - 1) * limit, page * limit)
      .map((r) => ({
        ...toLegacy(r),
        recentActivity: r.recentActivity.slice(-20),
      }));

    // ── Class-level summary stats (instructor-wide, ignores filters) ────────
    const [summaryRow] = await db
      .select({
        classAvgPercentage: sql<number>`coalesce(avg(${performances.overallPercentage}), 0)`,
        totalStudents: sql<number>`count(*)::int`,
        passing: sql<number>`count(*) filter (where ${performances.overallPercentage} >= 50)::int`,
        topPerformers: sql<number>`count(*) filter (where ${performances.overallPercentage} >= 80)::int`,
        struggling: sql<number>`count(*) filter (where ${performances.overallPercentage} < 40)::int`,
      })
      .from(performances)
      .where(eq(performances.instructorId, auth.userId));

    return NextResponse.json(
      {
        success: true,
        data: paginated,
        summary: summaryRow ?? {
          classAvgPercentage: 0,
          totalStudents: 0,
          passing: 0,
          topPerformers: 0,
          struggling: 0,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET PERFORMANCE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch performance data." },
      { status: 500 },
    );
  }
}
