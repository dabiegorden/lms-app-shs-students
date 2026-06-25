import { type NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { courseEnrollments } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacyList } from "@/lib/serialize";

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// GET /api/student/my-enrollments
export async function GET(req: NextRequest) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const enrollments = await db
      .select()
      .from(courseEnrollments)
      .where(eq(courseEnrollments.studentId, auth.userId))
      .orderBy(
        desc(courseEnrollments.lastAccessedAt),
        desc(courseEnrollments.enrolledAt),
      );

    return NextResponse.json(
      { success: true, data: toLegacyList(enrollments) },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[STUDENT MY ENROLLMENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch enrollments." },
      { status: 500 },
    );
  }
}
