import { type NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { lectureNotes } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacyList } from "@/lib/serialize";

function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET /api/notes/student ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    const classLevelParam = searchParams.get("classLevel")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [];

    if (classLevelParam) {
      const allowed =
        classLevelParam === "All" ? ["All"] : ["All", classLevelParam];
      conditions.push(inArray(lectureNotes.classLevel, allowed as any));
    }
    if (search) {
      conditions.push(
        or(
          ilike(lectureNotes.title, `%${search}%`),
          ilike(lectureNotes.subject, `%${search}%`),
          ilike(lectureNotes.topic, `%${search}%`),
          ilike(lectureNotes.description, `%${search}%`),
        )!,
      );
    }
    if (subject) conditions.push(ilike(lectureNotes.subject, `%${subject}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderByMap: Record<string, any> = {
      newest: desc(lectureNotes.createdAt),
      oldest: asc(lectureNotes.createdAt),
      title: asc(lectureNotes.title),
    };
    const orderBy = orderByMap[sort] ?? orderByMap.newest;

    const [fullRows, totalResult] = await Promise.all([
      db
        .select()
        .from(lectureNotes)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(lectureNotes)
        .where(whereClause),
    ]);

    const rows = fullRows.map(({ filePath, ...rest }) => rest);
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
    console.error("[GET STUDENT NOTES ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch notes." },
      { status: 500 },
    );
  }
}
