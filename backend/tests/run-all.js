// Runs every backend test, each on a freshly seeded database (works on Windows, Mac and Linux).
//   npm test        (needs a MONGO_URI + JWT_SECRET in backend/.env or the environment; it WIPES that database)
require("dotenv").config();
const { spawn, spawnSync } = require("child_process");

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error("MONGO_URI and JWT_SECRET must be set (backend/.env). Use a throw-away database: the tests wipe it.");
  process.exit(1);
}
process.env.LOGIN_RATE_LIMIT = process.env.LOGIN_RATE_LIMIT || "1000"; // tests sign in many times
const PORT = process.env.PORT || 5000;
const node = (args) => spawnSync(process.execPath, args, { stdio: "inherit", env: process.env }).status === 0;
const reseed = () => node(["seed.js", "--force"]);

(async () => {
  const server = spawn(process.execPath, ["server.js"], { stdio: "inherit", env: process.env });
  let healthy = false;
  for (let i = 0; i < 40 && !healthy; i++) {
    await new Promise((r) => setTimeout(r, 500));
    healthy = await fetch(`http://localhost:${PORT}/api/health`).then((r) => r.ok).catch(() => false);
  }
  if (!healthy) { console.error("Server did not start"); server.kill(); process.exit(1); }

  const results = [];
  const suite = (name, file, needsServer) => { reseed(); results.push([name, node([file])]); void needsServer; };
  suite("API (145 checks)", "tests/api.test.js", true);
  suite("New features (83 checks)", "tests/features2.test.js", true);
  suite("Maintenance, mess finance, payroll (109 checks)", "tests/ops.test.js", true);
  suite("Maintenance reminders (10 checks)", "tests/scheduler.test.js");
  suite("Email (8 checks)", "tests/email.test.js");
  suite("Password reset (18 checks)", "tests/reset.test.js");
  suite("AI report logic (15 checks)", "tests/report.test.js");
  server.kill();

  console.log("\n==== SUMMARY ====");
  results.forEach(([n, okk]) => console.log(okk ? "✓" : "✗ FAILED", n));
  process.exit(results.every(([, okk]) => okk) ? 0 : 1);
})();
