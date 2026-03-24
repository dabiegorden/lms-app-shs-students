import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Assignment from "@/models/Assignment";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  // Accept both "student" role and any authenticated user who isn't blocked
  if (!user) return null;
  return user;
}

// ─── GET /api/students/assignment ─────────────────────────────────────────────
// Returns PUBLISHED assignments only (students never see drafts/closed unless
// they already submitted to a now-closed one — handled client-side).
//
// Query params:
//   search     – free-text search
//   subject    – exact subject filter
//   classLevel – "SHS 1" | "SHS 2" | "SHS 3" | "All"
//   status     – locked to "published" (ignored from client, always overridden)
//   page       – default 1
//   limit      – default 12, max 50
//   sort       – "newest" | "oldest" | "title" | "dueDate"
export async function GET(req: NextRequest) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)),
    );
    const skip = (page - 1) * limit;

    // ── Query — students always see only published assignments ─────────────
    const query: Record<string, any> = { status: "published" };

    if (search) query.$text = { $search: search };
    if (subject) query.subject = { $regex: subject, $options: "i" };
    // If classLevel is "All" or empty, show everything; otherwise filter
    if (classLevel && classLevel !== "All") query.classLevel = classLevel;

    // ── Sort ───────────────────────────────────────────────────────────────
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title: { title: 1 },
      dueDate: { dueDate: 1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.newest;

    // ── Execute ────────────────────────────────────────────────────────────
    const [assignments, total] = await Promise.all([
      Assignment.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select("-filePath -instructor") // never expose server path or instructor id
        .lean(),
      Assignment.countDocuments(query),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: assignments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET STUDENT ASSIGNMENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch assignments." },
      { status: 500 },
    );
  }
}
