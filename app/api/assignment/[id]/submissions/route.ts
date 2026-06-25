import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { assignments, submissions, users } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacyList } from "@/lib/serialize";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/assignment/[id]/submissions ─────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    const { id } = await params;

    // Verify the assignment belongs to this instructor
    const [assignment] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(eq(assignments.id, id), eq(assignments.instructorId, auth.userId)),
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status")?.trim() ?? "";

    const conditions = [eq(submissions.assignmentId, id)];
    if (statusFilter)
      conditions.push(eq(submissions.status, statusFilter as any));

    const rows = await db
      .select({
        id: submissions.id,
        assignmentId: submissions.assignmentId,
        submittedAt: submissions.submittedAt,
        fileUrl: submissions.fileUrl,
        fileName: submissions.fileName,
        fileSize: submissions.fileSize,
        note: submissions.note,
        status: submissions.status,
        score: submissions.score,
        feedback: submissions.feedback,
        isLate: submissions.isLate,
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt,
        student: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(submissions)
      .innerJoin(users, eq(submissions.studentId, users.id))
      .where(and(...conditions))
      .orderBy(desc(submissions.submittedAt));

    return NextResponse.json(
      { success: true, data: toLegacyList(rows) },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET ASSIGNMENT SUBMISSIONS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch submissions." },
      { status: 500 },
    );
  }
}
