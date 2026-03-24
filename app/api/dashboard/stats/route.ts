import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import mongoose from "mongoose";
import Assignment from "@/models/Assignment";
import Quiz from "@/models/Quiz";
import Announcement from "@/models/Announcement";
import Course from "@/models/Course";
import Performance from "@/models/Performance";
import User from "@/models/User";
import LectureNote from "@/models/Lecturenote";
import CourseEnrollment from "@/models/Courseenrollment";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
// Returns all instructor dashboard statistics in a single round-trip.
// Runs all aggregations in parallel for performance.
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

    const instructorId = new mongoose.Types.ObjectId(auth.userId);

    // ── All counts run in parallel ─────────────────────────────────────────
    const [
      assignmentStats,
      quizStats,
      noteStats,
      announcementStats,
      courseStats,
      enrollmentStats,
      studentStats,
      performanceStats,
      recentActivity,
      monthlySubmissions,
    ] = await Promise.all([
      // Assignment counts
      Assignment.aggregate([
        { $match: { instructor: instructorId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            draft: {
              $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
            },
            closed: {
              $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] },
            },
            totalSubmissions: { $sum: "$submissionsCount" },
            totalViews: { $sum: "$views" },
          },
        },
      ]),

      // Quiz counts
      Quiz.aggregate([
        { $match: { instructor: instructorId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            draft: {
              $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
            },
            totalSubmissions: { $sum: "$submissionsCount" },
            totalViews: { $sum: "$views" },
            totalQuestions: { $sum: { $size: "$questions" } },
          },
        },
      ]),

      // Lecture note counts
      LectureNote.aggregate([
        { $match: { instructor: instructorId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalViews: { $sum: "$views" },
            totalDownloads: { $sum: "$downloads" },
          },
        },
      ]),

      // Announcement counts
      Announcement.aggregate([
        { $match: { instructor: instructorId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            pinned: {
              $sum: { $cond: [{ $eq: ["$isPinned", true] }, 1, 0] },
            },
            totalViews: { $sum: "$viewsCount" },
            totalComments: { $sum: "$commentsCount" },
          },
        },
      ]),

      // Course counts
      Course.aggregate([
        { $match: { instructor: instructorId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            draft: {
              $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
            },
            totalEnrollments: { $sum: "$enrollmentsCount" },
            totalLessons: { $sum: "$totalLessons" },
            totalViews: { $sum: "$views" },
            avgRating: { $avg: "$ratingsAverage" },
          },
        },
      ]),

      // Enrollment stats — get all courses for this instructor first, then count
      Course.distinct("_id", { instructor: instructorId }).then((courseIds) => {
        if (!courseIds.length) return [{ total: 0, completed: 0 }];
        return CourseEnrollment.aggregate([
          { $match: { course: { $in: courseIds } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $eq: ["$isCompleted", true] }, 1, 0] },
              },
            },
          },
        ]);
      }),

      // Unique student count (students who submitted to this instructor's content)
      Performance.countDocuments({ instructor: instructorId }),

      // Performance summary
      Performance.aggregate([
        { $match: { instructor: instructorId } },
        {
          $group: {
            _id: null,
            avgOverallPercentage: { $avg: "$overallPercentage" },
            topPerformers: {
              $sum: { $cond: [{ $gte: ["$overallPercentage", 80] }, 1, 0] },
            },
            struggling: {
              $sum: { $cond: [{ $lt: ["$overallPercentage", 50] }, 1, 0] },
            },
            totalActivities: { $sum: "$totalActivities" },
          },
        },
      ]),

      // Recent 10 items created by this instructor across all content types
      // We'll fetch recent assignments + quizzes + notes
      Promise.all([
        Assignment.find({ instructor: instructorId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("title subject status createdAt submissionsCount")
          .lean()
          .then((docs) =>
            docs.map((d) => ({ ...d, contentType: "assignment" })),
          ),
        Quiz.find({ instructor: instructorId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("title subject status createdAt submissionsCount")
          .lean()
          .then((docs) => docs.map((d) => ({ ...d, contentType: "quiz" }))),
        LectureNote.find({ instructor: instructorId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("title subject createdAt views downloads")
          .lean()
          .then((docs) => docs.map((d) => ({ ...d, contentType: "note" }))),
      ]),

      // Monthly submission trend — last 6 months
      // Combines quiz + assignment submission counts by month
      Promise.all([
        Assignment.aggregate([
          {
            $match: {
              instructor: instructorId,
              createdAt: {
                $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
              },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              assignments: { $sum: 1 },
              submissions: { $sum: "$submissionsCount" },
            },
          },
        ]),
        Quiz.aggregate([
          {
            $match: {
              instructor: instructorId,
              createdAt: {
                $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
              },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              quizzes: { $sum: 1 },
              submissions: { $sum: "$submissionsCount" },
            },
          },
        ]),
      ]),
    ]);

    // ── Merge monthly trend data ────────────────────────────────────────────
    const MONTHS = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const now = new Date();
    const trendMap = new Map<
      string,
      {
        month: string;
        assignments: number;
        quizzes: number;
        submissions: number;
      }
    >();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      trendMap.set(key, {
        month: MONTHS[d.getMonth()],
        assignments: 0,
        quizzes: 0,
        submissions: 0,
      });
    }

    const [assignmentMonthly, quizMonthly] = monthlySubmissions;
    for (const a of assignmentMonthly) {
      const key = `${a._id.year}-${a._id.month}`;
      if (trendMap.has(key)) {
        const entry = trendMap.get(key)!;
        entry.assignments += a.assignments ?? 0;
        entry.submissions += a.submissions ?? 0;
      }
    }
    for (const q of quizMonthly) {
      const key = `${q._id.year}-${q._id.month}`;
      if (trendMap.has(key)) {
        const entry = trendMap.get(key)!;
        entry.quizzes += q.quizzes ?? 0;
        entry.submissions += q.submissions ?? 0;
      }
    }

    const trendData = Array.from(trendMap.values());

    // ── Flatten recent activity ────────────────────────────────────────────
    const [recentAssignments, recentQuizzes, recentNotes] = recentActivity;
    const allRecent = [...recentAssignments, ...recentQuizzes, ...recentNotes]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 8);

    // ── Compile response ──────────────────────────────────────────────────
    const response = {
      assignments: assignmentStats[0] ?? {
        total: 0,
        published: 0,
        draft: 0,
        closed: 0,
        totalSubmissions: 0,
        totalViews: 0,
      },
      quizzes: quizStats[0] ?? {
        total: 0,
        published: 0,
        draft: 0,
        totalSubmissions: 0,
        totalViews: 0,
        totalQuestions: 0,
      },
      notes: noteStats[0] ?? {
        total: 0,
        totalViews: 0,
        totalDownloads: 0,
      },
      announcements: announcementStats[0] ?? {
        total: 0,
        published: 0,
        pinned: 0,
        totalViews: 0,
        totalComments: 0,
      },
      courses: courseStats[0] ?? {
        total: 0,
        published: 0,
        draft: 0,
        totalEnrollments: 0,
        totalLessons: 0,
        totalViews: 0,
        avgRating: 0,
      },
      enrollments: (enrollmentStats as any[])[0] ?? { total: 0, completed: 0 },
      students: {
        total: studentStats,
        ...(performanceStats[0] ?? {
          avgOverallPercentage: 0,
          topPerformers: 0,
          struggling: 0,
          totalActivities: 0,
        }),
      },
      trendData,
      recentActivity: allRecent,
    };

    return NextResponse.json(
      { success: true, data: response },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[DASHBOARD STATS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to load dashboard stats." },
      { status: 500 },
    );
  }
}
