import mongoose, { Schema, type Document, type Model } from "mongoose";

// ─── Per-lesson progress entry ────────────────────────────────────────────────

export interface ILessonProgress {
  lessonId: mongoose.Types.ObjectId;
  sectionId: mongoose.Types.ObjectId;
  completedAt: Date | null;
  watchedSeconds: number; // How many seconds watched (for resume position)
  isCompleted: boolean;
}

// ─── Enrollment document ──────────────────────────────────────────────────────

export interface ICourseEnrollment extends Document {
  _id: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;

  // ── Progress ────────────────────────────────────────────────────────────────
  lessonProgress: ILessonProgress[];
  completedLessons: number; // Denormalised count
  totalLessons: number; // Snapshot at enrolment time
  progressPercent: number; // 0–100
  lastAccessedAt: Date | null;
  lastLessonId: mongoose.Types.ObjectId | null; // resume point

  // ── Completion & Certificate ─────────────────────────────────────────────────
  isCompleted: boolean;
  completedAt: Date | null;
  certificateIssuedAt: Date | null;
  certificateId: string | null; // Unique cert ID for verification

  // ── Rating (student can rate after completing) ───────────────────────────────
  rating: number | null; // 1–5
  review: string;
  reviewedAt: Date | null;

  enrolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const LessonProgressSchema = new Schema<ILessonProgress>(
  {
    lessonId: { type: Schema.Types.ObjectId, required: true },
    sectionId: { type: Schema.Types.ObjectId, required: true },
    completedAt: { type: Date, default: null },
    watchedSeconds: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
  },
  { _id: false },
);

const CourseEnrollmentSchema = new Schema<ICourseEnrollment>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },

    lessonProgress: { type: [LessonProgressSchema], default: [] },
    completedLessons: { type: Number, default: 0 },
    totalLessons: { type: Number, default: 0 },
    progressPercent: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: null },
    lastLessonId: { type: Schema.Types.ObjectId, default: null },

    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    certificateIssuedAt: { type: Date, default: null },
    certificateId: { type: String, default: null },

    rating: { type: Number, min: 1, max: 5, default: null },
    review: { type: String, trim: true, default: "" },
    reviewedAt: { type: Date, default: null },

    enrolledAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One enrolment per student per course
CourseEnrollmentSchema.index({ course: 1, student: 1 }, { unique: true });
CourseEnrollmentSchema.index({ student: 1, enrolledAt: -1 });
CourseEnrollmentSchema.index({ course: 1, isCompleted: 1 });

const CourseEnrollment: Model<ICourseEnrollment> =
  mongoose.models.CourseEnrollment ??
  mongoose.model<ICourseEnrollment>("CourseEnrollment", CourseEnrollmentSchema);

export default CourseEnrollment;
