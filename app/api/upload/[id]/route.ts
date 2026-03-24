import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import LectureNote from "@/models/Lecturenote";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 20 * 1024 * 1024;
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

// ─── File deletion helper ─────────────────────────────────────────────────────
async function deleteFileFromDisk(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    // File already gone — not a fatal error, just log it
    if (err.code !== "ENOENT") {
      console.warn("[FILE DELETE WARN]", err.message);
    }
  }
}

// ─── GET /api/notes/[id] ──────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }, // Next.js v16: params is a Promise
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params; // ← must be awaited in Next.js v16

    await connectDB();

    const note = await LectureNote.findOne({
      _id: id,
      instructor: auth.userId, // instructors can only fetch their own notes
    }).select("-filePath"); // never expose the server path

    if (!note) {
      return NextResponse.json(
        { success: false, message: "Note not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: note }, { status: 200 });
  } catch (error: any) {
    console.error("[GET NOTE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch note." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/notes/[id] ────────────────────────────────────────────────────
// Updates metadata and/or replaces the PDF file.
// Body: multipart/form-data — all fields optional except when replacing file.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    await connectDB();

    // Fetch the full document (we need filePath for old-file deletion)
    const note = await LectureNote.findOne({
      _id: id,
      instructor: auth.userId,
    });
    if (!note) {
      return NextResponse.json(
        { success: false, message: "Note not found." },
        { status: 404 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const subject = formData.get("subject") as string | null;
    const description = formData.get("description") as string | null;
    const topic = formData.get("topic") as string | null;
    const classLevel = formData.get("classLevel") as string | null;

    // ── Update text fields if provided ─────────────────────────────────────
    if (title?.trim()) note.title = title.trim();
    if (subject?.trim()) note.subject = subject.trim();
    if (description !== null) note.description = description.trim();
    if (topic !== null) note.topic = topic.trim();
    if (classLevel?.trim()) note.classLevel = classLevel.trim() as any;

    // ── Replace PDF if a new one was submitted ─────────────────────────────
    if (file && file.size > 0) {
      // Validate replacement file
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

      // Delete old file from disk before writing the replacement
      if (note.filePath) {
        await deleteFileFromDisk(note.filePath);
      }

      // Write new file
      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      const sanitisedName = file.name
        .replace(/[/\\]/g, "")
        .replace(/\s+/g, "_");
      const uniqueFileName = `${Date.now()}-${sanitisedName}`;
      const absolutePath = path.join(UPLOAD_DIR, uniqueFileName);
      const publicUrl = `${UPLOAD_URL_BASE}/${uniqueFileName}`;

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(absolutePath, new Uint8Array(arrayBuffer));

      note.fileUrl = publicUrl;
      note.filePath = absolutePath;
      note.fileName = file.name;
      note.fileSize = file.size;
    }

    await note.save();

    return NextResponse.json(
      {
        success: true,
        message: "Note updated successfully.",
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
          updatedAt: note.updatedAt,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[PATCH NOTE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update note." },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/notes/[id] ───────────────────────────────────────────────────
// Removes the note from DB and deletes the PDF from disk.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    await connectDB();

    const note = await LectureNote.findOne({
      _id: id,
      instructor: auth.userId,
    });
    if (!note) {
      return NextResponse.json(
        { success: false, message: "Note not found." },
        { status: 404 },
      );
    }

    // ── Delete file from disk first ────────────────────────────────────────
    if (note.filePath) {
      await deleteFileFromDisk(note.filePath);
    }

    // ── Remove DB record ───────────────────────────────────────────────────
    await LectureNote.deleteOne({ _id: id });

    return NextResponse.json(
      { success: true, message: "Note deleted successfully." },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[DELETE NOTE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete note." },
      { status: 500 },
    );
  }
}
