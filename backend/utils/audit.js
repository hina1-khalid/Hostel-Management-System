const AuditLog = require("../models/AuditLog");

const SENSITIVE = /pass|token|secret|authorization|cnic/i;
const SKIP = [/^\/api\/notifications/, /^\/api\/chatbot/, /^\/api\/audit/, /^\/api\/docs/];

// Keep a small, safe copy of the request body (no passwords/tokens, short strings, few keys)
const scrub = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 200 ? value.slice(0, 200) + "…" : value;
  if (typeof value !== "object") return value;
  if (depth >= 2) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => scrub(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value).slice(0, 15)) out[k] = SENSITIVE.test(k) ? "[hidden]" : scrub(v, depth + 1);
  return out;
};

const toRoute = (p) => p.replace(/[a-f\d]{24}/gi, ":id");
const firstId = (p) => (p.match(/[a-f\d]{24}/i) || [])[0];

const write = (entry) => AuditLog.create(entry).catch((e) => console.error("audit log failed:", e.message));

// Logs every successful POST/PUT/PATCH/DELETE made by a signed-in user
const auditMiddleware = (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  res.on("finish", () => {
    const path = req.originalUrl.split("?")[0];
    if (res.statusCode >= 400 || !req.user || SKIP.some((r) => r.test(path))) return;
    const isAuth = /^\/api\/auth/.test(path);
    write({
      user: req.user._id, userName: req.user.name, role: req.user.role,
      method: req.method, route: toRoute(path), path, entity: path.split("/")[2], entityId: firstId(path),
      status: res.statusCode, details: isAuth ? undefined : scrub(req.body), ip: req.ip,
    });
  });
  next();
};

// For events that happen before req.user exists (e.g. sign-in)
const logEvent = (user, route, details) =>
  write({ user: user._id, userName: user.name, role: user.role, method: "POST", route, path: route, entity: route.split("/")[2], status: 200, details });

module.exports = { auditMiddleware, logEvent, scrub };
