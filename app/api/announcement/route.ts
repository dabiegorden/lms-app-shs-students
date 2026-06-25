import { type NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { announcements, users } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy, toLegacyList } from "@/lib/serialize";
import { uploadManyToCloudinary, ALLOWED_TYPES } from "@/lib/Cloudinaryupload";

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Columns + the joined instructor object (mirrors the old populate)
const announcementSelect = {
  id: announcements.id,
  title: announcements.title,
  body: announcements.body,
  attachments: announcements.attachments,
  targetType: announcements.targetType,
  targetClassLevel: announcements.targetClassLevel,
  targetSubjects: announcements.targetSubjects,
  targetCourses: announcements.targetCourses,
  isPinned: announcements.isPinned,
  allowComments: announcements.allowComments,
  status: announcements.status,
  publishedAt: announcements.publishedAt,
  viewsCount: announcements.viewsCount,
  commentsCount: announcements.commentsCount,
  likesCount: announcements.likesCount,
  createdAt: announcements.createdAt,
  updatedAt: announcements.updatedAt,
  instructor: {
    id: users.id,
    name: users.name,
    email: users.email,
    profilePicture: users.profilePicture,
  },
} as const;

// ─── GET /api/announcement ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

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
    const offset = (page - 1) * limit;

    // Instructors only see their own; students see all published ones
    const conditions =
      auth.role === "instructor"
        ? [eq(announcements.instructorId, auth.userId)]
        : [eq(announcements.status, "published")];

    if (search) {
      conditions.push(
        or(
          ilike(announcements.title, `%${search}%`),
          ilike(announcements.body, `%${search}%`),
        )!,
      );
    }
    if (status && auth.role === "instructor")
      conditions.push(eq(announcements.status, status as any));
    if (targetType) conditions.push(eq(announcements.targetType, targetType as any));
    if (isPinned === "true") conditions.push(eq(announcements.isPinned, true));
    if (isPinned === "false") conditions.push(eq(announcements.isPinned, false));

    const whereClause = and(...conditions);

    const orderBy =
      sort === "oldest"
        ? [desc(announcements.isPinned), asc(announcements.createdAt)]
        : sort === "popular"
          ? [desc(announcements.commentsCount), desc(announcements.createdAt)]
          : [desc(announcements.isPinned), desc(announcements.createdAt)];

    const [rows, totalResult] = await Promise.all([
      db
        .select(announcementSelect)
        .from(announcements)
        .innerJoin(users, eq(announcements.instructorId, users.id))
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(announcements)
        .where(whereClause),
    ]);

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
    console.error("[GET ANNOUNCEMENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch announcements." },
      { status: 500 },
    );
  }
}

// ─── POST /api/announcement ────────────────────────────────────────────────────
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

    let attachments: any[] = [];
    if (validFiles.length > 0) {
      const { attachments: uploaded, errors } = await uploadManyToCloudinary(
        validFiles,
        `announcements/${auth.userId}`,
      );
      attachments = uploaded;
      if (errors.length > 0) console.warn("[UPLOAD PARTIAL ERRORS]", errors);
    }

    const [created] = await db
      .insert(announcements)
      .values({
        title,
        body,
        attachments,
        instructorId: auth.userId,
        status: status as any,
        isPinned,
        allowComments,
        targetType: targetType as any,
        targetClassLevel,
        targetSubjects,
        targetCourses,
        publishedAt: status === "published" ? new Date() : null,
      })
      .returning();

    // Re-fetch with instructor joined for the response
    const [withInstructor] = await db
      .select(announcementSelect)
      .from(announcements)
      .innerJoin(users, eq(announcements.instructorId, users.id))
      .where(eq(announcements.id, created.id))
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        message: "Announcement posted successfully.",
        data: toLegacy(withInstructor),
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

export { announcementSelect };
