import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Quiz from "@/models/Quiz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const authUser = verifyToken(token);
    if (!authUser || authUser.role !== "student")
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { id } = await params;

    // Guard: reject obviously invalid IDs before hitting MongoDB
    if (!id || id === "undefined" || !id.match(/^[a-f\d]{24}$/i)) {
      return NextResponse.json(
        { success: false, message: "Invalid course ID." },
        { status: 400 },
      );
    }
    await connectDB();

    const quiz = await Quiz.findOne({ _id: id, status: "published" })
      .select(
        "_id title description subject topic classLevel dueDate totalMarks durationMinutes allowLateSubmission shuffleQuestions status questions._id questions.type questions.text questions.marks questions.options questions.order",
      )
      .lean();

    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found or not available." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: quiz }, { status: 200 });
  } catch (error: any) {
    console.error("[STUDENT GET QUIZ ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch quiz." },
      { status: 500 },
    );
  }
}
