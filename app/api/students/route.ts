import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import User from "@/models/User";
import Performance from "@/models/Performance";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/students ────────────────────────────────────────────────────────
// Returns all students with optional search, filter, sort, pagination.
// Also joins their performance summary if available.
//
// Query params:
//   search     – name / email
//   classLevel – "SHS 1" | "SHS 2" | "SHS 3"
//   sort       – "newest" | "oldest" | "name" | "topPerformers"
//   page       – default 1
//   limit      – default 20, max 50
export async function GET(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const skip = (page - 1) * limit;

    // ── Build query ────────────────────────────────────────────────────────
    const query: Record<string, any> = { role: "student" };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (classLevel) query.classLevel = classLevel;

    // ── Sort ───────────────────────────────────────────────────────────────
    const sortMap: Record<string, any> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name: { name: 1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.newest;

    // ── Execute base query ─────────────────────────────────────────────────
    const [students, total] = await Promise.all([
      User.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select("-password -profilePicturePublicId")
        .lean(),
      User.countDocuments(query),
    ]);

    if (!students.length) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
        { status: 200 },
      );
    }

    // ── Join performance data ──────────────────────────────────────────────
    const studentIds = students.map((s) => s._id);
    const performances = await Performance.find({
      student: { $in: studentIds },
      instructor: auth.userId,
    })
      .select(
        "student overallPercentage totalActivities quizCount assignmentCount lastActivityAt",
      )
      .lean();

    const perfMap = new Map(performances.map((p) => [String(p.student), p]));

    const enriched = students.map((s) => ({
      ...s,
      performance: perfMap.get(String(s._id)) ?? null,
    }));

    // ── Sort by performance if requested ───────────────────────────────────
    if (sort === "topPerformers") {
      enriched.sort((a, b) => {
        const aP = (a.performance as any)?.overallPercentage ?? -1;
        const bP = (b.performance as any)?.overallPercentage ?? -1;
        return bP - aP;
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: enriched,
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
    console.error("[GET STUDENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch students." },
      { status: 500 },
    );
  }
}

// ─── POST /api/students ───────────────────────────────────────────────────────
// Instructor creates a student account manually.
// Body: JSON { name, email, password, school?, classLevel?, programme? }
export async function POST(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    await connectDB();

    const body = await req.json();
    const {
      name,
      email,
      password = "student123", // default password — student should change it
      school,
      classLevel,
      programme,
    } = body;

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { success: false, message: "Name and email are required." },
        { status: 400 },
      );
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "A user with this email already exists." },
        { status: 409 },
      );
    }

    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);

    const student = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      role: "student",
      school: school?.trim() ?? "",
      classLevel: classLevel?.trim() ?? "",
      programme: programme?.trim() ?? "",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Student account created successfully.",
        data: {
          _id: student._id,
          name: student.name,
          email: student.email,
          role: student.role,
          school: student.school,
          classLevel: student.classLevel,
          programme: student.programme,
          profilePicture: student.profilePicture,
          createdAt: student.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[CREATE STUDENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to create student." },
      { status: 500 },
    );
  }
}
