const router = require("express").Router();
const c = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/authMiddleware");
const A = authorize("admin", "superadmin");
router.route("/").get(protect, A, c.getAttendance).post(protect, A, c.markAttendance);
router.post("/bulk", protect, A, c.bulkMarkAttendance);
router.get("/sheet", protect, A, c.getSheet);
router.get("/me", protect, authorize("student"), c.getMyAttendance);
module.exports = router;
