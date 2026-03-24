import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Assignment from "@/models/Assignment";
import Submission from "@/models/Submission";

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
  const user = verifyToken(token);
  if (!user) return null;
  return user;
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

    await connectDB();

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
    const assignment = await Assignment.findById(assignmentId).select(
      "status dueDate allowLateSubmission title subject",
    );

    console.log("[SUBMISSION DEBUG] assignmentId:", assignmentId);
    console.log(
      "[SUBMISSION DEBUG] assignment found:",
      assignment
        ? {
            status: assignment.status,
            dueDate: assignment.dueDate,
            allowLateSubmission: assignment.allowLateSubmission,
          }
        : null,
    );

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 },
      );
    }

    // ── Status check ───────────────────────────────────────────────────────
    if (assignment.status !== "published") {
      console.log("[SUBMISSION DEBUG] BLOCKED — status is:", assignment.status);
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

    console.log("[SUBMISSION DEBUG] now:", now.toISOString());
    console.log("[SUBMISSION DEBUG] dueDate:", dueDate.toISOString());
    console.log(
      "[SUBMISSION DEBUG] isLate:",
      isLate,
      "| allowLateSubmission:",
      assignment.allowLateSubmission,
    );

    if (isLate && !assignment.allowLateSubmission) {
      console.log("[SUBMISSION DEBUG] BLOCKED — late submission not allowed");
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
    const existing = await Submission.findOne({
      assignment: assignmentId,
      student: auth.userId,
    });

    console.log(
      "[SUBMISSION DEBUG] existing submission:",
      existing ? { status: existing.status, _id: existing._id } : null,
    );

    if (existing && existing.status !== "returned") {
      console.log(
        "[SUBMISSION DEBUG] BLOCKED — duplicate submission, status:",
        existing.status,
      );
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
    let submission;

    if (existing && existing.status === "returned") {
      if (existing.filePath) {
        try {
          await fs.unlink(existing.filePath);
        } catch (e: any) {
          if (e.code !== "ENOENT") console.warn("[SUB FILE DELETE]", e.message);
        }
      }
      existing.submittedAt = now;
      existing.fileUrl = fileUrl;
      existing.filePath = filePath;
      existing.fileName = fileName;
      existing.fileSize = fileSize;
      existing.note = note;
      existing.status = "submitted";
      existing.score = null;
      existing.feedback = null;
      existing.isLate = isLate;
      submission = await existing.save();
    } else {
      submission = await Submission.create({
        assignment: assignmentId,
        student: auth.userId,
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
      });

      Assignment.findByIdAndUpdate(assignmentId, {
        $inc: { submissionsCount: 1 },
      })
        .exec()
        .catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        message: "Assignment submitted successfully.",
        data: {
          _id: submission._id,
          assignment: submission.assignment,
          submittedAt: submission.submittedAt,
          fileUrl: submission.fileUrl,
          fileName: submission.fileName,
          fileSize: submission.fileSize,
          note: submission.note,
          status: submission.status,
          score: submission.score,
          feedback: submission.feedback,
          isLate: submission.isLate,
        },
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
