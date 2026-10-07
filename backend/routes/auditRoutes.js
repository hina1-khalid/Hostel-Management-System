const router = require("express").Router();
const { list } = require("../controllers/auditController");
const { protect, authorize } = require("../middleware/authMiddleware");
router.get("/", protect, authorize("superadmin"), list);
module.exports = router;
