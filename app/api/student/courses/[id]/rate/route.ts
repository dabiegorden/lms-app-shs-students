import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Course from "@/models/Course";
import CourseEnrollment from "@/models/Courseenrollment";

// ─── FILE: /api/student/courses/[id]/rate/route.ts ───────────────────────────

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// POST /api/student/courses/[id]/rate
// Body: { rating: number (1–5), review?: string }
export async function POST(
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

    // Guard: reject obviously invalid IDs before hitting MongoDB
    if (!id || id === "undefined" || !id.match(/^[a-f\d]{24}$/i)) {
      return NextResponse.json(
        { success: false, message: "Invalid course ID." },
        { status: 400 },
      );
    }
    const { rating, review = "" } = await req.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Rating must be between 1 and 5." },
        { status: 400 },
      );
    }

    await connectDB();

    const enrollment = await CourseEnrollment.findOne({
      course: id,
      student: auth.userId,
    });

    if (!enrollment) {
      return NextResponse.json(
        { success: false, message: "Not enrolled in this course." },
        { status: 404 },
      );
    }

    if (!enrollment.isCompleted) {
      return NextResponse.json(
        {
          success: false,
          message: "Complete the course before submitting a rating.",
        },
        { status: 400 },
      );
    }

    enrollment.rating = rating;
    enrollment.review = review.trim();
    enrollment.reviewedAt = new Date();
    await enrollment.save();

    // Recompute course average rating (fire-and-forget)
    CourseEnrollment.aggregate([
      { $match: { course: enrollment.course, rating: { $ne: null } } },
      {
        $group: {
          _id: null,
          avg: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ])
      .then(([result]: any) => {
        if (result) {
          Course.findByIdAndUpdate(id, {
            ratingsAverage: Math.round(result.avg * 10) / 10,
            ratingsCount: result.count,
          })
            .exec()
            .catch(() => {});
        }
      })
      .catch(() => {});

    return NextResponse.json(
      { success: true, message: "Rating submitted.", data: enrollment },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[STUDENT RATE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit rating." },
      { status: 500 },
    );
  }
}
