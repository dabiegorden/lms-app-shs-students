import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Submission from "@/models/Submission";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user) return null;
  return user;
}

// ─── GET /api/submission/bulk?ids=id1,id2,id3 ─────────────────────────────────
// Returns the current student's submissions for the given assignment IDs.
// Only returns submissions belonging to the authenticated user.
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
      .filter(Boolean)
      .slice(0, 100); // cap at 100 to prevent abuse

    await connectDB();

    const submissions = await Submission.find({
      assignment: { $in: ids },
      student: auth.userId,
    })
      .select(
        "_id assignment submittedAt fileUrl fileName fileSize note status score feedback isLate",
      )
      .lean();

    return NextResponse.json(
      { success: true, data: submissions },
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
