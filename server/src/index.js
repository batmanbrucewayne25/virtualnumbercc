// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer server/.env; fall back to repo-root .env (when running from server/ with .env only at project root)
const serverEnvPath = path.join(__dirname, "../.env");
const rootEnvPath = path.join(__dirname, "../../.env");
dotenv.config({ path: serverEnvPath });
if (!process.env.HASURA_GRAPHQL_ENDPOINT) {
  dotenv.config({ path: rootEnvPath });
}
// Shared .env often uses VITE_* for the frontend; server needs unprefixed names.
if (!process.env.HASURA_GRAPHQL_ENDPOINT && process.env.VITE_HASURA_GRAPHQL_ENDPOINT) {
  process.env.HASURA_GRAPHQL_ENDPOINT = process.env.VITE_HASURA_GRAPHQL_ENDPOINT;
}
if (!process.env.HASURA_ADMIN_SECRET && process.env.VITE_HASURA_ADMIN_SECRET) {
  process.env.HASURA_ADMIN_SECRET = process.env.VITE_HASURA_ADMIN_SECRET;
}

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import resellerDashboardRoutes from "./routes/resellerDashboard.routes.js";
import razorpayRoutes from "./routes/razorpay.routes.js";
import kycRoutes from "./routes/kyc.routes.js";
import virtualNumbersRoutes from "./routes/virtualNumbers.routes.js";
import virtualNumberProxyRoutes from "./routes/virtualNumberProxy.routes.js";
import otpRoutes from "./routes/otp.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import resellerRoutes from "./routes/reseller.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { corsOriginHandler } from "./middleware/cors.middleware.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  }),
);

// Body parser middleware
// CRITICAL: For Razorpay webhook routes we must preserve the raw body buffer
// so that HMAC-SHA256 signature verification works correctly.
// express.json() must NOT run on webhook routes — it consumes the stream and
// JSON.stringify(parsed) does not reproduce the exact original byte sequence.
app.use((req, res, next) => {
  // Capture raw body for Razorpay webhook signature verification.
  // We must consume the stream here AND set req._body = true so that
  // express.json() (below) skips re-reading an already-consumed stream,
  // which would throw "stream is not readable".
  if (req.path.startsWith("/api/razorpay/webhook/")) {
    console.log(`[RawBody] Capturing raw body for webhook path: ${req.path}`);
    let data = [];
    req.on("data", (chunk) => data.push(chunk));
    req.on("end", () => {
      const rawBuf = Buffer.concat(data);
      req.rawBody = rawBuf.toString("utf8");
      req.rawBodyBuffer = rawBuf;
      console.log(`[RawBody] Captured ${rawBuf.length} bytes`);
      // Parse JSON body so controllers can access req.body
      try {
        req.body = JSON.parse(req.rawBody);
      } catch {
        req.body = {};
      }
      // CRITICAL: tell body-parser the body is already parsed — prevents
      // express.json() from trying to read the consumed stream again.
      req._body = true;
      next();
    });
    req.on("error", (err) => {
      console.error("[RawBody] Stream error:", err);
      next(err);
    });
  } else {
    next();
  }
});

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
app.use("/api/upload", uploadRoutes);

// External API Routes (Virtual Numbers API — API-key auth for partners)
app.use("/virtualnumbers", virtualNumbersRoutes);

// Internal proxy to VN API (JWT auth for admin/reseller UI)
app.use("/api/virtual-numbers", virtualNumberProxyRoutes);

// Serve uploaded images (Option A: use default path so save and serve match;
// do not set IMAGE_UPLOAD_PATH in server .env)
const uploadsPath = path.join(__dirname, "../uploads");
console.log(`📂 Uploads path: ${path.resolve(uploadsPath)}`);
app.use("/uploads", express.static(uploadsPath));

// Serve static files from dist folder (React build)
// This should be after API routes so API routes take precedence
const distPath = path.join(__dirname, "../../dist");
app.use(express.static(distPath));

// For React Router - serve index.html for all non-API routes
app.get("*", (req, res, next) => {
  // Skip API routes, virtualnumbers routes, and static uploads
  if (
    req.path.startsWith("/api") ||
    req.path.startsWith("/virtualnumbers") ||
    req.path.startsWith("/uploads")
  ) {
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
