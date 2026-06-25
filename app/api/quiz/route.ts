import { type NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { quizzes } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy, toLegacyList } from "@/lib/serialize";
import {
  buildQuestions,
  computeTotalMarks,
  quizListProjection,
} from "@/lib/quiz-utils";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── Sanitise — list/summary view of a quiz (no answers) ───────────────────────
export function _sanitiseQuiz(quiz: any) {
  const questions = quiz.questions ?? [];
  return {
    _id: quiz.id,
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    subject: quiz.subject,
    topic: quiz.topic,
    classLevel: quiz.classLevel,
    dueDate: quiz.dueDate,
    totalMarks: quiz.totalMarks,
    durationMinutes: quiz.durationMinutes,
    allowLateSubmission: quiz.allowLateSubmission,
    shuffleQuestions: quiz.shuffleQuestions,
    status: quiz.status,
    views: quiz.views,
    submissionsCount: quiz.submissionsCount,
    questionCount: questions.length,
    mcqCount: questions.filter((q: any) => q.type === "mcq").length,
    theoryCount: questions.filter((q: any) => q.type === "theory").length,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
}

// ─── GET /api/quiz ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [eq(quizzes.instructorId, auth.userId)];
    if (search) {
      conditions.push(
        or(
          ilike(quizzes.title, `%${search}%`),
          ilike(quizzes.subject, `%${search}%`),
          ilike(quizzes.topic, `%${search}%`),
          ilike(quizzes.description, `%${search}%`),
        )!,
      );
    }
    if (subject) conditions.push(ilike(quizzes.subject, `%${subject}%`));
    if (classLevel) conditions.push(eq(quizzes.classLevel, classLevel as any));
    if (status) conditions.push(eq(quizzes.status, status as any));

    const whereClause = and(...conditions);

    const orderByMap: Record<string, any> = {
      newest: desc(quizzes.createdAt),
      oldest: asc(quizzes.createdAt),
      title: asc(quizzes.title),
      dueDate: asc(quizzes.dueDate),
    };
    const orderBy = orderByMap[sort] ?? orderByMap.newest;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(quizzes)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(quizzes)
        .where(whereClause),
    ]);

    // Strip answer-bearing question fields from the list view
    const data = toLegacyList(rows).map((q) => quizListProjection(q));
    const total = totalResult[0]?.count ?? 0;

    return NextResponse.json(
      {
        success: true,
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET QUIZZES ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch quizzes." },
      { status: 500 },
    );
  }
}

// ─── POST /api/quiz ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    const body = await req.json();
    const {
      title,
      subject,
      dueDate: dueDateRaw,
      description = "",
      topic = "",
      classLevel = "All",
      durationMinutes = null,
      allowLateSubmission = false,
      shuffleQuestions = false,
      status = "published",
      questions = [],
    } = body;

    if (!title?.trim() || !subject?.trim()) {
      return NextResponse.json(
        { success: false, message: "Title and subject are required." },
        { status: 400 },
      );
    }
    if (!dueDateRaw || isNaN(Date.parse(dueDateRaw))) {
      return NextResponse.json(
        { success: false, message: "A valid due date is required." },
        { status: 400 },
      );
    }
    if (!Array.isArray(questions) || questions.length === 0) {
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

    const [quiz] = await db
      .insert(quizzes)
      .values({
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        topic: topic.trim(),
        classLevel,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        dueDate: new Date(dueDateRaw),
        allowLateSubmission: Boolean(allowLateSubmission),
        shuffleQuestions: Boolean(shuffleQuestions),
        status,
        questions: builtQuestions,
        totalMarks: computeTotalMarks(builtQuestions),
        instructorId: auth.userId,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        message: "Quiz created successfully.",
        data: _sanitiseQuiz(quiz),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[POST QUIZ ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to create quiz. Please try again." },
      { status: 500 },
    );
  }
}

// ─── Shared question validation (returns an error string or null) ──────────────
export function validateQuestions(questions: any[]): string | null {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.type || !["mcq", "theory"].includes(q.type)) {
      return `Question ${i + 1}: type must be "mcq" or "theory".`;
    }
    if (!q.text?.trim()) {
      return `Question ${i + 1}: text is required.`;
    }
    if (!q.marks || q.marks < 0.5) {
      return `Question ${i + 1}: marks must be at least 0.5.`;
    }
    if (q.type === "mcq") {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return `Question ${i + 1}: MCQ must have at least 2 options.`;
      }
      if (!q.correctOption) {
        return `Question ${i + 1}: MCQ must have a correct option selected.`;
      }
    }
  }
  return null;
}
