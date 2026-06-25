import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { lectureNotes } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";

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

    // Instructors only see their own notes; students see any note
    const whereClause =
      authUser.role === "instructor"
        ? and(
            eq(lectureNotes.id, id),
            eq(lectureNotes.instructorId, authUser.userId),
          )
        : eq(lectureNotes.id, id);

    const [note] = await db
      .select({
        filePath: lectureNotes.filePath,
        fileName: lectureNotes.fileName,
        fileSize: lectureNotes.fileSize,
        views: lectureNotes.views,
      })
      .from(lectureNotes)
      .where(whereClause)
      .limit(1);

    if (!note) return new NextResponse("Note not found", { status: 404 });

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

    // Increment views (fire-and-forget)
    db.update(lectureNotes)
      .set({ views: sql`${lectureNotes.views} + 1` })
      .where(eq(lectureNotes.id, id))
      .catch(() => {});

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
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
