import { type NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { quizzes, quizSubmissions } from "@/src/schema";
import type { AnswerEntry } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";

// ─── POST /api/quiz/[id]/submit ────────────────────────────────────────────────
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

    // ── Load quiz ──────────────────────────────────────────────────────────
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, id), eq(quizzes.status, "published")))
      .limit(1);

    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found or not published." },
        { status: 404 },
      );
    }

    // ── Check due date / late submission ───────────────────────────────────
    const now = new Date();
    if (now > new Date(quiz.dueDate) && !quiz.allowLateSubmission) {
      return NextResponse.json(
        { success: false, message: "The submission deadline has passed." },
        { status: 400 },
      );
    }

    // ── Prevent duplicate submission ───────────────────────────────────────
    const [existing] = await db
      .select({ id: quizSubmissions.id })
      .from(quizSubmissions)
      .where(
        and(
          eq(quizSubmissions.quizId, id),
          eq(quizSubmissions.studentId, authUser.userId),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, message: "You have already submitted this quiz." },
        { status: 409 },
      );
    }

    const body = await req.json();
    const { answers = [], startedAt = null, timeTakenSeconds = null } = body;

    // ── Process each answer ────────────────────────────────────────────────
    let mcqScore = 0;
    const hasTheory = quiz.questions.some((q) => q.type === "theory");

    const processedAnswers: AnswerEntry[] = quiz.questions.map((question) => {
      const studentAnswer = answers.find(
        (a: any) => String(a.questionId) === String(question.id),
      );

      if (question.type === "mcq") {
        const selected = studentAnswer?.selectedOption ?? null;
        const isCorrect =
          selected !== null && selected === question.correctOption;
        const autoMark = isCorrect ? question.marks : 0;
        mcqScore += autoMark;

        return {
          questionId: question.id,
          questionType: "mcq",
          selectedOption: selected,
          isCorrect,
          theoryAnswer: "",
          autoMark,
          instructorMark: null,
          maxMarks: question.marks,
          instructorFeedback: "",
        };
      }
      return {
        questionId: question.id,
        questionType: "theory",
        selectedOption: null,
        isCorrect: null,
        theoryAnswer: studentAnswer?.theoryAnswer?.trim() ?? "",
        autoMark: null,
        instructorMark: null,
        maxMarks: question.marks,
        instructorFeedback: "",
      };
    });

    // ── Determine grading status ───────────────────────────────────────────
    const gradingStatus = hasTheory ? "pending" : "graded";
    const totalScore = mcqScore; // theory score is 0 until graded

    const [submission] = await db
      .insert(quizSubmissions)
      .values({
        quizId: id,
        studentId: authUser.userId,
        answers: processedAnswers,
        mcqScore,
        theoryScore: 0,
        totalScore,
        maxPossibleScore: quiz.totalMarks,
        submittedAt: now,
        gradingStatus,
        gradedAt: hasTheory ? null : now,
        gradedBy: null,
        resultReleased: !hasTheory,
        startedAt: startedAt ? new Date(startedAt) : null,
        timeTakenSeconds: timeTakenSeconds ?? null,
      })
      .returning();

    // ── Increment quiz submissionsCount (fire-and-forget) ──────────────────
    db.update(quizzes)
      .set({ submissionsCount: sql`${quizzes.submissionsCount} + 1` })
      .where(eq(quizzes.id, id))
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
          _id: submission.id,
          id: submission.id,
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
