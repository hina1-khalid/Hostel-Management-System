const router = require("express").Router();
const c = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");
router.get("/", protect, c.list);
router.post("/test-email", protect, c.testEmail);
router.put("/read-all", protect, c.markAllRead);
router.put("/:id/read", protect, c.markRead);
router.delete("/:id", protect, c.remove);
module.exports = router;
