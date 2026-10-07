const router = require("express").Router();
const c = require("../controllers/qrEntryController");
const { protect, authorize } = require("../middleware/authMiddleware");
router.post("/scan", protect, authorize("security"), c.scanQr);
router.get("/", protect, authorize("admin", "superadmin", "security"), c.getQrEntries);
router.get("/me", protect, authorize("student"), c.getMyEntryHistory);
router.get("/student/:studentId", protect, authorize("admin", "superadmin", "security"), c.getStudentEntryHistory);
module.exports = router;
