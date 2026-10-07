// Forgot / reset password, tested end to end with a local fake SMTP server (runs the app in-process).
//   MONGO_URI=... JWT_SECRET=... node tests/reset.test.js      (needs the seeded demo data)
require("dotenv").config();
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "2527";
process.env.RESET_RATE_LIMIT = "5"; // forgot-password: 5 per hour for this test (the 6th request must be blocked)
const { SMTPServer } = require("smtp-server");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const mailer = require("../utils/mailer");

let pass = 0, failed = 0;
const ok = (n, c, x = "") => { c ? (pass++, console.log("  ✓", n)) : (failed++, console.log("  ✗ FAIL:", n, x)); };
const inbox = [];
const waitFor = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };

(async () => {
  const smtp = new SMTPServer({
    authOptional: true, disabledCommands: ["STARTTLS", "AUTH"],
    onData(stream, session, cb) { let d = ""; stream.on("data", (c) => (d += c)); stream.on("end", () => { inbox.push({ to: session.envelope.rcptTo.map((r) => r.address), raw: d.replace(/=\r?\n/g, "").replace(/=3D/g, "=") }); cb(); }); },
  });
  await new Promise((r) => smtp.listen(2527, "127.0.0.1", r));
  await mongoose.connect(process.env.MONGO_URI);
  const server = app.listen(0);
  const BASE = `http://127.0.0.1:${server.address().port}/api`;
  const post = async (path, body) => { const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };

  console.log("FORGOT / RESET PASSWORD");
  let r = await post("/auth/forgot-password", { email: "nobody@nowhere.com" });
  await new Promise((x) => setTimeout(x, 600));
  ok("unknown email: same generic answer, no email sent", r.status === 200 && /if an account/i.test(r.data.message) && inbox.length === 0);
  ok("invalid email format -> 400", (await post("/auth/forgot-password", { email: "bad" })).status === 400);

  inbox.length = 0;
  r = await post("/auth/forgot-password", { email: "ali@student.com" });
  ok("known email: identical generic answer", r.status === 200 && /if an account/i.test(r.data.message));
  ok("reset email is delivered to the user", await waitFor(() => inbox.length === 1) && inbox[0].to.includes("ali@student.com"));
  const m = /reset-password\/([a-f0-9]{64})/.exec(inbox[0].raw);
  ok("email contains a 64-char token link", !!m);
  const token = m[1];
  const row = await User.findOne({ email: "ali@student.com" }).select("+passwordResetToken +passwordResetExpires");
  ok("only a hash of the token is stored", row.passwordResetToken && row.passwordResetToken !== token && row.passwordResetToken.length === 64);
  ok("token expires in about 30 minutes", Math.abs(row.passwordResetExpires - Date.now() - 30 * 60 * 1000) < 60 * 1000);

  ok("wrong token rejected", (await post("/auth/reset-password", { token: "a".repeat(64), password: "NewPass123" })).status === 400);
  ok("short password rejected", (await post("/auth/reset-password", { token, password: "123" })).status === 400);
  r = await post("/auth/reset-password", { token, password: "NewPass123" });
  ok("valid token changes the password", r.status === 200 && /updated/i.test(r.data.message));
  ok("old password no longer works", (await post("/auth/login", { email: "ali@student.com", password: "Student@123" })).status === 401);
  ok("new password works", (await post("/auth/login", { email: "ali@student.com", password: "NewPass123" })).status === 200);
  ok("token cannot be used twice", (await post("/auth/reset-password", { token, password: "Another123" })).status === 400);
  ok("reset is written to the audit log", (await AuditLog.countDocuments({ route: "/api/auth/reset-password" })) === 1);
  ok("user is told their password changed", await waitFor(() => inbox.some((x) => /password was changed/i.test(x.raw))));

  inbox.length = 0;
  await post("/auth/forgot-password", { email: "hamza@student.com" });
  await waitFor(() => inbox.length === 1);
  const t2 = /reset-password\/([a-f0-9]{64})/.exec(inbox[0].raw)[1];
  await User.updateOne({ email: "hamza@student.com" }, { passwordResetExpires: new Date(Date.now() - 1000) });
  ok("expired token rejected", (await post("/auth/reset-password", { token: t2, password: "NewPass123" })).status === 400);

  inbox.length = 0;
  await User.updateOne({ email: "usman@student.com" }, { isActive: false });
  await post("/auth/forgot-password", { email: "usman@student.com" });
  await new Promise((x) => setTimeout(x, 600));
  ok("deactivated account gets no email", inbox.length === 0);

  r = await post("/auth/forgot-password", { email: "sana@student.com" }); // 6th request this hour
  ok("rate limit stops abuse (429)", r.status === 429, `status=${r.status}`);

  // leave the demo data as we found it
  await User.updateOne({ email: "usman@student.com" }, { isActive: true });
  console.log(`\nRESULT: ${pass} passed, ${failed} failed`);
  server.close(); smtp.close(); mailer.resetForTests(); await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
