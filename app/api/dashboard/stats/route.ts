import { type NextRequest, NextResponse } from "next/server";
import { desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  assignments,
  quizzes,
  lectureNotes,
  announcements,
  courses,
  courseEnrollments,
  performances,
} from "@/src/schema";
import { verifyToken } from "@/lib/jwt";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    const instructorId = auth.userId;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      assignmentStatsRows,
      quizStatsRows,
      noteStatsRows,
      announcementStatsRows,
      courseStatsRows,
      courseIdRows,
      studentCountRows,
      performanceStatsRows,
      recentAssignments,
      recentQuizzes,
      recentNotes,
      assignmentMonthly,
      quizMonthly,
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          published: sql<number>`count(*) filter (where ${assignments.status} = 'published')::int`,
          draft: sql<number>`count(*) filter (where ${assignments.status} = 'draft')::int`,
          closed: sql<number>`count(*) filter (where ${assignments.status} = 'closed')::int`,
          totalSubmissions: sql<number>`coalesce(sum(${assignments.submissionsCount}), 0)::int`,
          totalViews: sql<number>`coalesce(sum(${assignments.views}), 0)::int`,
        })
        .from(assignments)
        .where(eq(assignments.instructorId, instructorId)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          published: sql<number>`count(*) filter (where ${quizzes.status} = 'published')::int`,
          draft: sql<number>`count(*) filter (where ${quizzes.status} = 'draft')::int`,
          totalSubmissions: sql<number>`coalesce(sum(${quizzes.submissionsCount}), 0)::int`,
          totalViews: sql<number>`coalesce(sum(${quizzes.views}), 0)::int`,
          totalQuestions: sql<number>`coalesce(sum(jsonb_array_length(${quizzes.questions})), 0)::int`,
        })
        .from(quizzes)
        .where(eq(quizzes.instructorId, instructorId)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          totalViews: sql<number>`coalesce(sum(${lectureNotes.views}), 0)::int`,
          totalDownloads: sql<number>`coalesce(sum(${lectureNotes.downloads}), 0)::int`,
        })
        .from(lectureNotes)
        .where(eq(lectureNotes.instructorId, instructorId)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          published: sql<number>`count(*) filter (where ${announcements.status} = 'published')::int`,
          pinned: sql<number>`count(*) filter (where ${announcements.isPinned})::int`,
          totalViews: sql<number>`coalesce(sum(${announcements.viewsCount}), 0)::int`,
          totalComments: sql<number>`coalesce(sum(${announcements.commentsCount}), 0)::int`,
        })
        .from(announcements)
        .where(eq(announcements.instructorId, instructorId)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          published: sql<number>`count(*) filter (where ${courses.status} = 'published')::int`,
          draft: sql<number>`count(*) filter (where ${courses.status} = 'draft')::int`,
          totalEnrollments: sql<number>`coalesce(sum(${courses.enrollmentsCount}), 0)::int`,
          totalLessons: sql<number>`coalesce(sum(${courses.totalLessons}), 0)::int`,
          totalViews: sql<number>`coalesce(sum(${courses.views}), 0)::int`,
          avgRating: sql<number>`coalesce(avg(${courses.ratingsAverage}), 0)`,
        })
        .from(courses)
        .where(eq(courses.instructorId, instructorId)),
      db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.instructorId, instructorId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(performances)
        .where(eq(performances.instructorId, instructorId)),
      db
        .select({
          avgOverallPercentage: sql<number>`coalesce(avg(${performances.overallPercentage}), 0)`,
          topPerformers: sql<number>`count(*) filter (where ${performances.overallPercentage} >= 80)::int`,
          struggling: sql<number>`count(*) filter (where ${performances.overallPercentage} < 50)::int`,
          totalActivities: sql<number>`coalesce(sum(${performances.totalActivities}), 0)::int`,
        })
        .from(performances)
        .where(eq(performances.instructorId, instructorId)),
      db
        .select({
          id: assignments.id,
          title: assignments.title,
          subject: assignments.subject,
          status: assignments.status,
          createdAt: assignments.createdAt,
          submissionsCount: assignments.submissionsCount,
        })
        .from(assignments)
        .where(eq(assignments.instructorId, instructorId))
        .orderBy(desc(assignments.createdAt))
        .limit(5),
      db
        .select({
          id: quizzes.id,
          title: quizzes.title,
          subject: quizzes.subject,
          status: quizzes.status,
          createdAt: quizzes.createdAt,
          submissionsCount: quizzes.submissionsCount,
        })
        .from(quizzes)
        .where(eq(quizzes.instructorId, instructorId))
        .orderBy(desc(quizzes.createdAt))
        .limit(5),
      db
        .select({
          id: lectureNotes.id,
          title: lectureNotes.title,
          subject: lectureNotes.subject,
          createdAt: lectureNotes.createdAt,
          views: lectureNotes.views,
          downloads: lectureNotes.downloads,
        })
        .from(lectureNotes)
        .where(eq(lectureNotes.instructorId, instructorId))
        .orderBy(desc(lectureNotes.createdAt))
        .limit(5),
      db
        .select({
          year: sql<number>`extract(year from ${assignments.createdAt})::int`,
          month: sql<number>`extract(month from ${assignments.createdAt})::int`,
          assignments: sql<number>`count(*)::int`,
          submissions: sql<number>`coalesce(sum(${assignments.submissionsCount}), 0)::int`,
        })
        .from(assignments)
        .where(
          sql`${assignments.instructorId} = ${instructorId} and ${assignments.createdAt} >= ${sixMonthsAgo}`,
        )
        .groupBy(
          sql`extract(year from ${assignments.createdAt})`,
          sql`extract(month from ${assignments.createdAt})`,
        ),
      db
        .select({
          year: sql<number>`extract(year from ${quizzes.createdAt})::int`,
          month: sql<number>`extract(month from ${quizzes.createdAt})::int`,
          quizzes: sql<number>`count(*)::int`,
          submissions: sql<number>`coalesce(sum(${quizzes.submissionsCount}), 0)::int`,
        })
        .from(quizzes)
        .where(
          sql`${quizzes.instructorId} = ${instructorId} and ${quizzes.createdAt} >= ${sixMonthsAgo}`,
        )
        .groupBy(
          sql`extract(year from ${quizzes.createdAt})`,
          sql`extract(month from ${quizzes.createdAt})`,
        ),
    ]);

    // ── Enrollment stats over this instructor's courses ────────────────────
    const courseIds = courseIdRows.map((c) => c.id);
    let enrollments = { total: 0, completed: 0 };
    if (courseIds.length > 0) {
      const [enrollRow] = await db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${courseEnrollments.isCompleted})::int`,
        })
        .from(courseEnrollments)
        .where(inArray(courseEnrollments.courseId, courseIds));
      enrollments = enrollRow ?? enrollments;
    }

    // ── Merge monthly trend data ────────────────────────────────────────────
    const now = new Date();
    const trendMap = new Map<
      string,
      { month: string; assignments: number; quizzes: number; submissions: number }
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
    for (const a of assignmentMonthly) {
      const key = `${a.year}-${a.month}`;
      const entry = trendMap.get(key);
      if (entry) {
        entry.assignments += a.assignments ?? 0;
        entry.submissions += a.submissions ?? 0;
      }
    }
    for (const q of quizMonthly) {
      const key = `${q.year}-${q.month}`;
      const entry = trendMap.get(key);
      if (entry) {
        entry.quizzes += q.quizzes ?? 0;
        entry.submissions += q.submissions ?? 0;
      }
    }
    const trendData = Array.from(trendMap.values());

    // ── Flatten recent activity ────────────────────────────────────────────
    const allRecent = [
      ...recentAssignments.map((d) => ({ ...d, _id: d.id, contentType: "assignment" })),
      ...recentQuizzes.map((d) => ({ ...d, _id: d.id, contentType: "quiz" })),
      ...recentNotes.map((d) => ({ ...d, _id: d.id, contentType: "note" })),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 8);

    const response = {
      assignments: assignmentStatsRows[0],
      quizzes: quizStatsRows[0],
      notes: noteStatsRows[0],
      announcements: announcementStatsRows[0],
      courses: courseStatsRows[0],
      enrollments,
      students: {
        total: studentCountRows[0]?.count ?? 0,
        ...performanceStatsRows[0],
      },
      trendData,
      recentActivity: allRecent,
    };

    return NextResponse.json({ success: true, data: response }, { status: 200 });
  } catch (error: any) {
    console.error("[DASHBOARD STATS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to load dashboard stats." },
      { status: 500 },
    );
  }
}
