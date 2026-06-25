import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { lectureNotes } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "notes");
const UPLOAD_URL_BASE = "/uploads/notes";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

async function deleteFileFromDisk(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err.code !== "ENOENT") console.warn("[FILE DELETE WARN]", err.message);
  }
}

// ─── GET /api/upload/[id] ─────────────────────────────────────────────────────
export async function GET(
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

    const [note] = await db
      .select()
      .from(lectureNotes)
      .where(
        and(eq(lectureNotes.id, id), eq(lectureNotes.instructorId, auth.userId)),
      )
      .limit(1);

    if (!note) {
      return NextResponse.json(
        { success: false, message: "Note not found." },
        { status: 404 },
      );
    }

    const { filePath: _fp, ...safe } = note;
    return NextResponse.json(
      { success: true, data: toLegacy(safe) },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET NOTE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch note." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/upload/[id] ───────────────────────────────────────────────────
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

    const [note] = await db
      .select()
      .from(lectureNotes)
      .where(
        and(eq(lectureNotes.id, id), eq(lectureNotes.instructorId, auth.userId)),
      )
      .limit(1);

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

    const updates: Partial<typeof lectureNotes.$inferInsert> = {};

    if (title?.trim()) updates.title = title.trim();
    if (subject?.trim()) updates.subject = subject.trim();
    if (description !== null) updates.description = description.trim();
    if (topic !== null) updates.topic = topic.trim();
    if (classLevel?.trim()) updates.classLevel = classLevel.trim() as any;

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

      if (note.filePath) await deleteFileFromDisk(note.filePath);

      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      const sanitisedName = file.name
        .replace(/[/\\]/g, "")
        .replace(/\s+/g, "_");
      const uniqueFileName = `${Date.now()}-${sanitisedName}`;
      const absolutePath = path.join(UPLOAD_DIR, uniqueFileName);

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(absolutePath, new Uint8Array(arrayBuffer));

      updates.fileUrl = `${UPLOAD_URL_BASE}/${uniqueFileName}`;
      updates.filePath = absolutePath;
      updates.fileName = file.name;
      updates.fileSize = file.size;
    }

    const [updated] = await db
      .update(lectureNotes)
      .set(updates)
      .where(eq(lectureNotes.id, note.id))
      .returning();

    const { filePath: _fp, ...safe } = updated;

    return NextResponse.json(
      {
        success: true,
        message: "Note updated successfully.",
        data: toLegacy(safe),
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

// ─── DELETE /api/upload/[id] ──────────────────────────────────────────────────
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

    const [note] = await db
      .select()
      .from(lectureNotes)
      .where(
        and(eq(lectureNotes.id, id), eq(lectureNotes.instructorId, auth.userId)),
      )
      .limit(1);

    if (!note) {
      return NextResponse.json(
        { success: false, message: "Note not found." },
        { status: 404 },
      );
    }

    if (note.filePath) await deleteFileFromDisk(note.filePath);

    await db.delete(lectureNotes).where(eq(lectureNotes.id, id));

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
