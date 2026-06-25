import { type NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { announcements, announcementComments, users } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";
import { deleteManyFromCloudinary } from "@/lib/Cloudinaryupload";
import { commentSelect } from "../route";

function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── PATCH /api/announcement/[id]/comments/[commentId] ────────────────────────
// Edit comment body (author only) or toggle like (any authenticated user)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const auth = requireAuth(req);
    if (!auth)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { commentId } = await params;

    const [comment] = await db
      .select()
      .from(announcementComments)
      .where(eq(announcementComments.id, commentId))
      .limit(1);

    if (!comment || comment.isDeleted) {
      return NextResponse.json(
        { success: false, message: "Comment not found." },
        { status: 404 },
      );
    }

    const body = await req.json();

    // ── Like / Unlike ────────────────────────────────────────────────────────
    if (body.like !== undefined) {
      const userId = auth.userId;
      const alreadyLiked = comment.likes.some((u) => String(u) === userId);
      const likes = alreadyLiked
        ? comment.likes.filter((u) => String(u) !== userId)
        : [...comment.likes, userId];
      const likesCount = likes.length;

      await db
        .update(announcementComments)
        .set({ likes, likesCount })
        .where(eq(announcementComments.id, commentId));

      return NextResponse.json(
        { success: true, data: { likesCount, liked: !alreadyLiked } },
        { status: 200 },
      );
    }

    // ── Edit body (author only) ───────────────────────────────────────────────
    if (body.body !== undefined) {
      if (String(comment.authorId) !== String(auth.userId)) {
        return NextResponse.json(
          { success: false, message: "You can only edit your own comments." },
          { status: 403 },
        );
      }
      if (!body.body.trim()) {
        return NextResponse.json(
          { success: false, message: "Comment body cannot be empty." },
          { status: 400 },
        );
      }

      await db
        .update(announcementComments)
        .set({
          body: body.body.trim(),
          isEdited: true,
          editedAt: new Date(),
        })
        .where(eq(announcementComments.id, commentId));

      const [withAuthor] = await db
        .select(commentSelect)
        .from(announcementComments)
        .innerJoin(users, eq(announcementComments.authorId, users.id))
        .where(eq(announcementComments.id, commentId))
        .limit(1);

      return NextResponse.json(
        { success: true, data: toLegacy(withAuthor) },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { success: false, message: "No valid action provided." },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("[PATCH COMMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update comment." },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/announcement/[id]/comments/[commentId] ───────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const auth = requireAuth(req);
    if (!auth)
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );

    const { id, commentId } = await params;

    const [comment] = await db
      .select()
      .from(announcementComments)
      .where(eq(announcementComments.id, commentId))
      .limit(1);

    if (!comment || comment.isDeleted) {
      return NextResponse.json(
        { success: false, message: "Comment not found." },
        { status: 404 },
      );
    }

    // Permission: own comment OR instructor who owns the announcement
    const isOwn = String(comment.authorId) === String(auth.userId);
    let isAnnouncementInstructor = false;
    if (!isOwn && auth.role === "instructor") {
      const [ann] = await db
        .select({ id: announcements.id })
        .from(announcements)
        .where(
          and(
            eq(announcements.id, id),
            eq(announcements.instructorId, auth.userId),
          ),
        )
        .limit(1);
      isAnnouncementInstructor = !!ann;
    }

    if (!isOwn && !isAnnouncementInstructor) {
      return NextResponse.json(
        { success: false, message: "Not authorized to delete this comment." },
        { status: 403 },
      );
    }

    // Delete Cloudinary assets
    if (comment.attachments.length > 0) {
      await deleteManyFromCloudinary(comment.attachments);
    }

    // Soft-delete
    await db
      .update(announcementComments)
      .set({ isDeleted: true, body: "", attachments: [] })
      .where(eq(announcementComments.id, commentId));

    // Decrement counts (fire-and-forget)
    db.update(announcements)
      .set({ commentsCount: sql`GREATEST(${announcements.commentsCount} - 1, 0)` })
      .where(eq(announcements.id, id))
      .catch(() => {});
    if (comment.parentCommentId) {
      db.update(announcementComments)
        .set({
          repliesCount: sql`GREATEST(${announcementComments.repliesCount} - 1, 0)`,
        })
        .where(eq(announcementComments.id, comment.parentCommentId))
        .catch(() => {});
    }

    return NextResponse.json(
      { success: true, message: "Comment deleted." },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[DELETE COMMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete comment." },
      { status: 500 },
    );
  }
}
