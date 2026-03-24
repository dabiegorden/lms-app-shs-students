import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Quiz from "@/models/Quiz";
import QuizSubmission from "@/models/Quizsubmission";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/quiz/[id]/submissions ───────────────────────────────────────────
// Returns all submissions for the quiz (instructor only).
// Query: gradingStatus filter, page, limit
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

    // Confirm ownership
    const quiz = await Quiz.findOne({
      _id: id,
      instructor: auth.userId,
    }).select("_id title totalMarks questions");
    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found." },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(req.url);
    const gradingStatus = searchParams.get("gradingStatus")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const skip = (page - 1) * limit;

    const subQuery: Record<string, any> = { quiz: id };
    if (gradingStatus) subQuery.gradingStatus = gradingStatus;

    const [submissions, total] = await Promise.all([
      QuizSubmission.find(subQuery)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("student", "name email")
        .lean(),
      QuizSubmission.countDocuments(subQuery),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          quiz: {
            _id: quiz._id,
            title: quiz.title,
            totalMarks: quiz.totalMarks,
            questions: quiz.questions, // includes correctOption & modelAnswer for instructor
          },
          submissions,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1,
          },
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET SUBMISSIONS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch submissions." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/quiz/[id]/submissions ─────────────────────────────────────────
// Grade one or more theory answers in a single submission.
// Body: JSON
//   submissionId   string (required)
//   grades: [
//     { questionId: string, instructorMark: number, instructorFeedback?: string }
//   ]
//   overallFeedback?: string
//   releaseResult?: boolean   – set true to push result to student dashboard
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

    // Confirm quiz ownership
    const quiz = await Quiz.findOne({
      _id: id,
      instructor: auth.userId,
    }).select("_id totalMarks questions");
    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found." },
        { status: 404 },
      );
    }

    const body = await req.json();
    const { submissionId, grades = [], overallFeedback, releaseResult } = body;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: "submissionId is required." },
        { status: 400 },
      );
    }

    const submission = await QuizSubmission.findOne({
      _id: submissionId,
      quiz: id,
    });
    if (!submission) {
      return NextResponse.json(
        { success: false, message: "Submission not found." },
        { status: 404 },
      );
    }

    // ── Apply per-question grades ──────────────────────────────────────────
    for (const grade of grades) {
      const answerEntry = submission.answers.find(
        (a) => String(a.questionId) === String(grade.questionId),
      );
      if (!answerEntry) continue;

      // Instructors can grade both theory and override MCQ marks
      const question = quiz.questions.find(
        (q) => String(q._id) === String(grade.questionId),
      );
      const maxMarks = question?.marks ?? answerEntry.maxMarks;

      // Clamp mark between 0 and maxMarks
      const mark = Math.min(
        maxMarks,
        Math.max(0, Number(grade.instructorMark)),
      );
      answerEntry.instructorMark = mark;

      if (grade.instructorFeedback !== undefined) {
        answerEntry.instructorFeedback = grade.instructorFeedback.trim();
      }
    }

    // ── Re-compute scores ──────────────────────────────────────────────────
    let theoryScore = 0;
    let allTheoryGraded = true;

    for (const answer of submission.answers) {
      if (answer.questionType === "theory") {
        if (answer.instructorMark === null) {
          allTheoryGraded = false;
        } else {
          theoryScore += answer.instructorMark;
        }
      }
    }

    submission.theoryScore = theoryScore;
    submission.totalScore = submission.mcqScore + theoryScore;

    // ── Update grading status ──────────────────────────────────────────────
    const hasAnyTheoryGraded = submission.answers.some(
      (a) => a.questionType === "theory" && a.instructorMark !== null,
    );

    if (allTheoryGraded) {
      submission.gradingStatus = "graded";
      submission.gradedAt = new Date();
      submission.gradedBy = auth.userId as any;
    } else if (hasAnyTheoryGraded) {
      submission.gradingStatus = "partially_graded";
    }

    // ── Optional fields ────────────────────────────────────────────────────
    if (overallFeedback !== undefined) {
      submission.overallFeedback = overallFeedback.trim();
    }
    if (releaseResult !== undefined) {
      submission.resultReleased = Boolean(releaseResult);
    }

    await submission.save();

    return NextResponse.json(
      {
        success: true,
        message: "Submission graded successfully.",
        data: submission.toObject(),
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GRADE SUBMISSION ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to grade submission." },
      { status: 500 },
    );
  }
}
