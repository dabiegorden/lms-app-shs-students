import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { quizzes } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { isUuid } from "@/lib/validation";
import { toLegacy } from "@/lib/serialize";

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

    if (!isUuid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid quiz ID." },
        { status: 400 },
      );
    }

    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, id), eq(quizzes.status, "published")))
      .limit(1);

    if (!quiz) {
      return NextResponse.json(
        { success: false, message: "Quiz not found or not available." },
        { status: 404 },
      );
    }

    // Strip instructor + answer-bearing fields (correctOption / modelAnswer)
    const { instructorId, questions, ...rest } = quiz;
    const safeQuestions = questions.map((q) => ({
      id: q.id,
      _id: q.id,
      type: q.type,
      text: q.text,
      marks: q.marks,
      options: q.options,
      order: q.order,
    }));

    return NextResponse.json(
      { success: true, data: { ...toLegacy(rest), questions: safeQuestions } },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[STUDENT GET QUIZ ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch quiz." },
      { status: 500 },
    );
  }
}
