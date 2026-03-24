import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Quiz from "@/models/Quiz";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/quiz/[id] ───────────────────────────────────────────────────────
// Returns the full quiz including correctOption and modelAnswer (instructor only)
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

    const quiz = await Quiz.findOne({
      _id: id,
      instructor: auth.userId,
    }).lean();
    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: quiz }, { status: 200 });
  } catch (error: any) {
    console.error("[GET QUIZ ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch quiz." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/quiz/[id] ─────────────────────────────────────────────────────
// Body: JSON — all fields optional. Passing `questions` replaces the entire array.
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

    const quiz = await Quiz.findOne({ _id: id, instructor: auth.userId });
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

    // ── Apply updates ──────────────────────────────────────────────────────
    if (title?.trim()) quiz.title = title.trim();
    if (subject?.trim()) quiz.subject = subject.trim();
    if (dueDateRaw && !isNaN(Date.parse(dueDateRaw)))
      quiz.dueDate = new Date(dueDateRaw);
    if (description !== undefined) quiz.description = description.trim();
    if (topic !== undefined) quiz.topic = topic.trim();
    if (classLevel) quiz.classLevel = classLevel;
    if (durationMinutes !== undefined)
      quiz.durationMinutes = durationMinutes ? Number(durationMinutes) : null;
    if (allowLateSubmission !== undefined)
      quiz.allowLateSubmission = Boolean(allowLateSubmission);
    if (shuffleQuestions !== undefined)
      quiz.shuffleQuestions = Boolean(shuffleQuestions);
    if (status) quiz.status = status;

    // ── Replace questions array if provided ────────────────────────────────
    if (Array.isArray(questions)) {
      if (questions.length === 0) {
        return NextResponse.json(
          { success: false, message: "At least one question is required." },
          { status: 400 },
        );
      }
      // Validate
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.type || !["mcq", "theory"].includes(q.type)) {
          return NextResponse.json(
            {
              success: false,
              message: `Question ${i + 1}: type must be "mcq" or "theory".`,
            },
            { status: 400 },
          );
        }
        if (!q.text?.trim()) {
          return NextResponse.json(
            { success: false, message: `Question ${i + 1}: text is required.` },
            { status: 400 },
          );
        }
        if (
          q.type === "mcq" &&
          (!Array.isArray(q.options) || q.options.length < 2)
        ) {
          return NextResponse.json(
            {
              success: false,
              message: `Question ${i + 1}: MCQ requires at least 2 options.`,
            },
            { status: 400 },
          );
        }
        if (q.type === "mcq" && !q.correctOption) {
          return NextResponse.json(
            {
              success: false,
              message: `Question ${i + 1}: MCQ must have a correct option.`,
            },
            { status: 400 },
          );
        }
      }

      quiz.questions = questions.map((q: any, idx: number) => ({
        type: q.type,
        text: q.text.trim(),
        marks: Number(q.marks) || 1,
        options: q.type === "mcq" ? q.options : [],
        correctOption: q.type === "mcq" ? q.correctOption : null,
        modelAnswer: q.type === "theory" ? (q.modelAnswer?.trim() ?? "") : "",
        order: q.order ?? idx,
      }));
    }

    await quiz.save(); // triggers pre-save totalMarks computation

    return NextResponse.json(
      {
        success: true,
        message: "Quiz updated successfully.",
        data: quiz.toObject(),
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
    await connectDB();

    const quiz = await Quiz.findOne({ _id: id, instructor: auth.userId });
    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found." },
        { status: 404 },
      );
    }

    await Quiz.deleteOne({ _id: id });

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
