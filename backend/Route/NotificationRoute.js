const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
	listNotifications,
	markNotificationRead,
	markAllNotificationsRead,
	removeNotification
} = require('../Controlers/NotificationController');

const router = express.Router();

router.use(requireAuth);

router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.delete('/:id', removeNotification);

module.exports = router;
