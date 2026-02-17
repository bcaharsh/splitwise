import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create reminder
 * @param {object} reminderData
 * @returns {Promise<object>}
 */
export const createReminder = async (reminderData) => {
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
  } = reminderData;

  if (!user_id || !reminder_type || !title || !remind_at) {
    throw new Error(
      "user_id, reminder_type, title, and remind_at are required",
    );
  }

  const reminder_id = uuidv4();

  const insert_query = `
    INSERT INTO reminders (
      reminder_id,
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
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    reminder_id,
    user_id,
    related_user_id || null,
    group_id || null,
    expense_id || null,
    reminder_type,
    title,
    message || null,
    remind_at,
    is_recurring || 0,
    recurrence_pattern || null,
    "pending",
  ];

  const [reminder] = await con.execute(insert_query, params);

  return { reminder_id, ...reminder };
};

/**
 * Get user reminders
 * @param {string} user_id
 * @param {object} filters
 * @returns {Promise<Array>}
 */
export const getUserReminders = async (user_id, filters = {}) => {
  let query = `
    SELECT 
      r.*,
      u.first_name as related_user_first_name,
      u.last_name as related_user_last_name,
      g.group_name
    FROM reminders r
    LEFT JOIN users u ON r.related_user_id = u.user_id
    LEFT JOIN expense_groups g ON r.group_id = g.group_id
    WHERE r.user_id = ?
  `;

  const params = [user_id];

  if (filters.status) {
    query += ` AND r.status = ?`;
    params.push(filters.status);
  }

  if (filters.reminder_type) {
    query += ` AND r.reminder_type = ?`;
    params.push(filters.reminder_type);
  }

  query += ` ORDER BY r.remind_at ASC`;

  const [reminders] = await con.execute(query, params);

  return reminders;
};

/**
 * Update reminder status
 * @param {string} reminder_id
 * @param {string} status
 * @returns {Promise<object>}
 */
export const updateReminderStatus = async (reminder_id, status) => {
  const update_query = `
    UPDATE reminders
    SET status = ?, updated_at = NOW()
    WHERE reminder_id = ?
  `;

  const [result] = await con.execute(update_query, [status, reminder_id]);

  return result;
};

/**
 * Snooze reminder
 * @param {string} reminder_id
 * @param {Date} snooze_until
 * @returns {Promise<object>}
 */
export const snoozeReminder = async (reminder_id, snooze_until) => {
  const update_query = `
    UPDATE reminders
    SET status = 'snoozed', snoozed_until = ?, updated_at = NOW()
    WHERE reminder_id = ?
  `;

  const [result] = await con.execute(update_query, [snooze_until, reminder_id]);

  return result;
};

/**
 * Delete reminder
 * @param {string} reminder_id
 * @returns {Promise<object>}
 */
export const deleteReminder = async (reminder_id) => {
  const delete_query = `
    DELETE FROM reminders
    WHERE reminder_id = ?
  `;

  const [result] = await con.execute(delete_query, [reminder_id]);

  return result;
};

/**
 * Get due reminders (for cron job)
 * @returns {Promise<Array>}
 */
export const getDueReminders = async () => {
  const now = new Date();

  const query = `
    SELECT 
      r.*,
      u.email,
      u.first_name,
      u.last_name,
      u2.first_name as related_user_first_name,
      u2.last_name as related_user_last_name,
      g.group_name
    FROM reminders r
    LEFT JOIN users u ON r.user_id = u.user_id
    LEFT JOIN users u2 ON r.related_user_id = u2.user_id
    LEFT JOIN expense_groups g ON r.group_id = g.group_id
    WHERE r.status = 'pending'
    AND r.remind_at <= ?
  `;

  const [reminders] = await con.execute(query, [now]);

  return reminders;
};

/**
 * Get snoozed reminders that are due
 * @returns {Promise<Array>}
 */
export const getDueSnoozedReminders = async () => {
  const now = new Date();

  const query = `
    SELECT 
      r.*,
      u.email,
      u.first_name,
      u.last_name
    FROM reminders r
    LEFT JOIN users u ON r.user_id = u.user_id
    WHERE r.status = 'snoozed'
    AND r.snoozed_until <= ?
  `;

  const [reminders] = await con.execute(query, [now]);

  return reminders;
};

/**
 * Mark reminder as sent
 * @param {string} reminder_id
 * @returns {Promise<object>}
 */
export const markReminderAsSent = async (reminder_id) => {
  const update_query = `
    UPDATE reminders
    SET status = 'sent', sent_at = NOW(), updated_at = NOW()
    WHERE reminder_id = ?
  `;

  const [result] = await con.execute(update_query, [reminder_id]);

  return result;
};
