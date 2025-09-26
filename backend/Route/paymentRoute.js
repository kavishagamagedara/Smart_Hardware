// routes/paymentRoutes.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");

const {
  getAllPayments,
  addPayment,
  getPaymentById,
  updatePayment,
  deletePayment,
  uploadSlip,
  createStripePaymentIntent,
  createPaymentWithSlip,
  updatePaymentStatus,
  createCheckoutSession, 
  recordCheckoutSession,
} = require("../Controlers/paymentController");

const router = express.Router();

/* ----------------------------- ensure upload dir ----------------------------- */
const uploadDir = path.join(process.cwd(), "uploads", "slips");
fs.mkdirSync(uploadDir, { recursive: true });

/* ----------------------------- multer setup ----------------------------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_").slice(0, 80);
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({ storage });

/* ----------------------------- CRUD (admin UI) ----------------------------- */
router.get("/", getAllPayments);
router.post("/", addPayment);
router.get("/:id", getPaymentById);
router.put("/:id", updatePayment);
router.delete("/:id", deletePayment);

/* ------------------------ Slip endpoints ------------------------ */
router.post("/slip", upload.single("slip"), createPaymentWithSlip);
router.put("/:id/slip", upload.single("slip"), uploadSlip);

/* --------------------------- STRIPE endpoints --------------------------- */
router.post("/stripe/create-intent", createStripePaymentIntent);
router.post("/stripe/update-status", updatePaymentStatus);
router.post("/stripe/record-session", recordCheckoutSession);

router.post(
  "/stripe/create-checkout-session",
  requireAuth,            
  createCheckoutSession
);


// NOTE: Do NOT mount the webhook here. It's mounted raw in app.js.

module.exports = router;
