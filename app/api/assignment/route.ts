import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { assignments } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy, toLegacyList } from "@/lib/serialize";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "assignments");
const UPLOAD_URL_BASE = "/uploads/assignments";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/assignment ──────────────────────────────────────────────────────
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
    const subject = searchParams.get("subject")?.trim() ?? "";
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [eq(assignments.instructorId, auth.userId)];
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
    if (classLevel)
      conditions.push(eq(assignments.classLevel, classLevel as any));
    if (status) conditions.push(eq(assignments.status, status as any));

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
    console.error("[GET ASSIGNMENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch assignments." },
      { status: 500 },
    );
  }
}

// ─── POST /api/assignment ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    const formData = await req.formData();

    const title = (formData.get("title") as string)?.trim();
    const subject = (formData.get("subject") as string)?.trim();
    const dueDateRaw = (formData.get("dueDate") as string)?.trim();
    const instructions =
      (formData.get("instructions") as string | null)?.trim() ?? "";
    const topic = (formData.get("topic") as string | null)?.trim() ?? "";
    const classLevel =
      (formData.get("classLevel") as string | null)?.trim() || "All";
    const totalMarks = parseInt(
      (formData.get("totalMarks") as string | null) ?? "100",
      10,
    );
    const allowLateSubmission =
      (formData.get("allowLateSubmission") as string) === "true";
    const status =
      (formData.get("status") as string | null)?.trim() || "published";
    const file = formData.get("file") as File | null;

    if (!title || !subject) {
      return NextResponse.json(
        { success: false, message: "Title and subject are required." },
        { status: 400 },
      );
    }
    if (!dueDateRaw || isNaN(Date.parse(dueDateRaw))) {
      return NextResponse.json(
        { success: false, message: "A valid due date is required." },
        { status: 400 },
      );
    }

    let fileUrl: string | null = null;
    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    if (file && file.size > 0) {
      if (file.type !== "application/pdf") {
        return NextResponse.json(
          { success: false, message: "Only PDF files are accepted." },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, message: "PDF must be smaller than 20MB." },
          { status: 400 },
        );
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      const sanitisedName = file.name
        .replace(/[/\\]/g, "")
        .replace(/\s+/g, "_");
      const uniqueFileName = `${Date.now()}-${sanitisedName}`;
      const absolutePath = path.join(UPLOAD_DIR, uniqueFileName);

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(absolutePath, new Uint8Array(arrayBuffer));

      fileUrl = `${UPLOAD_URL_BASE}/${uniqueFileName}`;
      filePath = absolutePath;
      fileName = file.name;
      fileSize = file.size;
    }

    const [assignment] = await db
      .insert(assignments)
      .values({
        title,
        instructions,
        subject,
        topic,
        classLevel: classLevel as any,
        dueDate: new Date(dueDateRaw),
        totalMarks: isNaN(totalMarks) ? 100 : totalMarks,
        allowLateSubmission,
        status: status as any,
        fileUrl,
        filePath,
        fileName,
        fileSize,
        instructorId: auth.userId,
      })
      .returning();

    const { filePath: _fp, ...safe } = assignment;

    return NextResponse.json(
      {
        success: true,
        message: "Assignment created successfully.",
        data: toLegacy(safe),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[POST ASSIGNMENT ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create assignment. Please try again.",
      },
      { status: 500 },
    );
  }
}
