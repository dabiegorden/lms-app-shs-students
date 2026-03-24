import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Announcement from "@/models/Announcement";
import {
  uploadManyToCloudinary,
  deleteFromCloudinary,
  deleteManyFromCloudinary,
  ALLOWED_TYPES,
} from "@/lib/Cloudinaryupload";
import AnnouncementComment from "@/models/Announcementcomment";

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

// ─── GET /api/announcement/[id] ───────────────────────────────────────────────
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

    const query =
      auth.role === "instructor"
        ? { _id: id, instructor: auth.userId }
        : { _id: id, status: "published" };

    const announcement = await Announcement.findOne(query)
      .populate("instructor", "name email avatar")
      .lean();

    if (!announcement) {
      return NextResponse.json(
        { success: false, message: "Announcement not found." },
        { status: 404 },
      );
    }

    // Increment view count (fire-and-forget)
    Announcement.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } })
      .exec()
      .catch(() => {});

    return NextResponse.json(
      { success: true, data: announcement },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET ANNOUNCEMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch announcement." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/announcement/[id] ────────────────────────────────────────────
// Body: multipart/form-data — all fields optional
//   removeAttachments  JSON array of publicIds to delete
//   files              new files to add (up to 5 total remaining)
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

    const announcement = await Announcement.findOne({
      _id: id,
      instructor: auth.userId,
    });
    if (!announcement) {
      return NextResponse.json(
        { success: false, message: "Announcement not found." },
        { status: 404 },
      );
    }

    const formData = await req.formData();
    const title = formData.get("title") as string | null;
    const body = formData.get("body") as string | null;
    const status = formData.get("status") as string | null;
    const isPinnedRaw = formData.get("isPinned") as string | null;
    const allowCommentsRaw = formData.get("allowComments") as string | null;
    const targetType = formData.get("targetType") as string | null;
    const files = (formData.getAll("files") as File[]).filter(
      (f) => f.size > 0,
    );

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

    const removeAttachments =
      safeParseArray(formData.get("removeAttachments")) ?? [];
    const targetClassLevel = safeParseArray(formData.get("targetClassLevel"));
    const targetSubjects = safeParseArray(formData.get("targetSubjects"));
    const targetCourses = safeParseArray(formData.get("targetCourses"));

    // ── Apply text patches ───────────────────────────────────────────────────
    if (title?.trim()) announcement.title = title.trim();
    if (body?.trim()) announcement.body = body.trim();
    if (status) announcement.status = status as any;
    if (isPinnedRaw !== null) announcement.isPinned = isPinnedRaw === "true";
    if (allowCommentsRaw !== null)
      announcement.allowComments = allowCommentsRaw !== "false";
    if (targetType) announcement.targetType = targetType as any;
    if (targetClassLevel) announcement.targetClassLevel = targetClassLevel;
    if (targetSubjects) announcement.targetSubjects = targetSubjects;
    if (targetCourses) announcement.targetCourses = targetCourses as any;

    // ── Remove specific attachments ──────────────────────────────────────────
    if (removeAttachments.length > 0) {
      const toDelete = announcement.attachments.filter((a) =>
        removeAttachments.includes(a.publicId),
      );
      await deleteManyFromCloudinary(toDelete);
      announcement.attachments = announcement.attachments.filter(
        (a) => !removeAttachments.includes(a.publicId),
      );
    }

    // ── Upload new files ─────────────────────────────────────────────────────
    if (files.length > 0) {
      const remaining = 5 - announcement.attachments.length;
      if (remaining <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Maximum 5 attachments per announcement.",
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
      const filesToUpload = files.slice(0, remaining);
      const { attachments: newAttachments, errors } =
        await uploadManyToCloudinary(
          filesToUpload,
          `announcements/${auth.userId}`,
        );
      announcement.attachments.push(...newAttachments);
      if (errors.length > 0) console.warn("[UPLOAD ERRORS]", errors);
    }

    await announcement.save();
    await announcement.populate("instructor", "name email avatar");

    return NextResponse.json(
      {
        success: true,
        message: "Announcement updated.",
        data: announcement.toObject(),
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[PATCH ANNOUNCEMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update announcement." },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/announcement/[id] ───────────────────────────────────────────
// Deletes announcement + all its comments + all Cloudinary assets
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

    const announcement = await Announcement.findOne({
      _id: id,
      instructor: auth.userId,
    });
    if (!announcement) {
      return NextResponse.json(
        { success: false, message: "Announcement not found." },
        { status: 404 },
      );
    }

    // Delete Cloudinary assets
    if (announcement.attachments.length > 0) {
      await deleteManyFromCloudinary(announcement.attachments);
    }

    // Delete all comments (and their attachments)
    const comments = await AnnouncementComment.find({ announcement: id })
      .select("attachments")
      .lean();
    const commentAttachments = comments.flatMap(
      (c: any) => c.attachments ?? [],
    );
    if (commentAttachments.length > 0) {
      await deleteManyFromCloudinary(commentAttachments);
    }

    await AnnouncementComment.deleteMany({ announcement: id });
    await Announcement.deleteOne({ _id: id });

    return NextResponse.json(
      { success: true, message: "Announcement deleted successfully." },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[DELETE ANNOUNCEMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete announcement." },
      { status: 500 },
    );
  }
}
