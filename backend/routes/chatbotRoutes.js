const router = require("express").Router();
const { chat } = require("../controllers/chatbotController");
const { protect } = require("../middleware/authMiddleware");
router.post("/", protect, chat);
module.exports = router;
