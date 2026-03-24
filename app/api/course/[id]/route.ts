import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Course from "@/models/Course";
import { extractYouTubeId } from "../route";

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
// Returns full course including sections/lessons with correctOption-equivalent data
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
    await connectDB();

    const course = await Course.findOne({
      _id: id,
      instructor: auth.userId,
    }).lean();
    if (!course)
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 },
      );

    const { thumbnailPath: _tp, ...safe } = course as any;
    return NextResponse.json({ success: true, data: safe }, { status: 200 });
  } catch (error: any) {
    console.error("[GET COURSE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch course." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/course/[id] ───────────────────────────────────────────────────
// Body: multipart/form-data
// Sending `sections` (JSON string) replaces the entire curriculum.
// All other fields are optional patches.
// Send removeThumbnail="true" to remove the existing image.
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
    await connectDB();

    const course = await Course.findOne({ _id: id, instructor: auth.userId });
    if (!course)
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 },
      );

    const formData = await req.formData();

    // ── Text fields ──────────────────────────────────────────────────────────
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

    // Parse array fields
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

    // ── Apply text patches ───────────────────────────────────────────────────
    if (title?.trim()) course.title = title.trim();
    if (subject?.trim()) course.subject = subject.trim();
    if (description !== null) course.description = description.trim();
    if (overview !== null) course.overview = overview.trim();
    if (topic !== null) course.topic = topic.trim();
    if (classLevel) course.classLevel = classLevel as any;
    if (language) course.language = language;
    if (level) course.level = level as any;
    if (status) course.status = status as any;
    if (certificateEnabledRaw !== null)
      course.certificateEnabled = certificateEnabledRaw !== "false";
    if (whatYouWillLearn) course.whatYouWillLearn = whatYouWillLearn;
    if (requirements) course.requirements = requirements;
    if (targetAudience) course.targetAudience = targetAudience;

    if (previewVideoUrl !== null) {
      course.previewVideoUrl = previewVideoUrl.trim() || null;
      course.previewVideoId = previewVideoUrl.trim()
        ? extractYouTubeId(previewVideoUrl.trim())
        : null;
    }

    // ── Thumbnail handling ───────────────────────────────────────────────────
    if (removeThumbnail && (!thumbnail || thumbnail.size === 0)) {
      if (course.thumbnailPath) await deleteFile(course.thumbnailPath);
      course.thumbnailUrl = null;
      course.thumbnailPath = null;
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
      course.thumbnailUrl = `${UPLOAD_URL_BASE}/${uniqueName}`;
      course.thumbnailPath = absolutePath;
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

      course.sections = parsedSections.map((sec: any, sIdx: number) => ({
        title: sec.title?.trim() ?? `Section ${sIdx + 1}`,
        description: sec.description?.trim() ?? "",
        order: sec.order ?? sIdx,
        isPublished: sec.isPublished !== false,
        lessons: (sec.lessons ?? []).map((les: any, lIdx: number) => {
          const youtubeUrl = les.youtubeUrl?.trim() ?? "";
          const youtubeVideoId =
            les.youtubeVideoId?.trim() ||
            (youtubeUrl ? (extractYouTubeId(youtubeUrl) ?? "") : "");
          return {
            title: les.title?.trim() ?? `Lesson ${lIdx + 1}`,
            description: les.description?.trim() ?? "",
            youtubeUrl,
            youtubeVideoId,
            durationSeconds: Number(les.durationSeconds) || 0,
            order: les.order ?? lIdx,
            isFree: Boolean(les.isFree),
            isPublished: les.isPublished !== false,
          };
        }),
      }));
    }

    await course.save(); // triggers pre-save total recomputation

    const { thumbnailPath: _tp, ...safe } = course.toObject();
    return NextResponse.json(
      { success: true, message: "Course updated successfully.", data: safe },
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
    await connectDB();

    const course = await Course.findOne({ _id: id, instructor: auth.userId });
    if (!course)
      return NextResponse.json(
        { success: false, message: "Course not found." },
        { status: 404 },
      );

    if (course.thumbnailPath) await deleteFile(course.thumbnailPath);
    await Course.deleteOne({ _id: id });

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
