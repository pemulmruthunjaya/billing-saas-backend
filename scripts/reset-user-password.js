require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../db/connection");
const { ensureUserAccessColumns } = require("../services/userAccessService");

const email = String(process.argv[2] || "").trim().toLowerCase();
const requestedPassword = String(process.argv[3] || "");

if (!email) {
  console.error("Usage: npm run reset:user-password -- user@example.com [new-password]");
  process.exit(1);
}

const generatedPassword = `Bs!${crypto.randomBytes(12).toString("base64url")}`;
const newPassword = requestedPassword || generatedPassword;

if (newPassword.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

(async () => {
  try {
    await ensureUserAccessColumns();
    const [users] = await db.query(
      "SELECT id, name, role FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (!users.length) {
      throw new Error("No user found for that exact email address.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.query(
      `UPDATE users
       SET password = ?, must_change_password = 1, password_changed_at = NOW(),
           password_reset_token_hash = NULL, password_reset_expires_at = NULL
       WHERE id = ?`,
      [hashedPassword, users[0].id]
    );

    console.log(`Password reset for ${users[0].name} (${users[0].role}) <${email}>.`);
    console.log(`Temporary password: ${newPassword}`);
    console.log("The user must change this password after signing in.");
  } catch (error) {
    console.error(`Password reset failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
