const express = require("express");
const router = express.Router();

const {
  createRefundRequest,
  listMyRefunds,
  listRefunds,
  getRefundById,
  replyToRefund,
} = require("../Controlers/RefundController");
const { requireAuth, requirePermission } = require("../middleware/permissions");

router.use(requireAuth);

router.post("/", createRefundRequest);
router.get("/mine", listMyRefunds);
router.get(
  "/",
  requirePermission(
    "refund_view_requests",
    "refund_manage_requests",
    "cc_manage_returns",
    "moderate_feedback"
  ),
  listRefunds
);
router.get("/:id", getRefundById);
router.post("/:id/reply", replyToRefund);

module.exports = router;
