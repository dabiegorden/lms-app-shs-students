import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Assignment from "@/models/Assignment";
import Submission from "@/models/Submission";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/assignment/[id]/submissions ─────────────────────────────────────
// Returns all student submissions for a given assignment.
// Only the instructor who owns the assignment can access this.
//
// Query params:
//   status – "submitted" | "graded" | "returned" (optional filter)
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
    await connectDB();

    // Verify the assignment belongs to this instructor
    const assignment = await Assignment.findOne({
      _id: id,
      instructor: auth.userId,
    }).select("_id");

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Assignment not found." },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status")?.trim() ?? "";

    const query: Record<string, any> = { assignment: id };
    if (statusFilter) query.status = statusFilter;

    const submissions = await Submission.find(query)
      .populate("student", "name email avatar")
      .select("-filePath") // never expose server path
      .sort({ submittedAt: -1 })
      .lean();

    return NextResponse.json(
      { success: true, data: submissions },
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
