const router = require("express").Router();
const c = require("../controllers/reportController");
const { protect, authorize } = require("../middleware/authMiddleware");
const A = authorize("admin", "superadmin");
router.get("/", protect, A, c.listReports);
router.post("/generate", protect, A, c.generateReport);
router.get("/:id", protect, A, c.getReport);
module.exports = router;
