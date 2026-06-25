import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { assignments, submissions } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "submissions");
const UPLOAD_URL_BASE = "/uploads/submissions";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── POST /api/submission ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const formData = await req.formData();
    const assignmentId = (formData.get("assignmentId") as string)?.trim();
    const note = (formData.get("note") as string | null)?.trim() ?? "";
    const file = formData.get("file") as File | null;

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, message: "Assignment ID is required." },
        { status: 400 },
      );
    }

    if (!note && (!file || file.size === 0)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please attach a file or write a note before submitting.",
        },
        { status: 400 },
      );
    }

    // ── Fetch the assignment ───────────────────────────────────────────────
    const [assignment] = await db
      .select({
        id: assignments.id,
        status: assignments.status,
        dueDate: assignments.dueDate,
        allowLateSubmission: assignments.allowLateSubmission,
        title: assignments.title,
        subject: assignments.subject,
      })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 },
      );
    }

    // ── Status check ───────────────────────────────────────────────────────
    if (assignment.status !== "published") {
      return NextResponse.json(
        {
          success: false,
          message:
            assignment.status === "closed"
              ? "This assignment is closed. Submissions are no longer accepted."
              : "This assignment is not available for submission.",
        },
        { status: 403 },
      );
    }

    // ── Late check ─────────────────────────────────────────────────────────
    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    const isLate = now > dueDate;

    if (isLate && !assignment.allowLateSubmission) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The due date has passed and late submissions are not allowed.",
        },
        { status: 403 },
      );
    }

    // ── Duplicate check ────────────────────────────────────────────────────
    const [existing] = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, assignmentId),
          eq(submissions.studentId, auth.userId),
        ),
      )
      .limit(1);

    if (existing && existing.status !== "returned") {
      return NextResponse.json(
        {
          success: false,
          message:
            existing.status === "graded"
              ? "This assignment has already been graded."
              : "You have already submitted this assignment.",
        },
        { status: 409 },
      );
    }

    // ── Handle optional file upload ────────────────────────────────────────
    let fileUrl: string | null = null;
    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    if (file && file.size > 0) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            success: false,
            message: "Accepted file types: PDF, JPG, PNG, WEBP, DOC, DOCX",
          },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, message: "File must be smaller than 25MB." },
          { status: 400 },
        );
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      const sanitisedName = file.name
        .replace(/[/\\]/g, "")
        .replace(/\s+/g, "_");
      const uniqueFileName = `${Date.now()}-${auth.userId}-${sanitisedName}`;
      const absolutePath = path.join(UPLOAD_DIR, uniqueFileName);

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(absolutePath, new Uint8Array(arrayBuffer));

      fileUrl = `${UPLOAD_URL_BASE}/${uniqueFileName}`;
      filePath = absolutePath;
      fileName = file.name;
      fileSize = file.size;
    }

    // ── Create or replace submission ───────────────────────────────────────
    let submission: typeof submissions.$inferSelect;

    if (existing && existing.status === "returned") {
      if (existing.filePath) {
        try {
          await fs.unlink(existing.filePath);
        } catch (e: any) {
          if (e.code !== "ENOENT") console.warn("[SUB FILE DELETE]", e.message);
        }
      }
      [submission] = await db
        .update(submissions)
        .set({
          submittedAt: now,
          fileUrl,
          filePath,
          fileName,
          fileSize,
          note,
          status: "submitted",
          score: null,
          feedback: null,
          isLate,
        })
        .where(eq(submissions.id, existing.id))
        .returning();
    } else {
      [submission] = await db
        .insert(submissions)
        .values({
          assignmentId,
          studentId: auth.userId,
          submittedAt: now,
          fileUrl,
          filePath,
          fileName,
          fileSize,
          note,
          status: "submitted",
          score: null,
          feedback: null,
          isLate,
        })
        .returning();

      db.update(assignments)
        .set({ submissionsCount: sql`${assignments.submissionsCount} + 1` })
        .where(eq(assignments.id, assignmentId))
        .catch(() => {});
    }

    const { filePath: _fp, ...safe } = submission;

    return NextResponse.json(
      {
        success: true,
        message: "Assignment submitted successfully.",
        data: toLegacy(safe),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[POST SUBMISSION ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Submission failed. Please try again." },
      { status: 500 },
    );
  }
}
