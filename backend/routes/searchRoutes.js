const router = require("express").Router();
const { globalSearch } = require("../controllers/searchController");
const { protect, authorize } = require("../middleware/authMiddleware");
router.get("/", protect, authorize("admin", "superadmin", "security"), globalSearch);
module.exports = router;
