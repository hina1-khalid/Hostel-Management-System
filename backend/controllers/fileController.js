const Attachment = require("../models/Attachment");
const Complaint = require("../models/Complaint");
const { wrap, fail, assertId, assertOwnerOrAdmin } = require("../utils/helpers");

// GET /api/files/:id -> the image itself. Only the student who filed the complaint, or an admin of that hostel.
const getFile = wrap(async (req, res) => {
  assertId(req.params.id);
  const file = await Attachment.findById(req.params.id).select("+data");
  if (!file) fail(404, "File not found");
  const complaint = await Complaint.findById(file.complaint);
  if (!complaint) fail(404, "File not found");
  await assertOwnerOrAdmin(req, complaint.student, complaint.hostel);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Length", file.size);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("Content-Disposition", "inline");
  res.send(file.data);
});

module.exports = { getFile };
