import { type NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  courseEnrollments,
  courses,
  quizSubmissions,
  quizzes,
  submissions,
  assignments,
  announcements,
  lectureNotes,
  performances,
} from "@/src/schema";
import { verifyToken } from "@/lib/jwt";

function requireStudent(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "student") return null;
  return user;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pct = (score: number | null, max: number | null) =>
  max && max > 0 && score != null ? (score / max) * 100 : 0;

// ─── GET /api/student/dashboard/stats ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = requireStudent(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Student access only." },
        { status: 401 },
      );
    }

    const studentId = auth.userId;

    const [
      enrollmentRows,
      quizSubRows,
      assignmentSubRows,
      perfRows,
      announcementCountRows,
      noteCountRows,
    ] = await Promise.all([
      db
        .select({
          id: courseEnrollments.id,
          courseId: courseEnrollments.courseId,
          progressPercent: courseEnrollments.progressPercent,
          isCompleted: courseEnrollments.isCompleted,
          completedLessons: courseEnrollments.completedLessons,
          totalLessons: courseEnrollments.totalLessons,
          certificateId: courseEnrollments.certificateId,
          enrolledAt: courseEnrollments.enrolledAt,
          lastAccessedAt: courseEnrollments.lastAccessedAt,
          course: {
            title: courses.title,
            subject: courses.subject,
            thumbnailUrl: courses.thumbnailUrl,
            previewVideoId: courses.previewVideoId,
            totalLessons: courses.totalLessons,
            totalDurationSeconds: courses.totalDurationSeconds,
            certificateEnabled: courses.certificateEnabled,
          },
        })
        .from(courseEnrollments)
        .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
        .where(eq(courseEnrollments.studentId, studentId)),
      db
        .select({
          id: quizSubmissions.id,
          totalScore: quizSubmissions.totalScore,
          maxPossibleScore: quizSubmissions.maxPossibleScore,
          gradingStatus: quizSubmissions.gradingStatus,
          submittedAt: quizSubmissions.submittedAt,
          timeTakenSeconds: quizSubmissions.timeTakenSeconds,
          quiz: {
            title: quizzes.title,
            subject: quizzes.subject,
            totalMarks: quizzes.totalMarks,
            durationMinutes: quizzes.durationMinutes,
          },
        })
        .from(quizSubmissions)
        .innerJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
        .where(eq(quizSubmissions.studentId, studentId))
        .orderBy(desc(quizSubmissions.submittedAt)),
      db
        .select({
          id: submissions.id,
          score: submissions.score,
          status: submissions.status,
          isLate: submissions.isLate,
          submittedAt: submissions.submittedAt,
          assignment: {
            title: assignments.title,
            subject: assignments.subject,
            totalMarks: assignments.totalMarks,
            dueDate: assignments.dueDate,
          },
        })
        .from(submissions)
        .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
        .where(eq(submissions.studentId, studentId))
        .orderBy(desc(submissions.submittedAt)),
      db
        .select()
        .from(performances)
        .where(eq(performances.studentId, studentId))
        .limit(1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(announcements)
        .where(eq(announcements.status, "published")),
      db.select({ count: sql<number>`count(*)::int` }).from(lectureNotes),
    ]);

    // ── Enrollment aggregates ──────────────────────────────────────────────
    const enrollStats = {
      total: enrollmentRows.length,
      completed: enrollmentRows.filter((e) => e.isCompleted).length,
      inProgress: enrollmentRows.filter(
        (e) => e.progressPercent > 0 && e.progressPercent < 100,
      ).length,
      notStarted: enrollmentRows.filter((e) => e.progressPercent === 0).length,
      totalLessonsCompleted: enrollmentRows.reduce(
        (s, e) => s + e.completedLessons,
        0,
      ),
      avgProgress: enrollmentRows.length
        ? enrollmentRows.reduce((s, e) => s + e.progressPercent, 0) /
          enrollmentRows.length
        : 0,
      certificatesEarned: enrollmentRows.filter((e) => !!e.certificateId).length,
    };

    // ── Quiz aggregates ────────────────────────────────────────────────────
    const quizPercents = quizSubRows.map((q) =>
      pct(q.totalScore, q.maxPossibleScore),
    );
    const quizStats = {
      total: quizSubRows.length,
      graded: quizSubRows.filter((q) => q.gradingStatus === "graded").length,
      avgScore: quizPercents.length
        ? quizPercents.reduce((s, p) => s + p, 0) / quizPercents.length
        : 0,
      highestScore: quizPercents.length ? Math.max(...quizPercents) : 0,
      totalMarksEarned: quizSubRows.reduce((s, q) => s + (q.totalScore ?? 0), 0),
      passed: quizPercents.filter((p) => p >= 50).length,
    };

    // ── Assignment aggregates ──────────────────────────────────────────────
    const assignPercents = assignmentSubRows.map((a) =>
      pct(a.score, a.assignment.totalMarks),
    );
    const assignStats = {
      total: assignmentSubRows.length,
      graded: assignmentSubRows.filter((a) => a.status === "graded").length,
      avgScore: assignPercents.length
        ? assignPercents.reduce((s, p) => s + p, 0) / assignPercents.length
        : 0,
      highestScore: assignPercents.length ? Math.max(...assignPercents) : 0,
      onTime: assignmentSubRows.filter((a) => !a.isLate).length,
      late: assignmentSubRows.filter((a) => a.isLate).length,
    };

    const perf = perfRows[0];

    // ── Monthly trend (last 6 months) ──────────────────────────────────────
    const now = new Date();
    const trendMap = new Map<
      string,
      { month: string; quizzes: number; assignments: number; scoreSum: number; scoreCount: number }
    >();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trendMap.set(`${d.getFullYear()}-${d.getMonth() + 1}`, {
        month: MONTHS[d.getMonth()],
        quizzes: 0,
        assignments: 0,
        scoreSum: 0,
        scoreCount: 0,
      });
    }
    const monthKey = (date: Date) =>
      `${date.getFullYear()}-${date.getMonth() + 1}`;
    quizSubRows.forEach((q, idx) => {
      const e = trendMap.get(monthKey(new Date(q.submittedAt)));
      if (e) {
        e.quizzes += 1;
        e.scoreSum += quizPercents[idx];
        e.scoreCount += 1;
      }
    });
    assignmentSubRows.forEach((a, idx) => {
      const e = trendMap.get(monthKey(new Date(a.submittedAt)));
      if (e) {
        e.assignments += 1;
        e.scoreSum += assignPercents[idx];
        e.scoreCount += 1;
      }
    });
    const trendData = Array.from(trendMap.values()).map((e) => ({
      month: e.month,
      quizzes: e.quizzes,
      assignments: e.assignments,
      avgScore: e.scoreCount > 0 ? Math.round(e.scoreSum / e.scoreCount) : 0,
    }));

    // ── Recent activity (latest 8) ─────────────────────────────────────────
    const recentQuizActivity = quizSubRows.slice(0, 5).map((q, idx) => ({
      _id: q.id,
      title: q.quiz.title,
      subject: q.quiz.subject,
      score: Math.round(quizPercents[idx]),
      isGraded: q.gradingStatus === "graded",
      submittedAt: q.submittedAt,
      contentType: "quiz",
    }));
    const recentAssignmentActivity = assignmentSubRows.slice(0, 5).map((a, idx) => ({
      _id: a.id,
      title: a.assignment.title,
      subject: a.assignment.subject,
      score: Math.round(assignPercents[idx]),
      isGraded: a.status === "graded",
      isLate: a.isLate,
      submittedAt: a.submittedAt,
      contentType: "assignment",
    }));
    const recentCourseActivity = [...enrollmentRows]
      .sort(
        (a, b) =>
          new Date(b.lastAccessedAt ?? 0).getTime() -
          new Date(a.lastAccessedAt ?? 0).getTime(),
      )
      .slice(0, 4)
      .map((c) => ({
        _id: c.id,
        title: c.course.title,
        subject: c.course.subject,
        thumbnailUrl: c.course.thumbnailUrl,
        previewVideoId: c.course.previewVideoId,
        progress: c.progressPercent,
        isCompleted: c.isCompleted,
        completedLessons: c.completedLessons,
        totalLessons: c.totalLessons,
        lastAccessedAt: c.lastAccessedAt,
        submittedAt: c.lastAccessedAt ?? new Date(0),
        contentType: "course",
      }));

    const allRecent = [
      ...recentQuizActivity,
      ...recentAssignmentActivity,
      ...recentCourseActivity,
    ]
      .sort(
        (a, b) =>
          new Date((b as any).submittedAt ?? 0).getTime() -
          new Date((a as any).submittedAt ?? 0).getTime(),
      )
      .slice(0, 8);

    // ── Top courses by progress ────────────────────────────────────────────
    const topCourses = [...enrollmentRows]
      .sort(
        (a, b) =>
          b.progressPercent - a.progressPercent ||
          new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime(),
      )
      .slice(0, 4)
      .map((e) => ({
        enrollmentId: e.id,
        courseId: e.courseId,
        title: e.course.title,
        subject: e.course.subject,
        thumbnailUrl: e.course.thumbnailUrl,
        previewVideoId: e.course.previewVideoId,
        totalLessons: e.course.totalLessons,
        totalDurationSeconds: e.course.totalDurationSeconds,
        certificateEnabled: e.course.certificateEnabled,
        progressPercent: e.progressPercent,
        completedLessons: e.completedLessons,
        totalEnrolledLessons: e.totalLessons,
        isCompleted: e.isCompleted,
        certificateId: e.certificateId,
        enrolledAt: e.enrolledAt,
        lastAccessedAt: e.lastAccessedAt,
      }));

    const response = {
      enrollments: {
        total: enrollStats.total,
        completed: enrollStats.completed,
        inProgress: enrollStats.inProgress,
        notStarted: enrollStats.notStarted,
        avgProgress: Math.round(enrollStats.avgProgress),
        totalLessonsCompleted: enrollStats.totalLessonsCompleted,
        certificatesEarned: enrollStats.certificatesEarned,
      },
      quizzes: {
        total: quizStats.total,
        graded: quizStats.graded,
        pending: quizStats.total - quizStats.graded,
        avgScore: Math.round(quizStats.avgScore),
        highestScore: Math.round(quizStats.highestScore),
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
        avgScore: Math.round(assignStats.avgScore),
        highestScore: Math.round(assignStats.highestScore),
        onTime: assignStats.onTime,
        late: assignStats.late,
        onTimeRate:
          assignStats.total > 0
            ? Math.round((assignStats.onTime / assignStats.total) * 100)
            : 0,
      },
      performance: {
        overallPercentage: Math.round(perf?.overallPercentage ?? 0),
        totalActivities: perf?.totalActivities ?? 0,
        subjectBreakdown: perf?.subjectStats ?? [],
        grade: null,
        lastUpdated: perf?.updatedAt ?? null,
      },
      resources: {
        announcements: announcementCountRows[0]?.count ?? 0,
        lectureNotes: noteCountRows[0]?.count ?? 0,
      },
      trendData,
      topCourses,
      recentQuizSubmissions: quizSubRows.slice(0, 5).map((s, idx) => ({
        _id: s.id,
        quizTitle: s.quiz.title,
        subject: s.quiz.subject,
        totalMarks: s.quiz.totalMarks ?? 0,
        totalScore: s.totalScore ?? 0,
        percentage: Math.round(quizPercents[idx]),
        isGraded: s.gradingStatus === "graded",
        submittedAt: s.submittedAt,
        timeSpentSeconds: s.timeTakenSeconds ?? 0,
      })),
      recentAssignmentSubmissions: assignmentSubRows.slice(0, 5).map((s, idx) => ({
        _id: s.id,
        assignmentTitle: s.assignment.title,
        subject: s.assignment.subject,
        totalMarks: s.assignment.totalMarks ?? 0,
        totalScore: s.score ?? 0,
        percentage: Math.round(assignPercents[idx]),
        isGraded: s.status === "graded",
        isLate: s.isLate,
        grade: null,
        submittedAt: s.submittedAt,
      })),
      recentActivity: allRecent,
    };

    return NextResponse.json({ success: true, data: response }, { status: 200 });
  } catch (error: any) {
    console.error("[STUDENT DASHBOARD STATS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to load dashboard stats." },
      { status: 500 },
    );
  }
}
