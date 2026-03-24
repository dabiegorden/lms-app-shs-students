import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Announcement from "@/models/Announcement";
import {
  uploadManyToCloudinary,
  deleteManyFromCloudinary,
  ALLOWED_TYPES,
} from "@/lib/Cloudinaryupload";
import AnnouncementComment from "@/models/Announcementcomment";

function requireAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET /api/announcement/[id]/comments ──────────────────────────────────────
// Returns top-level comments + their replies nested one level deep
// Query: page, limit
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
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const skip = (page - 1) * limit;

    // Top-level comments only
    const [topLevelComments, total] = await Promise.all([
      AnnouncementComment.find({
        announcement: id,
        parentComment: null,
        isDeleted: false,
      })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name email avatar role")
        .lean(),
      AnnouncementComment.countDocuments({
        announcement: id,
        parentComment: null,
        isDeleted: false,
      }),
    ]);

    // Fetch replies for all visible top-level comments
    const topLevelIds = topLevelComments.map((c: any) => c._id);
    const replies = await AnnouncementComment.find({
      announcement: id,
      parentComment: { $in: topLevelIds },
      isDeleted: false,
    })
      .sort({ createdAt: 1 })
      .populate("author", "name email avatar role")
      .lean();

    // Attach replies to their parent
    const repliesMap: Record<string, any[]> = {};
    for (const reply of replies) {
      const key = String((reply as any).parentComment);
      if (!repliesMap[key]) repliesMap[key] = [];
      repliesMap[key].push(reply);
    }

    const enriched = topLevelComments.map((c: any) => ({
      ...c,
      replies: repliesMap[String(c._id)] ?? [],
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
// Body: multipart/form-data
//   body            (optional if files provided)
//   parentComment   (optional, ID for reply)
//   files           (optional, up to 3 attachments)
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
    await connectDB();

    // Check the announcement exists and allows comments
    const announcement = await Announcement.findById(id).select(
      "allowComments status instructor",
    );
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
      (formData.get("parentComment") as string | null)?.trim() ?? null;
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

    // Validate file types
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

    // Upload attachments
    let attachments: any[] = [];
    if (files.length > 0) {
      const { attachments: uploaded, errors } = await uploadManyToCloudinary(
        files.slice(0, 3),
        `announcements/${id}/comments`,
      );
      attachments = uploaded;
      if (errors.length > 0) console.warn("[COMMENT UPLOAD ERRORS]", errors);
    }

    const comment = await AnnouncementComment.create({
      announcement: id,
      author: auth.userId,
      authorRole: auth.role,
      body,
      attachments,
      parentComment: parentCommentId || null,
    });

    // If this is a reply, increment the parent's repliesCount
    if (parentCommentId) {
      AnnouncementComment.findByIdAndUpdate(parentCommentId, {
        $inc: { repliesCount: 1 },
      })
        .exec()
        .catch(() => {});
    }

    // Increment announcement commentsCount
    Announcement.findByIdAndUpdate(id, { $inc: { commentsCount: 1 } })
      .exec()
      .catch(() => {});

    await comment.populate("author", "name email avatar role");

    return NextResponse.json(
      { success: true, message: "Comment posted.", data: comment.toObject() },
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
