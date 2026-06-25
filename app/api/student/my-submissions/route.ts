import { type NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { quizSubmissions } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacyList } from "@/lib/serialize";

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

    const rows = await db
      .select()
      .from(quizSubmissions)
      .where(eq(quizSubmissions.studentId, authUser.userId))
      .orderBy(desc(quizSubmissions.submittedAt));

    return NextResponse.json(
      { success: true, data: toLegacyList(rows) },
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
