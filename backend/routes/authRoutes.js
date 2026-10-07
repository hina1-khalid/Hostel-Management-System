const router = require("express").Router();
const c = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validate } = require("../utils/validate");
const v = require("../validation/schemas");

router.post("/register", validate(v.register), c.registerUser);
router.post("/login", validate(v.login), c.loginUser);
router.post("/forgot-password", validate(v.forgotPassword), c.forgotPassword);
router.post("/reset-password", validate(v.resetPassword), c.resetPassword);
router.get("/me", protect, c.getMe);
router.put("/profile", protect, validate(v.profile), c.updateProfile);
router.put("/change-password", protect, validate(v.changePassword), c.changePassword);
router.post("/create-staff", protect, authorize("superadmin", "admin"), validate(v.createStaff), c.createStaffUser);
router.get("/staff", protect, authorize("superadmin", "admin"), c.getStaff);
router.put("/staff/:id", protect, authorize("superadmin", "admin"), c.updateStaff);
module.exports = router;
