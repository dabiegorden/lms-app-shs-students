import mongoose, { Schema, type Document, type Model } from "mongoose";

// ─── Per-question answer ──────────────────────────────────────────────────────

export interface IAnswerEntry {
  questionId: mongoose.Types.ObjectId;
  questionType: "mcq" | "theory";

  // MCQ
  selectedOption: "A" | "B" | "C" | "D" | "E" | null;
  isCorrect: boolean | null; // set immediately on submission for MCQ; null for theory

  // Theory
  theoryAnswer: string; // student's written response

  // Marks
  autoMark: number | null; // filled at submission time for MCQ (full marks or 0)
  instructorMark: number | null; // filled when instructor grades theory (or can override MCQ)
  maxMarks: number; // snapshot of question.marks at submission time
  instructorFeedback: string; // per-question feedback from instructor
}

// ─── Submission document ──────────────────────────────────────────────────────

export interface IQuizSubmission extends Document {
  _id: mongoose.Types.ObjectId;
  quiz: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;

  answers: IAnswerEntry[];

  // Scores
  mcqScore: number; // sum of autoMark for MCQ questions
  theoryScore: number; // sum of instructorMark for theory questions (0 until graded)
  totalScore: number; // mcqScore + theoryScore (updated when instructor finalises)
  maxPossibleScore: number; // totalMarks snapshot

  // Workflow state
  submittedAt: Date;
  gradingStatus: "pending" | "partially_graded" | "graded"; // pending = MCQ only / no theory; graded = instructor done
  gradedAt: Date | null;
  gradedBy: mongoose.Types.ObjectId | null; // instructor userId

  // Instructor can leave an overall comment
  overallFeedback: string;

  // Released to student?
  resultReleased: boolean;

  // Timing
  startedAt: Date | null;
  timeTakenSeconds: number | null;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const AnswerEntrySchema = new Schema<IAnswerEntry>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    questionType: { type: String, enum: ["mcq", "theory"], required: true },

    selectedOption: {
      type: String,
      enum: ["A", "B", "C", "D", "E", null],
      default: null,
    },
    isCorrect: { type: Boolean, default: null },

    theoryAnswer: { type: String, trim: true, default: "" },

    autoMark: { type: Number, default: null },
    instructorMark: { type: Number, default: null },
    maxMarks: { type: Number, required: true },
    instructorFeedback: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const QuizSubmissionSchema = new Schema<IQuizSubmission>(
  {
    quiz: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    answers: { type: [AnswerEntrySchema], default: [] },

    mcqScore: { type: Number, default: 0 },
    theoryScore: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    maxPossibleScore: { type: Number, default: 0 },

    submittedAt: { type: Date, default: Date.now },
    gradingStatus: {
      type: String,
      enum: ["pending", "partially_graded", "graded"],
      default: "pending",
    },
    gradedAt: { type: Date, default: null },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    overallFeedback: { type: String, trim: true, default: "" },
    resultReleased: { type: Boolean, default: false },

    startedAt: { type: Date, default: null },
    timeTakenSeconds: { type: Number, default: null },
  },
  { timestamps: true },
);

// One submission per student per quiz
QuizSubmissionSchema.index({ quiz: 1, student: 1 }, { unique: true });
QuizSubmissionSchema.index({ quiz: 1, gradingStatus: 1 });
QuizSubmissionSchema.index({ student: 1, submittedAt: -1 });

const QuizSubmission: Model<IQuizSubmission> =
  mongoose.models.QuizSubmission ??
  mongoose.model<IQuizSubmission>("QuizSubmission", QuizSubmissionSchema);

export default QuizSubmission;
