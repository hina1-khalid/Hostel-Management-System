const AuditLog = require("../models/AuditLog");
const { wrap, paginate } = require("../utils/helpers");

// GET /api/audit?entity=&method=&role=&q=&from=&to=&page=&limit=   (superadmin)
const list = wrap(async (req, res) => {
  const filter = {};
  ["entity", "method", "role"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
  if (req.query.q) {
    const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ userName: rx }, { route: rx }];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00+05:00`);
    if (req.query.to) filter.createdAt.$lt = new Date(new Date(`${req.query.to}T00:00:00+05:00`).getTime() + 86400000);
  }
  const { limit, skip } = paginate(req, 25);
  res.set("X-Total-Count", String(await AuditLog.countDocuments(filter)));
  res.json(await AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit));
});

module.exports = { list };
