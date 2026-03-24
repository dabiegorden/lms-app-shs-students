import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Quiz from "@/models/Quiz";
import QuizSubmission from "@/models/Quizsubmission";

// ─── POST /api/quiz/[id]/submit ────────────────────────────────────────────────
// Body: JSON
//   answers: [
//     { questionId: string, selectedOption?: "A"|"B"|"C"|"D"|"E", theoryAnswer?: string }
//   ]
//   startedAt?: ISO string  (when the student opened the quiz)
//   timeTakenSeconds?: number
//
// Returns the submission with MCQ results immediately. Theory answers stay
// in "pending" state until the instructor grades them.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }
    const authUser = verifyToken(token);
    if (!authUser || authUser.role !== "student") {
      return NextResponse.json(
        { success: false, message: "Only students can submit quizzes." },
        { status: 403 },
      );
    }

    const { id } = await params;
    await connectDB();

    // ── Load quiz ──────────────────────────────────────────────────────────
    const quiz = await Quiz.findOne({ _id: id, status: "published" });
    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found or not published." },
        { status: 404 },
      );
    }

    // ── Check due date / late submission ───────────────────────────────────
    const now = new Date();
    if (now > quiz.dueDate && !quiz.allowLateSubmission) {
      return NextResponse.json(
        { success: false, message: "The submission deadline has passed." },
        { status: 400 },
      );
    }

    // ── Prevent duplicate submission ───────────────────────────────────────
    const existing = await QuizSubmission.findOne({
      quiz: id,
      student: authUser.userId,
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "You have already submitted this quiz." },
        { status: 409 },
      );
    }

    const body = await req.json();
    const { answers = [], startedAt = null, timeTakenSeconds = null } = body;

    // ── Build a lookup map: questionId → question ──────────────────────────
    const questionMap = new Map(quiz.questions.map((q) => [String(q._id), q]));

    // ── Process each answer ────────────────────────────────────────────────
    let mcqScore = 0;
    const hasTheory = quiz.questions.some((q) => q.type === "theory");

    const processedAnswers = quiz.questions.map((question) => {
      const studentAnswer = answers.find(
        (a: any) => String(a.questionId) === String(question._id),
      );

      if (question.type === "mcq") {
        const selected = studentAnswer?.selectedOption ?? null;
        const isCorrect =
          selected !== null && selected === question.correctOption;
        const autoMark = isCorrect ? question.marks : 0;
        mcqScore += autoMark;

        return {
          questionId: question._id,
          questionType: "mcq" as const,
          selectedOption: selected,
          isCorrect,
          theoryAnswer: "",
          autoMark,
          instructorMark: null,
          maxMarks: question.marks,
          instructorFeedback: "",
        };
      } else {
        // Theory
        return {
          questionId: question._id,
          questionType: "theory" as const,
          selectedOption: null,
          isCorrect: null,
          theoryAnswer: studentAnswer?.theoryAnswer?.trim() ?? "",
          autoMark: null,
          instructorMark: null,
          maxMarks: question.marks,
          instructorFeedback: "",
        };
      }
    });

    // ── Determine grading status ───────────────────────────────────────────
    // If there are no theory questions, the quiz is fully auto-graded
    const gradingStatus = hasTheory ? "pending" : "graded";
    const totalScore = hasTheory ? mcqScore : mcqScore; // theory score is 0 until graded

    // ── Save submission ────────────────────────────────────────────────────
    const submission = await QuizSubmission.create({
      quiz: id,
      student: authUser.userId,
      answers: processedAnswers,
      mcqScore,
      theoryScore: 0,
      totalScore,
      maxPossibleScore: quiz.totalMarks,
      submittedAt: now,
      gradingStatus,
      gradedAt: hasTheory ? null : now,
      gradedBy: hasTheory ? null : null,
      resultReleased: !hasTheory, // auto-release if MCQ only
      startedAt: startedAt ? new Date(startedAt) : null,
      timeTakenSeconds: timeTakenSeconds ?? null,
    });

    // ── Increment quiz submissionsCount (fire-and-forget) ──────────────────
    Quiz.findByIdAndUpdate(id, { $inc: { submissionsCount: 1 } })
      .exec()
      .catch(() => {});

    // ── Build student-safe response (no correct answers / model answers) ───
    const responseAnswers = processedAnswers.map((a) => ({
      questionId: a.questionId,
      questionType: a.questionType,
      selectedOption: a.selectedOption,
      isCorrect: a.questionType === "mcq" ? a.isCorrect : null,
      theoryAnswer: a.theoryAnswer,
      autoMark: a.questionType === "mcq" ? a.autoMark : null,
      maxMarks: a.maxMarks,
    }));

    return NextResponse.json(
      {
        success: true,
        message: hasTheory
          ? "Quiz submitted! Your MCQ answers have been marked. Theory answers are awaiting instructor review."
          : "Quiz submitted and marked successfully!",
        data: {
          _id: submission._id,
          mcqScore,
          totalScore,
          maxPossibleScore: quiz.totalMarks,
          gradingStatus: submission.gradingStatus,
          resultReleased: submission.resultReleased,
          submittedAt: submission.submittedAt,
          answers: responseAnswers,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[QUIZ SUBMIT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit quiz." },
      { status: 500 },
    );
  }
}
