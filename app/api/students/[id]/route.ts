import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/src/db";
import { users, performances } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";
import { toLegacy } from "@/lib/serialize";

function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

const studentColumns = {
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

// ─── GET /api/students/[id] ───────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    const [student] = await db
      .select(studentColumns)
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, "student")))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student not found." },
        { status: 404 },
      );
    }

    const [performance] = await db
      .select()
      .from(performances)
      .where(
        and(
          eq(performances.studentId, id),
          eq(performances.instructorId, auth.userId),
        ),
      )
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...toLegacy(student),
          performance: performance ? toLegacy(performance) : null,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[GET STUDENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch student." },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/students/[id] ─────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    const [student] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, "student")))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student not found." },
        { status: 404 },
      );
    }

    const body = await req.json();
    const { name, email, school, classLevel, programme, newPassword } = body;

    const updates: Partial<typeof users.$inferInsert> = {};

    if (name?.trim()) updates.name = name.trim();
    if (school !== undefined) updates.school = school?.trim() ?? "";
    if (classLevel !== undefined) updates.classLevel = classLevel?.trim() ?? "";
    if (programme !== undefined) updates.programme = programme?.trim() ?? "";

    if (email?.trim() && email.toLowerCase() !== student.email) {
      const [clash] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email.toLowerCase()), ne(users.id, id)))
        .limit(1);
      if (clash) {
        return NextResponse.json(
          { success: false, message: "Email already in use." },
          { status: 409 },
        );
      }
      updates.email = email.toLowerCase().trim();
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message: "Password must be at least 6 characters.",
          },
          { status: 400 },
        );
      }
      const salt = await bcrypt.genSalt(12);
      updates.password = await bcrypt.hash(newPassword, salt);
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning(studentColumns);

    return NextResponse.json(
      {
        success: true,
        message: "Student updated successfully.",
        data: toLegacy(updated),
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[PATCH STUDENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to update student." },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/students/[id] ────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireInstructor(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    const [student] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, "student")))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student not found." },
        { status: 404 },
      );
    }

    // Related rows (enrollments, submissions, performances) are removed via
    // ON DELETE CASCADE foreign keys defined in the schema.
    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json(
      { success: true, message: "Student deleted successfully." },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[DELETE STUDENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete student." },
      { status: 500 },
    );
  }
}
