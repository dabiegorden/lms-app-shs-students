import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { assignments, submissions, users } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── PATCH /api/submission/[id]/grade ─────────────────────────────────────────
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

    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);

    if (!submission) {
      return NextResponse.json(
        { success: false, message: "Submission not found." },
        { status: 404 },
      );
    }

    // Verify the assignment belongs to this instructor
    const [assignment] = await db
      .select({ id: assignments.id, totalMarks: assignments.totalMarks })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, submission.assignmentId),
          eq(assignments.instructorId, auth.userId),
        ),
      )
      .limit(1);

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

    const updates: Partial<typeof submissions.$inferInsert> = {
      status,
      feedback: typeof feedback === "string" ? feedback.trim() : null,
    };

    if (status === "graded") {
      if (score === null || score === undefined || isNaN(Number(score))) {
        return NextResponse.json(
          { success: false, message: "A valid score is required when grading." },
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
      updates.score = numScore;
    } else {
      updates.score = null;
    }

    await db.update(submissions).set(updates).where(eq(submissions.id, id));

    // Re-fetch with the student joined for the response
    const [graded] = await db
      .select({
        id: submissions.id,
        assignmentId: submissions.assignmentId,
        submittedAt: submissions.submittedAt,
        fileUrl: submissions.fileUrl,
        fileName: submissions.fileName,
        fileSize: submissions.fileSize,
        note: submissions.note,
        status: submissions.status,
        score: submissions.score,
        feedback: submissions.feedback,
        isLate: submissions.isLate,
        student: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(submissions)
      .innerJoin(users, eq(submissions.studentId, users.id))
      .where(eq(submissions.id, id))
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        message:
          status === "graded"
            ? "Submission graded successfully."
            : "Submission returned for revision.",
        data: toLegacy(graded),
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
