import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/schema";
import { generateToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
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

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 6 characters.",
        },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Check if email already exists ──────────────────────────────────────
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

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
    const [user] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: role === "instructor" ? "instructor" : "student",
        school: school.trim(),
        classLevel: classLevel.trim(),
        programme: programme.trim(),
      })
      .returning();

    // ── Generate JWT ───────────────────────────────────────────────────────
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // ── Set token in HTTP-only cookie ──────────────────────────────────────
    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        user: {
          id: user.id,
          _id: user.id,
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
