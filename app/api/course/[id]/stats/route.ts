import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Course from "@/models/Course";
import CourseEnrollment from "@/models/Courseenrollment";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/course/[id]/stats ───────────────────────────────────────────────
// Returns enrollment + completion stats for a course
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { id } = await params;
    await connectDB();

    const course = await Course.findOne({
      _id: id,
      instructor: auth.userId,
    }).select("_id title totalLessons enrollmentsCount");
    if (!course)
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 },
      );

    const [totalEnrolled, totalCompleted, recentEnrollments, avgProgress] =
      await Promise.all([
        CourseEnrollment.countDocuments({ course: id }),
        CourseEnrollment.countDocuments({ course: id, isCompleted: true }),
        CourseEnrollment.find({ course: id })
          .sort({ enrolledAt: -1 })
          .limit(10)
          .populate("student", "name email")
          .select(
            "student progressPercent isCompleted enrolledAt lastAccessedAt",
          )
          .lean(),
        CourseEnrollment.aggregate([
          { $match: { course: course._id } },
          { $group: { _id: null, avgProgress: { $avg: "$progressPercent" } } },
        ]),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        totalEnrolled,
        totalCompleted,
        completionRate:
          totalEnrolled > 0
            ? Math.round((totalCompleted / totalEnrolled) * 100)
            : 0,
        averageProgress: Math.round(avgProgress[0]?.avgProgress ?? 0),
        recentEnrollments,
      },
    });
  } catch (error: any) {
    console.error("[COURSE STATS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch stats." },
      { status: 500 },
    );
  }
}
