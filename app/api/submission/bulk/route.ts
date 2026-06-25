import { type NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import { submissions } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacyList } from "@/lib/serialize";
import { isUuid } from "@/lib/validation";

function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET /api/submission/bulk?ids=id1,id2,id3 ─────────────────────────────────
// Returns the current student's submissions for the given assignment IDs.
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids") ?? "";

    if (!idsParam.trim()) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => isUuid(id))
      .slice(0, 100); // cap at 100 to prevent abuse

    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

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
      })
      .from(submissions)
      .where(
        and(
          inArray(submissions.assignmentId, ids),
          eq(submissions.studentId, auth.userId),
        ),
      );

    return NextResponse.json(
      { success: true, data: toLegacyList(rows) },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET BULK SUBMISSIONS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch submission status." },
      { status: 500 },
    );
  }
}
