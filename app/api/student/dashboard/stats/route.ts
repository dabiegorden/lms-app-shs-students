import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import mongoose from "mongoose";
import CourseEnrollment from "@/models/Courseenrollment";
import QuizSubmission from "@/models/Quizsubmission";
import AssignmentSubmission from "@/models/Assignment";
import Announcement from "@/models/Announcement";
import LectureNote from "@/models/Lecturenote";
import Performance from "@/models/Performance";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

// ─── GET /api/student/dashboard/stats ─────────────────────────────────────────
// Returns all student dashboard statistics in a single round-trip.
// All aggregations run in parallel for performance.
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

    const studentId = new mongoose.Types.ObjectId(auth.userId);

    const [
      enrollmentStats,
      quizSubmissionStats,
      assignmentSubmissionStats,
      performanceData,
      announcementStats,
      noteStats,
      recentActivity,
      monthlyActivity,
      topCourses,
      recentQuizSubmissions,
      recentAssignmentSubmissions,
    ] = await Promise.all([
      // ── Course enrollments ────────────────────────────────────────────────
      CourseEnrollment.aggregate([
        { $match: { student: studentId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$isCompleted", true] }, 1, 0] },
            },
            inProgress: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$progressPercent", 0] },
                      { $lt: ["$progressPercent", 100] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            notStarted: {
              $sum: { $cond: [{ $eq: ["$progressPercent", 0] }, 1, 0] },
            },
            totalLessonsCompleted: { $sum: "$completedLessons" },
            avgProgress: { $avg: "$progressPercent" },
            certificatesEarned: {
              $sum: {
                $cond: [{ $ifNull: ["$certificateId", false] }, 1, 0],
              },
            },
          },
        },
      ]),

      // ── Quiz submissions ──────────────────────────────────────────────────
      QuizSubmission.aggregate([
        { $match: { student: studentId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            graded: {
              $sum: { $cond: [{ $eq: ["$isGraded", true] }, 1, 0] },
            },
            avgScore: { $avg: "$percentage" },
            highestScore: { $max: "$percentage" },
            totalMarksEarned: { $sum: "$totalScore" },
            passed: {
              $sum: { $cond: [{ $gte: ["$percentage", 50] }, 1, 0] },
            },
          },
        },
      ]),

      // ── Assignment submissions ────────────────────────────────────────────
      AssignmentSubmission.aggregate([
        { $match: { student: studentId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            graded: {
              $sum: { $cond: [{ $eq: ["$isGraded", true] }, 1, 0] },
            },
            avgScore: { $avg: "$percentage" },
            highestScore: { $max: "$percentage" },
            onTime: {
              $sum: { $cond: [{ $eq: ["$isLate", false] }, 1, 0] },
            },
            late: {
              $sum: { $cond: [{ $eq: ["$isLate", true] }, 1, 0] },
            },
          },
        },
      ]),

      // ── Performance record ────────────────────────────────────────────────
      Performance.findOne({ student: studentId }).lean(),

      // ── Announcement count visible to this student ─────────────────────────
      // (all published — student sees all)
      Announcement.countDocuments({ status: "published" }),

      // ── Lecture notes available ────────────────────────────────────────────
      LectureNote.countDocuments({ status: "published" }),

      // ── Recent activity: last 8 submissions across quizzes + assignments ───
      Promise.all([
        QuizSubmission.find({ student: studentId })
          .sort({ submittedAt: -1 })
          .limit(5)
          .populate("quiz", "title subject")
          .select("quiz percentage isGraded submittedAt totalScore")
          .lean()
          .then((docs) =>
            docs.map((d: any) => ({
              _id: d._id,
              title: d.quiz?.title ?? "Quiz",
              subject: d.quiz?.subject ?? "",
              score: d.percentage,
              isGraded: d.isGraded,
              submittedAt: d.submittedAt,
              contentType: "quiz",
            })),
          ),
        AssignmentSubmission.find({ student: studentId })
          .sort({ submittedAt: -1 })
          .limit(5)
          .populate("assignment", "title subject")
          .select("assignment percentage isGraded submittedAt isLate")
          .lean()
          .then((docs: any) =>
            docs.map((d: any) => ({
              _id: d._id,
              title: d.assignment?.title ?? "Assignment",
              subject: d.assignment?.subject ?? "",
              score: d.percentage,
              isGraded: d.isGraded,
              isLate: d.isLate,
              submittedAt: d.submittedAt,
              contentType: "assignment",
            })),
          ),
        CourseEnrollment.find({ student: studentId })
          .sort({ lastAccessedAt: -1 })
          .limit(4)
          .populate("course", "title subject thumbnailUrl previewVideoId")
          .select(
            "course progressPercent isCompleted lastAccessedAt completedLessons totalLessons",
          )
          .lean()
          .then((docs) =>
            docs.map((d: any) => ({
              _id: d._id,
              title: d.course?.title ?? "Course",
              subject: d.course?.subject ?? "",
              thumbnailUrl: d.course?.thumbnailUrl ?? null,
              previewVideoId: d.course?.previewVideoId ?? null,
              progress: d.progressPercent,
              isCompleted: d.isCompleted,
              completedLessons: d.completedLessons,
              totalLessons: d.totalLessons,
              lastAccessedAt: d.lastAccessedAt,
              contentType: "course",
            })),
          ),
      ]),

      // ── Monthly activity trend — last 6 months ─────────────────────────────
      Promise.all([
        QuizSubmission.aggregate([
          {
            $match: {
              student: studentId,
              submittedAt: {
                $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
              },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$submittedAt" },
                month: { $month: "$submittedAt" },
              },
              count: { $sum: 1 },
              avgScore: { $avg: "$percentage" },
            },
          },
        ]),
        AssignmentSubmission.aggregate([
          {
            $match: {
              student: studentId,
              submittedAt: {
                $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
              },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$submittedAt" },
                month: { $month: "$submittedAt" },
              },
              count: { $sum: 1 },
              avgScore: { $avg: "$percentage" },
            },
          },
        ]),
      ]),

      // ── Top 4 enrolled courses with progress ──────────────────────────────
      CourseEnrollment.find({ student: studentId })
        .sort({ progressPercent: -1, enrolledAt: -1 })
        .limit(4)
        .populate(
          "course",
          "title subject thumbnailUrl previewVideoId totalLessons totalDurationSeconds certificateEnabled",
        )
        .select(
          "course progressPercent isCompleted completedLessons totalLessons certificateId enrolledAt lastAccessedAt",
        )
        .lean(),

      // ── Recent quiz submissions with scores ────────────────────────────────
      QuizSubmission.find({ student: studentId })
        .sort({ submittedAt: -1 })
        .limit(5)
        .populate("quiz", "title subject totalMarks durationMinutes")
        .select(
          "quiz totalScore percentage isGraded submittedAt timeSpentSeconds",
        )
        .lean(),

      // ── Recent assignment submissions ──────────────────────────────────────
      AssignmentSubmission.find({ student: studentId })
        .sort({ submittedAt: -1 })
        .limit(5)
        .populate("assignment", "title subject totalMarks dueDate")
        .select(
          "assignment totalScore percentage isGraded submittedAt isLate grade",
        )
        .lean(),
    ]);

    // ── Build monthly trend map ──────────────────────────────────────────────
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
        quizzes: number;
        assignments: number;
        avgScore: number;
        scoreCount: number;
      }
    >();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      trendMap.set(key, {
        month: MONTHS[d.getMonth()],
        quizzes: 0,
        assignments: 0,
        avgScore: 0,
        scoreCount: 0,
      });
    }

    const [quizMonthly, assignmentMonthly] = monthlyActivity;

    for (const q of quizMonthly) {
      const key = `${q._id.year}-${q._id.month}`;
      if (trendMap.has(key)) {
        const e = trendMap.get(key)!;
        e.quizzes += q.count;
        e.avgScore += q.avgScore ?? 0;
        e.scoreCount += 1;
      }
    }
    for (const a of assignmentMonthly) {
      const key = `${a._id.year}-${a._id.month}`;
      if (trendMap.has(key)) {
        const e = trendMap.get(key)!;
        e.assignments += a.count;
        e.avgScore += a.avgScore ?? 0;
        e.scoreCount += 1;
      }
    }

    const trendData = Array.from(trendMap.values()).map((e) => ({
      month: e.month,
      quizzes: e.quizzes,
      assignments: e.assignments,
      avgScore: e.scoreCount > 0 ? Math.round(e.avgScore / e.scoreCount) : 0,
    }));

    // ── Flatten recent activity ──────────────────────────────────────────────
    const [recentQuizActivity, recentAssignmentActivity, recentCourseActivity] =
      recentActivity;
    const allRecent = [
      ...recentQuizActivity,
      ...recentAssignmentActivity,
      ...recentCourseActivity.map((c: any) => ({
        ...c,
        submittedAt: c.lastAccessedAt ?? new Date(0),
      })),
    ]
      .sort(
        (a, b) =>
          new Date((b as any).submittedAt ?? 0).getTime() -
          new Date((a as any).submittedAt ?? 0).getTime(),
      )
      .slice(0, 8);

    // ── Subject performance breakdown ────────────────────────────────────────
    const subjectBreakdown = (performanceData as any)?.subjectBreakdown ?? [];

    // ── Compile final response ───────────────────────────────────────────────
    const enrollStats = enrollmentStats[0] ?? {
      total: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      totalLessonsCompleted: 0,
      avgProgress: 0,
      certificatesEarned: 0,
    };

    const quizStats = quizSubmissionStats[0] ?? {
      total: 0,
      graded: 0,
      avgScore: 0,
      highestScore: 0,
      totalMarksEarned: 0,
      passed: 0,
    };

    const assignStats = assignmentSubmissionStats[0] ?? {
      total: 0,
      graded: 0,
      avgScore: 0,
      highestScore: 0,
      onTime: 0,
      late: 0,
    };

    const perf = performanceData as any;

    const response = {
      // Overview counts
      enrollments: {
        total: enrollStats.total,
        completed: enrollStats.completed,
        inProgress: enrollStats.inProgress,
        notStarted: enrollStats.notStarted,
        avgProgress: Math.round(enrollStats.avgProgress ?? 0),
        totalLessonsCompleted: enrollStats.totalLessonsCompleted,
        certificatesEarned: enrollStats.certificatesEarned,
      },

      quizzes: {
        total: quizStats.total,
        graded: quizStats.graded,
        pending: quizStats.total - quizStats.graded,
        avgScore: Math.round(quizStats.avgScore ?? 0),
        highestScore: Math.round(quizStats.highestScore ?? 0),
        passed: quizStats.passed,
        passRate:
          quizStats.total > 0
            ? Math.round((quizStats.passed / quizStats.total) * 100)
            : 0,
      },

      assignments: {
        total: assignStats.total,
        graded: assignStats.graded,
        pending: assignStats.total - assignStats.graded,
        avgScore: Math.round(assignStats.avgScore ?? 0),
        highestScore: Math.round(assignStats.highestScore ?? 0),
        onTime: assignStats.onTime,
        late: assignStats.late,
        onTimeRate:
          assignStats.total > 0
            ? Math.round((assignStats.onTime / assignStats.total) * 100)
            : 0,
      },

      // Overall academic performance
      performance: {
        overallPercentage: Math.round(perf?.overallPercentage ?? 0),
        totalActivities: perf?.totalActivities ?? 0,
        subjectBreakdown,
        grade: perf?.grade ?? null,
        lastUpdated: perf?.updatedAt ?? null,
      },

      // Resources available
      resources: {
        announcements: announcementStats,
        lectureNotes: noteStats,
      },

      // Chart data
      trendData,

      // Lists for cards
      topCourses: topCourses.map((e: any) => ({
        enrollmentId: e._id,
        courseId: e.course?._id,
        title: e.course?.title ?? "Untitled Course",
        subject: e.course?.subject ?? "",
        thumbnailUrl: e.course?.thumbnailUrl ?? null,
        previewVideoId: e.course?.previewVideoId ?? null,
        totalLessons: e.course?.totalLessons ?? 0,
        totalDurationSeconds: e.course?.totalDurationSeconds ?? 0,
        certificateEnabled: e.course?.certificateEnabled ?? false,
        progressPercent: e.progressPercent,
        completedLessons: e.completedLessons,
        totalEnrolledLessons: e.totalLessons,
        isCompleted: e.isCompleted,
        certificateId: e.certificateId ?? null,
        enrolledAt: e.enrolledAt,
        lastAccessedAt: e.lastAccessedAt,
      })),

      recentQuizSubmissions: recentQuizSubmissions.map((s: any) => ({
        _id: s._id,
        quizTitle: s.quiz?.title ?? "Quiz",
        subject: s.quiz?.subject ?? "",
        totalMarks: s.quiz?.totalMarks ?? 0,
        totalScore: s.totalScore ?? 0,
        percentage: Math.round(s.percentage ?? 0),
        isGraded: s.isGraded,
        submittedAt: s.submittedAt,
        timeSpentSeconds: s.timeSpentSeconds ?? 0,
      })),

      recentAssignmentSubmissions: recentAssignmentSubmissions.map(
        (s: any) => ({
          _id: s._id,
          assignmentTitle: s.assignment?.title ?? "Assignment",
          subject: s.assignment?.subject ?? "",
          totalMarks: s.assignment?.totalMarks ?? 0,
          totalScore: s.totalScore ?? 0,
          percentage: Math.round(s.percentage ?? 0),
          isGraded: s.isGraded,
          isLate: s.isLate,
          grade: s.grade ?? null,
          submittedAt: s.submittedAt,
        }),
      ),

      recentActivity: allRecent,
    };

    return NextResponse.json(
      { success: true, data: response },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[STUDENT DASHBOARD STATS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to load dashboard stats." },
      { status: 500 },
    );
  }
}
