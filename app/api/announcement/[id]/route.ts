import { type NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { announcements, announcementComments, users } from "@/src/schema";
import type { Attachment } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";
import {
  uploadManyToCloudinary,
  deleteManyFromCloudinary,
  ALLOWED_TYPES,
} from "@/lib/Cloudinaryupload";
import { announcementSelect } from "../route";

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

    const whereClause =
      auth.role === "instructor"
        ? and(
            eq(announcements.id, id),
            eq(announcements.instructorId, auth.userId),
          )
        : and(eq(announcements.id, id), eq(announcements.status, "published"));

    const [announcement] = await db
      .select(announcementSelect)
      .from(announcements)
      .innerJoin(users, eq(announcements.instructorId, users.id))
      .where(whereClause)
      .limit(1);

    if (!announcement) {
      return NextResponse.json(
        { success: false, message: "Announcement not found." },
        { status: 404 },
      );
    }

    // Increment view count (fire-and-forget)
    db.update(announcements)
      .set({ viewsCount: sql`${announcements.viewsCount} + 1` })
      .where(eq(announcements.id, id))
      .catch(() => {});

    return NextResponse.json(
      { success: true, data: toLegacy(announcement) },
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

    const [announcement] = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.id, id),
          eq(announcements.instructorId, auth.userId),
        ),
      )
      .limit(1);

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

    const updates: Partial<typeof announcements.$inferInsert> = {};

    if (title?.trim()) updates.title = title.trim();
    if (body?.trim()) updates.body = body.trim();
    if (status) {
      updates.status = status as any;
      // Set publishedAt the first time it transitions to published
      if (status === "published" && !announcement.publishedAt) {
        updates.publishedAt = new Date();
      }
    }
    if (isPinnedRaw !== null) updates.isPinned = isPinnedRaw === "true";
    if (allowCommentsRaw !== null)
      updates.allowComments = allowCommentsRaw !== "false";
    if (targetType) updates.targetType = targetType as any;
    if (targetClassLevel) updates.targetClassLevel = targetClassLevel;
    if (targetSubjects) updates.targetSubjects = targetSubjects;
    if (targetCourses) updates.targetCourses = targetCourses;

    // Work on a copy of the current attachments
    let attachments: Attachment[] = [...announcement.attachments];

    // ── Remove specific attachments ──────────────────────────────────────────
    if (removeAttachments.length > 0) {
      const toDelete = attachments.filter((a) =>
        removeAttachments.includes(a.publicId),
      );
      await deleteManyFromCloudinary(toDelete);
      attachments = attachments.filter(
        (a) => !removeAttachments.includes(a.publicId),
      );
    }

    // ── Upload new files ─────────────────────────────────────────────────────
    if (files.length > 0) {
      const remaining = 5 - attachments.length;
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
      attachments.push(...newAttachments);
      if (errors.length > 0) console.warn("[UPLOAD ERRORS]", errors);
    }

    updates.attachments = attachments;

    await db
      .update(announcements)
      .set(updates)
      .where(eq(announcements.id, announcement.id));

    const [withInstructor] = await db
      .select(announcementSelect)
      .from(announcements)
      .innerJoin(users, eq(announcements.instructorId, users.id))
      .where(eq(announcements.id, announcement.id))
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        message: "Announcement updated.",
        data: toLegacy(withInstructor),
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

    const [announcement] = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.id, id),
          eq(announcements.instructorId, auth.userId),
        ),
      )
      .limit(1);

    if (!announcement) {
      return NextResponse.json(
        { success: false, message: "Announcement not found." },
        { status: 404 },
      );
    }

    // Delete Cloudinary assets for the announcement
    if (announcement.attachments.length > 0) {
      await deleteManyFromCloudinary(announcement.attachments);
    }

    // Delete comment attachments
    const comments = await db
      .select({ attachments: announcementComments.attachments })
      .from(announcementComments)
      .where(eq(announcementComments.announcementId, id));

    const commentAttachments = comments.flatMap((c) => c.attachments ?? []);
    if (commentAttachments.length > 0) {
      await deleteManyFromCloudinary(commentAttachments);
    }

    // Comments are removed automatically via ON DELETE CASCADE, but we delete
    // explicitly to be safe if the FK constraint is ever relaxed.
    await db
      .delete(announcementComments)
      .where(eq(announcementComments.announcementId, id));
    await db.delete(announcements).where(eq(announcements.id, id));

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
