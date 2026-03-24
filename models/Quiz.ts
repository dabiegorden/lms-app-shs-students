import mongoose, { Schema, type Document, type Model } from "mongoose";

// ─── Question sub-types ───────────────────────────────────────────────────────

export interface IMCQOption {
  label: "A" | "B" | "C" | "D" | "E";
  text: string;
}

export interface IQuestion {
  _id?: mongoose.Types.ObjectId;
  type: "mcq" | "theory";
  text: string; // The question body
  marks: number; // Points awarded for this question

  // MCQ-only fields
  options: IMCQOption[]; // 2–5 options (A–E)
  correctOption: "A" | "B" | "C" | "D" | "E" | null; // Which label is correct

  // Theory-only
  modelAnswer: string; // Instructor's reference answer (hidden from students)

  order: number; // Display order (0-indexed)
}

// ─── Quiz document ────────────────────────────────────────────────────────────

export interface IQuiz extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  subject: string;
  topic: string;
  classLevel: "SHS 1" | "SHS 2" | "SHS 3" | "All";

  questions: IQuestion[];
  totalMarks: number; // Sum of all question marks (auto-computed on save)

  durationMinutes: number | null; // null = no timer
  dueDate: Date;
  allowLateSubmission: boolean;
  shuffleQuestions: boolean; // randomise question order per student

  instructor: mongoose.Types.ObjectId;
  status: "draft" | "published" | "closed";

  views: number;
  submissionsCount: number;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const MCQOptionSchema = new Schema<IMCQOption>(
  {
    label: {
      type: String,
      enum: ["A", "B", "C", "D", "E"],
      required: true,
    },
    text: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const QuestionSchema = new Schema<IQuestion>(
  {
    type: {
      type: String,
      enum: ["mcq", "theory"],
      required: true,
    },
    text: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
      maxlength: [2000, "Question text must be under 2000 characters"],
    },
    marks: {
      type: Number,
      required: true,
      min: [0.5, "Marks must be at least 0.5"],
      default: 1,
    },
    // MCQ fields
    options: { type: [MCQOptionSchema], default: [] },
    correctOption: {
      type: String,
      enum: ["A", "B", "C", "D", "E", null],
      default: null,
    },
    // Theory field
    modelAnswer: { type: String, trim: true, default: "" },

    order: { type: Number, default: 0 },
  },
  { timestamps: false },
);

const QuizSchema = new Schema<IQuiz>(
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
      maxlength: [5000, "Description must be under 5000 characters"],
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    topic: { type: String, trim: true, default: "" },
    classLevel: {
      type: String,
      enum: ["SHS 1", "SHS 2", "SHS 3", "All"],
      default: "All",
    },

    questions: { type: [QuestionSchema], default: [] },
    totalMarks: { type: Number, default: 0 },

    durationMinutes: { type: Number, default: null },
    dueDate: { type: Date, required: [true, "Due date is required"] },
    allowLateSubmission: { type: Boolean, default: false },
    shuffleQuestions: { type: Boolean, default: false },

    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "published",
    },

    views: { type: Number, default: 0 },
    submissionsCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ── Auto-compute totalMarks before save ────────────────────────────────────────
QuizSchema.pre("save", async function () {
  if (this.isModified("questions")) {
    this.totalMarks = this.questions.reduce(
      (sum, q) => sum + (q.marks ?? 0),
      0,
    );
  }
  return;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
QuizSchema.index({
  title: "text",
  subject: "text",
  topic: "text",
  description: "text",
});
QuizSchema.index({ instructor: 1, createdAt: -1 });
QuizSchema.index({ subject: 1, classLevel: 1 });
QuizSchema.index({ dueDate: 1, status: 1 });

const Quiz: Model<IQuiz> =
  mongoose.models.Quiz ?? mongoose.model<IQuiz>("Quiz", QuizSchema);

export default Quiz;
