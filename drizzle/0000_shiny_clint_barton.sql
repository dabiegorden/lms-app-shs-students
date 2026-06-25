CREATE TABLE "announcement_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"author_role" text NOT NULL,
	"body" text DEFAULT '',
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parent_comment_id" uuid,
	"replies_count" integer DEFAULT 0 NOT NULL,
	"likes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"instructor_id" uuid NOT NULL,
	"target_type" text DEFAULT 'all' NOT NULL,
	"target_class_level" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_courses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"allow_comments" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"published_at" timestamp with time zone,
	"views_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"instructions" text DEFAULT '',
	"subject" text NOT NULL,
	"topic" text DEFAULT '',
	"class_level" text DEFAULT 'All' NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"total_marks" integer DEFAULT 100 NOT NULL,
	"allow_late_submission" boolean DEFAULT false NOT NULL,
	"file_url" text,
	"file_path" text,
	"file_name" text,
	"file_size" integer,
	"instructor_id" uuid NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"submissions_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"lesson_progress" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_lessons" integer DEFAULT 0 NOT NULL,
	"total_lessons" integer DEFAULT 0 NOT NULL,
	"progress_percent" double precision DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"last_lesson_id" text,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"certificate_issued_at" timestamp with time zone,
	"certificate_id" text,
	"rating" integer,
	"review" text DEFAULT '',
	"reviewed_at" timestamp with time zone,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '',
	"overview" text DEFAULT '',
	"subject" text NOT NULL,
	"topic" text DEFAULT '',
	"class_level" text DEFAULT 'All' NOT NULL,
	"language" text DEFAULT 'English' NOT NULL,
	"thumbnail_url" text,
	"thumbnail_path" text,
	"preview_video_url" text,
	"preview_video_id" text,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_lessons" integer DEFAULT 0 NOT NULL,
	"total_duration_seconds" integer DEFAULT 0 NOT NULL,
	"what_you_will_learn" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_audience" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"instructor_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"level" text DEFAULT 'All Levels' NOT NULL,
	"certificate_enabled" boolean DEFAULT true NOT NULL,
	"enrollments_count" integer DEFAULT 0 NOT NULL,
	"ratings_average" double precision DEFAULT 0 NOT NULL,
	"ratings_count" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lecture_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"subject" text NOT NULL,
	"topic" text DEFAULT '',
	"class_level" text DEFAULT 'All' NOT NULL,
	"file_url" text NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"instructor_id" uuid NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"total_activities" integer DEFAULT 0 NOT NULL,
	"total_score" double precision DEFAULT 0 NOT NULL,
	"total_max_score" double precision DEFAULT 0 NOT NULL,
	"overall_percentage" double precision DEFAULT 0 NOT NULL,
	"quiz_count" integer DEFAULT 0 NOT NULL,
	"quiz_total_score" double precision DEFAULT 0 NOT NULL,
	"quiz_total_max_score" double precision DEFAULT 0 NOT NULL,
	"quiz_average_percentage" double precision DEFAULT 0 NOT NULL,
	"assignment_count" integer DEFAULT 0 NOT NULL,
	"assignment_total_score" double precision DEFAULT 0 NOT NULL,
	"assignment_total_max_score" double precision DEFAULT 0 NOT NULL,
	"assignment_average_percentage" double precision DEFAULT 0 NOT NULL,
	"subject_stats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recent_activity" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_insight" text DEFAULT '',
	"ai_insight_generated_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mcq_score" double precision DEFAULT 0 NOT NULL,
	"theory_score" double precision DEFAULT 0 NOT NULL,
	"total_score" double precision DEFAULT 0 NOT NULL,
	"max_possible_score" double precision DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"grading_status" text DEFAULT 'pending' NOT NULL,
	"graded_at" timestamp with time zone,
	"graded_by" uuid,
	"overall_feedback" text DEFAULT '',
	"result_released" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone,
	"time_taken_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"subject" text NOT NULL,
	"topic" text DEFAULT '',
	"class_level" text DEFAULT 'All' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_marks" double precision DEFAULT 0 NOT NULL,
	"duration_minutes" integer,
	"due_date" timestamp with time zone NOT NULL,
	"allow_late_submission" boolean DEFAULT false NOT NULL,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"instructor_id" uuid NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"submissions_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_url" text,
	"file_path" text,
	"file_name" text,
	"file_size" integer,
	"note" text DEFAULT '',
	"status" text DEFAULT 'submitted' NOT NULL,
	"score" double precision,
	"feedback" text,
	"is_late" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"school" text,
	"class_level" text,
	"programme" text,
	"profile_picture" text DEFAULT '',
	"profile_picture_public_id" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lecture_notes" ADD CONSTRAINT "lecture_notes_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_announcement_parent_created_idx" ON "announcement_comments" USING btree ("announcement_id","parent_comment_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "announcement_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "announcements_instructor_created_idx" ON "announcements" USING btree ("instructor_id","created_at");--> statement-breakpoint
CREATE INDEX "announcements_instructor_pinned_idx" ON "announcements" USING btree ("instructor_id","is_pinned","created_at");--> statement-breakpoint
CREATE INDEX "announcements_status_target_idx" ON "announcements" USING btree ("status","target_type");--> statement-breakpoint
CREATE INDEX "assignments_instructor_created_idx" ON "assignments" USING btree ("instructor_id","created_at");--> statement-breakpoint
CREATE INDEX "assignments_subject_class_idx" ON "assignments" USING btree ("subject","class_level");--> statement-breakpoint
CREATE INDEX "assignments_due_status_idx" ON "assignments" USING btree ("due_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_course_student_unique" ON "course_enrollments" USING btree ("course_id","student_id");--> statement-breakpoint
CREATE INDEX "enrollments_student_enrolled_idx" ON "course_enrollments" USING btree ("student_id","enrolled_at");--> statement-breakpoint
CREATE INDEX "enrollments_course_completed_idx" ON "course_enrollments" USING btree ("course_id","is_completed");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_slug_unique" ON "courses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "courses_instructor_created_idx" ON "courses" USING btree ("instructor_id","created_at");--> statement-breakpoint
CREATE INDEX "courses_subject_class_status_idx" ON "courses" USING btree ("subject","class_level","status");--> statement-breakpoint
CREATE INDEX "notes_instructor_created_idx" ON "lecture_notes" USING btree ("instructor_id","created_at");--> statement-breakpoint
CREATE INDEX "notes_subject_class_idx" ON "lecture_notes" USING btree ("subject","class_level");--> statement-breakpoint
CREATE UNIQUE INDEX "performances_student_instructor_unique" ON "performances" USING btree ("student_id","instructor_id");--> statement-breakpoint
CREATE INDEX "performances_instructor_overall_idx" ON "performances" USING btree ("instructor_id","overall_percentage");--> statement-breakpoint
CREATE INDEX "performances_instructor_lastactivity_idx" ON "performances" USING btree ("instructor_id","last_activity_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_submissions_quiz_student_unique" ON "quiz_submissions" USING btree ("quiz_id","student_id");--> statement-breakpoint
CREATE INDEX "quiz_submissions_quiz_status_idx" ON "quiz_submissions" USING btree ("quiz_id","grading_status");--> statement-breakpoint
CREATE INDEX "quiz_submissions_student_submitted_idx" ON "quiz_submissions" USING btree ("student_id","submitted_at");--> statement-breakpoint
CREATE INDEX "quizzes_instructor_created_idx" ON "quizzes" USING btree ("instructor_id","created_at");--> statement-breakpoint
CREATE INDEX "quizzes_subject_class_idx" ON "quizzes" USING btree ("subject","class_level");--> statement-breakpoint
CREATE INDEX "quizzes_due_status_idx" ON "quizzes" USING btree ("due_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_assignment_student_unique" ON "submissions" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");