import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAssignment extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  instructions: string; // Rich description / what students must do
  subject: string;
  topic: string;
  classLevel: "SHS 1" | "SHS 2" | "SHS 3" | "All";
  dueDate: Date;
  totalMarks: number; // Max marks for grading
  allowLateSubmission: boolean;

  // Optional attached PDF (question sheet / rubric)
  fileUrl: string | null; // Public URL  e.g. /uploads/assignments/...
  filePath: string | null; // Absolute server path for deletion
  fileName: string | null; // Original filename shown to students
  fileSize: number | null; // bytes

  instructor: mongoose.Types.ObjectId; // ref: User
  views: number;
  submissionsCount: number; // denormalised counter — incremented on each submission
  status: "draft" | "published" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title must be under 200 characters"],
    },
    instructions: {
      type: String,
      trim: true,
      default: "",
      maxlength: [5000, "Instructions must be under 5000 characters"],
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    topic: {
      type: String,
      trim: true,
      default: "",
    },
    classLevel: {
      type: String,
      enum: ["SHS 1", "SHS 2", "SHS 3", "All"],
      default: "All",
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    totalMarks: {
      type: Number,
      default: 100,
      min: [1, "Total marks must be at least 1"],
    },
    allowLateSubmission: {
      type: Boolean,
      default: false,
    },

    // ── Optional attached file ─────────────────────────────────────────────
    fileUrl: { type: String, default: null },
    filePath: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },

    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Instructor reference is required"],
    },
    views: { type: Number, default: 0 },
    submissionsCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "published",
    },
  },
  { timestamps: true },
);

// Full-text search
AssignmentSchema.index({
  title: "text",
  subject: "text",
  topic: "text",
  instructions: "text",
});

// Common query patterns
AssignmentSchema.index({ instructor: 1, createdAt: -1 });
AssignmentSchema.index({ subject: 1, classLevel: 1 });
AssignmentSchema.index({ dueDate: 1, status: 1 });

const Assignment: Model<IAssignment> =
  mongoose.models.Assignment ??
  mongoose.model<IAssignment>("Assignment", AssignmentSchema);

export default Assignment;
