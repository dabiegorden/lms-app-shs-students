import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import LectureNote from "@/models/Lecturenote";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
// Resolved at runtime — works in both dev and production builds
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "notes");
const UPLOAD_URL_BASE = "/uploads/notes"; // served statically by Next.js

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/notes ───────────────────────────────────────────────────────────
// Query params:
//   search     – free-text (title / subject / topic / description)
//   subject    – exact match (case-insensitive)
//   classLevel – "SHS 1" | "SHS 2" | "SHS 3" | "All"
//   page       – default 1
//   limit      – default 10, max 50
//   sort       – "newest" | "oldest" | "title"
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
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)),
    );
    const skip = (page - 1) * limit;

    // ── Query ──────────────────────────────────────────────────────────────
    // Instructors only see their own notes
    const query: Record<string, any> = { instructor: auth.userId };

    if (search) {
      query.$text = { $search: search };
    }
    if (subject) {
      query.subject = { $regex: subject, $options: "i" };
    }
    if (classLevel) {
      query.classLevel = classLevel;
    }

    // ── Sort ───────────────────────────────────────────────────────────────
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title: { title: 1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.newest;

    // ── Execute ────────────────────────────────────────────────────────────
    // Exclude the internal filePath from the response — clients don't need it
    const [notes, total] = await Promise.all([
      LectureNote.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select("-filePath")
        .lean(),
      LectureNote.countDocuments(query),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: notes,
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

// ─── POST /api/notes ──────────────────────────────────────────────────────────
// Body: multipart/form-data
//   file        (required) – PDF only
//   title       (required)
//   subject     (required)
//   description (optional)
//   topic       (optional)
//   classLevel  (optional, default "All")
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

    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string)?.trim();
    const subject = (formData.get("subject") as string)?.trim();
    const description =
      (formData.get("description") as string | null)?.trim() ?? "";
    const topic = (formData.get("topic") as string | null)?.trim() ?? "";
    const classLevel =
      (formData.get("classLevel") as string | null)?.trim() || "All";

    // ── Validate text fields ───────────────────────────────────────────────
    if (!title || !subject) {
      return NextResponse.json(
        { success: false, message: "Title and subject are required." },
        { status: 400 },
      );
    }

    // ── Validate file ──────────────────────────────────────────────────────
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

    // ── Save file to disk ──────────────────────────────────────────────────
    // Sanitise the original filename: strip path separators, collapse spaces
    const sanitisedName = file.name.replace(/[/\\]/g, "").replace(/\s+/g, "_");
    const uniqueFileName = `${Date.now()}-${sanitisedName}`;
    const absolutePath = path.join(UPLOAD_DIR, uniqueFileName);
    const publicUrl = `${UPLOAD_URL_BASE}/${uniqueFileName}`;

    // Ensure the uploads directory exists (recursive = no error if already there)
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(absolutePath, new Uint8Array(arrayBuffer));

    // ── Save metadata to MongoDB ───────────────────────────────────────────
    const note = await LectureNote.create({
      title,
      description,
      subject,
      topic,
      classLevel,
      fileUrl: publicUrl,
      filePath: absolutePath, // stored privately — never sent to the client
      fileName: file.name, // original human-readable name for display
      fileSize: file.size,
      instructor: auth.userId,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Lecture note uploaded successfully.",
        data: {
          _id: note._id,
          title: note.title,
          subject: note.subject,
          topic: note.topic,
          classLevel: note.classLevel,
          description: note.description,
          fileUrl: note.fileUrl,
          fileName: note.fileName,
          fileSize: note.fileSize,
          views: note.views,
          downloads: note.downloads,
          createdAt: note.createdAt,
        },
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
