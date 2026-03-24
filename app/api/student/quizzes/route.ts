import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Quiz from "@/models/Quiz";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// ─── GET /api/student/quizzes ──────────────────────────────────────────────────
// Returns all published quizzes visible to the student.
// Query: search, subject, classLevel, page, limit
export async function GET(req: NextRequest) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Student access only." },
        { status: 401 },
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const skip = (page - 1) * limit;

    // Only published quizzes — classLevel "All" matches everyone
    const query: Record<string, any> = {
      status: "published",
      $or: [{ classLevel: "All" }, ...(classLevel ? [{ classLevel }] : [])],
    };

    if (search) query.$text = { $search: search };
    if (subject) query.subject = { $regex: subject, $options: "i" };

    const [quizzes, total] = await Promise.all([
      Quiz.find(query)
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // Strip correctOption and modelAnswer from student view
        .select(
          "_id title description subject topic classLevel dueDate totalMarks durationMinutes allowLateSubmission shuffleQuestions status views submissionsCount createdAt questions._id questions.type questions.text questions.marks questions.options questions.order",
        )
        .lean(),
      Quiz.countDocuments(query),
    ]);

    // Increment views (fire-and-forget)
    const ids = quizzes.map((q: any) => q._id);
    Quiz.updateMany({ _id: { $in: ids } }, { $inc: { views: 1 } })
      .exec()
      .catch(() => {});

    const data = quizzes.map((q: any) => ({
      ...q,
      questionCount: q.questions?.length ?? 0,
      mcqCount: q.questions?.filter((qu: any) => qu.type === "mcq").length ?? 0,
      theoryCount:
        q.questions?.filter((qu: any) => qu.type === "theory").length ?? 0,
      questions: undefined, // Strip questions from list view; fetched individually
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
    console.error("[STUDENT GET QUIZZES ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch quizzes." },
      { status: 500 },
    );
  }
}
