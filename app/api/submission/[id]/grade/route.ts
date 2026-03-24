import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Assignment from "@/models/Assignment";
import Submission from "@/models/Submission";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── PATCH /api/submission/[id]/grade ─────────────────────────────────────────
// Grades or returns a student submission.
//
// Body (JSON):
//   score    – number | null  (required when status === "graded")
//   feedback – string         (optional)
//   status   – "graded" | "returned"
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    const { id } = await params;
    await connectDB();

    // Fetch the submission and populate the assignment to verify ownership
    const submission = await Submission.findById(id);
    if (!submission) {
      return NextResponse.json(
        { success: false, message: "Submission not found." },
        { status: 404 },
      );
    }

    // Verify the assignment belongs to this instructor
    const assignment = await Assignment.findOne({
      _id: submission.assignment,
      instructor: auth.userId,
    }).select("_id totalMarks");

    if (!assignment) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have permission to grade this submission.",
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { score, feedback, status } = body;

    if (!["graded", "returned"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Status must be 'graded' or 'returned'." },
        { status: 400 },
      );
    }

    if (status === "graded") {
      if (score === null || score === undefined || isNaN(Number(score))) {
        return NextResponse.json(
          {
            success: false,
            message: "A valid score is required when grading.",
          },
          { status: 400 },
        );
      }
      const numScore = Number(score);
      if (numScore < 0 || numScore > assignment.totalMarks) {
        return NextResponse.json(
          {
            success: false,
            message: `Score must be between 0 and ${assignment.totalMarks}.`,
          },
          { status: 400 },
        );
      }
      submission.score = numScore;
    } else {
      // Returning for revision — clear score
      submission.score = null;
    }

    submission.status = status;
    submission.feedback = typeof feedback === "string" ? feedback.trim() : null;
    await submission.save();

    // Re-populate student for the response
    await submission.populate("student", "name email avatar");

    return NextResponse.json(
      {
        success: true,
        message:
          status === "graded"
            ? "Submission graded successfully."
            : "Submission returned for revision.",
        data: {
          _id: submission._id,
          assignment: submission.assignment,
          student: submission.student,
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
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GRADE SUBMISSION ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to save grade." },
      { status: 500 },
    );
  }
}
