import mongoose from "mongoose";
import Performance from "@/models/Performance";

interface SyncActivityInput {
  type: "quiz" | "assignment";
  refId: mongoose.Types.ObjectId | string;
  submissionId: mongoose.Types.ObjectId | string;
  studentId: mongoose.Types.ObjectId | string;
  instructorId: mongoose.Types.ObjectId | string;
  title: string;
  subject: string;
  score: number;
  maxScore: number;
  submittedAt: Date;
  gradedAt: Date | null;
}

/**
 * Upserts the Performance document for a (student, instructor) pair.
 * Call this after:
 *   - A quiz is auto-graded (MCQ-only) on submission
 *   - An instructor grades a theory quiz submission
 *   - An instructor grades an assignment submission
 *
 * It is designed to be fire-and-forget safe — wrap in try/catch at call site.
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

  const studentObjId =
    typeof studentId === "string"
      ? new mongoose.Types.ObjectId(studentId)
      : studentId;
  const instructorObjId =
    typeof instructorId === "string"
      ? new mongoose.Types.ObjectId(instructorId)
      : instructorId;

  // ── Fetch or create the performance record ─────────────────────────────
  let perf = await Performance.findOne({
    student: studentObjId,
    instructor: instructorObjId,
  });

  if (!perf) {
    perf = new Performance({
      student: studentObjId,
      instructor: instructorObjId,
    });
  }

  // ── Check if this submission was already recorded (prevent duplicates) ──
  const existingIdx = perf.recentActivity.findIndex(
    (a) => String(a.submissionId) === String(submissionId),
  );

  const activityRecord = {
    type,
    refId: new mongoose.Types.ObjectId(String(refId)),
    submissionId: new mongoose.Types.ObjectId(String(submissionId)),
    title,
    subject,
    score,
    maxScore,
    percentage,
    submittedAt,
    gradedAt,
  };

  if (existingIdx >= 0) {
    // Update existing record (e.g., theory answers graded later)
    perf.recentActivity[existingIdx] = activityRecord;
  } else {
    // New activity — push and cap to 100 most recent
    perf.recentActivity.push(activityRecord);
    if (perf.recentActivity.length > 100) {
      perf.recentActivity = perf.recentActivity.slice(-100);
    }
  }

  // ── Recompute all aggregates from the full activity log ─────────────────
  const allActivities = perf.recentActivity;

  perf.totalActivities = allActivities.length;
  perf.totalScore = allActivities.reduce((s, a) => s + a.score, 0);
  perf.totalMaxScore = allActivities.reduce((s, a) => s + a.maxScore, 0);
  perf.overallPercentage =
    perf.totalMaxScore > 0
      ? Math.round((perf.totalScore / perf.totalMaxScore) * 10000) / 100
      : 0;

  // Quiz aggregates
  const quizActivities = allActivities.filter((a) => a.type === "quiz");
  perf.quizCount = quizActivities.length;
  perf.quizTotalScore = quizActivities.reduce((s, a) => s + a.score, 0);
  perf.quizTotalMaxScore = quizActivities.reduce((s, a) => s + a.maxScore, 0);
  perf.quizAveragePercentage =
    perf.quizTotalMaxScore > 0
      ? Math.round((perf.quizTotalScore / perf.quizTotalMaxScore) * 10000) / 100
      : 0;

  // Assignment aggregates
  const assignmentActivities = allActivities.filter(
    (a) => a.type === "assignment",
  );
  perf.assignmentCount = assignmentActivities.length;
  perf.assignmentTotalScore = assignmentActivities.reduce(
    (s, a) => s + a.score,
    0,
  );
  perf.assignmentTotalMaxScore = assignmentActivities.reduce(
    (s, a) => s + a.maxScore,
    0,
  );
  perf.assignmentAveragePercentage =
    perf.assignmentTotalMaxScore > 0
      ? Math.round(
          (perf.assignmentTotalScore / perf.assignmentTotalMaxScore) * 10000,
        ) / 100
      : 0;

  // ── Subject breakdown ──────────────────────────────────────────────────
  const subjectMap = new Map<
    string,
    {
      quizScore: number;
      quizMax: number;
      assignScore: number;
      assignMax: number;
    }
  >();

  for (const a of allActivities) {
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

  perf.subjectStats = Array.from(subjectMap.entries()).map(([subj, data]) => {
    const totalScore = data.quizScore + data.assignScore;
    const totalMax = data.quizMax + data.assignMax;
    const quizActivitiesForSubj = quizActivities.filter(
      (a) => a.subject === subj,
    ).length;
    const assignActivitiesForSubj = assignmentActivities.filter(
      (a) => a.subject === subj,
    ).length;
    return {
      subject: subj,
      totalActivities: quizActivitiesForSubj + assignActivitiesForSubj,
      totalScore,
      totalMaxScore: totalMax,
      averagePercentage:
        totalMax > 0 ? Math.round((totalScore / totalMax) * 10000) / 100 : 0,
      quizCount: quizActivitiesForSubj,
      assignmentCount: assignActivitiesForSubj,
    };
  });

  perf.lastActivityAt = new Date(
    Math.max(...allActivities.map((a) => new Date(a.submittedAt).getTime())),
  );

  await perf.save();
}
