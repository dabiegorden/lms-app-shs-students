import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISubmission extends Document {
  assignment: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  submittedAt: Date;
  fileUrl: string | null;
  filePath: string | null; // server-side path, never exposed to clients
  fileName: string | null;
  fileSize: number | null;
  note: string;
  status: "submitted" | "graded" | "returned";
  score: number | null;
  feedback: string | null;
  isLate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    assignment: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    fileUrl: { type: String, default: null },
    filePath: { type: String, default: null }, // internal only
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    note: { type: String, default: "" },
    status: {
      type: String,
      enum: ["submitted", "graded", "returned"],
      default: "submitted",
    },
    score: { type: Number, default: null },
    feedback: { type: String, default: null },
    isLate: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One submission per student per assignment (at a time)
SubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

const Submission: Model<ISubmission> =
  mongoose.models.Submission ??
  mongoose.model<ISubmission>("Submission", SubmissionSchema);

export default Submission;
