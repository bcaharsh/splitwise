import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import {
  createReminder,
  getUserReminders,
  updateReminderStatus,
  snoozeReminder,
  deleteReminder,
} from "../services/reminder.service.js";

/**
 * Create reminder
 */
const createReminderController = async (req, res) => {
  const {
    user_id,
    related_user_id,
    group_id,
    expense_id,
    reminder_type,
    title,
    message,
    remind_at,
    is_recurring,
    recurrence_pattern,
  } = req.body;

  if (!user_id || !reminder_type || !title || !remind_at) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id, reminder_type, title, and remind_at are required",
    });
  }

  const reminderData = {
    user_id,
    related_user_id,
    group_id,
    expense_id,
    reminder_type,
    title,
    message,
    remind_at,
    is_recurring,
    recurrence_pattern,
  };

  const reminder = await createReminder(reminderData);

  return res.status(201).json({
    status: 201,
    success: true,
    message: "Reminder created successfully",
    data: reminder,
  });
};

/**
 * Get user reminders
 */
const getReminders = async (req, res) => {
  const { user_id, status, reminder_type } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const filters = { status, reminder_type };

  const reminders = await getUserReminders(user_id, filters);

  return res.status(200).json({
    status: 200,
    success: true,
    data: reminders,
    count: reminders.length,
  });
};

/**
 * Dismiss reminder
 */
const dismissReminder = async (req, res) => {
  const { reminder_id } = req.body;

  if (!reminder_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "reminder_id is required",
    });
  }

  await updateReminderStatus(reminder_id, "dismissed");

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Reminder dismissed",
  });
};

/**
 * Snooze reminder
 */
const snoozeReminderController = async (req, res) => {
  const { reminder_id, snooze_until } = req.body;

  if (!reminder_id || !snooze_until) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "reminder_id and snooze_until are required",
    });
  }

  await snoozeReminder(reminder_id, snooze_until);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Reminder snoozed",
  });
};

/**
 * Delete reminder
 */
const deleteReminderController = async (req, res) => {
  const { reminder_id } = req.body;

  if (!reminder_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "reminder_id is required",
    });
  }

  await deleteReminder(reminder_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Reminder deleted",
  });
};

// Routes
router.post("/create", Errorhandler(createReminderController));
router.get("/list", Errorhandler(getReminders));
router.post("/dismiss", Errorhandler(dismissReminder));
router.post("/snooze", Errorhandler(snoozeReminderController));
router.delete("/delete", Errorhandler(deleteReminderController));

export default router;
