import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Assignment from "@/models/Assignment";

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

// ─── File deletion helper ─────────────────────────────────────────────────────
async function deleteFileFromDisk(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.warn("[FILE DELETE WARN]", err.message);
    }
  }
}

// ─── Shared safe-select (never leak filePath) ─────────────────────────────────
const PUBLIC_SELECT =
  "_id title instructions subject topic classLevel dueDate totalMarks allowLateSubmission status fileUrl fileName fileSize views submissionsCount instructor createdAt updatedAt";

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
    await connectDB();

    const assignment = await Assignment.findOne({
      _id: id,
      instructor: auth.userId,
    }).select(PUBLIC_SELECT);

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: assignment },
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
// Body: multipart/form-data — all fields optional
// If a new `file` is provided, the old one is deleted from disk first.
// Send file=<empty> or omit entirely to keep the existing attachment.
// Send removeFile="true" to detach the current PDF without uploading a new one.
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

    const assignment = await Assignment.findOne({
      _id: id,
      instructor: auth.userId,
    });

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

    // ── Update text fields if provided ─────────────────────────────────────
    if (title?.trim()) assignment.title = title.trim();
    if (subject?.trim()) assignment.subject = subject.trim();
    if (dueDateRaw?.trim() && !isNaN(Date.parse(dueDateRaw)))
      assignment.dueDate = new Date(dueDateRaw);
    if (instructions !== null) assignment.instructions = instructions.trim();
    if (topic !== null) assignment.topic = topic.trim();
    if (classLevel?.trim()) assignment.classLevel = classLevel.trim() as any;
    if (totalMarksRaw !== null) {
      const n = parseInt(totalMarksRaw, 10);
      if (!isNaN(n) && n > 0) assignment.totalMarks = n;
    }
    if (allowLateSubmissionRaw !== null) {
      assignment.allowLateSubmission = allowLateSubmissionRaw === "true";
    }
    if (status?.trim()) assignment.status = status.trim() as any;

    // ── Remove attachment without replacement ──────────────────────────────
    if (removeFile && (!file || file.size === 0)) {
      if (assignment.filePath) await deleteFileFromDisk(assignment.filePath);
      assignment.fileUrl = null;
      assignment.filePath = null;
      assignment.fileName = null;
      assignment.fileSize = null;
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

      // Delete old file first
      if (assignment.filePath) await deleteFileFromDisk(assignment.filePath);

      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      const sanitisedName = file.name
        .replace(/[/\\]/g, "")
        .replace(/\s+/g, "_");
      const uniqueFileName = `${Date.now()}-${sanitisedName}`;
      const absolutePath = path.join(UPLOAD_DIR, uniqueFileName);
      const publicUrl = `${UPLOAD_URL_BASE}/${uniqueFileName}`;

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(absolutePath, new Uint8Array(arrayBuffer));

      assignment.fileUrl = publicUrl;
      assignment.filePath = absolutePath;
      assignment.fileName = file.name;
      assignment.fileSize = file.size;
    }

    await assignment.save();

    return NextResponse.json(
      {
        success: true,
        message: "Assignment updated successfully.",
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
    await connectDB();

    const assignment = await Assignment.findOne({
      _id: id,
      instructor: auth.userId,
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 },
      );
    }

    // Delete attached PDF from disk if present
    if (assignment.filePath) await deleteFileFromDisk(assignment.filePath);

    await Assignment.deleteOne({ _id: id });

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
