import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { performances, users } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";
import { GoogleGenAI } from "@google/genai";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

const performanceWithStudentSelect = {
  id: performances.id,
  studentId: performances.studentId,
  instructorId: performances.instructorId,
  totalActivities: performances.totalActivities,
  totalScore: performances.totalScore,
  totalMaxScore: performances.totalMaxScore,
  overallPercentage: performances.overallPercentage,
  quizCount: performances.quizCount,
  quizTotalScore: performances.quizTotalScore,
  quizTotalMaxScore: performances.quizTotalMaxScore,
  quizAveragePercentage: performances.quizAveragePercentage,
  assignmentCount: performances.assignmentCount,
  assignmentTotalScore: performances.assignmentTotalScore,
  assignmentTotalMaxScore: performances.assignmentTotalMaxScore,
  assignmentAveragePercentage: performances.assignmentAveragePercentage,
  subjectStats: performances.subjectStats,
  recentActivity: performances.recentActivity,
  aiInsight: performances.aiInsight,
  aiInsightGeneratedAt: performances.aiInsightGeneratedAt,
  lastActivityAt: performances.lastActivityAt,
  createdAt: performances.createdAt,
  updatedAt: performances.updatedAt,
  student: {
    id: users.id,
    name: users.name,
    email: users.email,
    profilePicture: users.profilePicture,
    classLevel: users.classLevel,
    school: users.school,
    programme: users.programme,
  },
} as const;

// ─── GET /api/performance/[studentId] ────────────────────────────────────────
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

    const [performance] = await db
      .select(performanceWithStudentSelect)
      .from(performances)
      .innerJoin(users, eq(performances.studentId, users.id))
      .where(
        and(
          eq(performances.studentId, studentId),
          eq(performances.instructorId, auth.userId),
        ),
      )
      .limit(1);

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
      { success: true, data: toLegacy(performance) },
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

// ─── POST /api/performance/[studentId] — regenerate AI insight ───────────────
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

    const [performance] = await db
      .select(performanceWithStudentSelect)
      .from(performances)
      .innerJoin(users, eq(performances.studentId, users.id))
      .where(
        and(
          eq(performances.studentId, studentId),
          eq(performances.instructorId, auth.userId),
        ),
      )
      .limit(1);

    if (!performance) {
      return NextResponse.json(
        { success: false, message: "Performance record not found." },
        { status: 404 },
      );
    }

    const studentName = performance.student?.name ?? "This student";
    const classLevel = performance.student?.classLevel ?? "SHS";

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
    const generatedAt = new Date();

    await db
      .update(performances)
      .set({ aiInsight: insight, aiInsightGeneratedAt: generatedAt })
      .where(eq(performances.id, performance.id));

    return NextResponse.json(
      { success: true, insight, generatedAt },
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
