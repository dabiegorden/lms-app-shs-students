/**
 * Serialization helpers — bridge the gap between the Drizzle/PostgreSQL row
 * shape and the legacy MongoDB/Mongoose JSON shape the front-end was built
 * against.
 *
 * The previous API returned documents with:
 *   - `_id` instead of `id`
 *   - relation fields named `instructor` / `student` / `course` … (holding the
 *     referenced ObjectId or a populated sub-object)
 *   - embedded array items (sections, lessons, questions, answers …) each
 *     carrying their own `_id`
 *
 * Rather than rewrite every front-end component, route handlers pass their
 * rows through `toLegacy()` so responses keep the original contract.
 */

// Foreign-key column → legacy relation field name
const FK_TO_LEGACY: Record<string, string> = {
  instructorId: "instructor",
  studentId: "student",
  courseId: "course",
  assignmentId: "assignment",
  quizId: "quiz",
  announcementId: "announcement",
  authorId: "author",
  parentCommentId: "parentComment",
};

// Embedded JSONB array columns whose items should also expose `_id`
const NESTED_ID_KEYS = [
  "sections",
  "lessons",
  "questions",
  "answers",
  "recentActivity",
  "lessonProgress",
];

function addNestedIds(value: any): any {
  if (Array.isArray(value)) return value.map(addNestedIds);
  if (value && typeof value === "object") {
    const out: any = { ...value };
    if (typeof out.id === "string" && out._id === undefined) out._id = out.id;
    for (const key of NESTED_ID_KEYS) {
      if (Array.isArray(out[key])) out[key] = out[key].map(addNestedIds);
    }
    return out;
  }
  return value;
}

/**
 * Convert a single Drizzle row to the legacy JSON shape.
 * - copies `id` → `_id`
 * - renames foreign-key columns to their legacy relation name (only when the
 *   value is still a raw id string; if the route already attached a populated
 *   object under the legacy name, that object is preserved)
 * - recursively exposes `_id` on known embedded arrays
 */
export function toLegacy<T extends Record<string, any>>(row: T): any {
  if (!row || typeof row !== "object") return row;

  const out: Record<string, any> = {};

  // Pass 1: copy every column (normalising nested arrays); keep *Id columns.
  for (const [key, rawValue] of Object.entries(row)) {
    out[key] = NESTED_ID_KEYS.includes(key)
      ? addNestedIds(rawValue)
      : rawValue;
  }

  // Pass 2: project foreign-key columns onto their legacy relation name,
  // without clobbering a populated object the route already supplied.
  for (const [fkKey, legacyName] of Object.entries(FK_TO_LEGACY)) {
    if (out[fkKey] !== undefined && out[legacyName] === undefined) {
      out[legacyName] = out[fkKey];
    }
  }

  if (out.id !== undefined && out._id === undefined) out._id = out.id;

  return out;
}

export function toLegacyList<T extends Record<string, any>>(rows: T[]): any[] {
  return rows.map((r) => toLegacy(r));
}
