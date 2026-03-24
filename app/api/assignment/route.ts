import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Assignment from "@/models/Assignment";

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
// Query params:
//   search     – free-text (title / subject / topic / instructions)
//   subject    – exact match (case-insensitive)
//   classLevel – "SHS 1" | "SHS 2" | "SHS 3" | "All"
//   status     – "draft" | "published" | "closed"
//   page       – default 1
//   limit      – default 12, max 50
//   sort       – "newest" | "oldest" | "title" | "dueDate"
export async function GET(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    await connectDB();

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
    const skip = (page - 1) * limit;

    // ── Query ──────────────────────────────────────────────────────────────
    const query: Record<string, any> = { instructor: auth.userId };

    if (search) query.$text = { $search: search };
    if (subject) query.subject = { $regex: subject, $options: "i" };
    if (classLevel) query.classLevel = classLevel;
    if (status) query.status = status;

    // ── Sort ───────────────────────────────────────────────────────────────
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title: { title: 1 },
      dueDate: { dueDate: 1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.newest;

    // ── Execute ────────────────────────────────────────────────────────────
    const [assignments, total] = await Promise.all([
      Assignment.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select("-filePath") // never expose server path
        .lean(),
      Assignment.countDocuments(query),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: assignments,
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
// Body: multipart/form-data
//   title              (required)
//   subject            (required)
//   dueDate            (required)  ISO string
//   instructions       (optional)
//   topic              (optional)
//   classLevel         (optional, default "All")
//   totalMarks         (optional, default 100)
//   allowLateSubmission (optional, "true" | "false")
//   status             (optional, default "published")
//   file               (optional) PDF only, max 20 MB
export async function POST(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    await connectDB();

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

    // ── Validate required text fields ──────────────────────────────────────
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

    // ── Handle optional file ───────────────────────────────────────────────
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
      const publicUrl = `${UPLOAD_URL_BASE}/${uniqueFileName}`;

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(absolutePath, new Uint8Array(arrayBuffer));

      fileUrl = publicUrl;
      filePath = absolutePath;
      fileName = file.name;
      fileSize = file.size;
    }

    // ── Save to DB ─────────────────────────────────────────────────────────
    const assignment = await Assignment.create({
      title,
      instructions,
      subject,
      topic,
      classLevel,
      dueDate: new Date(dueDateRaw),
      totalMarks: isNaN(totalMarks) ? 100 : totalMarks,
      allowLateSubmission,
      status,
      fileUrl,
      filePath,
      fileName,
      fileSize,
      instructor: auth.userId,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Assignment created successfully.",
        data: {
          _id: assignment._id,
          title: assignment.title,
          subject: assignment.subject,
          topic: assignment.topic,
          classLevel: assignment.classLevel,
          instructions: assignment.instructions,
          dueDate: assignment.dueDate,
          totalMarks: assignment.totalMarks,
          allowLateSubmission: assignment.allowLateSubmission,
          status: assignment.status,
          fileUrl: assignment.fileUrl,
          fileName: assignment.fileName,
          fileSize: assignment.fileSize,
          views: assignment.views,
          submissionsCount: assignment.submissionsCount,
          createdAt: assignment.createdAt,
          updatedAt: assignment.updatedAt,
        },
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
