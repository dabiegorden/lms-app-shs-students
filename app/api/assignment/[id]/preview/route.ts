import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { assignments } from "@/src/schema";
import { verifyToken } from "@/lib/jwt";

// ─── GET /api/assignment/[id]/preview ─────────────────────────────────────────
// Streams the attached PDF from disk inline; increments the view counter.
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

    // Instructors only preview their own; students can preview any published one
    const whereClause =
      authUser.role === "instructor"
        ? and(
            eq(assignments.id, id),
            eq(assignments.instructorId, authUser.userId),
          )
        : and(eq(assignments.id, id), eq(assignments.status, "published"));

    const [assignment] = await db
      .select({
        filePath: assignments.filePath,
        fileName: assignments.fileName,
        fileSize: assignments.fileSize,
        views: assignments.views,
      })
      .from(assignments)
      .where(whereClause)
      .limit(1);

    if (!assignment) {
      return new NextResponse("Assignment not found", { status: 404 });
    }
    if (!assignment.filePath) {
      return new NextResponse("This assignment has no attached file", {
        status: 404,
      });
    }

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

    // Increment view count (fire-and-forget)
    db.update(assignments)
      .set({ views: sql`${assignments.views} + 1` })
      .where(eq(assignments.id, id))
      .catch(() => {});

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
