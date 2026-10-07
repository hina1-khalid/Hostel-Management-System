const router = require("express").Router();
const c = require("../controllers/hostelController");
const { protect, authorize } = require("../middleware/authMiddleware");
router.route("/").get(protect, c.getHostels).post(protect, authorize("superadmin"), c.createHostel);
router.route("/:id").get(protect, c.getHostelById).put(protect, authorize("superadmin"), c.updateHostel).delete(protect, authorize("superadmin"), c.deleteHostel);
module.exports = router;
