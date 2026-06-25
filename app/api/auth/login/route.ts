import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/schema";
import { generateToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // ── Validate required fields ───────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 },
      );
    }

    // ── Find user by email ─────────────────────────────────────────────────
    // Intentionally use the same generic error for both "not found"
    // and "wrong password" to avoid user enumeration attacks.
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 },
      );
    }

    // ── Compare password ───────────────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 },
      );
    }

    // ── Generate JWT ───────────────────────────────────────────────────────
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // ── Build safe user payload (never send password) ──────────────────────
    const userPayload = {
      id: user.id,
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      // Student-specific
      ...(user.role === "student" && {
        school: user.school,
        classLevel: user.classLevel,
        programme: user.programme,
      }),
    };

    // ── Set token in HTTP-only cookie ──────────────────────────────────────
    const response = NextResponse.json(
      {
        success: true,
        message: "Logged in successfully.",
        user: userPayload,
      },
      { status: 200 },
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
    console.error("[LOGIN ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
