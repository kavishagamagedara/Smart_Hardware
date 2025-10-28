const express = require('express');
const router = express.Router();
const ReportController = require('../Controlers/ReportController');
const { requireAuth } = require('../middleware/auth');

// Protected reports
router.get('/weekly', requireAuth, ReportController.weeklyReport);
router.get('/monthly', requireAuth, ReportController.monthlyReport);
router.get('/realtime', requireAuth, ReportController.realtimeReport);
// Temporary public debug endpoint (no auth) for quick inspection during development
router.get('/realtime-public', ReportController.realtimeReport);

module.exports = router;
