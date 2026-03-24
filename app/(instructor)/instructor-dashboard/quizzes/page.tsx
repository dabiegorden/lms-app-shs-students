"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type QuestionType = "mcq" | "theory";
type OptionLabel = "A" | "B" | "C" | "D" | "E";
type QuizStatus = "draft" | "published" | "closed";
type GradingStatus = "pending" | "partially_graded" | "graded";

interface MCQOption {
  label: OptionLabel;
  text: string;
}

interface Question {
  _id?: string;
  type: QuestionType;
  text: string;
  marks: number;
  options: MCQOption[];
  correctOption: OptionLabel | null;
  modelAnswer: string;
  order: number;
}

interface Quiz {
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
  views: number;
  submissionsCount: number;
  questionCount: number;
  mcqCount: number;
  theoryCount: number;
  createdAt: string;
  updatedAt: string;
}

interface QuizFull extends Quiz {
  questions: Question[];
}

interface AnswerEntry {
  questionId: string;
  questionType: QuestionType;
  selectedOption: OptionLabel | null;
  isCorrect: boolean | null;
  theoryAnswer: string;
  autoMark: number | null;
  instructorMark: number | null;
  maxMarks: number;
  instructorFeedback: string;
}

interface Submission {
  _id: string;
  student: { _id: string; name: string; email: string };
  answers: AnswerEntry[];
  mcqScore: number;
  theoryScore: number;
  totalScore: number;
  maxPossibleScore: number;
  gradingStatus: GradingStatus;
  resultReleased: boolean;
  overallFeedback: string;
  submittedAt: string;
  timeTakenSeconds: number | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBJECTS = [
  "Mathematics",
  "English Language",
  "Integrated Science",
  "Social Studies",
  "ICT",
  "Elective Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
  "Government",
  "History",
  "Geography",
  "Literature",
  "French",
  "Visual Arts",
  "Business Management",
];
const CLASS_LEVELS = ["All", "SHS 1", "SHS 2", "SHS 3"];
const OPTION_LABELS: OptionLabel[] = ["A", "B", "C", "D", "E"];

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
  const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000);
  const formatted = formatDate(iso);
  if (diffDays < 0) return { label: formatted, badge: "overdue" };
  if (diffDays === 0) return { label: "Due today", badge: "today" };
  if (diffDays <= 3) return { label: `${diffDays}d left`, badge: "soon" };
  return { label: formatted, badge: "normal" };
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSeconds(s: number | null) {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg
      className={`animate-spin shrink-0 ${sm ? "w-3.5 h-3.5" : "w-4 h-4"}`}
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

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl mb-4">
        {filtered ? "🔍" : "🧩"}
      </div>
      <h3 className="font-black text-slate-800 text-base mb-1">
        {filtered ? "No quizzes match your search" : "No quizzes yet"}
      </h3>
      <p className="text-slate-500 text-sm max-w-xs">
        {filtered
          ? "Try adjusting your filters."
          : "Create your first quiz with MCQ and theory questions."}
      </p>
    </div>
  );
}

// ─── Question Builder ─────────────────────────────────────────────────────────
function QuestionBuilder({
  questions,
  onChange,
  disabled,
}: {
  questions: Question[];
  onChange: (qs: Question[]) => void;
  disabled: boolean;
}) {
  const addQuestion = (type: QuestionType) => {
    const newQ: Question = {
      type,
      text: "",
      marks: 1,
      options:
        type === "mcq"
          ? [
              { label: "A", text: "" },
              { label: "B", text: "" },
              { label: "C", text: "" },
              { label: "D", text: "" },
            ]
          : [],
      correctOption: null,
      modelAnswer: "",
      order: questions.length,
    };
    onChange([...questions, newQ]);
  };

  const updateQ = (idx: number, patch: Partial<Question>) => {
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const removeQ = (idx: number) => {
    onChange(
      questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i })),
    );
  };

  const updateOption = (qIdx: number, oIdx: number, text: string) => {
    const opts = [...questions[qIdx].options];
    opts[oIdx] = { ...opts[oIdx], text };
    updateQ(qIdx, { options: opts });
  };

  const addOption = (qIdx: number) => {
    const q = questions[qIdx];
    if (q.options.length >= 5) return;
    const label = OPTION_LABELS[q.options.length];
    updateQ(qIdx, { options: [...q.options, { label, text: "" }] });
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const q = questions[qIdx];
    if (q.options.length <= 2) return;
    const newOpts = q.options
      .filter((_, i) => i !== oIdx)
      .map((o, i) => ({ ...o, label: OPTION_LABELS[i] }));
    const correctStillValid = newOpts.some((o) => o.label === q.correctOption);
    updateQ(qIdx, {
      options: newOpts,
      correctOption: correctStillValid ? q.correctOption : null,
    });
  };

  const moveQ = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= questions.length) return;
    const arr = [...questions];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr.map((q, i) => ({ ...q, order: i })));
  };

  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, idx) => (
        <div
          key={idx}
          className={`border-2 rounded-2xl p-4 flex flex-col gap-3 ${
            q.type === "mcq"
              ? "border-emerald-200 bg-emerald-50/30"
              : "border-blue-200 bg-blue-50/30"
          }`}
        >
          {/* Question header */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${
                q.type === "mcq"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {q.type === "mcq" ? "MCQ" : "Theory"}
            </span>
            <span className="text-xs font-bold text-slate-500">Q{idx + 1}</span>
            <div className="flex-1" />
            {/* Move up/down */}
            <button
              type="button"
              onClick={() => moveQ(idx, -1)}
              disabled={disabled || idx === 0}
              className="text-slate-400 hover:text-slate-700 disabled:opacity-30 text-base px-1"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveQ(idx, 1)}
              disabled={disabled || idx === questions.length - 1}
              className="text-slate-400 hover:text-slate-700 disabled:opacity-30 text-base px-1"
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => removeQ(idx)}
              disabled={disabled}
              className="text-red-400 hover:text-red-600 disabled:opacity-30 text-sm font-bold px-1"
              title="Remove question"
            >
              ✕
            </button>
          </div>

          {/* Question text + marks */}
          <div className="flex gap-3 items-start">
            <textarea
              value={q.text}
              onChange={(e) => updateQ(idx, { text: e.target.value })}
              placeholder="Enter question text…"
              rows={2}
              disabled={disabled}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none disabled:opacity-60 bg-white"
            />
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-xs font-bold text-slate-500">Marks</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={q.marks}
                onChange={(e) =>
                  updateQ(idx, { marks: parseFloat(e.target.value) || 1 })
                }
                disabled={disabled}
                className="w-20 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center disabled:opacity-60 bg-white"
              />
            </div>
          </div>

          {/* MCQ options */}
          {q.type === "mcq" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Answer Options
                </p>
                <p className="text-xs text-slate-400 italic">
                  Click the circle to mark the correct answer
                </p>
              </div>

              {q.options.map((opt, oIdx) => {
                const isCorrect = q.correctOption === opt.label;
                return (
                  <div
                    key={opt.label}
                    className={`flex items-center gap-2 rounded-xl px-2 py-1 transition-colors ${
                      isCorrect ? "bg-emerald-50 ring-1 ring-emerald-300" : ""
                    }`}
                  >
                    {/* Correct answer toggle — shows checkmark when selected */}
                    <button
                      type="button"
                      onClick={() =>
                        updateQ(idx, {
                          correctOption:
                            q.correctOption === opt.label ? null : opt.label,
                        })
                      }
                      disabled={disabled}
                      title={
                        isCorrect
                          ? "Correct answer (click to deselect)"
                          : `Mark ${opt.label} as correct answer`
                      }
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                        isCorrect
                          ? "border-emerald-500 bg-emerald-500 text-white scale-110 shadow-sm"
                          : "border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
                      }`}
                    >
                      {isCorrect ? "✓" : opt.label}
                    </button>

                    <span
                      className={`text-xs font-black w-5 shrink-0 ${isCorrect ? "text-emerald-700" : "text-slate-400"}`}
                    >
                      {opt.label}.
                    </span>

                    <input
                      value={opt.text}
                      onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                      placeholder={`Type option ${opt.label} here…`}
                      disabled={disabled}
                      className={`flex-1 border rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 bg-white transition-colors ${
                        isCorrect
                          ? "border-emerald-300 font-semibold"
                          : "border-slate-200"
                      }`}
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx, oIdx)}
                        disabled={disabled}
                        className="text-slate-300 hover:text-red-500 text-sm font-bold shrink-0 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}

              {q.options.length < 5 && (
                <button
                  type="button"
                  onClick={() => addOption(idx)}
                  disabled={disabled}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 text-left w-fit pl-1"
                >
                  + Add option {OPTION_LABELS[q.options.length]}
                </button>
              )}

              {/* Answer key summary bar — always visible so instructor always knows the state */}
              <div
                className={`flex items-center gap-2 mt-1 px-3 py-2 rounded-xl text-xs font-bold ${
                  q.correctOption
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {q.correctOption ? (
                  <>
                    <span>✓</span>
                    <span>Answer key:</span>
                    <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded-md">
                      {q.correctOption}
                    </span>
                    <span className="font-normal truncate">
                      {q.options.find((o) => o.label === q.correctOption)
                        ?.text || "(no text yet)"}
                    </span>
                  </>
                ) : (
                  <>
                    <span>⚠</span>
                    <span>
                      No correct answer set — click a letter circle above to
                      mark it
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Theory model answer */}
          {q.type === "theory" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Model Answer{" "}
                <span className="text-slate-400 normal-case font-normal">
                  (hidden from students)
                </span>
              </label>
              <textarea
                value={q.modelAnswer}
                onChange={(e) => updateQ(idx, { modelAnswer: e.target.value })}
                placeholder="Enter the expected answer or marking guide…"
                rows={3}
                disabled={disabled}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60 bg-white"
              />
            </div>
          )}
        </div>
      ))}

      {/* Add question buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => addQuestion("mcq")}
          disabled={disabled}
          className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-2 border-dashed border-emerald-200 hover:border-emerald-400 px-4 py-3 rounded-xl transition-all disabled:opacity-50 flex-1 justify-center"
        >
          + Add MCQ Question
        </button>
        <button
          type="button"
          onClick={() => addQuestion("theory")}
          disabled={disabled}
          className="flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border-2 border-dashed border-blue-200 hover:border-blue-400 px-4 py-3 rounded-xl transition-all disabled:opacity-50 flex-1 justify-center"
        >
          + Add Theory Question
        </button>
      </div>
    </div>
  );
}

// ─── Quiz Modal (Create / Edit) ───────────────────────────────────────────────
function QuizModal({
  mode,
  quiz,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  quiz?: QuizFull;
  onClose: () => void;
  onSaved: (saved: Quiz) => void;
}) {
  const [saving, setSaving] = useState(false);
  const isEdit = mode === "edit";

  // Form state
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [subject, setSubject] = useState(quiz?.subject ?? "");
  const [topic, setTopic] = useState(quiz?.topic ?? "");
  const [description, setDescription] = useState(quiz?.description ?? "");
  const [classLevel, setClassLevel] = useState(quiz?.classLevel ?? "All");
  const [dueDate, setDueDate] = useState(
    quiz?.dueDate ? toDatetimeLocal(quiz.dueDate) : "",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    String(quiz?.durationMinutes ?? ""),
  );
  const [allowLate, setAllowLate] = useState(
    quiz?.allowLateSubmission ?? false,
  );
  const [shuffle, setShuffle] = useState(quiz?.shuffleQuestions ?? false);
  const [status, setStatus] = useState<QuizStatus>(quiz?.status ?? "published");
  const [questions, setQuestions] = useState<Question[]>(quiz?.questions ?? []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !subject) {
      toast.error("Title and subject are required.");
      return;
    }
    if (!dueDate) {
      toast.error("Due date is required.");
      return;
    }
    if (questions.length === 0) {
      toast.error("Add at least one question.");
      return;
    }

    // Validate questions client-side
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        toast.error(`Question ${i + 1}: enter question text.`);
        return;
      }
      if (q.type === "mcq") {
        if (q.options.some((o) => !o.text.trim())) {
          toast.error(`Question ${i + 1}: fill in all option texts.`);
          return;
        }
        if (!q.correctOption) {
          toast.error(`Question ${i + 1}: select the correct answer.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        subject,
        description: description.trim(),
        topic: topic.trim(),
        classLevel,
        dueDate: new Date(dueDate).toISOString(),
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
        allowLateSubmission: allowLate,
        shuffleQuestions: shuffle,
        status,
        questions,
      };

      const url = isEdit ? `/api/quiz/${quiz!._id}` : "/api/quiz";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(isEdit ? "Quiz updated!" : "Quiz created successfully!");
      onSaved(data.data);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 to-teal-700 px-6 py-5 flex items-center justify-between rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              {isEdit ? "✏️" : "🧩"}
            </div>
            <div>
              <h2 className="font-black text-white text-base">
                {isEdit ? "Edit Quiz" : "Create Quiz"}
              </h2>
              <p className="text-emerald-200 text-xs">
                MCQ (auto-marked) + Theory questions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mid-Term Physics Quiz — Waves & Optics"
              disabled={saving}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-60"
            />
          </div>

          {/* Subject + Class Level */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Subject <span className="text-red-400">*</span>
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all bg-white disabled:opacity-60"
              >
                <option value="">Select subject</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Class Level
              </label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all bg-white disabled:opacity-60"
              >
                {CLASS_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Topic */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Topic / Chapter
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Waves — Reflection and Refraction"
              disabled={saving}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-60"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Description / Instructions
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions for students before they start the quiz…"
              rows={3}
              disabled={saving}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-60 resize-none"
            />
          </div>

          {/* Due Date + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Due Date <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Duration{" "}
                <span className="text-slate-400 normal-case font-normal">
                  (mins, blank = no limit)
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={360}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 45"
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {/* Status + Toggles */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as QuizStatus)}
                disabled={saving}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all bg-white disabled:opacity-60"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Late Submissions
              </label>
              <button
                type="button"
                onClick={() => setAllowLate((p) => !p)}
                disabled={saving}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all disabled:opacity-60 ${allowLate ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
              >
                <span>{allowLate ? "Allowed" : "Blocked"}</span>
                <div
                  className={`w-9 h-5 rounded-full transition-colors relative ${allowLate ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${allowLate ? "left-4" : "left-0.5"}`}
                  />
                </div>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Shuffle Order
              </label>
              <button
                type="button"
                onClick={() => setShuffle((p) => !p)}
                disabled={saving}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all disabled:opacity-60 ${shuffle ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
              >
                <span>{shuffle ? "On" : "Off"}</span>
                <div
                  className={`w-9 h-5 rounded-full transition-colors relative ${shuffle ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${shuffle ? "left-4" : "left-0.5"}`}
                  />
                </div>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 pt-2">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-black text-slate-800 text-sm">Questions</h3>
              {questions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                    {questions.filter((q) => q.type === "mcq").length} MCQ
                  </span>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                    {questions.filter((q) => q.type === "theory").length} Theory
                  </span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    {questions.reduce((s, q) => s + (q.marks || 0), 0)} total
                    marks
                  </span>
                </div>
              )}
            </div>
            <QuestionBuilder
              questions={questions}
              onChange={setQuestions}
              disabled={saving}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 py-3 rounded-xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl shadow-md transition-all"
            >
              {saving ? (
                <>
                  <Spinner sm />
                  {isEdit ? "Saving…" : "Creating…"}
                </>
              ) : isEdit ? (
                "💾 Save Changes"
              ) : (
                "🧩 Create Quiz"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Grading Modal ────────────────────────────────────────────────────────────
function GradingModal({
  quizId,
  onClose,
}: {
  quizId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<{
    title: string;
    questions: Question[];
    totalMarks: number;
  } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(
    null,
  );
  const [grades, setGrades] = useState<
    Record<string, { mark: string; feedback: string }>
  >({});
  const [overallFeedback, setOverallFeedback] = useState("");
  const [releaseResult, setReleaseResult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(filterStatus && { gradingStatus: filterStatus }),
      });
      const res = await fetch(`/api/quiz/${quizId}/submissions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setQuizData(data.data.quiz);
      setSubmissions(data.data.submissions);
      setPagination(data.data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  }, [quizId, page, filterStatus]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const openSubmission = (sub: Submission) => {
    setActiveSubmission(sub);
    setOverallFeedback(sub.overallFeedback ?? "");
    setReleaseResult(sub.resultReleased);
    // Pre-fill existing instructor marks
    const initialGrades: Record<string, { mark: string; feedback: string }> =
      {};
    sub.answers.forEach((a) => {
      initialGrades[a.questionId] = {
        mark: a.instructorMark !== null ? String(a.instructorMark) : "",
        feedback: a.instructorFeedback ?? "",
      };
    });
    setGrades(initialGrades);
  };

  const handleGrade = async () => {
    if (!activeSubmission) return;
    setSaving(true);
    try {
      const gradeList = activeSubmission.answers
        .filter(
          (a) =>
            a.questionType === "theory" || grades[a.questionId]?.mark !== "",
        )
        .map((a) => ({
          questionId: a.questionId,
          instructorMark: parseFloat(grades[a.questionId]?.mark ?? "0"),
          instructorFeedback: grades[a.questionId]?.feedback ?? "",
        }));

      const res = await fetch(`/api/quiz/${quizId}/submissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: activeSubmission._id,
          grades: gradeList,
          overallFeedback,
          releaseResult,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Submission graded successfully!");
      setActiveSubmission(null);
      fetchSubmissions();
    } catch (err: any) {
      toast.error(err.message || "Failed to save grades.");
    } finally {
      setSaving(false);
    }
  };

  const gradingBadge: Record<GradingStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-700" },
    partially_graded: { label: "Partial", cls: "bg-blue-100 text-blue-700" },
    graded: { label: "Graded", cls: "bg-green-100 text-green-700" },
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
      {/* Header */}
      <div className="bg-linear-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center gap-4 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg">
          📝
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-sm truncate">
            {quizData?.title ?? "Quiz"} — Submissions
          </p>
          <p className="text-slate-400 text-xs">
            {pagination?.total ?? 0} submission
            {pagination?.total !== 1 ? "s" : ""} · {quizData?.totalMarks ?? 0}{" "}
            total marks
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-slate-600 bg-slate-700 text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="partially_graded">Partial</option>
            <option value="graded">Graded</option>
          </select>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {/* Grading panel for selected submission */}
        {activeSubmission && quizData && (
          <div className="bg-white rounded-2xl shadow-xl mb-5 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm">
                  Grading: {activeSubmission.student.name}
                </p>
                <p className="text-xs text-slate-500">
                  {activeSubmission.student.email}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs font-bold text-slate-600">
                <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                  MCQ: {activeSubmission.mcqScore} marks
                </span>
                <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                  Time: {formatSeconds(activeSubmission.timeTakenSeconds)}
                </span>
              </div>
              <button
                onClick={() => setActiveSubmission(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm px-2"
              >
                ✕ Close
              </button>
            </div>

            <div className="px-5 py-5 flex flex-col gap-5 max-h-[60vh] overflow-y-auto">
              {activeSubmission.answers.map((answer, aIdx) => {
                const question = quizData.questions.find(
                  (q) => String(q._id) === answer.questionId,
                );
                if (!question) return null;
                const g = grades[answer.questionId] ?? {
                  mark: "",
                  feedback: "",
                };
                return (
                  <div
                    key={answer.questionId}
                    className={`rounded-xl border p-4 flex flex-col gap-3 ${answer.questionType === "mcq" ? "border-emerald-100 bg-emerald-50/30" : "border-blue-100 bg-blue-50/30"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${answer.questionType === "mcq" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {answer.questionType === "mcq" ? "MCQ" : "Theory"}
                      </span>
                      <p className="text-sm font-semibold text-slate-800 flex-1">
                        Q{aIdx + 1}. {question.text}
                      </p>
                      <span className="text-xs text-slate-400 shrink-0">
                        {question.marks} mark{question.marks !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {answer.questionType === "mcq" ? (
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl ${answer.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                        >
                          {answer.isCorrect ? "✓" : "✗"}{" "}
                          {answer.selectedOption ?? "No answer"}
                        </div>
                        <span className="text-xs text-slate-500">
                          Correct:{" "}
                          <span className="font-bold text-slate-700">
                            {question.correctOption}
                          </span>
                        </span>
                        <span
                          className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${answer.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                        >
                          {answer.autoMark ?? 0} / {answer.maxMarks}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 min-h-15">
                          {answer.theoryAnswer || (
                            <span className="text-slate-400 italic">
                              No answer provided
                            </span>
                          )}
                        </div>
                        {question.modelAnswer && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700">
                            <span className="font-bold">Model Answer:</span>{" "}
                            {question.modelAnswer}
                          </div>
                        )}
                        <div className="flex gap-2 items-center">
                          <label className="text-xs font-bold text-slate-500 shrink-0">
                            Mark:
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={question.marks}
                            step={0.5}
                            value={g.mark}
                            onChange={(e) =>
                              setGrades((prev) => ({
                                ...prev,
                                [answer.questionId]: {
                                  ...g,
                                  mark: e.target.value,
                                },
                              }))
                            }
                            placeholder={`0-${question.marks}`}
                            className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-slate-400">
                            / {question.marks}
                          </span>
                          <input
                            value={g.feedback}
                            onChange={(e) =>
                              setGrades((prev) => ({
                                ...prev,
                                [answer.questionId]: {
                                  ...g,
                                  feedback: e.target.value,
                                },
                              }))
                            }
                            placeholder="Optional feedback for this answer…"
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Overall feedback */}
              <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Overall Feedback
                </label>
                <textarea
                  value={overallFeedback}
                  onChange={(e) => setOverallFeedback(e.target.value)}
                  placeholder="General comments for the student…"
                  rows={3}
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                />
              </div>
            </div>

            {/* Grade actions */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReleaseResult((p) => !p)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${releaseResult ? "border-green-300 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-600"}`}
              >
                <div
                  className={`w-8 h-4 rounded-full relative transition-colors ${releaseResult ? "bg-green-500" : "bg-slate-300"}`}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${releaseResult ? "left-4" : "left-0.5"}`}
                  />
                </div>
                {releaseResult ? "Result Released" : "Release to Student"}
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setActiveSubmission(null)}
                className="text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleGrade}
                disabled={saving}
                className="flex items-center gap-2 text-sm font-bold text-white bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 px-5 py-2.5 rounded-xl shadow transition-all"
              >
                {saving ? (
                  <>
                    <Spinner sm />
                    Saving…
                  </>
                ) : (
                  "💾 Save Grades"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Submissions list */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl h-32 animate-pulse"
              />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-black text-white text-base">
              No submissions yet
            </p>
            <p className="text-slate-400 text-sm">
              Students have not submitted this quiz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {submissions.map((sub) => {
              const badge = gradingBadge[sub.gradingStatus];
              return (
                <div
                  key={sub._id}
                  onClick={() => openSubmission(sub)}
                  className={`bg-white rounded-2xl border p-4 flex flex-col gap-3 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${activeSubmission?._id === sub._id ? "border-emerald-400 ring-2 ring-emerald-300" : "border-slate-100"}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-slate-200 to-slate-300 flex items-center justify-center font-black text-slate-600 text-sm shrink-0">
                      {sub.student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">
                        {sub.student.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {sub.student.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    {sub.resultReleased && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                        Released
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Score:{" "}
                      <span className="font-black text-slate-800">
                        {sub.totalScore}
                      </span>{" "}
                      / {sub.maxPossibleScore}
                    </span>
                    <span>{formatDate(sub.submittedAt)}</span>
                  </div>

                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-emerald-400 to-teal-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (sub.totalScore / (sub.maxPossibleScore || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              className="w-8 h-8 rounded-xl bg-white/10 text-white disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-sm text-slate-300 font-medium">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="w-8 h-8 rounded-xl bg-white/10 text-white disabled:opacity-30"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({
  quiz,
  onClose,
  onDeleted,
}: {
  quiz: Quiz;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/quiz/${quiz._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Quiz deleted.");
      onDeleted(quiz._id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-2xl shrink-0">
            🗑️
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">
              Delete Quiz?
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              This cannot be undone.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
          <p className="font-bold text-slate-800 text-sm truncate">
            {quiz.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {quiz.subject} · {quiz.questionCount} questions
          </p>
        </div>
        <p className="text-sm text-slate-600">
          All student submissions will also be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 text-sm font-bold text-slate-700 border-2 border-slate-200 hover:bg-slate-50 py-3 rounded-xl transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 py-3 rounded-xl transition-all"
          >
            {deleting ? (
              <>
                <Spinner sm />
                Deleting…
              </>
            ) : (
              "🗑️ Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Card ────────────────────────────────────────────────────────────────
function QuizCard({
  quiz,
  onEdit,
  onDelete,
  onViewSubmissions,
}: {
  quiz: Quiz;
  onEdit: (q: Quiz) => void;
  onDelete: (q: Quiz) => void;
  onViewSubmissions: (q: Quiz) => void;
}) {
  const levelColors: Record<string, string> = {
    "SHS 1": "bg-blue-100 text-blue-700",
    "SHS 2": "bg-indigo-100 text-indigo-700",
    "SHS 3": "bg-violet-100 text-violet-700",
    All: "bg-green-100 text-green-700",
  };
  const statusCfg: Record<QuizStatus, { label: string; cls: string }> = {
    published: { label: "Published", cls: "bg-green-100 text-green-700" },
    draft: { label: "Draft", cls: "bg-amber-100 text-amber-700" },
    closed: { label: "Closed", cls: "bg-slate-100 text-slate-600" },
  };
  const dueBadge: Record<string, string> = {
    overdue: "bg-red-100 text-red-700",
    today: "bg-orange-100 text-orange-700",
    soon: "bg-amber-100 text-amber-700",
    normal: "bg-slate-100 text-slate-600",
  };

  const due = formatDueDate(quiz.dueDate);
  const sc = statusCfg[quiz.status] ?? statusCfg.published;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
      <div className="h-1 bg-linear-to-r from-emerald-500 to-teal-500" />
      <div className="p-4 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg shrink-0">
            🧩
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
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${levelColors[quiz.classLevel] ?? "bg-slate-100 text-slate-600"}`}
          >
            {quiz.classLevel}
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${sc.cls}`}
          >
            {sc.label}
          </span>
        </div>

        {/* Question breakdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            {quiz.mcqCount} MCQ
          </span>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
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
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${dueBadge[due.badge]}`}
          >
            📅 {due.label}
          </span>
          {quiz.allowLateSubmission && (
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
              Late allowed
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              👁 <span className="font-semibold">{quiz.views}</span>
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              📝 <span className="font-semibold">{quiz.submissionsCount}</span>{" "}
              submitted
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {formatDate(quiz.createdAt)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-slate-50">
          <button
            onClick={() => onViewSubmissions(quiz)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 py-2 rounded-xl transition-colors"
          >
            📊 Submissions
          </button>
          <button
            onClick={() => onEdit(quiz)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-xl transition-colors"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => onDelete(quiz)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-xl transition-colors"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InstructorQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editQuiz, setEditQuiz] = useState<QuizFull | undefined>(undefined);
  const [deleteQuiz, setDeleteQuiz] = useState<Quiz | undefined>(undefined);
  const [gradingQuizId, setGradingQuizId] = useState<string | undefined>(
    undefined,
  );
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterSubject, filterClass, filterStatus, sort]);

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
        sort,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filterSubject && { subject: filterSubject }),
        ...(filterClass && { classLevel: filterClass }),
        ...(filterStatus && { status: filterStatus }),
      });
      const res = await fetch(`/api/quiz?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setQuizzes(data.data);
      setPagination(data.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load quizzes.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, filterSubject, filterClass, filterStatus]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // Load full quiz data for editing (includes questions with answers)
  const handleEditClick = async (quiz: Quiz) => {
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/quiz/${quiz._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setEditQuiz(data.data);
      setShowModal(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to load quiz details.");
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleSaved = (saved: Quiz) => {
    setShowModal(false);
    setEditQuiz(undefined);
    if (editQuiz) {
      setQuizzes((prev) =>
        prev.map((q) => (q._id === saved._id ? { ...q, ...saved } : q)),
      );
    } else {
      setQuizzes((prev) => [saved, ...prev]);
      setPagination((prev) =>
        prev ? { ...prev, total: prev.total + 1 } : prev,
      );
    }
  };

  const handleDeleted = (id: string) => {
    setDeleteQuiz(undefined);
    setQuizzes((prev) => prev.filter((q) => q._id !== id));
    setPagination((prev) =>
      prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev,
    );
  };

  const isFiltered = !!(
    debouncedSearch ||
    filterSubject ||
    filterClass ||
    filterStatus
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
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
              {pagination
                ? `${pagination.total} quiz${pagination.total !== 1 ? "zes" : ""}`
                : "Create MCQ and theory quizzes for students"}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditQuiz(undefined);
            setShowModal(true);
          }}
          disabled={loadingEdit}
          className="flex items-center gap-2 bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all text-sm shrink-0 disabled:opacity-60"
        >
          {loadingEdit ? <Spinner sm /> : null}+ Create Quiz
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
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
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-all min-w-36"
        >
          <option value="">All Classes</option>
          {CLASS_LEVELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-all min-w-36"
        >
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-all min-w-36"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="title">Title A–Z</option>
          <option value="dueDate">Due Date</option>
        </select>
        {isFiltered && (
          <button
            onClick={() => {
              setSearch("");
              setFilterSubject("");
              setFilterClass("");
              setFilterStatus("");
              setSort("newest");
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
      ) : quizzes.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((q) => (
            <QuizCard
              key={q._id}
              quiz={q}
              onEdit={handleEditClick}
              onDelete={(q) => setDeleteQuiz(q)}
              onViewSubmissions={(q) => setGradingQuizId(q._id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3.5">
          <p className="text-xs text-slate-500 font-medium">
            Showing{" "}
            <span className="font-bold text-slate-800">
              {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of{" "}
            <span className="font-bold text-slate-800">{pagination.total}</span>{" "}
            quizzes
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ‹
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === pagination.totalPages ||
                  Math.abs(p - pagination.page) <= 1,
              )
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1)
                  acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span
                    key={`e-${i}`}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${pagination.page === p ? "bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-md" : "border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"}`}
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="w-8 h-8 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <QuizModal
          mode={editQuiz ? "edit" : "create"}
          quiz={editQuiz}
          onClose={() => {
            setShowModal(false);
            setEditQuiz(undefined);
          }}
          onSaved={handleSaved}
        />
      )}
      {deleteQuiz && (
        <DeleteConfirm
          quiz={deleteQuiz}
          onClose={() => setDeleteQuiz(undefined)}
          onDeleted={handleDeleted}
        />
      )}
      {gradingQuizId && (
        <GradingModal
          quizId={gradingQuizId}
          onClose={() => {
            setGradingQuizId(undefined);
            fetchQuizzes();
          }}
        />
      )}
    </div>
  );
}
