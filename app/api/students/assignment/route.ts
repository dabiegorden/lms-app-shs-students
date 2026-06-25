import { type NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { assignments } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacyList } from "@/lib/serialize";

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user) return null;
  return user;
}

// ─── GET /api/students/assignment ─────────────────────────────────────────────
// Returns PUBLISHED assignments only.
export async function GET(req: NextRequest) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [eq(assignments.status, "published")];
    if (search) {
      conditions.push(
        or(
          ilike(assignments.title, `%${search}%`),
          ilike(assignments.subject, `%${search}%`),
          ilike(assignments.topic, `%${search}%`),
          ilike(assignments.instructions, `%${search}%`),
        )!,
      );
    }
    if (subject) conditions.push(ilike(assignments.subject, `%${subject}%`));
    if (classLevel && classLevel !== "All")
      conditions.push(eq(assignments.classLevel, classLevel as any));

    const whereClause = and(...conditions);

    const orderByMap: Record<string, any> = {
      newest: desc(assignments.createdAt),
      oldest: asc(assignments.createdAt),
      title: asc(assignments.title),
      dueDate: asc(assignments.dueDate),
    };
    const orderBy = orderByMap[sort] ?? orderByMap.newest;

    const [fullRows, totalResult] = await Promise.all([
      db
        .select()
        .from(assignments)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(assignments)
        .where(whereClause),
    ]);

    const rows = fullRows.map(
      ({ filePath, instructorId, ...rest }) => rest,
    );
    const total = totalResult[0]?.count ?? 0;

    return NextResponse.json(
      {
        success: true,
        data: toLegacyList(rows),
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
    console.error("[GET STUDENT ASSIGNMENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch assignments." },
      { status: 500 },
    );
  }
}
