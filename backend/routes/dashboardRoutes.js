const router = require("express").Router();
const c = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");
const A = authorize("admin", "superadmin");
router.get("/summary", protect, A, c.getDashboardSummary);
router.get("/fee-chart", protect, A, c.getFeeChart);
router.get("/occupancy-chart", protect, A, c.getOccupancyChart);
router.get("/complaint-stats", protect, A, c.getComplaintStats);
module.exports = router;
