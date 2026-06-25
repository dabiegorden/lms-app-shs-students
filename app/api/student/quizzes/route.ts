import { type NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { quizzes } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacyList } from "@/lib/serialize";
import { quizListProjection } from "@/lib/quiz-utils";

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// ─── GET /api/student/quizzes ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Student access only." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [eq(quizzes.status, "published")];
    if (classLevel) {
      conditions.push(
        or(
          eq(quizzes.classLevel, "All"),
          eq(quizzes.classLevel, classLevel as any),
        )!,
      );
    }
    if (search) {
      conditions.push(
        or(
          ilike(quizzes.title, `%${search}%`),
          ilike(quizzes.subject, `%${search}%`),
          ilike(quizzes.topic, `%${search}%`),
          ilike(quizzes.description, `%${search}%`),
        )!,
      );
    }
    if (subject) conditions.push(ilike(quizzes.subject, `%${subject}%`));

    const whereClause = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(quizzes)
        .where(whereClause)
        .orderBy(asc(quizzes.dueDate), desc(quizzes.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(quizzes)
        .where(whereClause),
    ]);

    // Increment views (fire-and-forget)
    const ids = rows.map((q) => q.id);
    if (ids.length > 0) {
      db.update(quizzes)
        .set({ views: sql`${quizzes.views} + 1` })
        .where(inArray(quizzes.id, ids))
        .catch(() => {});
    }

    // Strip instructor + answer-bearing fields from the student list view
    const data = toLegacyList(
      rows.map(({ instructorId, ...rest }) => rest),
    ).map((q) => quizListProjection(q));

    const total = totalResult[0]?.count ?? 0;

    return NextResponse.json(
      {
        success: true,
        data,
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
    console.error("[STUDENT GET QUIZZES ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch quizzes." },
      { status: 500 },
    );
  }
}
