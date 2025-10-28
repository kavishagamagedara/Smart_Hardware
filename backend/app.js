// app.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const productRouter = require("./Route/ProductRoute");
const supplierProductRouter = require("./Route/SupplierProductRoute");
const supplierDiscountRoute = require("./Route/SupplierDiscountRoute");
const userRouter = require("./Route/UserRoute");
const roleRouter = require("./Route/RoleRoute");
const orderRoute = require("./Route/orderRoute");
const adminorderRoute = require("./Route/adminOrderRoute");
const reviewRoutes = require("./Route/ReviewRoutes");
const paymentRoute = require("./Route/paymentRoute");
const notificationRoute = require("./Route/NotificationRoute");
const attendanceRoute = require("./Route/AttendanceRoute");
const receiptRoute = require("./Route/receiptRoute");
const refundRoute = require("./Route/RefundRoute");
const reportRoute = require("./Route/ReportRoute");
const cartRoute = require("./Route/CartRoute");
const adminCartRoute = require("./Route/AdminCartRoute");
const adminCancelledOrderRoute = require("./Route/adminCancelledOrderRoute");

// ✅ Stripe webhook controller
const { stripeWebhook } = require("./Controlers/paymentController");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001"], credentials: true }));

// ✅ Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ------------------ Stripe webhook (raw body required) ------------------
// This **must** be before express.json()
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, _res, next) => {
    req.rawBody = req.body; // Stripe requires raw buffer
    next();
  },
  stripeWebhook
);

// ------------------ Routes ------------------
app.use("/products", productRouter);
app.use("/supplier-products", supplierProductRouter);
app.use("/api/supplier-discounts", supplierDiscountRoute);

app.use("/users", userRouter);       
app.use("/api/users", userRouter);  

app.use("/roles", roleRouter);         
app.use("/api/roles", roleRouter);    

app.use("/api/orders", orderRoute);
app.use("/api/admin-orders", adminorderRoute);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoute);
app.use("/api/attendance", attendanceRoute);
app.use("/api/receipts", receiptRoute);
app.use("/api/refunds", refundRoute);

app.use("/api/notifications", notificationRoute);
app.use("/api/reports", reportRoute);
app.use("/api/carts", cartRoute);
app.use("/api/admin-carts", adminCartRoute);
app.use("/api/admin-cancelled-orders", adminCancelledOrderRoute);

// Root test endpoint
app.get("/", (req, res) => {
  res.send("Backend running...");
});

function sanitizeUri(raw) {
  return typeof raw === "string" ? raw.trim() : "";
}

function isPlaceholderAtlasUri(uri) {
  if (!uri) return false;
  const lower = uri.toLowerCase();
  return lower.includes("username:password") || lower.includes("cluster.mongodb.net/smart_hardware");
}

async function connectToMongo() {
  const atlasFromEnv = sanitizeUri(process.env.MONGODB_URI);
  const suppliedAtlasUri = !isPlaceholderAtlasUri(atlasFromEnv) && atlasFromEnv.length ? atlasFromEnv : null;
  const bundledAtlasUri =
    "mongodb+srv://admin:QsTd3vVSiVm6Pn6j@cluster0.nirwofp.mongodb.net/smart_hardware";
  const legacyAtlasUri =
    "mongodb+srv://admin:QsTd3vVSiVm6Pn6j@cluster0.nirwofp.mongodb.net/test";
  const localUri =
    sanitizeUri(process.env.MONGODB_LOCAL_URI) || "mongodb://127.0.0.1:27017/smarthardware";

  if (atlasFromEnv && !suppliedAtlasUri) {
    console.warn(
      "⚠️  Ignoring MONGODB_URI from .env because it still contains placeholder values. Update it with your real Atlas credentials."
    );
  }

  const preferLocal = sanitizeUri(process.env.PREFER_LOCAL_MONGO) === "true";
  const localFirst = preferLocal ? [localUri] : [];
  const remoteUris = [suppliedAtlasUri, legacyAtlasUri, bundledAtlasUri].filter(Boolean);
  const localLast = preferLocal ? remoteUris : [...remoteUris, localUri];

  const mongoCandidates = preferLocal ? [...localFirst, ...remoteUris] : localLast;
  const failures = [];

  for (const uri of mongoCandidates) {
    try {
      const display = uri.includes("@") ? uri.split("@").pop() : uri;
      console.log(`🔗 Attempting MongoDB connection: ${display}`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      console.log("✅ MongoDB connection established");
      return true;
    } catch (err) {
      const message = err?.message || String(err);
      const display = uri.includes("@") ? uri.split("@").pop() : uri;
      failures.push({ display, message });
      console.error("⚠️  MongoDB connection failed:", message);
    }
  }

  console.warn("⚠️  All MongoDB connection attempts failed. Continuing in mock mode.");

  const localFailure = failures.find(({ display, message }) => display.includes("127.0.0.1") && message.includes("ECONNREFUSED"));
  if (localFailure) {
    console.warn(
      "💡 Local MongoDB appears to be offline. Start it manually or run `docker compose up -d mongo` from the project root to spin up the bundled container."
    );
  }

  if (failures.some(({ message }) => message.toLowerCase().includes("whitelist"))) {
    console.warn(
      "🔐 Your Atlas cluster is rejecting the connection. Make sure this machine's IP is whitelisted in the Atlas Network Access settings."
    );
  }

  if (failures.length) {
    console.warn("ℹ️  Connection attempts summary:");
    failures.forEach(({ display, message }) => {
      console.warn(`   • ${display}: ${message}`);
    });
  }

  return false;
}

async function startServer() {
  const dbConnected = await connectToMongo();
  app.locals.dbConnected = dbConnected;

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (dbConnected) {
      console.log("✅ Backend is ready for connections");
    } else {
      console.log("📊 Running with mock data (database unavailable)");
    }
  });

  // ---------------- Socket.IO (real-time) ----------------
  try {
    const { Server } = require("socket.io");
    const io = new Server(server, {
      cors: {
        origin: ["http://localhost:3000"],
        methods: ["GET", "POST"],
      },
    });
    app.locals.io = io;
    io.on("connection", (socket) => {
      console.log("[socket] client connected:", socket.id);
      socket.on("disconnect", () => console.log("[socket] client disconnected:", socket.id));
    });
  } catch (err) {
    console.warn("Socket.IO not available:", err && err.message);
  }

  server.on("error", (err) => {
    console.error("Server error:", err);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("SIGINT", async () => {
    console.log("\n📴 Received SIGINT, shutting down gracefully...");
    server.close(async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
        }
      } finally {
        process.exit(0);
      }
    });
  });
}

startServer().catch((err) => {
  console.error("Failed to start backend:", err);
  process.exit(1);
});

module.exports = app;
