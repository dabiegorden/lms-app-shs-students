import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { quizzes } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";
import { buildQuestions, computeTotalMarks } from "@/lib/quiz-utils";
import { validateQuestions } from "../route";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/quiz/[id] ───────────────────────────────────────────────────────
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
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, id), eq(quizzes.instructorId, auth.userId)))
      .limit(1);

    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: toLegacy(quiz) },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET QUIZ ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch quiz." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/quiz/[id] ─────────────────────────────────────────────────────
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
      .select()
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
    const {
      title,
      subject,
      dueDate: dueDateRaw,
      description,
      topic,
      classLevel,
      durationMinutes,
      allowLateSubmission,
      shuffleQuestions,
      status,
      questions,
    } = body;

    const updates: Partial<typeof quizzes.$inferInsert> = {};

    if (title?.trim()) updates.title = title.trim();
    if (subject?.trim()) updates.subject = subject.trim();
    if (dueDateRaw && !isNaN(Date.parse(dueDateRaw)))
      updates.dueDate = new Date(dueDateRaw);
    if (description !== undefined) updates.description = description.trim();
    if (topic !== undefined) updates.topic = topic.trim();
    if (classLevel) updates.classLevel = classLevel;
    if (durationMinutes !== undefined)
      updates.durationMinutes = durationMinutes ? Number(durationMinutes) : null;
    if (allowLateSubmission !== undefined)
      updates.allowLateSubmission = Boolean(allowLateSubmission);
    if (shuffleQuestions !== undefined)
      updates.shuffleQuestions = Boolean(shuffleQuestions);
    if (status) updates.status = status;

    // ── Replace questions array if provided ────────────────────────────────
    if (Array.isArray(questions)) {
      if (questions.length === 0) {
        return NextResponse.json(
          { success: false, message: "At least one question is required." },
          { status: 400 },
        );
      }
      const validationError = validateQuestions(questions);
      if (validationError) {
        return NextResponse.json(
          { success: false, message: validationError },
          { status: 400 },
        );
      }

      const builtQuestions = buildQuestions(questions);
      updates.questions = builtQuestions;
      updates.totalMarks = computeTotalMarks(builtQuestions);
    }

    const [updated] = await db
      .update(quizzes)
      .set(updates)
      .where(eq(quizzes.id, quiz.id))
      .returning();

    return NextResponse.json(
      {
        success: true,
        message: "Quiz updated successfully.",
        data: toLegacy(updated),
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[PATCH QUIZ ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update quiz." },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/quiz/[id] ────────────────────────────────────────────────────
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

    const [quiz] = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(and(eq(quizzes.id, id), eq(quizzes.instructorId, auth.userId)))
      .limit(1);

    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found." },
        { status: 404 },
      );
    }

    await db.delete(quizzes).where(eq(quizzes.id, id));

    return NextResponse.json(
      { success: true, message: "Quiz deleted successfully." },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[DELETE QUIZ ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete quiz." },
      { status: 500 },
    );
  }
}
