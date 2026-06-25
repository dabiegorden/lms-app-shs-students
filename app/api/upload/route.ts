import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { lectureNotes } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy, toLegacyList } from "@/lib/serialize";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "notes");
const UPLOAD_URL_BASE = "/uploads/notes";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/upload ──────────────────────────────────────────────────────────
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
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [eq(lectureNotes.instructorId, auth.userId)];
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
    if (classLevel)
      conditions.push(eq(lectureNotes.classLevel, classLevel as any));

    const whereClause = and(...conditions);

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
    console.error("[GET NOTES ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch notes." },
      { status: 500 },
    );
  }
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────
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

    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string)?.trim();
    const subject = (formData.get("subject") as string)?.trim();
    const description =
      (formData.get("description") as string | null)?.trim() ?? "";
    const topic = (formData.get("topic") as string | null)?.trim() ?? "";
    const classLevel =
      (formData.get("classLevel") as string | null)?.trim() || "All";

    if (!title || !subject) {
      return NextResponse.json(
        { success: false, message: "Title and subject are required." },
        { status: 400 },
      );
    }

    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, message: "A PDF file is required." },
        { status: 400 },
      );
    }
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

    const sanitisedName = file.name.replace(/[/\\]/g, "").replace(/\s+/g, "_");
    const uniqueFileName = `${Date.now()}-${sanitisedName}`;
    const absolutePath = path.join(UPLOAD_DIR, uniqueFileName);
    const publicUrl = `${UPLOAD_URL_BASE}/${uniqueFileName}`;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(absolutePath, new Uint8Array(arrayBuffer));

    const [note] = await db
      .insert(lectureNotes)
      .values({
        title,
        description,
        subject,
        topic,
        classLevel: classLevel as any,
        fileUrl: publicUrl,
        filePath: absolutePath,
        fileName: file.name,
        fileSize: file.size,
        instructorId: auth.userId,
      })
      .returning();

    const { filePath: _fp, ...safe } = note;

    return NextResponse.json(
      {
        success: true,
        message: "Lecture note uploaded successfully.",
        data: toLegacy(safe),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[POST NOTE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to upload note. Please try again." },
      { status: 500 },
    );
  }
}
