import { type NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { announcements, announcementComments, users } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy, toLegacyList } from "@/lib/serialize";
import { uploadManyToCloudinary, ALLOWED_TYPES } from "@/lib/Cloudinaryupload";

function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Comment columns + joined author object (mirrors the old populate)
const commentSelect = {
  id: announcementComments.id,
  announcementId: announcementComments.announcementId,
  authorRole: announcementComments.authorRole,
  body: announcementComments.body,
  attachments: announcementComments.attachments,
  parentCommentId: announcementComments.parentCommentId,
  repliesCount: announcementComments.repliesCount,
  likes: announcementComments.likes,
  likesCount: announcementComments.likesCount,
  isEdited: announcementComments.isEdited,
  editedAt: announcementComments.editedAt,
  isDeleted: announcementComments.isDeleted,
  createdAt: announcementComments.createdAt,
  updatedAt: announcementComments.updatedAt,
  author: {
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    profilePicture: users.profilePicture,
  },
} as const;

// ─── GET /api/announcement/[id]/comments ──────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAuth(req);
    if (!auth)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const offset = (page - 1) * limit;

    const topLevelWhere = and(
      eq(announcementComments.announcementId, id),
      isNull(announcementComments.parentCommentId),
      eq(announcementComments.isDeleted, false),
    );

    const [topLevelComments, totalResult] = await Promise.all([
      db
        .select(commentSelect)
        .from(announcementComments)
        .innerJoin(users, eq(announcementComments.authorId, users.id))
        .where(topLevelWhere)
        .orderBy(asc(announcementComments.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(announcementComments)
        .where(topLevelWhere),
    ]);

    const total = totalResult[0]?.count ?? 0;

    // Fetch replies for all visible top-level comments
    const topLevelIds = topLevelComments.map((c) => c.id);
    const replies =
      topLevelIds.length > 0
        ? await db
            .select(commentSelect)
            .from(announcementComments)
            .innerJoin(users, eq(announcementComments.authorId, users.id))
            .where(
              and(
                eq(announcementComments.announcementId, id),
                inArray(announcementComments.parentCommentId, topLevelIds),
                eq(announcementComments.isDeleted, false),
              ),
            )
            .orderBy(asc(announcementComments.createdAt))
        : [];

    const repliesMap: Record<string, any[]> = {};
    for (const reply of replies) {
      const key = String(reply.parentCommentId);
      if (!repliesMap[key]) repliesMap[key] = [];
      repliesMap[key].push(toLegacy(reply));
    }

    const enriched = topLevelComments.map((c) => ({
      ...toLegacy(c),
      replies: repliesMap[String(c.id)] ?? [],
    }));

    return NextResponse.json(
      {
        success: true,
        data: enriched,
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
    console.error("[GET COMMENTS ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch comments." },
      { status: 500 },
    );
  }
}

// ─── POST /api/announcement/[id]/comments ─────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAuth(req);
    if (!auth)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { id } = await params;

    const [announcement] = await db
      .select({
        allowComments: announcements.allowComments,
        status: announcements.status,
        instructorId: announcements.instructorId,
      })
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1);

    if (!announcement) {
      return NextResponse.json(
        { success: false, message: "Announcement not found." },
        { status: 404 },
      );
    }
    if (!announcement.allowComments) {
      return NextResponse.json(
        {
          success: false,
          message: "Comments are disabled for this announcement.",
        },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const body = (formData.get("body") as string | null)?.trim() ?? "";
    const parentCommentId =
      (formData.get("parentComment") as string | null)?.trim() || null;
    const files = (formData.getAll("files") as File[]).filter(
      (f) => f.size > 0,
    );

    if (!body && files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Comment must have text or at least one attachment.",
        },
        { status: 400 },
      );
    }

    for (const file of files) {
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
    if (files.length > 0) {
      const { attachments: uploaded, errors } = await uploadManyToCloudinary(
        files.slice(0, 3),
        `announcements/${id}/comments`,
      );
      attachments = uploaded;
      if (errors.length > 0) console.warn("[COMMENT UPLOAD ERRORS]", errors);
    }

    const [comment] = await db
      .insert(announcementComments)
      .values({
        announcementId: id,
        authorId: auth.userId,
        authorRole: auth.role,
        body,
        attachments,
        parentCommentId: parentCommentId || null,
      })
      .returning();

    // If this is a reply, increment the parent's repliesCount
    if (parentCommentId) {
      db.update(announcementComments)
        .set({ repliesCount: sql`${announcementComments.repliesCount} + 1` })
        .where(eq(announcementComments.id, parentCommentId))
        .catch(() => {});
    }

    // Increment announcement commentsCount
    db.update(announcements)
      .set({ commentsCount: sql`${announcements.commentsCount} + 1` })
      .where(eq(announcements.id, id))
      .catch(() => {});

    // Re-fetch with author joined
    const [withAuthor] = await db
      .select(commentSelect)
      .from(announcementComments)
      .innerJoin(users, eq(announcementComments.authorId, users.id))
      .where(eq(announcementComments.id, comment.id))
      .limit(1);

    return NextResponse.json(
      { success: true, message: "Comment posted.", data: toLegacy(withAuthor) },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[POST COMMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to post comment." },
      { status: 500 },
    );
  }
}

export { commentSelect };
