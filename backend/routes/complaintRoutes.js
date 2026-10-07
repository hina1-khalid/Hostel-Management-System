const router = require("express").Router();
const c = require("../controllers/complaintController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { photos } = require("../utils/upload");
const { validate } = require("../utils/validate");
const v = require("../validation/schemas");
const A = authorize("admin", "superadmin");
// photos (multipart) is optional: plain JSON requests also work
router.route("/").get(protect, A, c.getComplaints).post(protect, authorize("student"), photos, validate(v.createComplaint), c.createComplaint);
router.get("/me", protect, authorize("student"), c.getMyComplaints);
router.route("/:id").get(protect, c.getComplaintById).put(protect, A, c.updateComplaint).delete(protect, A, c.deleteComplaint);
router.post("/:id/comments", protect, c.addComment);
module.exports = router;
