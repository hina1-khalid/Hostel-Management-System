const router = require("express").Router();
const { exportData } = require("../controllers/exportController");
const { protect, authorize } = require("../middleware/authMiddleware");
router.get("/:type", protect, authorize("admin", "superadmin"), exportData);
module.exports = router;
