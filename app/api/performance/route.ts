import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Performance from "@/models/Performance";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/performance ─────────────────────────────────────────────────────
// Returns a ranked list of all students who have submitted to this instructor's
// quizzes / assignments, with aggregate stats for the performance dashboard.
//
// Query params:
//   search     – filter by student name / email
//   subject    – filter by subject (matches subjectStats)
//   sort       – "top" | "bottom" | "recent" | "name"  (default: "top")
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
    const subject = searchParams.get("subject")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "top";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const skip = (page - 1) * limit;

    // ── Aggregation pipeline ───────────────────────────────────────────────
    const pipeline: any[] = [
      {
        $match: {
          instructor: new (require("mongoose").Types.ObjectId)(auth.userId),
        },
      },

      // Join student info
      {
        $lookup: {
          from: "users",
          localField: "student",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      { $unwind: "$studentInfo" },
    ];

    // Search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "studentInfo.name": { $regex: search, $options: "i" } },
            { "studentInfo.email": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Subject filter — student must have activity in that subject
    if (subject) {
      pipeline.push({
        $match: {
          "subjectStats.subject": { $regex: subject, $options: "i" },
        },
      });
    }

    // Sort
    const sortMap: Record<string, any> = {
      top: { overallPercentage: -1 },
      bottom: { overallPercentage: 1 },
      recent: { lastActivityAt: -1 },
      name: { "studentInfo.name": 1 },
    };
    pipeline.push({ $sort: sortMap[sort] ?? sortMap.top });

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: "total" }];

    // Paginate
    pipeline.push({ $skip: skip }, { $limit: limit });

    // Project only needed fields
    pipeline.push({
      $project: {
        _id: 1,
        student: 1,
        "studentInfo.name": 1,
        "studentInfo.email": 1,
        "studentInfo.profilePicture": 1,
        "studentInfo.classLevel": 1,
        "studentInfo.school": 1,
        totalActivities: 1,
        overallPercentage: 1,
        totalScore: 1,
        totalMaxScore: 1,
        quizCount: 1,
        quizAveragePercentage: 1,
        assignmentCount: 1,
        assignmentAveragePercentage: 1,
        subjectStats: 1,
        lastActivityAt: 1,
        aiInsight: 1,
        aiInsightGeneratedAt: 1,
        // Include last 20 activities for the spark line
        recentActivity: { $slice: ["$recentActivity", -20] },
      },
    });

    const [results, countResult] = await Promise.all([
      Performance.aggregate(pipeline),
      Performance.aggregate(countPipeline),
    ]);

    const total = countResult[0]?.total ?? 0;

    // ── Class-level summary stats ──────────────────────────────────────────
    const classSummaryPipeline = [
      {
        $match: {
          instructor: new (require("mongoose").Types.ObjectId)(auth.userId),
        },
      },
      {
        $group: {
          _id: null,
          classAvgPercentage: { $avg: "$overallPercentage" },
          totalStudents: { $sum: 1 },
          passing: {
            $sum: { $cond: [{ $gte: ["$overallPercentage", 50] }, 1, 0] },
          },
          topPerformers: {
            $sum: { $cond: [{ $gte: ["$overallPercentage", 80] }, 1, 0] },
          },
          struggling: {
            $sum: { $cond: [{ $lt: ["$overallPercentage", 40] }, 1, 0] },
          },
        },
      },
    ];

    const classSummary = await Performance.aggregate(classSummaryPipeline);
    const summary = classSummary[0] ?? {
      classAvgPercentage: 0,
      totalStudents: 0,
      passing: 0,
      topPerformers: 0,
      struggling: 0,
    };

    return NextResponse.json(
      {
        success: true,
        data: results,
        summary,
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
    console.error("[GET PERFORMANCE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch performance data." },
      { status: 500 },
    );
  }
}
