/**
 * Seed / upsert an instructor account.
 *
 * Usage:
 *   npm run db:seed:instructor
 *
 * Credentials are read from environment variables (falling back to sensible
 * defaults). Override them in `.env` or inline:
 *
 *   INSTRUCTOR_EMAIL=teacher@school.edu \
 *   INSTRUCTOR_PASSWORD='Str0ngPass!' \
 *   INSTRUCTOR_NAME='Jane Doe' \
 *   npm run db:seed:instructor
 *
 * The script is idempotent: if an account with the email already exists it is
 * promoted to the instructor role and its password is reset, otherwise a new
 * instructor is created.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/schema";

async function main() {
  const name = process.env.INSTRUCTOR_NAME?.trim() || "Lead Instructor";
  const email = (
    process.env.INSTRUCTOR_EMAIL?.trim() || "instructor@lms.edu"
  ).toLowerCase();
  const password = process.env.INSTRUCTOR_PASSWORD?.trim() || "instructor123";

  if (password.length < 6) {
    throw new Error("INSTRUCTOR_PASSWORD must be at least 6 characters.");
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ role: "instructor", password: hashedPassword, name })
      .where(eq(users.id, existing.id));
    console.log(`✅ Updated existing account to instructor: ${email}`);
  } else {
    const [created] = await db
      .insert(users)
      .values({ name, email, password: hashedPassword, role: "instructor" })
      .returning({ id: users.id });
    console.log(`✅ Created instructor account: ${email} (id: ${created.id})`);
  }

  console.log("─────────────────────────────────────────────");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log("─────────────────────────────────────────────");
  console.log("⚠️  Change this password after first login.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Failed to seed instructor:", err);
    process.exit(1);
  });
