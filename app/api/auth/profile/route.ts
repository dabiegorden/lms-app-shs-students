import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import cloudinary from "@/lib/cloudinary";

// ─── Helper: extract & verify token from cookie ───────────────────────────────
function getAuthUser(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Columns returned to clients — never expose password or the Cloudinary public id
const publicUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  school: users.school,
  classLevel: users.classLevel,
  programme: users.programme,
  profilePicture: users.profilePicture,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

// ─── GET /api/auth/profile — fetch current user's profile ────────────────────
export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const [user] = await db
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.id, authUser.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, user: { ...user, _id: user.id } },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET PROFILE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/auth/profile — update profile fields + optional picture ───────
export async function PATCH(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 },
      );
    }

    // ── Parse multipart form data ──────────────────────────────────────────
    const formData = await req.formData();

    const name = formData.get("name") as string | null;
    const school = formData.get("school") as string | null;
    const classLevel = formData.get("classLevel") as string | null;
    const programme = formData.get("programme") as string | null;
    const newPassword = formData.get("newPassword") as string | null;
    const currentPassword = formData.get("currentPassword") as string | null;
    const profilePictureFile = formData.get("profilePicture") as File | null;

    // Accumulate the changes to persist in a single UPDATE
    const updates: Partial<typeof users.$inferInsert> = {};

    // ── Update basic text fields ───────────────────────────────────────────
    if (name) updates.name = name.trim();
    if (school) updates.school = school.trim();
    if (classLevel) updates.classLevel = classLevel.trim();
    if (programme) updates.programme = programme.trim();

    // ── Password change (requires currentPassword for verification) ────────
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          {
            success: false,
            message: "Current password is required to set a new password.",
          },
          { status: 400 },
        );
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, message: "Current password is incorrect." },
          { status: 400 },
        );
      }
      if (newPassword.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message: "New password must be at least 6 characters.",
          },
          { status: 400 },
        );
      }
      const salt = await bcrypt.genSalt(12);
      updates.password = await bcrypt.hash(newPassword, salt);
    }

    // ── Profile picture upload to Cloudinary ──────────────────────────────
    if (profilePictureFile && profilePictureFile.size > 0) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      if (!allowedTypes.includes(profilePictureFile.type)) {
        return NextResponse.json(
          {
            success: false,
            message: "Profile picture must be a JPEG, PNG, WebP, or GIF image.",
          },
          { status: 400 },
        );
      }

      const MAX_SIZE = 5 * 1024 * 1024;
      if (profilePictureFile.size > MAX_SIZE) {
        return NextResponse.json(
          {
            success: false,
            message: "Profile picture must be smaller than 5MB.",
          },
          { status: 400 },
        );
      }

      const arrayBuffer = await profilePictureFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const dataUri = `data:${profilePictureFile.type};base64,${base64}`;

      // Delete the old profile picture from Cloudinary if one exists
      if (user.profilePicturePublicId) {
        await cloudinary.uploader
          .destroy(user.profilePicturePublicId)
          .catch((err: any) => {
            console.warn("[CLOUDINARY DELETE WARNING]", err);
          });
      }

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: "edulearn/profile-pictures",
        public_id: `user_${user.id}`,
        overwrite: true,
        transformation: [
          {
            width: 400,
            height: 400,
            crop: "fill",
            gravity: "face",
            fetch_format: "auto",
            quality: "auto",
          },
        ],
      });

      updates.profilePicture = uploadResult.secure_url;
      updates.profilePicturePublicId = uploadResult.public_id;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning();

    return NextResponse.json(
      {
        success: true,
        message: "Profile updated successfully.",
        user: {
          id: updated.id,
          _id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          profilePicture: updated.profilePicture,
          school: updated.school,
          classLevel: updated.classLevel,
          programme: updated.programme,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[UPDATE PROFILE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
