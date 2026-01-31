// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import resellerDashboardRoutes from "./routes/resellerDashboard.routes.js";
import razorpayRoutes from "./routes/razorpay.routes.js";
import kycRoutes from "./routes/kyc.routes.js";
import virtualNumbersRoutes from "./routes/virtualNumbers.routes.js";
import otpRoutes from "./routes/otp.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import resellerRoutes from "./routes/reseller.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { corsOriginHandler } from "./middleware/cors.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  }),
);

// Body parser middleware - but webhook routes will use raw body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "virtualnumber-api",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/reseller-dashboard", resellerDashboardRoutes);
app.use("/api/razorpay", razorpayRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reseller", resellerRoutes);

// External API Routes (Virtual Numbers API)
app.use("/virtualnumbers", virtualNumbersRoutes);

// Serve static files from dist folder (React build)
// This should be after API routes so API routes take precedence
const distPath = path.join(__dirname, "../../dist");
app.use(express.static(distPath));

// For React Router - serve index.html for all non-API routes
app.get("*", (req, res, next) => {
  // Skip API routes and virtualnumbers routes
  if (req.path.startsWith("/api") || req.path.startsWith("/virtualnumbers")) {
    return next();
  }
  
  // Serve index.html for all other routes (React Router handles routing)
  res.sendFile(path.join(distPath, "index.html"));
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;
