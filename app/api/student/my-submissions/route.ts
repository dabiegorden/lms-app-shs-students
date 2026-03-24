import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import QuizSubmission from "@/models/Quizsubmission";

export async function GET(req: NextRequest) {
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

    await connectDB();

    const submissions = await QuizSubmission.find({ student: authUser.userId })
      .sort({ submittedAt: -1 })
      .lean();

    return NextResponse.json(
      { success: true, data: submissions },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[STUDENT MY SUBMISSIONS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch submissions." },
      { status: 500 },
    );
  }
}
