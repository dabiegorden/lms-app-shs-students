import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import User from "@/models/User";
import Performance from "@/models/Performance";

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireInstructor(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || user.role !== "instructor") return null;
  return user;
}

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
    await connectDB();

    const student = await User.findOne({ _id: id, role: "student" })
      .select("-password -profilePicturePublicId")
      .lean();

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student not found." },
        { status: 404 },
      );
    }

    const performance = await Performance.findOne({
      student: id,
      instructor: auth.userId,
    }).lean();

    return NextResponse.json(
      { success: true, data: { ...student, performance } },
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
// Instructor can update: name, email, school, classLevel, programme, password
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
    await connectDB();

    const student = await User.findOne({ _id: id, role: "student" });
    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student not found." },
        { status: 404 },
      );
    }

    const body = await req.json();
    const { name, email, school, classLevel, programme, newPassword } = body;

    if (name?.trim()) student.name = name.trim();
    if (school !== undefined) student.school = school?.trim() ?? "";
    if (classLevel !== undefined) student.classLevel = classLevel?.trim() ?? "";
    if (programme !== undefined) student.programme = programme?.trim() ?? "";

    if (email?.trim() && email.toLowerCase() !== student.email) {
      const clash = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id },
      });
      if (clash) {
        return NextResponse.json(
          { success: false, message: "Email already in use." },
          { status: 409 },
        );
      }
      student.email = email.toLowerCase().trim();
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
      student.password = await bcrypt.hash(newPassword, salt);
    }

    await student.save();

    return NextResponse.json(
      {
        success: true,
        message: "Student updated successfully.",
        data: {
          _id: student._id,
          name: student.name,
          email: student.email,
          role: student.role,
          school: student.school,
          classLevel: student.classLevel,
          programme: student.programme,
          profilePicture: student.profilePicture,
          createdAt: student.createdAt,
          updatedAt: student.updatedAt,
        },
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
// Hard-deletes the student account.
// Also cleans up performance records scoped to this instructor.
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
    await connectDB();

    const student = await User.findOne({ _id: id, role: "student" });
    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student not found." },
        { status: 404 },
      );
    }

    // Delete user + performance records (fire-and-forget for perf records)
    await User.deleteOne({ _id: id });
    Performance.deleteMany({ student: id })
      .exec()
      .catch(() => {});

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
