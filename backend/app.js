// app.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const productRouter = require("./Route/ProductRoute");
const supplierProductRouter = require("./Route/SupplierProductRoute");
const userRouter = require("./Route/UserRoute");
const roleRouter = require("./Route/RoleRoute");
const orderRoute = require("./Route/orderRoute");
const adminorderRoute = require("./Route/adminOrderRoute");
const reviewRoutes = require("./Route/ReviewRoutes");
const paymentRoute = require("./Route/paymentRoute");
const notificationRoute = require("./Route/NotificationRoute");

// ✅ Stripe webhook controller
const { stripeWebhook } = require("./Controlers/paymentController");

const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000", credentials: true }));

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

app.use("/users", userRouter);       
app.use("/api/users", userRouter);  

app.use("/roles", roleRouter);         
app.use("/api/roles", roleRouter);    

app.use("/api/orders", orderRoute);
app.use("/api/admin-orders", adminorderRoute);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoute);

app.use("/api/notifications", notificationRoute);

// Root test endpoint
app.get("/", (req, res) => {
  res.send("Backend running...");
});

// DB connection + server
mongoose
  .connect("mongodb+srv://admin:QsTd3vVSiVm6Pn6j@cluster0.nirwofp.mongodb.net/")
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(5000, () => console.log("Server running on port 5000"));
  })
  .catch((err) => console.error("MongoDB connection error:", err));

module.exports = app;
