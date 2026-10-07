const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verifies the JWT and attaches the user to req.user
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer")) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
  } catch {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
  if (!req.user || req.user.isActive === false) {
    return res.status(401).json({ message: "Account not found or deactivated" });
  }
  next(); // outside the try/catch so errors from later handlers are not mistaken for token errors
};
protect.isProtect = true; // used by the API docs generator

// Usage: authorize("superadmin", "admin") -> only these roles can access
const authorize = (...roles) => {
  const guard = (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Role '${req.user?.role}' is not permitted to perform this action.`,
      });
    }
    next();
  };
  guard.roles = roles; // used by the API docs generator
  return guard;
};

module.exports = { protect, authorize };
