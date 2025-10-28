const express = require("express");
const {
	listByDate,
	listByUser,
	upsertAttendance,
	summaryByRange,
	exportAttendanceReport,
} = require("../Controlers/AttendanceController");
const { requireAuth, requireAdmin, requireFinanceOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, requireAdmin, listByDate);
router.get("/user/:userId", requireAuth, requireAdmin, listByUser);
router.post("/", requireAuth, requireAdmin, upsertAttendance);
router.get("/report", requireAuth, requireAdmin, exportAttendanceReport);
router.get("/summary", requireAuth, requireFinanceOrAdmin, summaryByRange);

module.exports = router;
