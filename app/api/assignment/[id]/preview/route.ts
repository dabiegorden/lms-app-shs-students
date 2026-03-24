import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import Assignment from "@/models/Assignment";

// ─── GET /api/assignment/[id]/preview ─────────────────────────────────────────
// Streams the attached PDF from disk with Content-Disposition: inline so the
// browser renders it natively inside the iframe (no sandbox, no Google Docs).
// Also increments the view counter (fire-and-forget).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return new NextResponse("Unauthorized", { status: 401 });

    const authUser = verifyToken(token);
    if (!authUser) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    await connectDB();

    // Instructors only preview their own; students can preview any published one
    const query =
      authUser.role === "instructor"
        ? { _id: id, instructor: authUser.userId }
        : { _id: id, status: "published" };

    const assignment = await Assignment.findOne(query).select(
      "filePath fileName fileSize views",
    );

    if (!assignment) {
      return new NextResponse("Assignment not found", { status: 404 });
    }
    if (!assignment.filePath) {
      return new NextResponse("This assignment has no attached file", {
        status: 404,
      });
    }

    // ── Read file from disk ──────────────────────────────────────────────────
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(assignment.filePath);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return new NextResponse("PDF file not found on server", {
          status: 404,
        });
      }
      throw err;
    }

    // ── Increment view count (fire-and-forget) ───────────────────────────────
    Assignment.findByIdAndUpdate(id, { $inc: { views: 1 } })
      .exec()
      .catch(() => {});

    // ── Return inline — NO sandbox on the consuming iframe ───────────────────
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(assignment.fileName ?? "assignment.pdf")}"`,
        "Content-Length": String(fileBuffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("[ASSIGNMENT PREVIEW ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
