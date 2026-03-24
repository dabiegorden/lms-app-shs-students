import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Course from "@/models/Course";

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

// ─── YouTube video ID extractor ───────────────────────────────────────────────
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // raw ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ─── Format seconds to "Xh Ym" ───────────────────────────────────────────────
export function formatDuration(seconds: number): string {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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

    await connectDB();

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
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { instructor: auth.userId };
    if (search) query.$text = { $search: search };
    if (subject) query.subject = { $regex: subject, $options: "i" };
    if (classLevel) query.classLevel = classLevel;
    if (status) query.status = status;
    if (level) query.level = level;

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title: { title: 1 },
      popular: { enrollmentsCount: -1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.newest;

    const [courses, total] = await Promise.all([
      Course.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        // Exclude sections detail from list view — too heavy
        .select("-sections -thumbnailPath -overview")
        .lean(),
      Course.countDocuments(query),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: courses,
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
// Body: multipart/form-data
//   title              (required)
//   subject            (required)
//   description        (required, tagline ≤ 300)
//   overview           (optional, long description)
//   topic              (optional)
//   classLevel         (optional, default "All")
//   language           (optional, default "English")
//   level              (optional, default "All Levels")
//   status             (optional, default "draft")
//   certificateEnabled (optional, "true"|"false")
//   previewVideoUrl    (optional, YouTube URL)
//   whatYouWillLearn   (optional, JSON array string)
//   requirements       (optional, JSON array string)
//   targetAudience     (optional, JSON array string)
//   thumbnail          (optional, image file ≤ 5MB)
export async function POST(req: NextRequest) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Instructor access only." },
        { status: 401 },
      );
    }

    await connectDB();

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

    // Parse array fields (sent as JSON strings)
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

    // ── Extract YouTube preview ID ─────────────────────────────────────────
    const previewVideoId = previewVideoUrl
      ? extractYouTubeId(previewVideoUrl)
      : null;

    const course = await Course.create({
      title,
      subject,
      description,
      overview,
      topic,
      classLevel,
      language,
      level,
      status,
      certificateEnabled,
      previewVideoUrl: previewVideoUrl || null,
      previewVideoId,
      thumbnailUrl,
      thumbnailPath,
      whatYouWillLearn,
      requirements,
      targetAudience,
      instructor: auth.userId,
      sections: [],
    });

    return NextResponse.json(
      {
        success: true,
        message: "Course created successfully.",
        data: _publicCourse(course),
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

// ─── Strip server-only fields ─────────────────────────────────────────────────
export function _publicCourse(course: any) {
  const obj = course.toObject ? course.toObject() : course;
  const { thumbnailPath: _tp, ...rest } = obj;
  return rest;
}
