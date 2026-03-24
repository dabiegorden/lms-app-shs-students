import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import LectureNote from "@/models/Lecturenote";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const token = req.cookies.get("token")?.value;
    if (!token) return new NextResponse("Unauthorized", { status: 401 });

    const authUser = verifyToken(token);
    if (!authUser) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    await connectDB();

    // Instructors only see their own notes; students see any note
    const query =
      authUser.role === "instructor"
        ? { _id: id, instructor: authUser.userId }
        : { _id: id };

    const note = await LectureNote.findOne(query).select(
      "filePath fileName fileSize views",
    );

    if (!note) return new NextResponse("Note not found", { status: 404 });

    // ── Read from disk ───────────────────────────────────────────────────────
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(note.filePath);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return new NextResponse("PDF file not found on server", {
          status: 404,
        });
      }
      throw err;
    }

    // ── Increment views (fire-and-forget) ───────────────────────────────────
    LectureNote.findByIdAndUpdate(id, { $inc: { views: 1 } })
      .exec()
      .catch(() => {});

    // ── Return with inline headers so the browser renders, never downloads ──
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // "inline" tells the browser to render in-page; "attachment" would download
        "Content-Disposition": `inline; filename="${encodeURIComponent(note.fileName)}"`,
        "Content-Length": String(fileBuffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("[PDF PREVIEW ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
