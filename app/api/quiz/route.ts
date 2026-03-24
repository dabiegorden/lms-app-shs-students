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

// ─── GET /api/quiz ─────────────────────────────────────────────────────────────
// Query params:
//   search     – free-text (title / subject / topic / description)
//   subject    – exact match (case-insensitive)
//   classLevel – "SHS 1" | "SHS 2" | "SHS 3" | "All"
//   status     – "draft" | "published" | "closed"
//   page       – default 1
//   limit      – default 12, max 50
//   sort       – "newest" | "oldest" | "title" | "dueDate"
export async function GET(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    await connectDB();

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
    const skip = (page - 1) * limit;

    // ── Query ──────────────────────────────────────────────────────────────
    const query: Record<string, any> = { instructor: auth.userId };
    if (search) query.$text = { $search: search };
    if (subject) query.subject = { $regex: subject, $options: "i" };
    if (classLevel) query.classLevel = classLevel;
    if (status) query.status = status;

    // ── Sort ───────────────────────────────────────────────────────────────
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title: { title: 1 },
      dueDate: { dueDate: 1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.newest;

    // ── Execute ────────────────────────────────────────────────────────────
    // Exclude question-level model answers and correctOption from list view
    const [quizzes, total] = await Promise.all([
      Quiz.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select(
          "_id title description subject topic classLevel dueDate totalMarks durationMinutes allowLateSubmission shuffleQuestions status views submissionsCount instructor createdAt updatedAt questions._id questions.type questions.text questions.marks questions.options questions.order",
        )
        .lean(),
      Quiz.countDocuments(query),
    ]);

    // Attach question counts
    const data = quizzes.map((q: any) => ({
      ...q,
      questionCount: q.questions?.length ?? 0,
      mcqCount: q.questions?.filter((qu: any) => qu.type === "mcq").length ?? 0,
      theoryCount:
        q.questions?.filter((qu: any) => qu.type === "theory").length ?? 0,
      questions: undefined, // strip from list view to keep payload small
    }));

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
// Body: JSON
//   title              (required)
//   subject            (required)
//   dueDate            (required) ISO string
//   description        (optional)
//   topic              (optional)
//   classLevel         (optional, default "All")
//   durationMinutes    (optional, null = no timer)
//   allowLateSubmission (optional)
//   shuffleQuestions   (optional)
//   status             (optional, default "published")
//   questions          (required, array of question objects)
//     Each question:
//       type           "mcq" | "theory"
//       text           string
//       marks          number
//       options        [{label, text}, …]  (MCQ only, 2-5 options)
//       correctOption  "A"|"B"|"C"|"D"|"E" (MCQ only)
//       modelAnswer    string (theory only)
//       order          number
export async function POST(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    await connectDB();

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

    // ── Validate required fields ───────────────────────────────────────────
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

    // ── Validate questions ─────────────────────────────────────────────────
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
      if (!q.marks || q.marks < 0.5) {
        return NextResponse.json(
          {
            success: false,
            message: `Question ${i + 1}: marks must be at least 0.5.`,
          },
          { status: 400 },
        );
      }
      if (q.type === "mcq") {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          return NextResponse.json(
            {
              success: false,
              message: `Question ${i + 1}: MCQ must have at least 2 options.`,
            },
            { status: 400 },
          );
        }
        if (!q.correctOption) {
          return NextResponse.json(
            {
              success: false,
              message: `Question ${i + 1}: MCQ must have a correct option selected.`,
            },
            { status: 400 },
          );
        }
      }
    }

    // ── Create quiz ────────────────────────────────────────────────────────
    const quiz = await Quiz.create({
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
      questions: questions.map((q: any, idx: number) => ({
        type: q.type,
        text: q.text.trim(),
        marks: Number(q.marks),
        options: q.type === "mcq" ? q.options : [],
        correctOption: q.type === "mcq" ? q.correctOption : null,
        modelAnswer: q.type === "theory" ? (q.modelAnswer?.trim() ?? "") : "",
        order: q.order ?? idx,
      })),
      instructor: auth.userId,
    });

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

// ─── Sanitise — strip correctOption / modelAnswer from responses ───────────────
// (Only omit from student-facing views; instructors get the full object via [id])
export function _sanitiseQuiz(quiz: any) {
  return {
    _id: quiz._id,
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
    questionCount: quiz.questions?.length ?? 0,
    mcqCount: quiz.questions?.filter((q: any) => q.type === "mcq").length ?? 0,
    theoryCount:
      quiz.questions?.filter((q: any) => q.type === "theory").length ?? 0,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
}
