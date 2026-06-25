import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ───────────────────────────────────────────────────────────────────────────
 * Embedded (JSONB) sub-document shapes
 *
 * These mirror the Mongoose sub-schemas. Because they were embedded arrays in
 * MongoDB and are always read/written together with their parent document, we
 * keep them as JSONB columns rather than over-normalising into extra tables.
 * Each embedded item carries its own `id` (string) so the existing front-end
 * logic that references sub-document ids keeps working.
 * ──────────────────────────────────────────────────────────────────────────*/

export type Attachment = {
  publicId: string;
  url: string;
  originalName: string;
  resourceType: "image" | "video" | "raw";
  format: string;
  bytes: number;
  width?: number;
  height?: number;
};

export type Lesson = {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  durationSeconds: number;
  order: number;
  isFree: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Section = {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
  isPublished: boolean;
};

export type LessonProgress = {
  lessonId: string;
  sectionId: string;
  completedAt: string | null;
  watchedSeconds: number;
  isCompleted: boolean;
};

export type MCQOption = { label: "A" | "B" | "C" | "D" | "E"; text: string };

export type Question = {
  id: string;
  type: "mcq" | "theory";
  text: string;
  marks: number;
  options: MCQOption[];
  correctOption: "A" | "B" | "C" | "D" | "E" | null;
  modelAnswer: string;
  order: number;
};

export type AnswerEntry = {
  questionId: string;
  questionType: "mcq" | "theory";
  selectedOption: "A" | "B" | "C" | "D" | "E" | null;
  isCorrect: boolean | null;
  theoryAnswer: string;
  autoMark: number | null;
  instructorMark: number | null;
  maxMarks: number;
  instructorFeedback: string;
};

export type ActivityRecord = {
  type: "quiz" | "assignment";
  refId: string;
  submissionId: string;
  title: string;
  subject: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
  gradedAt: string | null;
};

export type SubjectStats = {
  subject: string;
  totalActivities: number;
  totalScore: number;
  totalMaxScore: number;
  averagePercentage: number;
  quizCount: number;
  assignmentCount: number;
};

/* ───────────────────────────────────────────────────────────────────────────
 * users
 * ──────────────────────────────────────────────────────────────────────────*/

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    password: text("password").notNull(),
    role: text("role", { enum: ["student", "instructor"] })
      .notNull()
      .default("student"),
    // Student-only fields
    school: text("school"),
    classLevel: text("class_level"),
    programme: text("programme"),
    // Profile
    profilePicture: text("profile_picture").default(""),
    profilePicturePublicId: text("profile_picture_public_id").default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

/* ───────────────────────────────────────────────────────────────────────────
 * courses
 * ──────────────────────────────────────────────────────────────────────────*/

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").default(""),
    overview: text("overview").default(""),
    subject: text("subject").notNull(),
    topic: text("topic").default(""),
    classLevel: text("class_level", {
      enum: ["SHS 1", "SHS 2", "SHS 3", "All"],
    })
      .notNull()
      .default("All"),
    language: text("language").notNull().default("English"),

    thumbnailUrl: text("thumbnail_url"),
    thumbnailPath: text("thumbnail_path"),
    previewVideoUrl: text("preview_video_url"),
    previewVideoId: text("preview_video_id"),

    sections: jsonb("sections").$type<Section[]>().notNull().default([]),
    totalLessons: integer("total_lessons").notNull().default(0),
    totalDurationSeconds: integer("total_duration_seconds")
      .notNull()
      .default(0),

    whatYouWillLearn: jsonb("what_you_will_learn")
      .$type<string[]>()
      .notNull()
      .default([]),
    requirements: jsonb("requirements").$type<string[]>().notNull().default([]),
    targetAudience: jsonb("target_audience")
      .$type<string[]>()
      .notNull()
      .default([]),

    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    level: text("level", {
      enum: ["Beginner", "Intermediate", "Advanced", "All Levels"],
    })
      .notNull()
      .default("All Levels"),
    certificateEnabled: boolean("certificate_enabled").notNull().default(true),

    enrollmentsCount: integer("enrollments_count").notNull().default(0),
    ratingsAverage: doublePrecision("ratings_average").notNull().default(0),
    ratingsCount: integer("ratings_count").notNull().default(0),
    views: integer("views").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("courses_slug_unique").on(t.slug),
    index("courses_instructor_created_idx").on(t.instructorId, t.createdAt),
    index("courses_subject_class_status_idx").on(
      t.subject,
      t.classLevel,
      t.status,
    ),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * course_enrollments
 * ──────────────────────────────────────────────────────────────────────────*/

export const courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    lessonProgress: jsonb("lesson_progress")
      .$type<LessonProgress[]>()
      .notNull()
      .default([]),
    completedLessons: integer("completed_lessons").notNull().default(0),
    totalLessons: integer("total_lessons").notNull().default(0),
    progressPercent: doublePrecision("progress_percent").notNull().default(0),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    lastLessonId: text("last_lesson_id"),

    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    certificateIssuedAt: timestamp("certificate_issued_at", {
      withTimezone: true,
    }),
    certificateId: text("certificate_id"),

    rating: integer("rating"),
    review: text("review").default(""),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("enrollments_course_student_unique").on(
      t.courseId,
      t.studentId,
    ),
    index("enrollments_student_enrolled_idx").on(t.studentId, t.enrolledAt),
    index("enrollments_course_completed_idx").on(t.courseId, t.isCompleted),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * assignments
 * ──────────────────────────────────────────────────────────────────────────*/

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    instructions: text("instructions").default(""),
    subject: text("subject").notNull(),
    topic: text("topic").default(""),
    classLevel: text("class_level", {
      enum: ["SHS 1", "SHS 2", "SHS 3", "All"],
    })
      .notNull()
      .default("All"),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    totalMarks: integer("total_marks").notNull().default(100),
    allowLateSubmission: boolean("allow_late_submission")
      .notNull()
      .default(false),

    fileUrl: text("file_url"),
    filePath: text("file_path"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),

    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    views: integer("views").notNull().default(0),
    submissionsCount: integer("submissions_count").notNull().default(0),
    status: text("status", { enum: ["draft", "published", "closed"] })
      .notNull()
      .default("published"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("assignments_instructor_created_idx").on(t.instructorId, t.createdAt),
    index("assignments_subject_class_idx").on(t.subject, t.classLevel),
    index("assignments_due_status_idx").on(t.dueDate, t.status),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * submissions (assignment submissions)
 * ──────────────────────────────────────────────────────────────────────────*/

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    fileUrl: text("file_url"),
    filePath: text("file_path"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    note: text("note").default(""),
    status: text("status", { enum: ["submitted", "graded", "returned"] })
      .notNull()
      .default("submitted"),
    score: doublePrecision("score"),
    feedback: text("feedback"),
    isLate: boolean("is_late").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("submissions_assignment_student_unique").on(
      t.assignmentId,
      t.studentId,
    ),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * lecture_notes
 * ──────────────────────────────────────────────────────────────────────────*/

export const lectureNotes = pgTable(
  "lecture_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").default(""),
    subject: text("subject").notNull(),
    topic: text("topic").default(""),
    classLevel: text("class_level", {
      enum: ["SHS 1", "SHS 2", "SHS 3", "All"],
    })
      .notNull()
      .default("All"),
    fileUrl: text("file_url").notNull(),
    filePath: text("file_path").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    views: integer("views").notNull().default(0),
    downloads: integer("downloads").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("notes_instructor_created_idx").on(t.instructorId, t.createdAt),
    index("notes_subject_class_idx").on(t.subject, t.classLevel),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * quizzes
 * ──────────────────────────────────────────────────────────────────────────*/

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").default(""),
    subject: text("subject").notNull(),
    topic: text("topic").default(""),
    classLevel: text("class_level", {
      enum: ["SHS 1", "SHS 2", "SHS 3", "All"],
    })
      .notNull()
      .default("All"),

    questions: jsonb("questions").$type<Question[]>().notNull().default([]),
    totalMarks: doublePrecision("total_marks").notNull().default(0),

    durationMinutes: integer("duration_minutes"),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    allowLateSubmission: boolean("allow_late_submission")
      .notNull()
      .default(false),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(false),

    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["draft", "published", "closed"] })
      .notNull()
      .default("published"),

    views: integer("views").notNull().default(0),
    submissionsCount: integer("submissions_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("quizzes_instructor_created_idx").on(t.instructorId, t.createdAt),
    index("quizzes_subject_class_idx").on(t.subject, t.classLevel),
    index("quizzes_due_status_idx").on(t.dueDate, t.status),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * quiz_submissions
 * ──────────────────────────────────────────────────────────────────────────*/

export const quizSubmissions = pgTable(
  "quiz_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    answers: jsonb("answers").$type<AnswerEntry[]>().notNull().default([]),

    mcqScore: doublePrecision("mcq_score").notNull().default(0),
    theoryScore: doublePrecision("theory_score").notNull().default(0),
    totalScore: doublePrecision("total_score").notNull().default(0),
    maxPossibleScore: doublePrecision("max_possible_score")
      .notNull()
      .default(0),

    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    gradingStatus: text("grading_status", {
      enum: ["pending", "partially_graded", "graded"],
    })
      .notNull()
      .default("pending"),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    gradedBy: uuid("graded_by").references(() => users.id, {
      onDelete: "set null",
    }),

    overallFeedback: text("overall_feedback").default(""),
    resultReleased: boolean("result_released").notNull().default(false),

    startedAt: timestamp("started_at", { withTimezone: true }),
    timeTakenSeconds: integer("time_taken_seconds"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("quiz_submissions_quiz_student_unique").on(
      t.quizId,
      t.studentId,
    ),
    index("quiz_submissions_quiz_status_idx").on(t.quizId, t.gradingStatus),
    index("quiz_submissions_student_submitted_idx").on(
      t.studentId,
      t.submittedAt,
    ),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * announcements
 * ──────────────────────────────────────────────────────────────────────────*/

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    attachments: jsonb("attachments")
      .$type<Attachment[]>()
      .notNull()
      .default([]),

    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", {
      enum: ["all", "class", "subject", "course"],
    })
      .notNull()
      .default("all"),
    targetClassLevel: jsonb("target_class_level")
      .$type<string[]>()
      .notNull()
      .default([]),
    targetSubjects: jsonb("target_subjects")
      .$type<string[]>()
      .notNull()
      .default([]),
    targetCourses: jsonb("target_courses")
      .$type<string[]>()
      .notNull()
      .default([]),

    isPinned: boolean("is_pinned").notNull().default(false),
    allowComments: boolean("allow_comments").notNull().default(true),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("published"),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    viewsCount: integer("views_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    likesCount: integer("likes_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("announcements_instructor_created_idx").on(
      t.instructorId,
      t.createdAt,
    ),
    index("announcements_instructor_pinned_idx").on(
      t.instructorId,
      t.isPinned,
      t.createdAt,
    ),
    index("announcements_status_target_idx").on(t.status, t.targetType),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * announcement_comments
 * ──────────────────────────────────────────────────────────────────────────*/

export const announcementComments = pgTable(
  "announcement_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorRole: text("author_role", {
      enum: ["student", "instructor"],
    }).notNull(),

    body: text("body").default(""),
    attachments: jsonb("attachments")
      .$type<Attachment[]>()
      .notNull()
      .default([]),

    parentCommentId: uuid("parent_comment_id"),
    repliesCount: integer("replies_count").notNull().default(0),

    likes: jsonb("likes").$type<string[]>().notNull().default([]),
    likesCount: integer("likes_count").notNull().default(0),

    isEdited: boolean("is_edited").notNull().default(false),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    isDeleted: boolean("is_deleted").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("comments_announcement_parent_created_idx").on(
      t.announcementId,
      t.parentCommentId,
      t.createdAt,
    ),
    index("comments_author_idx").on(t.authorId),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * performances
 * ──────────────────────────────────────────────────────────────────────────*/

export const performances = pgTable(
  "performances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    totalActivities: integer("total_activities").notNull().default(0),
    totalScore: doublePrecision("total_score").notNull().default(0),
    totalMaxScore: doublePrecision("total_max_score").notNull().default(0),
    overallPercentage: doublePrecision("overall_percentage")
      .notNull()
      .default(0),

    quizCount: integer("quiz_count").notNull().default(0),
    quizTotalScore: doublePrecision("quiz_total_score").notNull().default(0),
    quizTotalMaxScore: doublePrecision("quiz_total_max_score")
      .notNull()
      .default(0),
    quizAveragePercentage: doublePrecision("quiz_average_percentage")
      .notNull()
      .default(0),

    assignmentCount: integer("assignment_count").notNull().default(0),
    assignmentTotalScore: doublePrecision("assignment_total_score")
      .notNull()
      .default(0),
    assignmentTotalMaxScore: doublePrecision("assignment_total_max_score")
      .notNull()
      .default(0),
    assignmentAveragePercentage: doublePrecision(
      "assignment_average_percentage",
    )
      .notNull()
      .default(0),

    subjectStats: jsonb("subject_stats")
      .$type<SubjectStats[]>()
      .notNull()
      .default([]),
    recentActivity: jsonb("recent_activity")
      .$type<ActivityRecord[]>()
      .notNull()
      .default([]),

    aiInsight: text("ai_insight").default(""),
    aiInsightGeneratedAt: timestamp("ai_insight_generated_at", {
      withTimezone: true,
    }),

    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("performances_student_instructor_unique").on(
      t.studentId,
      t.instructorId,
    ),
    index("performances_instructor_overall_idx").on(
      t.instructorId,
      t.overallPercentage,
    ),
    index("performances_instructor_lastactivity_idx").on(
      t.instructorId,
      t.lastActivityAt,
    ),
  ],
);

/* ───────────────────────────────────────────────────────────────────────────
 * Relations
 * ──────────────────────────────────────────────────────────────────────────*/

export const usersRelations = relations(users, ({ many }) => ({
  courses: many(courses),
  enrollments: many(courseEnrollments),
  assignments: many(assignments),
  submissions: many(submissions),
  lectureNotes: many(lectureNotes),
  quizzes: many(quizzes),
  quizSubmissions: many(quizSubmissions),
  announcements: many(announcements),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
  }),
  enrollments: many(courseEnrollments),
}));

export const courseEnrollmentsRelations = relations(
  courseEnrollments,
  ({ one }) => ({
    course: one(courses, {
      fields: [courseEnrollments.courseId],
      references: [courses.id],
    }),
    student: one(users, {
      fields: [courseEnrollments.studentId],
      references: [users.id],
    }),
  }),
);

export const assignmentsRelations = relations(
  assignments,
  ({ one, many }) => ({
    instructor: one(users, {
      fields: [assignments.instructorId],
      references: [users.id],
    }),
    submissions: many(submissions),
  }),
);

export const submissionsRelations = relations(submissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [submissions.studentId],
    references: [users.id],
  }),
}));

export const lectureNotesRelations = relations(lectureNotes, ({ one }) => ({
  instructor: one(users, {
    fields: [lectureNotes.instructorId],
    references: [users.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  instructor: one(users, {
    fields: [quizzes.instructorId],
    references: [users.id],
  }),
  submissions: many(quizSubmissions),
}));

export const quizSubmissionsRelations = relations(
  quizSubmissions,
  ({ one }) => ({
    quiz: one(quizzes, {
      fields: [quizSubmissions.quizId],
      references: [quizzes.id],
    }),
    student: one(users, {
      fields: [quizSubmissions.studentId],
      references: [users.id],
    }),
  }),
);

export const announcementsRelations = relations(
  announcements,
  ({ one, many }) => ({
    instructor: one(users, {
      fields: [announcements.instructorId],
      references: [users.id],
    }),
    comments: many(announcementComments),
  }),
);

export const announcementCommentsRelations = relations(
  announcementComments,
  ({ one }) => ({
    announcement: one(announcements, {
      fields: [announcementComments.announcementId],
      references: [announcements.id],
    }),
    author: one(users, {
      fields: [announcementComments.authorId],
      references: [users.id],
    }),
  }),
);

export const performancesRelations = relations(performances, ({ one }) => ({
  student: one(users, {
    fields: [performances.studentId],
    references: [users.id],
  }),
  instructor: one(users, {
    fields: [performances.instructorId],
    references: [users.id],
  }),
}));

/* ───────────────────────────────────────────────────────────────────────────
 * Inferred types
 * ──────────────────────────────────────────────────────────────────────────*/

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type CourseEnrollment = typeof courseEnrollments.$inferSelect;
export type NewCourseEnrollment = typeof courseEnrollments.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type LectureNote = typeof lectureNotes.$inferSelect;
export type NewLectureNote = typeof lectureNotes.$inferInsert;
export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;
export type QuizSubmission = typeof quizSubmissions.$inferSelect;
export type NewQuizSubmission = typeof quizSubmissions.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type AnnouncementComment = typeof announcementComments.$inferSelect;
export type NewAnnouncementComment = typeof announcementComments.$inferInsert;
export type Performance = typeof performances.$inferSelect;
export type NewPerformance = typeof performances.$inferInsert;

// Re-export sql for convenience in raw expressions across the codebase
export { sql };
