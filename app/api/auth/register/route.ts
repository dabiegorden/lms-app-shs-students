import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { generateToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { name, email, password, school, classLevel, programme, role } = body;

    // ── Validate required fields ───────────────────────────────────────────
    if (
      !name?.trim() ||
      !email?.trim() ||
      !password?.trim() ||
      !school?.trim() ||
      !classLevel?.trim() ||
      !programme?.trim()
    ) {
      return NextResponse.json(
        { success: false, message: "All fields are required." },
        { status: 400 },
      );
    }

    // ── Check if email already exists ──────────────────────────────────────
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "An account with this email already exists.",
        },
        { status: 409 },
      );
    }

    // ── Hash password ──────────────────────────────────────────────────────
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ── Create student (only students can self-register) ───────────────────
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role === "instructor" ? "instructor" : "student",
      school,
      classLevel,
      programme,
    });
    // ── Generate JWT ───────────────────────────────────────────────────────
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // ── Set token in HTTP-only cookie ──────────────────────────────────────
    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          school: user.school,
          classLevel: user.classLevel,
          programme: user.programme,
          profilePicture: user.profilePicture,
        },
      },
      { status: 201 },
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[REGISTER ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
