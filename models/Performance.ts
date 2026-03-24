import mongoose, { Schema, type Document, type Model } from "mongoose";

// ─── Sub-document: individual activity snapshot ───────────────────────────────
export interface IActivityRecord {
  type: "quiz" | "assignment";
  refId: mongoose.Types.ObjectId; // Quiz._id or Assignment._id
  submissionId: mongoose.Types.ObjectId; // QuizSubmission._id or AssignmentSubmission._id
  title: string;
  subject: string;
  score: number; // marks earned
  maxScore: number; // marks possible
  percentage: number; // 0-100
  submittedAt: Date;
  gradedAt: Date | null;
}

// ─── Sub-document: per-subject breakdown ──────────────────────────────────────
export interface ISubjectStats {
  subject: string;
  totalActivities: number;
  totalScore: number;
  totalMaxScore: number;
  averagePercentage: number;
  quizCount: number;
  assignmentCount: number;
}

// ─── Main performance document ────────────────────────────────────────────────
export interface IPerformance extends Document {
  _id: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId; // ref: User
  instructor: mongoose.Types.ObjectId; // ref: User (scoped to instructor's content)

  // Rolling aggregate stats (recomputed on each upsert)
  totalActivities: number;
  totalScore: number;
  totalMaxScore: number;
  overallPercentage: number; // 0-100

  quizCount: number;
  quizTotalScore: number;
  quizTotalMaxScore: number;
  quizAveragePercentage: number;

  assignmentCount: number;
  assignmentTotalScore: number;
  assignmentTotalMaxScore: number;
  assignmentAveragePercentage: number;

  // Per-subject breakdown
  subjectStats: ISubjectStats[];

  // Chronological activity log (last 100 entries for chart data)
  recentActivity: IActivityRecord[];

  // AI-generated insight (refreshed when stats change)
  aiInsight: string;
  aiInsightGeneratedAt: Date | null;

  lastActivityAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ActivityRecordSchema = new Schema<IActivityRecord>(
  {
    type: { type: String, enum: ["quiz", "assignment"], required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    submissionId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    score: { type: Number, required: true, default: 0 },
    maxScore: { type: Number, required: true, default: 1 },
    percentage: { type: Number, required: true, default: 0 },
    submittedAt: { type: Date, required: true },
    gradedAt: { type: Date, default: null },
  },
  { _id: false },
);

const SubjectStatsSchema = new Schema<ISubjectStats>(
  {
    subject: { type: String, required: true, trim: true },
    totalActivities: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    totalMaxScore: { type: Number, default: 0 },
    averagePercentage: { type: Number, default: 0 },
    quizCount: { type: Number, default: 0 },
    assignmentCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const PerformanceSchema = new Schema<IPerformance>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Aggregates ─────────────────────────────────────────────────────────
    totalActivities: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    totalMaxScore: { type: Number, default: 0 },
    overallPercentage: { type: Number, default: 0 },

    quizCount: { type: Number, default: 0 },
    quizTotalScore: { type: Number, default: 0 },
    quizTotalMaxScore: { type: Number, default: 0 },
    quizAveragePercentage: { type: Number, default: 0 },

    assignmentCount: { type: Number, default: 0 },
    assignmentTotalScore: { type: Number, default: 0 },
    assignmentTotalMaxScore: { type: Number, default: 0 },
    assignmentAveragePercentage: { type: Number, default: 0 },

    // ── Subject breakdown ──────────────────────────────────────────────────
    subjectStats: { type: [SubjectStatsSchema], default: [] },

    // ── Activity log ───────────────────────────────────────────────────────
    recentActivity: { type: [ActivityRecordSchema], default: [] },

    // ── AI insight ─────────────────────────────────────────────────────────
    aiInsight: { type: String, default: "" },
    aiInsightGeneratedAt: { type: Date, default: null },

    lastActivityAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ── Compound unique index: one record per (student, instructor) pair ───────────
PerformanceSchema.index({ student: 1, instructor: 1 }, { unique: true });
PerformanceSchema.index({ instructor: 1, overallPercentage: -1 });
PerformanceSchema.index({ instructor: 1, lastActivityAt: -1 });

const Performance: Model<IPerformance> =
  mongoose.models.Performance ??
  mongoose.model<IPerformance>("Performance", PerformanceSchema);

export default Performance;
