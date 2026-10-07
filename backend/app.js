// The Express app (no database connection and no listening here, so tests can import it).
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { auditMiddleware } = require("./utils/audit");
const { buildOpenApi } = require("./docs/openapi");

const app = express();
app.set("trust proxy", 1);

const routes = {
  auth: "authRoutes", hostels: "hostelRoutes", rooms: "roomRoutes", students: "studentRoutes", fees: "feeRoutes",
  complaints: "complaintRoutes", "qr-entries": "qrEntryRoutes", attendance: "attendanceRoutes", leaves: "leaveRoutes",
  visitors: "visitorRoutes", notices: "noticeRoutes", dashboard: "dashboardRoutes", notifications: "notificationRoutes",
  inventory: "inventoryRoutes", mess: "messRoutes", laundry: "laundryRoutes", chatbot: "chatbotRoutes", search: "searchRoutes",
  export: "exportRoutes", reports: "reportRoutes", "room-requests": "roomRequestRoutes", audit: "auditRoutes", files: "fileRoutes",
  maintenance: "maintenanceRoutes", "mess-finance": "messFinanceRoutes", workforce: "workforceRoutes",
};
const mounts = Object.entries(routes).map(([path, file]) => [path, require(`./routes/${file}`)]);

// API documentation (served before helmet: Swagger UI needs inline scripts that helmet's CSP would block)
let spec;
app.get("/api/docs.json", (req, res) => res.json((spec ||= buildOpenApi(mounts))));
app.use("/api/docs", swaggerUi.serve, (req, res, next) =>
  swaggerUi.setup(null, { swaggerUrl: "/api/docs.json", customSiteTitle: "Hostel API docs" })(req, res, next)
);

app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_URL || "http://localhost:5173").split(","), credentials: true, exposedHeaders: ["Content-Disposition", "X-Total-Count"] }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(auditMiddleware);

// Brute-force protection on auth endpoints
const limiter = (windowMs, max, message) => rateLimit({ windowMs, max, message: { message } });
app.use("/api/auth/login", limiter(15 * 60 * 1000, Number(process.env.LOGIN_RATE_LIMIT || 30), "Too many login attempts. Try again in 15 minutes."));
app.use("/api/auth/register", limiter(60 * 60 * 1000, 20, "Too many registrations from this IP."));
app.use("/api/auth/forgot-password", limiter(60 * 60 * 1000, Number(process.env.RESET_RATE_LIMIT || 8), "Too many reset requests. Try again in an hour."));
app.use("/api/auth/reset-password", limiter(60 * 60 * 1000, Number(process.env.RESET_RATE_LIMIT || 8) * 2, "Too many attempts. Try again in an hour."));

mounts.forEach(([path, router]) => app.use(`/api/${path}`, router));

app.get("/", (req, res) => res.json({ message: "🏠 Hostel Management System API is running", health: "/api/health", docs: "/api/docs" }));
app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
