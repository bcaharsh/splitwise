import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} from "../services/notification.service.js";

/**
 * Get user notifications
 */
const getNotifications = async (req, res) => {
  const { user_id, is_read, notification_type, limit } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const filters = {
    is_read: is_read !== undefined ? parseInt(is_read) : undefined,
    notification_type,
    limit,
  };

  const notifications = await getUserNotifications(user_id, filters);

  return res.status(200).json({
    status: 200,
    success: true,
    data: notifications,
    count: notifications.length,
  });
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (req, res) => {
  const { notification_id } = req.body;

  if (!notification_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "notification_id is required",
    });
  }

  await markAsRead(notification_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Notification marked as read",
  });
};

/**
 * Mark all notifications as read
 */
const markAllNotificationsAsRead = async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  await markAllAsRead(user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "All notifications marked as read",
  });
};

/**
 * Delete notification
 */
const deleteNotificationController = async (req, res) => {
  const { notification_id } = req.body;

  if (!notification_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "notification_id is required",
    });
  }

  await deleteNotification(notification_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Notification deleted",
  });
};

/**
 * Get unread count
 */
const getUnreadCountController = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const count = await getUnreadCount(user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: { unread_count: count },
  });
};

// Routes
router.get("/list", Errorhandler(getNotifications));
router.post("/mark-read", Errorhandler(markNotificationAsRead));
router.post("/mark-all-read", Errorhandler(markAllNotificationsAsRead));
router.delete("/delete", Errorhandler(deleteNotificationController));
router.get("/unread-count", Errorhandler(getUnreadCountController));

export default router;
