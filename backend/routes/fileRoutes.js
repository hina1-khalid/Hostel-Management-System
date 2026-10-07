const router = require("express").Router();
const { getFile } = require("../controllers/fileController");
const { protect } = require("../middleware/authMiddleware");
router.get("/:id", protect, getFile);
module.exports = router;
