// Email test with a real (local, fake) SMTP server. Needs the demo data and MONGO_URI:
//   MONGO_URI=... node tests/email.test.js
require("dotenv").config();
const { SMTPServer } = require("smtp-server");
const mongoose = require("mongoose");

process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "2525";
process.env.MAIL_FROM = '"Hostel Test" <test@hostel.local>';

const User = require("../models/User");
const Student = require("../models/Student");
const notify = require("../utils/notify");
const mailer = require("../utils/mailer");

let pass = 0, failed = 0;
const ok = (name, cond, extra = "") => { cond ? (pass++, console.log("  ✓", name)) : (failed++, console.log("  ✗ FAIL:", name, extra)); };
const inbox = [];
const waitFor = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };

(async () => {
  const server = new SMTPServer({
    authOptional: true, disabledCommands: ["STARTTLS", "AUTH"],
    onData(stream, session, cb) { let d = ""; stream.on("data", (c) => (d += c)); stream.on("end", () => { inbox.push({ to: session.envelope.rcptTo.map((r) => r.address), raw: d }); cb(); }); },
  });
  await new Promise((r) => server.listen(2525, "127.0.0.1", r));
  await mongoose.connect(process.env.MONGO_URI);

  console.log("EMAIL");
  ok("mailer detects SMTP config", mailer.isConfigured());
  const ali = await User.findOne({ email: "ali@student.com" });
  const st = await Student.findOne({ user: ali._id });

  inbox.length = 0;
  await notify.toStudent(st._id, { title: "Fee reminder", message: "Your fee of Rs 8000 is due.", link: "/student/fees" });
  ok("notification email is delivered", await waitFor(() => inbox.length === 1), `inbox=${inbox.length}`);
  const mail = inbox[0];
  ok("sent to the student's address", mail?.to.includes("ali@student.com"));
  const flat = mail.raw.replace(/=\r?\n/g, ""); // undo quoted-printable line wrapping
  ok("has subject, branded HTML and portal link", /Subject: Fee reminder/.test(flat) && /Hostel Management System/.test(flat) && /localhost:5173\/student\/fees/.test(flat));

  await User.updateOne({ _id: ali._id }, { emailNotifications: false });
  inbox.length = 0;
  await notify.toStudent(st._id, { title: "Should not be emailed", message: "x" });
  await new Promise((r) => setTimeout(r, 800));
  ok("opted-out user gets no email", inbox.length === 0);
  await User.updateOne({ _id: ali._id }, { emailNotifications: true });

  inbox.length = 0;
  await notify.toStudent(st._id, { title: "In-app only", message: "x", email: false });
  await new Promise((r) => setTimeout(r, 800));
  ok("payload email:false skips email", inbox.length === 0);

  inbox.length = 0;
  await notify.toHostelStudents(st.hostel, { title: "Hostel notice", message: "Water off 10-1" });
  ok("hostel-wide notice emails every student of that hostel", await waitFor(() => inbox.length === 3, 6000), `got ${inbox.length}`);

  inbox.length = 0;
  const evil = await mailer.renderEmail({ name: "<b>x</b>", title: "<script>alert(1)</script>", message: "m" });
  ok("HTML is escaped in the template", !/<script>/.test(evil) && /&lt;script&gt;/.test(evil));

  console.log(`\nRESULT: ${pass} passed, ${failed} failed`);
  mailer.resetForTests(); server.close(); await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
