import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { assignments } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 20 * 1024 * 1024;
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

async function deleteFileFromDisk(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err.code !== "ENOENT") console.warn("[FILE DELETE WARN]", err.message);
  }
}

// ─── GET /api/assignment/[id] ─────────────────────────────────────────────────
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

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(
        and(eq(assignments.id, id), eq(assignments.instructorId, auth.userId)),
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 },
      );
    }

    const { filePath: _fp, ...safe } = assignment;
    return NextResponse.json(
      { success: true, data: toLegacy(safe) },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET ASSIGNMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch assignment." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/assignment/[id] ───────────────────────────────────────────────
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

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(
        and(eq(assignments.id, id), eq(assignments.instructorId, auth.userId)),
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 },
      );
    }

    const formData = await req.formData();

    const title = formData.get("title") as string | null;
    const subject = formData.get("subject") as string | null;
    const dueDateRaw = formData.get("dueDate") as string | null;
    const instructions = formData.get("instructions") as string | null;
    const topic = formData.get("topic") as string | null;
    const classLevel = formData.get("classLevel") as string | null;
    const totalMarksRaw = formData.get("totalMarks") as string | null;
    const allowLateSubmissionRaw = formData.get("allowLateSubmission") as
      | string
      | null;
    const status = formData.get("status") as string | null;
    const file = formData.get("file") as File | null;
    const removeFile = formData.get("removeFile") === "true";

    const updates: Partial<typeof assignments.$inferInsert> = {};

    if (title?.trim()) updates.title = title.trim();
    if (subject?.trim()) updates.subject = subject.trim();
    if (dueDateRaw?.trim() && !isNaN(Date.parse(dueDateRaw)))
      updates.dueDate = new Date(dueDateRaw);
    if (instructions !== null) updates.instructions = instructions.trim();
    if (topic !== null) updates.topic = topic.trim();
    if (classLevel?.trim()) updates.classLevel = classLevel.trim() as any;
    if (totalMarksRaw !== null) {
      const n = parseInt(totalMarksRaw, 10);
      if (!isNaN(n) && n > 0) updates.totalMarks = n;
    }
    if (allowLateSubmissionRaw !== null) {
      updates.allowLateSubmission = allowLateSubmissionRaw === "true";
    }
    if (status?.trim()) updates.status = status.trim() as any;

    // ── Remove attachment without replacement ──────────────────────────────
    if (removeFile && (!file || file.size === 0)) {
      if (assignment.filePath) await deleteFileFromDisk(assignment.filePath);
      updates.fileUrl = null;
      updates.filePath = null;
      updates.fileName = null;
      updates.fileSize = null;
    }

    // ── Replace PDF if a new one was submitted ─────────────────────────────
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

      if (assignment.filePath) await deleteFileFromDisk(assignment.filePath);

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
      .update(assignments)
      .set(updates)
      .where(eq(assignments.id, assignment.id))
      .returning();

    const { filePath: _fp, ...safe } = updated;

    return NextResponse.json(
      {
        success: true,
        message: "Assignment updated successfully.",
        data: toLegacy(safe),
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[PATCH ASSIGNMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update assignment." },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/assignment/[id] ──────────────────────────────────────────────
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

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(
        and(eq(assignments.id, id), eq(assignments.instructorId, auth.userId)),
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 },
      );
    }

    if (assignment.filePath) await deleteFileFromDisk(assignment.filePath);

    await db.delete(assignments).where(eq(assignments.id, id));

    return NextResponse.json(
      { success: true, message: "Assignment deleted successfully." },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[DELETE ASSIGNMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete assignment." },
      { status: 500 },
    );
  }
}
