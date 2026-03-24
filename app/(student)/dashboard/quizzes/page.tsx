"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type OptionLabel = "A" | "B" | "C" | "D" | "E";
type QuizStatus = "draft" | "published" | "closed";
type GradingStatus = "pending" | "partially_graded" | "graded";

interface MCQOption {
  label: OptionLabel;
  text: string;
}

interface Question {
  _id: string;
  type: "mcq" | "theory";
  text: string;
  marks: number;
  options: MCQOption[];
  order: number;
}

interface QuizListItem {
  _id: string;
  title: string;
  description: string;
  subject: string;
  topic: string;
  classLevel: string;
  dueDate: string;
  totalMarks: number;
  durationMinutes: number | null;
  allowLateSubmission: boolean;
  shuffleQuestions: boolean;
  status: QuizStatus;
  questionCount: number;
  mcqCount: number;
  theoryCount: number;
  submissionsCount: number;
  createdAt: string;
}

interface QuizFull extends QuizListItem {
  questions: Question[];
}

interface AnswerEntry {
  questionId: string;
  questionType: "mcq" | "theory";
  selectedOption: OptionLabel | null;
  isCorrect: boolean | null;
  theoryAnswer: string;
  autoMark: number | null;
  maxMarks: number;
}

interface SubmissionResult {
  _id: string;
  mcqScore: number;
  totalScore: number;
  maxPossibleScore: number;
  gradingStatus: GradingStatus;
  resultReleased: boolean;
  submittedAt: string;
  answers: AnswerEntry[];
}

interface MySubmission {
  _id: string;
  quiz: string;
  mcqScore: number;
  theoryScore: number;
  totalScore: number;
  maxPossibleScore: number;
  gradingStatus: GradingStatus;
  resultReleased: boolean;
  submittedAt: string;
  timeTakenSeconds: number | null;
  overallFeedback: string;
  answers: AnswerEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDueDate(iso: string) {
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / 86400000);
  const formatted = new Date(iso).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (diffMs < 0) return { label: "Overdue", badge: "overdue", formatted };
  if (diffDays === 0) return { label: "Due today", badge: "today", formatted };
  if (diffDays <= 3)
    return { label: `${diffDays}d left`, badge: "soon", formatted };
  return { label: formatted, badge: "normal", formatted };
}

function formatTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatSeconds(s: number | null) {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg
      className={`animate-spin shrink-0 ${sm ? "w-3.5 h-3.5" : "w-5 h-5"}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({
  score,
  max,
  size = 96,
}: {
  score: number;
  max: number;
  size?: number;
}) {
  const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  const color =
    pct >= 75
      ? "#10b981"
      : pct >= 50
        ? "#f59e0b"
        : pct >= 30
          ? "#f97316"
          : "#ef4444";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-black"
        style={{
          fontSize: size * 0.18,
          fontWeight: 900,
          fill: color,
          fontFamily: "inherit",
        }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

// ─── Quiz Taking Modal ────────────────────────────────────────────────────────
function QuizTakingModal({
  quiz,
  onClose,
  onSubmitted,
}: {
  quiz: QuizFull;
  onClose: () => void;
  onSubmitted: (result: SubmissionResult, quizId: string) => void;
}) {
  const startedAt = useRef(new Date().toISOString());
  const startTs = useRef(Date.now());

  // Shuffle questions if needed
  const [questions] = useState<Question[]>(() => {
    const sorted = [...quiz.questions].sort((a, b) => a.order - b.order);
    return quiz.shuffleQuestions ? shuffleArray(sorted) : sorted;
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<
    Record<string, { selectedOption: OptionLabel | null; theoryAnswer: string }>
  >(() => {
    const init: Record<
      string,
      { selectedOption: OptionLabel | null; theoryAnswer: string }
    > = {};
    quiz.questions.forEach((q) => {
      init[q._id] = { selectedOption: null, theoryAnswer: "" };
    });
    return init;
  });

  const [timeLeft, setTimeLeft] = useState<number | null>(
    quiz.durationMinutes ? quiz.durationMinutes * 60 : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }
    const t = setInterval(
      () => setTimeLeft((p) => (p !== null ? p - 1 : p)),
      1000,
    );
    return () => clearInterval(t);
  }, [timeLeft]);

  const currentQ = questions[currentIdx];
  const totalAnswered = Object.values(answers).filter(
    (a) => a.selectedOption !== null || a.theoryAnswer.trim() !== "",
  ).length;

  const setMCQAnswer = (qId: string, option: OptionLabel) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], selectedOption: option },
    }));
  };

  const setTheoryAnswer = (qId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], theoryAnswer: text },
    }));
  };

  const handleSubmit = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const timeTaken = Math.round((Date.now() - startTs.current) / 1000);
      const answersList = Object.entries(answers).map(([questionId, ans]) => ({
        questionId,
        selectedOption: ans.selectedOption,
        theoryAnswer: ans.theoryAnswer,
      }));

      const res = await fetch(`/api/quiz/${quiz._id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answersList,
          startedAt: startedAt.current,
          timeTakenSeconds: timeTaken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(
        auto ? "Time's up! Quiz auto-submitted." : "Quiz submitted!",
      );
      onSubmitted(data.data, quiz._id);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit quiz.");
      setSubmitting(false);
    }
  };

  const timerDanger = timeLeft !== null && timeLeft <= 60;
  const timerWarning = timeLeft !== null && timeLeft <= 300 && timeLeft > 60;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-100 shadow-sm px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-800 text-sm truncate">
            {quiz.title}
          </p>
          <p className="text-xs text-slate-500">
            {quiz.subject}
            {quiz.topic ? ` · ${quiz.topic}` : ""}
          </p>
        </div>

        {/* Timer */}
        {timeLeft !== null && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm tabular-nums shrink-0 transition-all ${
              timerDanger
                ? "bg-red-50 text-red-700 border border-red-200 animate-pulse"
                : timerWarning
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            ⏱ {formatTimer(timeLeft)}
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center gap-2 shrink-0 text-xs font-bold text-slate-500">
          <span className="text-emerald-600 font-black">{totalAnswered}</span>/
          {questions.length} answered
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={submitting}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-all shrink-0 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Spinner sm />
              Submitting…
            </>
          ) : (
            "Submit Quiz"
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — question navigator */}
        <div className="w-52 bg-white border-r border-slate-100 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3 border-b border-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Questions
            </p>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {questions.map((q, idx) => {
              const ans = answers[q._id];
              const answered =
                ans.selectedOption !== null || ans.theoryAnswer.trim() !== "";
              const isCurrent = idx === currentIdx;
              return (
                <button
                  key={q._id}
                  onClick={() => setCurrentIdx(idx)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all ${
                    isCurrent
                      ? "bg-emerald-600 text-white shadow-sm"
                      : answered
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      isCurrent
                        ? "bg-white/25 text-white"
                        : answered
                          ? "bg-emerald-200 text-emerald-800"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold truncate flex-1">
                    {q.type === "mcq" ? "MCQ" : "Theory"}
                  </span>
                  {answered && !isCurrent && (
                    <span className="text-emerald-500 text-xs shrink-0">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main question area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">
          {/* Question card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Question header */}
            <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
              <span
                className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${
                  currentQ.type === "mcq"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {currentQ.type === "mcq" ? "MCQ" : "Theory"}
              </span>
              <span className="text-xs font-bold text-slate-400">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <div className="flex-1" />
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {currentQ.marks} mark{currentQ.marks !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Question text */}
              <p className="text-slate-800 font-semibold text-base leading-relaxed">
                {currentQ.text}
              </p>

              {/* MCQ Options */}
              {currentQ.type === "mcq" && (
                <div className="flex flex-col gap-2.5">
                  {currentQ.options.map((opt) => {
                    const selected =
                      answers[currentQ._id]?.selectedOption === opt.label;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setMCQAnswer(currentQ._id, opt.label)}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                            selected
                              ? "border-emerald-500 bg-emerald-500 text-white scale-110"
                              : "border-slate-300 text-slate-500"
                          }`}
                        >
                          {selected ? "✓" : opt.label}
                        </div>
                        <span
                          className={`text-sm font-medium flex-1 ${selected ? "text-emerald-800 font-semibold" : "text-slate-700"}`}
                        >
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Theory Answer */}
              {currentQ.type === "theory" && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Your Answer
                  </label>
                  <textarea
                    value={answers[currentQ._id]?.theoryAnswer ?? ""}
                    onChange={(e) =>
                      setTheoryAnswer(currentQ._id, e.target.value)
                    }
                    placeholder="Write your answer here…"
                    rows={6}
                    className="w-full border-2 border-slate-200 focus:border-blue-400 rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none transition-colors"
                  />
                  <p className="text-xs text-slate-400 text-right">
                    {answers[currentQ._id]?.theoryAnswer.length ?? 0} characters
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
              disabled={currentIdx === 0}
              className="flex items-center gap-2 text-sm font-bold text-slate-600 border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 px-5 py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            {/* Dot nav */}
            <div className="flex items-center gap-1.5">
              {questions.map((q, idx) => {
                const ans = answers[q._id];
                const answered =
                  ans.selectedOption !== null || ans.theoryAnswer.trim() !== "";
                return (
                  <button
                    key={q._id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`rounded-full transition-all ${
                      idx === currentIdx
                        ? "w-4 h-3 bg-emerald-600"
                        : answered
                          ? "w-3 h-3 bg-emerald-400"
                          : "w-3 h-3 bg-slate-300 hover:bg-slate-400"
                    }`}
                  />
                );
              })}
            </div>

            {currentIdx < questions.length - 1 ? (
              <button
                onClick={() =>
                  setCurrentIdx((p) => Math.min(questions.length - 1, p + 1))
                }
                className="flex items-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 rounded-xl transition-all shadow"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={submitting}
                className="flex items-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-5 py-2.5 rounded-xl transition-all shadow"
              >
                Finish & Submit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Submit Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl shrink-0">
                📤
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Submit Quiz?
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  This cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Answered</span>
                <span
                  className={`font-black ${totalAnswered < questions.length ? "text-amber-600" : "text-emerald-600"}`}
                >
                  {totalAnswered} / {questions.length}
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{
                    width: `${(totalAnswered / questions.length) * 100}%`,
                  }}
                />
              </div>
              {totalAnswered < questions.length && (
                <p className="text-xs text-amber-600 font-semibold mt-1">
                  ⚠ {questions.length - totalAnswered} question
                  {questions.length - totalAnswered !== 1 ? "s" : ""} unanswered
                  — they will score 0.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 py-3 rounded-xl transition-all disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-3 rounded-xl transition-all shadow"
              >
                {submitting ? (
                  <>
                    <Spinner sm />
                    Submitting…
                  </>
                ) : (
                  "✓ Confirm Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Result Modal ─────────────────────────────────────────────────────────────
function ResultModal({
  result,
  quiz,
  onClose,
}: {
  result: SubmissionResult;
  quiz: QuizListItem;
  onClose: () => void;
}) {
  const pct =
    result.maxPossibleScore > 0
      ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
      : 0;

  const grade =
    pct >= 80
      ? { label: "Excellent!", emoji: "🏆", cls: "text-emerald-700" }
      : pct >= 65
        ? { label: "Good Job!", emoji: "🎉", cls: "text-blue-700" }
        : pct >= 50
          ? { label: "Passed", emoji: "👍", cls: "text-amber-700" }
          : { label: "Keep Practising", emoji: "📚", cls: "text-red-700" };

  const mcqAnswers = result.answers.filter((a) => a.questionType === "mcq");
  const theoryAnswers = result.answers.filter(
    (a) => a.questionType === "theory",
  );
  const correctCount = mcqAnswers.filter((a) => a.isCorrect).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-linear-to-br from-emerald-500 to-teal-600 px-6 py-6 rounded-t-3xl flex flex-col items-center gap-2 text-center">
          <div className="text-4xl">{grade.emoji}</div>
          <h2 className="font-black text-white text-xl">{grade.label}</h2>
          <p className="text-emerald-100 text-sm truncate max-w-full px-4">
            {quiz.title}
          </p>
        </div>

        <div className="px-6 py-6 flex flex-col gap-5">
          {/* Score Ring */}
          <div className="flex flex-col items-center gap-3">
            <ScoreRing
              score={result.totalScore}
              max={result.maxPossibleScore}
              size={120}
            />
            <div className="flex items-center gap-1 text-2xl font-black text-slate-800">
              {result.totalScore}
              <span className="text-slate-400 font-normal text-lg">
                / {result.maxPossibleScore}
              </span>
            </div>
            <p className="text-xs text-slate-500">marks scored</p>
          </div>

          {/* Breakdown */}
          <div className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-3 border border-slate-100">
            {mcqAnswers.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  MCQ Score
                </span>
                <span className="font-black text-slate-800">
                  {result.mcqScore}{" "}
                  <span className="text-slate-400 font-normal text-xs">
                    ({correctCount}/{mcqAnswers.length} correct)
                  </span>
                </span>
              </div>
            )}
            {theoryAnswers.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  Theory
                </span>
                <span className="font-black text-slate-500 text-xs italic">
                  {result.gradingStatus === "graded"
                    ? "Graded"
                    : "Awaiting instructor"}
                </span>
              </div>
            )}
          </div>

          {/* MCQ answer review */}
          {mcqAnswers.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                MCQ Review
              </p>
              <div className="flex flex-col gap-1.5">
                {mcqAnswers.map((a, idx) => (
                  <div
                    key={a.questionId}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                      a.isCorrect
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    <span>{a.isCorrect ? "✓" : "✗"}</span>
                    <span className="flex-1">Q{idx + 1}</span>
                    <span>Your answer: {a.selectedOption ?? "—"}</span>
                    <span className="font-black">
                      {a.autoMark ?? 0}/{a.maxMarks}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {theoryAnswers.length > 0 && result.gradingStatus !== "graded" && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-sm text-blue-700">
              <p className="font-bold mb-1">📝 Theory answers submitted</p>
              <p className="text-xs text-blue-600">
                Your theory answers are awaiting instructor review. You'll see
                your full score once graded.
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Card ────────────────────────────────────────────────────────────────
function QuizCard({
  quiz,
  submission,
  onTake,
}: {
  quiz: QuizListItem;
  submission?: MySubmission;
  onTake: (quiz: QuizListItem) => void;
}) {
  const due = formatDueDate(quiz.dueDate);
  const isOverdue = due.badge === "overdue";
  const canSubmit = !submission && (!isOverdue || quiz.allowLateSubmission);

  const dueBadgeColors: Record<string, string> = {
    overdue: "bg-red-100 text-red-700",
    today: "bg-orange-100 text-orange-700",
    soon: "bg-amber-100 text-amber-700",
    normal: "bg-slate-100 text-slate-600",
  };

  const subBadge: Record<GradingStatus, { label: string; cls: string }> = {
    pending: { label: "Pending Review", cls: "bg-amber-100 text-amber-700" },
    partially_graded: {
      label: "Partially Graded",
      cls: "bg-blue-100 text-blue-700",
    },
    graded: { label: "Graded", cls: "bg-green-100 text-green-700" },
  };

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${
        submission
          ? "border-emerald-200"
          : "border-slate-100 hover:-translate-y-0.5"
      }`}
    >
      <div
        className={`h-1 ${submission ? "bg-linear-to-r from-emerald-400 to-teal-400" : "bg-linear-to-r from-slate-200 to-slate-300"}`}
      />
      <div className="p-4 flex flex-col gap-3">
        {/* Title */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
              submission
                ? "bg-emerald-50 border border-emerald-100"
                : "bg-slate-50 border border-slate-100"
            }`}
          >
            {submission ? "✅" : "🧩"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
              {quiz.title}
            </h3>
            {quiz.topic && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {quiz.topic}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
            {quiz.subject}
          </span>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {quiz.classLevel}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            {quiz.mcqCount} MCQ
          </span>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
            {quiz.theoryCount} Theory
          </span>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {quiz.totalMarks} marks
          </span>
          {quiz.durationMinutes && (
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              ⏱ {quiz.durationMinutes}min
            </span>
          )}
        </div>

        {/* Due date */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${dueBadgeColors[due.badge]}`}
          >
            📅 {due.label}
          </span>
          {quiz.allowLateSubmission && (
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
              Late allowed
            </span>
          )}
        </div>

        {/* Submission status / score */}
        {submission ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${subBadge[submission.gradingStatus].cls}`}
              >
                {subBadge[submission.gradingStatus].label}
              </span>
              {submission.resultReleased && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                  Result Released
                </span>
              )}
            </div>

            {submission.resultReleased ? (
              <div className="flex items-center gap-3">
                <ScoreRing
                  score={submission.totalScore}
                  max={submission.maxPossibleScore}
                  size={56}
                />
                <div>
                  <p className="font-black text-slate-800 text-base">
                    {submission.totalScore}
                    <span className="text-slate-400 font-normal text-sm">
                      {" "}
                      / {submission.maxPossibleScore}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    MCQ: {submission.mcqScore} · Theory:{" "}
                    {submission.theoryScore}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Submitted {formatDate(submission.submittedAt)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Submitted {formatDate(submission.submittedAt)} ·{" "}
                {submission.gradingStatus === "pending"
                  ? "Awaiting grading"
                  : "Result not yet released"}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => onTake(quiz)}
            disabled={!canSubmit}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
              canSubmit
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow hover:shadow-md"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {canSubmit ? (
              <>🚀 Start Quiz</>
            ) : isOverdue ? (
              "⛔ Deadline Passed"
            ) : (
              "Unavailable"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl mb-4">
        {filtered ? "🔍" : "🧩"}
      </div>
      <h3 className="font-black text-slate-800 text-base mb-1">
        {filtered ? "No quizzes match your search" : "No quizzes available"}
      </h3>
      <p className="text-slate-500 text-sm max-w-xs">
        {filtered
          ? "Try adjusting your filters."
          : "Your instructor hasn't published any quizzes yet."}
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentsQuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [mySubmissions, setMySubmissions] = useState<
    Record<string, MySubmission>
  >({});
  const [loading, setLoading] = useState(true);

  // Active quiz-taking
  const [takingQuiz, setTakingQuiz] = useState<QuizFull | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // Result modal after submit
  const [submissionResult, setSubmissionResult] =
    useState<SubmissionResult | null>(null);
  const [resultQuiz, setResultQuiz] = useState<QuizListItem | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "done">("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch quizzes ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch published quizzes for students
      const params = new URLSearchParams({
        status: "published",
        limit: "50",
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filterSubject && { subject: filterSubject }),
      });
      const [quizRes, subRes] = await Promise.all([
        fetch(`/api/student/quizzes?${params}`),
        fetch("/api/student/my-submissions"),
      ]);

      if (quizRes.ok) {
        const qData = await quizRes.json();
        setQuizzes(qData.data ?? []);
      }

      if (subRes.ok) {
        const sData = await subRes.json();
        const subMap: Record<string, MySubmission> = {};
        (sData.data ?? []).forEach((s: MySubmission) => {
          subMap[s.quiz] = s;
        });
        setMySubmissions(subMap);
      }
    } catch (err) {
      toast.error("Failed to load quizzes.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterSubject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Start quiz ─────────────────────────────────────────────────────────────
  const handleStartQuiz = async (quiz: QuizListItem) => {
    setLoadingQuiz(true);
    try {
      const res = await fetch(`/api/student/quizzes/${quiz._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setTakingQuiz(data.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load quiz.");
    } finally {
      setLoadingQuiz(false);
    }
  };

  // ── After submission ───────────────────────────────────────────────────────
  const handleSubmitted = (result: SubmissionResult, quizId: string) => {
    setTakingQuiz(null);
    const quiz = quizzes.find((q) => q._id === quizId) ?? null;
    setSubmissionResult(result);
    setResultQuiz(quiz);
    // Update local submissions cache
    if (quiz) {
      setMySubmissions((prev) => ({
        ...prev,
        [quizId]: {
          _id: result._id,
          quiz: quizId,
          mcqScore: result.mcqScore,
          theoryScore: 0,
          totalScore: result.totalScore,
          maxPossibleScore: result.maxPossibleScore,
          gradingStatus: result.gradingStatus,
          resultReleased: result.resultReleased,
          submittedAt: result.submittedAt,
          timeTakenSeconds: null,
          overallFeedback: "",
          answers: result.answers,
        },
      }));
    }
  };

  // ── Filter quizzes ─────────────────────────────────────────────────────────
  const filteredQuizzes = quizzes.filter((q) => {
    if (filterTab === "pending" && mySubmissions[q._id]) return false;
    if (filterTab === "done" && !mySubmissions[q._id]) return false;
    return true;
  });

  const subjects = [...new Set(quizzes.map((q) => q.subject))].sort();
  const pendingCount = quizzes.filter((q) => !mySubmissions[q._id]).length;
  const doneCount = quizzes.filter((q) => !!mySubmissions[q._id]).length;
  const isFiltered = !!(debouncedSearch || filterSubject);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl shadow-sm">
            🧩
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-xl tracking-tight">
              Quizzes
            </h1>
            <p className="text-slate-500 text-sm">
              {loading
                ? "Loading…"
                : `${pendingCount} pending · ${doneCount} completed`}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 text-sm font-bold text-slate-600 border-2 border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 shrink-0"
        >
          {loading ? <Spinner sm /> : "↻"} Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 w-fit">
        {(
          [
            { key: "all", label: "All", count: quizzes.length },
            { key: "pending", label: "Pending", count: pendingCount },
            { key: "done", label: "Completed", count: doneCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filterTab === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                filterTab === tab.key
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quizzes…"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-all min-w-40"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {(search || filterSubject) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterSubject("");
            }}
            className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 h-72 animate-pulse"
            />
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <EmptyState filtered={isFiltered || filterTab !== "all"} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuizzes.map((q) => (
            <QuizCard
              key={q._id}
              quiz={q}
              submission={mySubmissions[q._id]}
              onTake={handleStartQuiz}
            />
          ))}
        </div>
      )}

      {/* Loading overlay when fetching quiz details */}
      {loadingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-6 flex items-center gap-4 shadow-2xl">
            <Spinner />
            <p className="font-bold text-slate-700">Loading quiz…</p>
          </div>
        </div>
      )}

      {/* Quiz taking modal */}
      {takingQuiz && (
        <QuizTakingModal
          quiz={takingQuiz}
          onClose={() => setTakingQuiz(null)}
          onSubmitted={handleSubmitted}
        />
      )}

      {/* Result modal */}
      {submissionResult && resultQuiz && (
        <ResultModal
          result={submissionResult}
          quiz={resultQuiz}
          onClose={() => {
            setSubmissionResult(null);
            setResultQuiz(null);
          }}
        />
      )}
    </div>
  );
}
