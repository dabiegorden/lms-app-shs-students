import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { performances } from "@/src/schema";
import type { ActivityRecord, SubjectStats } from "@/src/schema";

interface SyncActivityInput {
  type: "quiz" | "assignment";
  refId: string;
  submissionId: string;
  studentId: string;
  instructorId: string;
  title: string;
  subject: string;
  score: number;
  maxScore: number;
  submittedAt: Date;
  gradedAt: Date | null;
}

/**
 * Upserts the Performance record for a (student, instructor) pair.
 * Call this after:
 *   - A quiz is auto-graded (MCQ-only) on submission
 *   - An instructor grades a theory quiz submission
 *   - An instructor grades an assignment submission
 *
 * Fire-and-forget safe — wrap in try/catch at the call site.
 */
export async function syncPerformance(input: SyncActivityInput): Promise<void> {
  const {
    type,
    refId,
    submissionId,
    studentId,
    instructorId,
    title,
    subject,
    score,
    maxScore,
    submittedAt,
    gradedAt,
  } = input;

  const percentage =
    maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;

  // ── Fetch the existing performance record (if any) ─────────────────────
  const [existing] = await db
    .select()
    .from(performances)
    .where(
      and(
        eq(performances.studentId, studentId),
        eq(performances.instructorId, instructorId),
      ),
    )
    .limit(1);

  const recentActivity: ActivityRecord[] = existing
    ? [...existing.recentActivity]
    : [];

  // ── Insert or replace the activity record (idempotent per submission) ──
  const activityRecord: ActivityRecord = {
    type,
    refId: String(refId),
    submissionId: String(submissionId),
    title,
    subject,
    score,
    maxScore,
    percentage,
    submittedAt: new Date(submittedAt).toISOString(),
    gradedAt: gradedAt ? new Date(gradedAt).toISOString() : null,
  };

  const existingIdx = recentActivity.findIndex(
    (a) => String(a.submissionId) === String(submissionId),
  );

  let activities = recentActivity;
  if (existingIdx >= 0) {
    activities[existingIdx] = activityRecord;
  } else {
    activities.push(activityRecord);
    if (activities.length > 100) activities = activities.slice(-100);
  }

  // ── Recompute all aggregates from the full activity log ─────────────────
  const totalActivities = activities.length;
  const totalScore = activities.reduce((s, a) => s + a.score, 0);
  const totalMaxScore = activities.reduce((s, a) => s + a.maxScore, 0);
  const overallPercentage =
    totalMaxScore > 0
      ? Math.round((totalScore / totalMaxScore) * 10000) / 100
      : 0;

  const quizActivities = activities.filter((a) => a.type === "quiz");
  const quizCount = quizActivities.length;
  const quizTotalScore = quizActivities.reduce((s, a) => s + a.score, 0);
  const quizTotalMaxScore = quizActivities.reduce((s, a) => s + a.maxScore, 0);
  const quizAveragePercentage =
    quizTotalMaxScore > 0
      ? Math.round((quizTotalScore / quizTotalMaxScore) * 10000) / 100
      : 0;

  const assignmentActivities = activities.filter(
    (a) => a.type === "assignment",
  );
  const assignmentCount = assignmentActivities.length;
  const assignmentTotalScore = assignmentActivities.reduce(
    (s, a) => s + a.score,
    0,
  );
  const assignmentTotalMaxScore = assignmentActivities.reduce(
    (s, a) => s + a.maxScore,
    0,
  );
  const assignmentAveragePercentage =
    assignmentTotalMaxScore > 0
      ? Math.round((assignmentTotalScore / assignmentTotalMaxScore) * 10000) /
        100
      : 0;

  // ── Subject breakdown ──────────────────────────────────────────────────
  const subjectMap = new Map<
    string,
    { quizScore: number; quizMax: number; assignScore: number; assignMax: number }
  >();

  for (const a of activities) {
    if (!subjectMap.has(a.subject)) {
      subjectMap.set(a.subject, {
        quizScore: 0,
        quizMax: 0,
        assignScore: 0,
        assignMax: 0,
      });
    }
    const entry = subjectMap.get(a.subject)!;
    if (a.type === "quiz") {
      entry.quizScore += a.score;
      entry.quizMax += a.maxScore;
    } else {
      entry.assignScore += a.score;
      entry.assignMax += a.maxScore;
    }
  }

  const subjectStats: SubjectStats[] = Array.from(subjectMap.entries()).map(
    ([subj, data]) => {
      const subjTotalScore = data.quizScore + data.assignScore;
      const subjTotalMax = data.quizMax + data.assignMax;
      const quizForSubj = quizActivities.filter(
        (a) => a.subject === subj,
      ).length;
      const assignForSubj = assignmentActivities.filter(
        (a) => a.subject === subj,
      ).length;
      return {
        subject: subj,
        totalActivities: quizForSubj + assignForSubj,
        totalScore: subjTotalScore,
        totalMaxScore: subjTotalMax,
        averagePercentage:
          subjTotalMax > 0
            ? Math.round((subjTotalScore / subjTotalMax) * 10000) / 100
            : 0,
        quizCount: quizForSubj,
        assignmentCount: assignForSubj,
      };
    },
  );

  const lastActivityAt = new Date(
    Math.max(...activities.map((a) => new Date(a.submittedAt).getTime())),
  );

  const values = {
    studentId,
    instructorId,
    totalActivities,
    totalScore,
    totalMaxScore,
    overallPercentage,
    quizCount,
    quizTotalScore,
    quizTotalMaxScore,
    quizAveragePercentage,
    assignmentCount,
    assignmentTotalScore,
    assignmentTotalMaxScore,
    assignmentAveragePercentage,
    subjectStats,
    recentActivity: activities,
    lastActivityAt,
  };

  await db
    .insert(performances)
    .values(values)
    .onConflictDoUpdate({
      target: [performances.studentId, performances.instructorId],
      set: values,
    });
}
