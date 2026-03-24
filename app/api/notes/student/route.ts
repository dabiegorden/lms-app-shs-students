import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import LectureNote from "@/models/Lecturenote";

// ─── Auth helper (students + instructors) ─────────────────────────────────────
function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET /api/notes/student ───────────────────────────────────────────────────
// Returns all published lecture notes visible to the authenticated student.
// Notes are matched by the student's classLevel (or "All" class-level notes).
//
// Query params:
//   search     – free-text (title / subject / topic / description)
//   subject    – exact match (case-insensitive)
//   classLevel – override filter; default uses the student's own classLevel
//   page       – default 1
//   limit      – default 12, max 50
//   sort       – "newest" | "oldest" | "title"
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
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
    const classLevelParam = searchParams.get("classLevel")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)),
    );
    const skip = (page - 1) * limit;

    // ── Build query ────────────────────────────────────────────────────────
    // Students see notes targeted at:
    //   - "All" class levels, OR
    //   - Their specific class level (if known)
    //   - Also supports an explicit classLevel override from the query string
    const query: Record<string, any> = {};

    if (classLevelParam) {
      // Explicit filter from the UI
      query.classLevel =
        classLevelParam === "All"
          ? { $in: ["All"] }
          : { $in: ["All", classLevelParam] };
    }
    // No classLevel filter → return everything (all notes are visible to all students)

    if (search) {
      query.$text = { $search: search };
    }
    if (subject) {
      query.subject = { $regex: subject, $options: "i" };
    }

    // ── Sort ───────────────────────────────────────────────────────────────
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title: { title: 1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.newest;

    // ── Execute ────────────────────────────────────────────────────────────
    // Never expose filePath to students
    const [notes, total] = await Promise.all([
      LectureNote.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select("-filePath")
        .lean(),
      LectureNote.countDocuments(query),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: notes,
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
    console.error("[GET STUDENT NOTES ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch notes." },
      { status: 500 },
    );
  }
}
