import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Course from "@/models/Course";
import CourseEnrollment from "@/models/Courseenrollment";

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// ─── GET /api/student/courses ─────────────────────────────────────────────────
// Returns published courses visible to the student.
// Query: search, subject, classLevel, page, limit
export async function GET(req: NextRequest) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Student access only." },
        { status: 401 },
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)),
    );
    const skip = (page - 1) * limit;

    // Only published courses — classLevel "All" matches everyone
    const query: Record<string, any> = {
      status: "published",
      $or: [{ classLevel: "All" }, ...(classLevel ? [{ classLevel }] : [])],
    };

    if (search) query.$text = { $search: search };
    if (subject) query.subject = { $regex: subject, $options: "i" };

    const [courses, total] = await Promise.all([
      Course.find(query)
        .sort({ enrollmentsCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-sections -thumbnailPath -overview -instructor")
        .lean(),
      Course.countDocuments(query),
    ]);

    // Increment views (fire-and-forget)
    const ids = courses.map((c: any) => c._id);
    Course.updateMany({ _id: { $in: ids } }, { $inc: { views: 1 } })
      .exec()
      .catch(() => {});

    return NextResponse.json(
      {
        success: true,
        data: courses,
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
    console.error("[STUDENT GET COURSES ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch courses." },
      { status: 500 },
    );
  }
}
