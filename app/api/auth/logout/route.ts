import { type NextRequest, NextResponse } from "next/server";

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// Clears the HTTP-only auth cookie. No DB call needed since we use stateless JWT.
// If you later add a token blocklist / refresh-token table, invalidate it here.

export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.json(
      { success: true, message: "Logged out successfully." },
      { status: 200 },
    );

    // Clear the auth cookie by setting maxAge to 0
    response.cookies.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[LOGOUT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong." },
      { status: 500 },
    );
  }
}
