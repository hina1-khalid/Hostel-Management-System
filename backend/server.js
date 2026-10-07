require("dotenv").config();
const connectDB = require("./config/db");

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing in .env");
  process.exit(1);
}

const app = require("./app");
const PORT = process.env.PORT || 5000;
connectDB().then(() =>
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    require("./utils/scheduler").start();
  })
);
