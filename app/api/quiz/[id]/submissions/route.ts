import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { quizzes, quizSubmissions, users } from "@/src/schema";
import type { AnswerEntry } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy, toLegacyList } from "@/lib/serialize";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/quiz/[id]/submissions ───────────────────────────────────────────
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

    const [quiz] = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        totalMarks: quizzes.totalMarks,
        questions: quizzes.questions,
      })
      .from(quizzes)
      .where(and(eq(quizzes.id, id), eq(quizzes.instructorId, auth.userId)))
      .limit(1);

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
    const offset = (page - 1) * limit;

    const conditions = [eq(quizSubmissions.quizId, id)];
    if (gradingStatus)
      conditions.push(eq(quizSubmissions.gradingStatus, gradingStatus as any));
    const whereClause = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: quizSubmissions.id,
          quizId: quizSubmissions.quizId,
          answers: quizSubmissions.answers,
          mcqScore: quizSubmissions.mcqScore,
          theoryScore: quizSubmissions.theoryScore,
          totalScore: quizSubmissions.totalScore,
          maxPossibleScore: quizSubmissions.maxPossibleScore,
          submittedAt: quizSubmissions.submittedAt,
          gradingStatus: quizSubmissions.gradingStatus,
          gradedAt: quizSubmissions.gradedAt,
          overallFeedback: quizSubmissions.overallFeedback,
          resultReleased: quizSubmissions.resultReleased,
          startedAt: quizSubmissions.startedAt,
          timeTakenSeconds: quizSubmissions.timeTakenSeconds,
          createdAt: quizSubmissions.createdAt,
          updatedAt: quizSubmissions.updatedAt,
          student: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(quizSubmissions)
        .innerJoin(users, eq(quizSubmissions.studentId, users.id))
        .where(whereClause)
        .orderBy(desc(quizSubmissions.submittedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(quizSubmissions)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          quiz: {
            _id: quiz.id,
            id: quiz.id,
            title: quiz.title,
            totalMarks: quiz.totalMarks,
            questions: quiz.questions.map((q) => ({ ...q, _id: q.id })),
          },
          submissions: toLegacyList(rows),
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

    const [quiz] = await db
      .select({
        id: quizzes.id,
        totalMarks: quizzes.totalMarks,
        questions: quizzes.questions,
      })
      .from(quizzes)
      .where(and(eq(quizzes.id, id), eq(quizzes.instructorId, auth.userId)))
      .limit(1);

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

    const [submission] = await db
      .select()
      .from(quizSubmissions)
      .where(
        and(
          eq(quizSubmissions.id, submissionId),
          eq(quizSubmissions.quizId, id),
        ),
      )
      .limit(1);

    if (!submission) {
      return NextResponse.json(
        { success: false, message: "Submission not found." },
        { status: 404 },
      );
    }

    const answers: AnswerEntry[] = submission.answers.map((a) => ({ ...a }));

    // ── Apply per-question grades ──────────────────────────────────────────
    for (const grade of grades) {
      const answerEntry = answers.find(
        (a) => String(a.questionId) === String(grade.questionId),
      );
      if (!answerEntry) continue;

      const question = quiz.questions.find(
        (q) => String(q.id) === String(grade.questionId),
      );
      const maxMarks = question?.marks ?? answerEntry.maxMarks;

      const mark = Math.min(maxMarks, Math.max(0, Number(grade.instructorMark)));
      answerEntry.instructorMark = mark;

      if (grade.instructorFeedback !== undefined) {
        answerEntry.instructorFeedback = grade.instructorFeedback.trim();
      }
    }

    // ── Re-compute scores ──────────────────────────────────────────────────
    let theoryScore = 0;
    let allTheoryGraded = true;

    for (const answer of answers) {
      if (answer.questionType === "theory") {
        if (answer.instructorMark === null) {
          allTheoryGraded = false;
        } else {
          theoryScore += answer.instructorMark;
        }
      }
    }

    const updates: Partial<typeof quizSubmissions.$inferInsert> = {
      answers,
      theoryScore,
      totalScore: submission.mcqScore + theoryScore,
    };

    const hasAnyTheoryGraded = answers.some(
      (a) => a.questionType === "theory" && a.instructorMark !== null,
    );

    if (allTheoryGraded) {
      updates.gradingStatus = "graded";
      updates.gradedAt = new Date();
      updates.gradedBy = auth.userId;
    } else if (hasAnyTheoryGraded) {
      updates.gradingStatus = "partially_graded";
    }

    if (overallFeedback !== undefined) {
      updates.overallFeedback = overallFeedback.trim();
    }
    if (releaseResult !== undefined) {
      updates.resultReleased = Boolean(releaseResult);
    }

    const [updated] = await db
      .update(quizSubmissions)
      .set(updates)
      .where(eq(quizSubmissions.id, submission.id))
      .returning();

    return NextResponse.json(
      {
        success: true,
        message: "Submission graded successfully.",
        data: toLegacy(updated),
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
