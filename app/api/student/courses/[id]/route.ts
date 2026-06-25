import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { courses } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { isUuid } from "@/lib/validation";
import { toLegacy } from "@/lib/serialize";

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// ─── GET /api/student/courses/[id] ───────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    if (!isUuid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid course ID." },
        { status: 400 },
      );
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.status, "published")))
      .limit(1);

    if (!course) {
      return NextResponse.json(
        { success: false, message: "Course not found or not available." },
        { status: 404 },
      );
    }

    const { thumbnailPath: _tp, instructorId: _i, ...safe } = course;
    return NextResponse.json(
      { success: true, data: toLegacy(safe) },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[STUDENT GET COURSE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch course." },
      { status: 500 },
    );
  }
}
