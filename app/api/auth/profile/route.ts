import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/jwt";
import cloudinary from "@/lib/cloudinary";

// ─── Helper: extract & verify token from cookie ───────────────────────────────
function getAuthUser(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

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

    await connectDB();

    const user = await User.findById(authUser.userId).select(
      "-password -profilePicturePublicId",
    );
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
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

    await connectDB();

    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 },
      );
    }

    // ── Parse multipart form data ──────────────────────────────────────────
    // Profile picture is sent as a file; other fields as text.
    const formData = await req.formData();

    const name = formData.get("name") as string | null;
    const school = formData.get("school") as string | null;
    const classLevel = formData.get("classLevel") as string | null;
    const programme = formData.get("programme") as string | null;
    const newPassword = formData.get("newPassword") as string | null;
    const currentPassword = formData.get("currentPassword") as string | null;
    const profilePictureFile = formData.get("profilePicture") as File | null;

    // ── Update basic text fields ───────────────────────────────────────────
    if (name) user.name = name.trim();
    if (school) user.school = school.trim();
    if (classLevel) user.classLevel = classLevel.trim();
    if (programme) user.programme = programme.trim();

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
      user.password = await bcrypt.hash(newPassword, salt);
    }

    // ── Profile picture upload to Cloudinary ──────────────────────────────
    if (profilePictureFile && profilePictureFile.size > 0) {
      // Validate file type
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

      // Validate file size (max 5MB)
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

      // Convert File → Buffer → base64 data URI (required by Cloudinary uploader)
      const arrayBuffer = await profilePictureFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const dataUri = `data:${profilePictureFile.type};base64,${base64}`;

      // Delete the old profile picture from Cloudinary if one exists
      if (user.profilePicturePublicId) {
        await cloudinary.uploader
          .destroy(user.profilePicturePublicId)
          .catch((err: any) => {
            // Non-fatal: log but don't block the update
            console.warn("[CLOUDINARY DELETE WARNING]", err);
          });
      }

      // Upload new picture
      // - folder: keeps Cloudinary organised per project
      // - public_id: deterministic ID per user so re-uploads replace cleanly
      // - transformation: auto-crop to a square avatar at 400×400
      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: "edulearn/profile-pictures",
        public_id: `user_${user._id}`,
        overwrite: true,
        transformation: [
          {
            width: 400,
            height: 400,
            crop: "fill", // fill the square, cropping excess
            gravity: "face", // focus crop on the face when detected
            fetch_format: "auto",
            quality: "auto",
          },
        ],
      });

      user.profilePicture = uploadResult.secure_url;
      user.profilePicturePublicId = uploadResult.public_id;
    }

    await user.save();

    // Return updated user without sensitive fields
    const updatedUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      school: user.school,
      classLevel: user.classLevel,
      programme: user.programme,
    };

    return NextResponse.json(
      {
        success: true,
        message: "Profile updated successfully.",
        user: updatedUser,
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
