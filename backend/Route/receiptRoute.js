// routes/receiptRoute.js
const express = require("express");
const receiptController = require("../Controlers/receiptController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Generate receipt for a specific order
router.get("/:orderId", requireAuth, receiptController.generateReceipt);

module.exports = router;
