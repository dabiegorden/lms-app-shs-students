import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { courses } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";
import {
  extractYouTubeId,
  computeCourseTotals,
  normalizeSections,
} from "@/lib/course-utils";

const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "courses");
const UPLOAD_URL_BASE = "/uploads/courses";
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

async function deleteFile(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (e: any) {
    if (e.code !== "ENOENT") console.warn("[FILE DELETE WARN]", e.message);
  }
}

// ─── GET /api/course/[id] ─────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { id } = await params;

    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.instructorId, auth.userId)))
      .limit(1);

    if (!course)
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 },
      );

    const { thumbnailPath: _tp, ...safe } = course;
    return NextResponse.json(
      { success: true, data: toLegacy(safe) },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET COURSE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch course." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/course/[id] ───────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { id } = await params;

    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.instructorId, auth.userId)))
      .limit(1);

    if (!course)
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 },
      );

    const formData = await req.formData();

    const title = formData.get("title") as string | null;
    const subject = formData.get("subject") as string | null;
    const description = formData.get("description") as string | null;
    const overview = formData.get("overview") as string | null;
    const topic = formData.get("topic") as string | null;
    const classLevel = formData.get("classLevel") as string | null;
    const language = formData.get("language") as string | null;
    const level = formData.get("level") as string | null;
    const status = formData.get("status") as string | null;
    const certificateEnabledRaw = formData.get("certificateEnabled") as
      | string
      | null;
    const previewVideoUrl = formData.get("previewVideoUrl") as string | null;
    const removeThumbnail = formData.get("removeThumbnail") === "true";
    const thumbnail = formData.get("thumbnail") as File | null;
    const sectionsRaw = formData.get("sections") as string | null;

    const safeParseArray = (
      val: FormDataEntryValue | null,
    ): string[] | null => {
      if (val === null) return null;
      try {
        return JSON.parse(val as string);
      } catch {
        return null;
      }
    };
    const whatYouWillLearn = safeParseArray(formData.get("whatYouWillLearn"));
    const requirements = safeParseArray(formData.get("requirements"));
    const targetAudience = safeParseArray(formData.get("targetAudience"));

    const updates: Partial<typeof courses.$inferInsert> = {};

    // ── Apply text patches ───────────────────────────────────────────────────
    if (title?.trim()) updates.title = title.trim();
    if (subject?.trim()) updates.subject = subject.trim();
    if (description !== null) updates.description = description.trim();
    if (overview !== null) updates.overview = overview.trim();
    if (topic !== null) updates.topic = topic.trim();
    if (classLevel) updates.classLevel = classLevel as any;
    if (language) updates.language = language;
    if (level) updates.level = level as any;
    if (status) updates.status = status as any;
    if (certificateEnabledRaw !== null)
      updates.certificateEnabled = certificateEnabledRaw !== "false";
    if (whatYouWillLearn) updates.whatYouWillLearn = whatYouWillLearn;
    if (requirements) updates.requirements = requirements;
    if (targetAudience) updates.targetAudience = targetAudience;

    if (previewVideoUrl !== null) {
      const trimmed = previewVideoUrl.trim();
      updates.previewVideoUrl = trimmed || null;
      updates.previewVideoId = trimmed ? extractYouTubeId(trimmed) : null;
    }

    // ── Thumbnail handling ───────────────────────────────────────────────────
    if (removeThumbnail && (!thumbnail || thumbnail.size === 0)) {
      if (course.thumbnailPath) await deleteFile(course.thumbnailPath);
      updates.thumbnailUrl = null;
      updates.thumbnailPath = null;
    }

    if (thumbnail && thumbnail.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.includes(thumbnail.type)) {
        return NextResponse.json(
          { success: false, message: "Thumbnail must be JPEG, PNG, or WebP." },
          { status: 400 },
        );
      }
      if (thumbnail.size > MAX_THUMBNAIL_SIZE) {
        return NextResponse.json(
          { success: false, message: "Thumbnail must be smaller than 5MB." },
          { status: 400 },
        );
      }
      if (course.thumbnailPath) await deleteFile(course.thumbnailPath);
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const ext = thumbnail.name.split(".").pop() ?? "jpg";
      const uniqueName = `${Date.now()}-${auth.userId}.${ext}`;
      const absolutePath = path.join(UPLOAD_DIR, uniqueName);
      await fs.writeFile(
        absolutePath,
        new Uint8Array(await thumbnail.arrayBuffer()),
      );
      updates.thumbnailUrl = `${UPLOAD_URL_BASE}/${uniqueName}`;
      updates.thumbnailPath = absolutePath;
    }

    // ── Replace curriculum if sections provided ──────────────────────────────
    if (sectionsRaw) {
      let parsedSections: any[];
      try {
        parsedSections = JSON.parse(sectionsRaw);
      } catch {
        return NextResponse.json(
          { success: false, message: "Invalid sections JSON." },
          { status: 400 },
        );
      }

      const sections = normalizeSections(parsedSections);
      const totals = computeCourseTotals(sections);
      updates.sections = sections;
      updates.totalLessons = totals.totalLessons;
      updates.totalDurationSeconds = totals.totalDurationSeconds;
    }

    const [updated] = await db
      .update(courses)
      .set(updates)
      .where(eq(courses.id, course.id))
      .returning();

    const { thumbnailPath: _tp, ...safe } = updated;
    return NextResponse.json(
      {
        success: true,
        message: "Course updated successfully.",
        data: toLegacy(safe),
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[PATCH COURSE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update course." },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/course/[id] ──────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { id } = await params;

    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.instructorId, auth.userId)))
      .limit(1);

    if (!course)
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 },
      );

    if (course.thumbnailPath) await deleteFile(course.thumbnailPath);
    await db.delete(courses).where(eq(courses.id, id));

    return NextResponse.json(
      { success: true, message: "Course deleted successfully." },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[DELETE COURSE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete course." },
      { status: 500 },
    );
  }
}
