import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Announcement from "@/models/Announcement";
import { uploadManyToCloudinary, ALLOWED_TYPES } from "@/lib/Cloudinaryupload";

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

// Any authenticated user (instructor OR student) can read announcements
function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET /api/announcement ─────────────────────────────────────────────────────
// Query params:
//   search      – free-text (title / body)
//   status      – "draft" | "published"
//   targetType  – "all" | "class" | "subject" | "course"
//   isPinned    – "true" | "false"
//   page        – default 1
//   limit       – default 15, max 50
//   sort        – "newest" | "oldest" | "pinned"
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";
    const targetType = searchParams.get("targetType")?.trim() ?? "";
    const isPinned = searchParams.get("isPinned")?.trim() ?? "";
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "15", 10)),
    );
    const skip = (page - 1) * limit;

    // Instructors only see their own; students see all published ones
    const query: Record<string, any> =
      auth.role === "instructor"
        ? { instructor: auth.userId }
        : { status: "published" };

    if (search) query.$text = { $search: search };
    if (status && auth.role === "instructor") query.status = status;
    if (targetType) query.targetType = targetType;
    if (isPinned === "true") query.isPinned = true;
    if (isPinned === "false") query.isPinned = false;

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      newest: { isPinned: -1, createdAt: -1 },
      oldest: { isPinned: -1, createdAt: 1 },
      pinned: { isPinned: -1, createdAt: -1 },
      popular: { commentsCount: -1, createdAt: -1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.newest;

    const [announcements, total] = await Promise.all([
      Announcement.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate("instructor", "name email avatar")
        .lean(),
      Announcement.countDocuments(query),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: announcements,
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
    console.error("[GET ANNOUNCEMENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch announcements." },
      { status: 500 },
    );
  }
}

// ─── POST /api/announcement ────────────────────────────────────────────────────
// Body: multipart/form-data
//   title             (required)
//   body              (required)
//   status            (optional, default "published")
//   isPinned          (optional, "true"|"false")
//   allowComments     (optional, "true"|"false", default "true")
//   targetType        (optional, default "all")
//   targetClassLevel  (optional, JSON array string)
//   targetSubjects    (optional, JSON array string)
//   targetCourses     (optional, JSON array string of IDs)
//   files             (optional, up to 5 files, 25MB each)
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
    const body = (formData.get("body") as string)?.trim();
    const status =
      (formData.get("status") as string | null)?.trim() || "published";
    const isPinned = formData.get("isPinned") === "true";
    const allowComments = formData.get("allowComments") !== "false";
    const targetType =
      (formData.get("targetType") as string | null)?.trim() || "all";

    const safeParseArray = (val: FormDataEntryValue | null): string[] => {
      if (!val) return [];
      try {
        return JSON.parse(val as string);
      } catch {
        return [];
      }
    };

    const targetClassLevel = safeParseArray(formData.get("targetClassLevel"));
    const targetSubjects = safeParseArray(formData.get("targetSubjects"));
    const targetCourses = safeParseArray(formData.get("targetCourses"));
    const files = formData.getAll("files") as File[];

    // ── Validate ────────────────────────────────────────────────────────────
    if (!title) {
      return NextResponse.json(
        { success: false, message: "Title is required." },
        { status: 400 },
      );
    }
    if (!body) {
      return NextResponse.json(
        { success: false, message: "Body is required." },
        { status: 400 },
      );
    }

    // Validate file types before uploading
    const validFiles = files.filter((f) => f.size > 0);
    for (const file of validFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            success: false,
            message: `"${file.name}" is not a supported file type.`,
          },
          { status: 400 },
        );
      }
    }

    // ── Upload attachments to Cloudinary ─────────────────────────────────────
    let attachments: any[] = [];
    if (validFiles.length > 0) {
      const { attachments: uploaded, errors } = await uploadManyToCloudinary(
        validFiles,
        `announcements/${auth.userId}`,
      );
      attachments = uploaded;
      if (errors.length > 0) {
        console.warn("[UPLOAD PARTIAL ERRORS]", errors);
      }
    }

    // ── Save to DB ────────────────────────────────────────────────────────────
    const announcement = await Announcement.create({
      title,
      body,
      attachments,
      instructor: auth.userId,
      status,
      isPinned,
      allowComments,
      targetType,
      targetClassLevel,
      targetSubjects,
      targetCourses,
    });

    // Populate instructor for response
    await announcement.populate("instructor", "name email avatar");

    return NextResponse.json(
      {
        success: true,
        message: "Announcement posted successfully.",
        data: announcement.toObject(),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[POST ANNOUNCEMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to post announcement." },
      { status: 500 },
    );
  }
}
