// app.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const productRouter = require("./Route/ProductRoute");
const supplierProductRouter = require("./Route/SupplierProductRoute");
const userRouter = require("./Route/UserRoute");
const RoleRoute = require("./Route/RoleRoute");

const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" })); // frontend

// ✅ Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/products", productRouter);
app.use("/supplierProducts", supplierProductRouter);
app.use("/users", userRouter);
app.use("/roles", RoleRoute);

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
