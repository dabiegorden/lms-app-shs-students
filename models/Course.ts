import mongoose, { Schema, type Document, type Model } from "mongoose";

// ─── Lesson (leaf node inside a section) ─────────────────────────────────────

export interface ILesson {
  _id?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  youtubeUrl: string; // Full YouTube URL e.g. https://www.youtube.com/watch?v=...
  youtubeVideoId: string; // Extracted video ID for embed  e.g. "dQw4w9WgXcQ"
  durationSeconds: number; // Populated manually or via YouTube oEmbed
  order: number;
  isFree: boolean; // Preview lesson — visible without enrolment
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Section (chapter inside a course) ───────────────────────────────────────

export interface ISection {
  _id?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  order: number;
  lessons: ILesson[];
  isPublished: boolean;
}

// ─── Course document ──────────────────────────────────────────────────────────

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;

  // ── Identity ────────────────────────────────────────────────────────────────
  title: string;
  slug: string; // URL-friendly unique identifier
  description: string; // Short tagline (< 300 chars)
  overview: string; // Long rich description shown on course page
  subject: string;
  topic: string;
  classLevel: "SHS 1" | "SHS 2" | "SHS 3" | "All";
  language: string;

  // ── Media ───────────────────────────────────────────────────────────────────
  thumbnailUrl: string | null; // Uploaded cover image URL
  thumbnailPath: string | null; // Server path for deletion
  previewVideoUrl: string | null; // YouTube trailer URL
  previewVideoId: string | null;

  // ── Curriculum ──────────────────────────────────────────────────────────────
  sections: ISection[];
  totalLessons: number; // Denormalised — recomputed on save
  totalDurationSeconds: number; // Denormalised — recomputed on save

  // ── Learning outcomes ───────────────────────────────────────────────────────
  whatYouWillLearn: string[]; // Bullet points shown in course landing
  requirements: string[]; // Prerequisites
  targetAudience: string[];

  // ── Settings ────────────────────────────────────────────────────────────────
  instructor: mongoose.Types.ObjectId;
  status: "draft" | "published" | "archived";
  level: "Beginner" | "Intermediate" | "Advanced" | "All Levels";
  certificateEnabled: boolean; // Whether students get a completion cert

  // ── Stats (denormalised) ────────────────────────────────────────────────────
  enrollmentsCount: number;
  ratingsAverage: number;
  ratingsCount: number;
  views: number;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const LessonSchema = new Schema<ILesson>(
  {
    title: {
      type: String,
      required: [true, "Lesson title is required"],
      trim: true,
      maxlength: [200, "Lesson title must be under 200 characters"],
    },
    description: { type: String, trim: true, default: "" },
    youtubeUrl: { type: String, trim: true, default: "" },
    youtubeVideoId: { type: String, trim: true, default: "" },
    durationSeconds: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    isFree: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const SectionSchema = new Schema<ISection>(
  {
    title: {
      type: String,
      required: [true, "Section title is required"],
      trim: true,
      maxlength: [200, "Section title must be under 200 characters"],
    },
    description: { type: String, trim: true, default: "" },
    order: { type: Number, default: 0 },
    lessons: { type: [LessonSchema], default: [] },
    isPublished: { type: Boolean, default: true },
  },
  { _id: true },
);

// ─── Course Schema ────────────────────────────────────────────────────────────

const CourseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [200, "Title must be under 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Description must be under 500 characters"],
    },
    overview: {
      type: String,
      trim: true,
      default: "",
      maxlength: [10000, "Overview must be under 10000 characters"],
    },
    subject: { type: String, required: true, trim: true },
    topic: { type: String, trim: true, default: "" },
    classLevel: {
      type: String,
      enum: ["SHS 1", "SHS 2", "SHS 3", "All"],
      default: "All",
    },
    language: { type: String, default: "English" },

    thumbnailUrl: { type: String, default: null },
    thumbnailPath: { type: String, default: null },
    previewVideoUrl: { type: String, default: null },
    previewVideoId: { type: String, default: null },

    sections: { type: [SectionSchema], default: [] },
    totalLessons: { type: Number, default: 0 },
    totalDurationSeconds: { type: Number, default: 0 },

    whatYouWillLearn: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    targetAudience: { type: [String], default: [] },

    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "All Levels"],
      default: "All Levels",
    },
    certificateEnabled: { type: Boolean, default: true },

    enrollmentsCount: { type: Number, default: 0 },
    ratingsAverage: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ── Auto-compute slug from title ───────────────────────────────────────────────
CourseSchema.pre("validate", async function () {
  if (!this.slug && this.title) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 100) +
      "-" +
      Date.now();
  }
  return;
});

// ── Auto-recompute totals on save ─────────────────────────────────────────────
CourseSchema.pre("save", async function () {
  if (this.isModified("sections")) {
    let totalLessons = 0;
    let totalDurationSeconds = 0;
    for (const section of this.sections) {
      totalLessons += section.lessons.length;
      for (const lesson of section.lessons) {
        totalDurationSeconds += lesson.durationSeconds ?? 0;
      }
    }
    this.totalLessons = totalLessons;
    this.totalDurationSeconds = totalDurationSeconds;
  }
  return;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
CourseSchema.index({
  title: "text",
  subject: "text",
  topic: "text",
  description: "text",
});
CourseSchema.index({ instructor: 1, createdAt: -1 });
CourseSchema.index({ subject: 1, classLevel: 1, status: 1 });

const Course: Model<ICourse> =
  mongoose.models.Course ?? mongoose.model<ICourse>("Course", CourseSchema);

export default Course;
