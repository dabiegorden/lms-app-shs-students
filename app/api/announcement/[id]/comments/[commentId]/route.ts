import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Announcement from "@/models/Announcement";
import { deleteManyFromCloudinary } from "@/lib/Cloudinaryupload";
import AnnouncementComment from "@/models/Announcementcomment";

function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── PATCH /api/announcement/[id]/comments/[commentId] ────────────────────────
// Edit comment body (author only) or toggle like (any authenticated user)
// Body: JSON { body?: string, like?: boolean }
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
    await connectDB();

    const comment = await AnnouncementComment.findById(commentId);
    if (!comment || comment.isDeleted) {
      return NextResponse.json(
        { success: false, message: "Comment not found." },
        { status: 404 },
      );
    }

    const body = await req.json();

    // ── Like / Unlike ────────────────────────────────────────────────────────
    if (body.like !== undefined) {
      const userId = auth.userId as any;
      const alreadyLiked = comment.likes.some(
        (id: any) => String(id) === String(userId),
      );
      if (alreadyLiked) {
        comment.likes = comment.likes.filter(
          (id: any) => String(id) !== String(userId),
        );
        comment.likesCount = Math.max(0, comment.likesCount - 1);
      } else {
        comment.likes.push(userId);
        comment.likesCount += 1;
      }
      await comment.save();
      return NextResponse.json(
        {
          success: true,
          data: { likesCount: comment.likesCount, liked: !alreadyLiked },
        },
        { status: 200 },
      );
    }

    // ── Edit body (author only) ───────────────────────────────────────────────
    if (body.body !== undefined) {
      if (String(comment.author) !== String(auth.userId)) {
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
      comment.body = body.body.trim();
      comment.isEdited = true;
      comment.editedAt = new Date();
      await comment.save();
      await comment.populate("author", "name email avatar role");
      return NextResponse.json(
        { success: true, data: comment.toObject() },
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
// Author can delete their own comment; instructor can delete any comment on their announcement.
// Soft-delete: keeps the shell but clears body and attachments.
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
    await connectDB();

    const comment = await AnnouncementComment.findById(commentId);
    if (!comment || comment.isDeleted) {
      return NextResponse.json(
        { success: false, message: "Comment not found." },
        { status: 404 },
      );
    }

    // Check permission: own comment OR instructor who owns the announcement
    const isOwn = String(comment.author) === String(auth.userId);
    let isAnnouncementInstructor = false;
    if (!isOwn && auth.role === "instructor") {
      const ann = await Announcement.findOne({
        _id: id,
        instructor: auth.userId,
      }).select("_id");
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
    comment.isDeleted = true;
    comment.body = "";
    comment.attachments = [];
    await comment.save();

    // Decrement counts
    Announcement.findByIdAndUpdate(id, { $inc: { commentsCount: -1 } })
      .exec()
      .catch(() => {});
    if (comment.parentComment) {
      AnnouncementComment.findByIdAndUpdate(comment.parentComment, {
        $inc: { repliesCount: -1 },
      })
        .exec()
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
