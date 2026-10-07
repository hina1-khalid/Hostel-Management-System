const router = require("express").Router();
const c = require("../controllers/inventoryController");
const { protect, authorize } = require("../middleware/authMiddleware");
const A = authorize("admin", "superadmin");
router.route("/").get(protect, A, c.getItems).post(protect, A, c.createItem);
router.get("/summary", protect, A, c.getSummary);
router.route("/:id").put(protect, A, c.updateItem).delete(protect, A, c.deleteItem);
module.exports = router;
