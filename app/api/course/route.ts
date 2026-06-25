import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { courses } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy, toLegacyList } from "@/lib/serialize";
import {
  extractYouTubeId,
  formatDuration,
  generateSlug,
} from "@/lib/course-utils";

// Re-export so existing importers keep working
export { extractYouTubeId, formatDuration };

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "courses");
const UPLOAD_URL_BASE = "/uploads/courses";
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// ─── Strip server-only fields ─────────────────────────────────────────────────
export function _publicCourse(course: any) {
  const { thumbnailPath: _tp, ...rest } = course;
  return rest;
}

// ─── GET /api/course ──────────────────────────────────────────────────────────
// Query params: search, subject, classLevel, status, level, sort, page, limit
export async function GET(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    const classLevel = searchParams.get("classLevel")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";
    const level = searchParams.get("level")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [eq(courses.instructorId, auth.userId)];
    if (search) {
      conditions.push(
        or(
          ilike(courses.title, `%${search}%`),
          ilike(courses.subject, `%${search}%`),
          ilike(courses.topic, `%${search}%`),
          ilike(courses.description, `%${search}%`),
        )!,
      );
    }
    if (subject) conditions.push(ilike(courses.subject, `%${subject}%`));
    if (classLevel) conditions.push(eq(courses.classLevel, classLevel as any));
    if (status) conditions.push(eq(courses.status, status as any));
    if (level) conditions.push(eq(courses.level, level as any));

    const whereClause = and(...conditions);

    const orderByMap: Record<string, any> = {
      newest: desc(courses.createdAt),
      oldest: asc(courses.createdAt),
      title: asc(courses.title),
      popular: desc(courses.enrollmentsCount),
    };
    const orderBy = orderByMap[sort] ?? orderByMap.newest;

    const [fullRows, totalResult] = await Promise.all([
      db
        .select()
        .from(courses)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(courses)
        .where(whereClause),
    ]);

    // List view excludes the heavy sections / overview / server-path columns
    const rows = fullRows.map(
      ({ sections, overview, thumbnailPath, ...rest }) => rest,
    );

    const total = totalResult[0]?.count ?? 0;

    return NextResponse.json(
      {
        success: true,
        data: toLegacyList(rows),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET COURSES ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch courses." },
      { status: 500 },
    );
  }
}

// ─── POST /api/course ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    const formData = await req.formData();

    const title = (formData.get("title") as string)?.trim();
    const subject = (formData.get("subject") as string)?.trim();
    const description =
      (formData.get("description") as string | null)?.trim() ?? "";
    const overview = (formData.get("overview") as string | null)?.trim() ?? "";
    const topic = (formData.get("topic") as string | null)?.trim() ?? "";
    const classLevel =
      (formData.get("classLevel") as string | null)?.trim() || "All";
    const language =
      (formData.get("language") as string | null)?.trim() || "English";
    const level =
      (formData.get("level") as string | null)?.trim() || "All Levels";
    const status = (formData.get("status") as string | null)?.trim() || "draft";
    const certificateEnabled = formData.get("certificateEnabled") !== "false";
    const previewVideoUrl =
      (formData.get("previewVideoUrl") as string | null)?.trim() ?? "";
    const thumbnail = formData.get("thumbnail") as File | null;

    const safeParseArray = (val: FormDataEntryValue | null): string[] => {
      if (!val) return [];
      try {
        return JSON.parse(val as string);
      } catch {
        return [];
      }
    };
    const whatYouWillLearn = safeParseArray(formData.get("whatYouWillLearn"));
    const requirements = safeParseArray(formData.get("requirements"));
    const targetAudience = safeParseArray(formData.get("targetAudience"));

    if (!title || !subject) {
      return NextResponse.json(
        { success: false, message: "Title and subject are required." },
        { status: 400 },
      );
    }

    // ── Handle thumbnail upload ────────────────────────────────────────────
    let thumbnailUrl: string | null = null;
    let thumbnailPath: string | null = null;

    if (thumbnail && thumbnail.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.includes(thumbnail.type)) {
        return NextResponse.json(
          {
            success: false,
            message: "Thumbnail must be a JPEG, PNG, or WebP image.",
          },
          { status: 400 },
        );
      }
      if (thumbnail.size > MAX_THUMBNAIL_SIZE) {
        return NextResponse.json(
          { success: false, message: "Thumbnail must be smaller than 5MB." },
          { status: 400 },
        );
      }
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const ext = thumbnail.name.split(".").pop() ?? "jpg";
      const uniqueName = `${Date.now()}-${auth.userId}.${ext}`;
      const absolutePath = path.join(UPLOAD_DIR, uniqueName);
      const arrayBuffer = await thumbnail.arrayBuffer();
      await fs.writeFile(absolutePath, new Uint8Array(arrayBuffer));
      thumbnailUrl = `${UPLOAD_URL_BASE}/${uniqueName}`;
      thumbnailPath = absolutePath;
    }

    const previewVideoId = previewVideoUrl
      ? extractYouTubeId(previewVideoUrl)
      : null;

    const [course] = await db
      .insert(courses)
      .values({
        title,
        slug: generateSlug(title),
        subject,
        description,
        overview,
        topic,
        classLevel: classLevel as any,
        language,
        level: level as any,
        status: status as any,
        certificateEnabled,
        previewVideoUrl: previewVideoUrl || null,
        previewVideoId,
        thumbnailUrl,
        thumbnailPath,
        whatYouWillLearn,
        requirements,
        targetAudience,
        instructorId: auth.userId,
        sections: [],
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        message: "Course created successfully.",
        data: toLegacy(_publicCourse(course)),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[POST COURSE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to create course." },
      { status: 500 },
    );
  }
}
