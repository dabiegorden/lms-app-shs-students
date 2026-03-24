import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ILectureNote extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  subject: string;
  topic: string;
  classLevel: "SHS 1" | "SHS 2" | "SHS 3" | "All";
  fileUrl: string; // Public URL e.g. /uploads/notes/1234567890-filename.pdf
  filePath: string; // Absolute server path for deletion e.g. public/uploads/notes/...
  fileName: string; // Original filename shown to students
  fileSize: number; // bytes
  instructor: mongoose.Types.ObjectId; // ref: User
  views: number;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
}

const LectureNoteSchema = new Schema<ILectureNote>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title must be under 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [1000, "Description must be under 1000 characters"],
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

    // ── File storage (local filesystem) ───────────────────────────────────
    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
    },
    filePath: {
      type: String,
      required: [true, "File path is required"],
    },
    fileName: {
      type: String,
      required: [true, "Original file name is required"],
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
    },

    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Instructor reference is required"],
    },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Full-text search index across the most useful fields
LectureNoteSchema.index({
  title: "text",
  subject: "text",
  topic: "text",
  description: "text",
});

// Compound indexes for common query patterns
LectureNoteSchema.index({ instructor: 1, createdAt: -1 });
LectureNoteSchema.index({ subject: 1, classLevel: 1 });

const LectureNote: Model<ILectureNote> =
  mongoose.models.LectureNote ??
  mongoose.model<ILectureNote>("LectureNote", LectureNoteSchema);

export default LectureNote;
