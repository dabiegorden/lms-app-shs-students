import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Performance from "@/models/Performance";
import { GoogleGenAI } from "@google/genai";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/performance/[studentId] ────────────────────────────────────────
// Full performance profile for a single student (instructor-scoped)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { studentId } = await params;
    await connectDB();

    const performance = await Performance.findOne({
      student: studentId,
      instructor: auth.userId,
    })
      .populate(
        "student",
        "name email profilePicture classLevel school programme",
      )
      .lean();

    if (!performance) {
      return NextResponse.json(
        {
          success: false,
          message: "No performance data found for this student.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: performance },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET STUDENT PERFORMANCE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch student performance." },
      { status: 500 },
    );
  }
}

// ─── POST /api/performance/[studentId]/ai-insight ────────────────────────────
// Regenerate the AI insight for a student using Gemini
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { studentId } = await params;
    await connectDB();

    const performance = await Performance.findOne({
      student: studentId,
      instructor: auth.userId,
    }).populate("student", "name classLevel");

    if (!performance) {
      return NextResponse.json(
        { success: false, message: "Performance record not found." },
        { status: 404 },
      );
    }

    // ── Build Gemini prompt ────────────────────────────────────────────────
    const studentName = (performance.student as any)?.name ?? "This student";
    const classLevel = (performance.student as any)?.classLevel ?? "SHS";

    const subjectSummary = performance.subjectStats
      .map(
        (s) =>
          `${s.subject}: ${s.averagePercentage.toFixed(1)}% avg across ${s.totalActivities} activities`,
      )
      .join("; ");

    const recentScores = performance.recentActivity
      .slice(-10)
      .map(
        (a) =>
          `${a.type === "quiz" ? "Quiz" : "Assignment"} "${a.title}" (${a.subject}): ${a.percentage.toFixed(1)}%`,
      )
      .join("; ");

    const prompt = `You are an educational performance analyst for a Ghanaian high school LMS. 
Analyse this student's academic performance and provide actionable feedback.

Student: ${studentName} (${classLevel})
Overall Average: ${performance.overallPercentage.toFixed(1)}%
Total Activities: ${performance.totalActivities} (${performance.quizCount} quizzes, ${performance.assignmentCount} assignments)
Quiz Average: ${performance.quizAveragePercentage.toFixed(1)}%
Assignment Average: ${performance.assignmentAveragePercentage.toFixed(1)}%

Subject Breakdown: ${subjectSummary || "No subject data yet"}

Recent Activity (latest 10): ${recentScores || "No recent activity"}

Write a concise, encouraging, and professional performance insight (3–5 sentences max) that:
1. States clearly whether the student is performing well, averagely, or needs improvement
2. Highlights their strongest subject(s) and where they need more work
3. Gives 2 specific, actionable suggestions for improvement
4. Uses a warm, motivating tone appropriate for a high school student in Ghana

Do NOT use markdown formatting. Write plain paragraphs only.`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const insight = response.text?.trim() ?? "";

    // ── Persist the insight ────────────────────────────────────────────────
    performance.aiInsight = insight;
    performance.aiInsightGeneratedAt = new Date();
    await performance.save();

    return NextResponse.json(
      { success: true, insight, generatedAt: performance.aiInsightGeneratedAt },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[AI INSIGHT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate AI insight." },
      { status: 500 },
    );
  }
}
