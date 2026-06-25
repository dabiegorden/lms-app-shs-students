import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { courses } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacyList } from "@/lib/serialize";

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// ─── GET /api/student/courses ─────────────────────────────────────────────────
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
      Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [eq(courses.status, "published")];

    // classLevel "All" matches everyone; otherwise also match the requested level
    if (classLevel) {
      conditions.push(
        or(
          eq(courses.classLevel, "All"),
          eq(courses.classLevel, classLevel as any),
        )!,
      );
    }
    if (search) {
      conditions.push(
        or(
          ilike(courses.title, `%${search}%`),
          ilike(courses.subject, `%${search}%`),
          ilike(courses.topic, `%${search}%`),
          ilike(courses.description, `%${search}%`),
        )!,
      );
    }
    if (subject) conditions.push(ilike(courses.subject, `%${subject}%`));

    const whereClause = and(...conditions);

    const [fullRows, totalResult] = await Promise.all([
      db
        .select()
        .from(courses)
        .where(whereClause)
        .orderBy(desc(courses.enrollmentsCount), desc(courses.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(courses)
        .where(whereClause),
    ]);

    const rows = fullRows.map(
      ({ sections, overview, thumbnailPath, instructorId, ...rest }) => rest,
    );
    const total = totalResult[0]?.count ?? 0;

    // Increment views (fire-and-forget)
    const ids = fullRows.map((c) => c.id);
    if (ids.length > 0) {
      db.update(courses)
        .set({ views: sql`${courses.views} + 1` })
        .where(inArray(courses.id, ids))
        .catch(() => {});
    }

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
    console.error("[STUDENT GET COURSES ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch courses." },
      { status: 500 },
    );
  }
}
