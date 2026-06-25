import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { users, performances } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy, toLegacyList } from "@/lib/serialize";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

const studentColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  school: users.school,
  classLevel: users.classLevel,
  programme: users.programme,
  profilePicture: users.profilePicture,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

// ─── GET /api/students ────────────────────────────────────────────────────────
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
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [eq(users.role, "student")];
    if (search) {
      conditions.push(
        or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))!,
      );
    }
    if (classLevel) conditions.push(eq(users.classLevel, classLevel));

    const whereClause = and(...conditions);

    const orderByMap: Record<string, any> = {
      newest: desc(users.createdAt),
      oldest: asc(users.createdAt),
      name: asc(users.name),
    };
    const orderBy = orderByMap[sort] ?? orderByMap.newest;

    const [students, totalResult] = await Promise.all([
      db
        .select(studentColumns)
        .from(users)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;

    if (!students.length) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
        { status: 200 },
      );
    }

    // ── Join performance data ──────────────────────────────────────────────
    const studentIds = students.map((s) => s.id);
    const perfRows = await db
      .select({
        student: performances.studentId,
        overallPercentage: performances.overallPercentage,
        totalActivities: performances.totalActivities,
        quizCount: performances.quizCount,
        assignmentCount: performances.assignmentCount,
        lastActivityAt: performances.lastActivityAt,
      })
      .from(performances)
      .where(
        and(
          inArray(performances.studentId, studentIds),
          eq(performances.instructorId, auth.userId),
        ),
      );

    const perfMap = new Map(perfRows.map((p) => [String(p.student), p]));

    const enriched = students.map((s) => ({
      ...toLegacy(s),
      performance: perfMap.get(String(s.id)) ?? null,
    }));

    if (sort === "topPerformers") {
      enriched.sort((a, b) => {
        const aP = (a.performance as any)?.overallPercentage ?? -1;
        const bP = (b.performance as any)?.overallPercentage ?? -1;
        return bP - aP;
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: enriched,
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
    console.error("[GET STUDENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch students." },
      { status: 500 },
    );
  }
}

// ─── POST /api/students ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const body = await req.json();
    const {
      name,
      email,
      password = "student123",
      school,
      classLevel,
      programme,
    } = body;

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { success: false, message: "Name and email are required." },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, message: "A user with this email already exists." },
        { status: 409 },
      );
    }

    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);

    const [student] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        password: hashed,
        role: "student",
        school: school?.trim() ?? "",
        classLevel: classLevel?.trim() ?? "",
        programme: programme?.trim() ?? "",
      })
      .returning(studentColumns);

    return NextResponse.json(
      {
        success: true,
        message: "Student account created successfully.",
        data: toLegacy(student),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[CREATE STUDENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to create student." },
      { status: 500 },
    );
  }
}
