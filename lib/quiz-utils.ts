import { randomUUID } from "crypto";
import type { Question } from "@/src/schema";

/** Normalise raw question payloads into stored Question[] (assigns stable ids). */
export function buildQuestions(rawQuestions: any[]): Question[] {
  return rawQuestions.map((q: any, idx: number): Question => ({
    id: q.id || q._id || randomUUID(),
    type: q.type,
    text: q.text.trim(),
    marks: Number(q.marks) || 1,
    options: q.type === "mcq" ? q.options : [],
    correctOption: q.type === "mcq" ? q.correctOption : null,
    modelAnswer: q.type === "theory" ? (q.modelAnswer?.trim() ?? "") : "",
    order: q.order ?? idx,
  }));
}

/** Sum of all question marks (mirrors the old Mongoose pre-save hook). */
export function computeTotalMarks(questions: Question[]): number {
  return questions.reduce((sum, q) => sum + (q.marks ?? 0), 0);
}

/** Build the compact list-view projection used by quiz list endpoints. */
export function quizListProjection(q: any) {
  const questions = q.questions ?? [];
  return {
    ...q,
    questionCount: questions.length,
    mcqCount: questions.filter((qu: any) => qu.type === "mcq").length,
    theoryCount: questions.filter((qu: any) => qu.type === "theory").length,
    questions: undefined,
  };
}
