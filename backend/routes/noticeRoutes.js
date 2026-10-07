const router = require("express").Router();
const c = require("../controllers/noticeController");
const { protect, authorize } = require("../middleware/authMiddleware");
const A = authorize("admin", "superadmin");
router.route("/").get(protect, A, c.getNotices).post(protect, A, c.createNotice);
router.get("/me", protect, c.getMyNotices);
router.route("/:id").put(protect, A, c.updateNotice).delete(protect, A, c.deleteNotice);
module.exports = router;
