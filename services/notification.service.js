import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create notification
 * @param {object} notificationData
 * @returns {Promise<object>}
 */
export const createNotification = async (notificationData) => {
  const {
    user_id,
    notification_type,
    title,
    message,
    data_payload,
    related_entity_type,
    related_entity_id,
  } = notificationData;

  if (!user_id || !notification_type || !title || !message) {
    throw new Error(
      "user_id, notification_type, title, and message are required",
    );
  }

  const notification_id = uuidv4();

  const insert_query = `
    INSERT INTO notifications (
      notification_id,
      user_id,
      notification_type,
      title,
      message,
      data_payload,
      related_entity_type,
      related_entity_id,
      is_read,
      is_pushed,
      is_emailed
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    notification_id,
    user_id,
    notification_type,
    title,
    message,
    data_payload ? JSON.stringify(data_payload) : null,
    related_entity_type || null,
    related_entity_id || null,
    0,
    0,
    0,
  ];

  const [notification] = await con.execute(insert_query, params);

  return { notification_id, ...notification };
};

/**
 * Get user notifications
 * @param {string} user_id
 * @param {object} filters
 * @returns {Promise<Array>}
 */
export const getUserNotifications = async (user_id, filters = {}) => {
  let query = `
    SELECT *
    FROM notifications
    WHERE user_id = ?
  `;

  const params = [user_id];

  if (filters.is_read !== undefined) {
    query += ` AND is_read = ?`;
    params.push(filters.is_read);
  }

  if (filters.notification_type) {
    query += ` AND notification_type = ?`;
    params.push(filters.notification_type);
  }

  query += ` ORDER BY created_at DESC`;

  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(parseInt(filters.limit));
  }

  const [notifications] = await con.execute(query, params);

  return notifications;
};

/**
 * Mark notification as read
 * @param {string} notification_id
 * @returns {Promise<object>}
 */
export const markAsRead = async (notification_id) => {
  const update_query = `
    UPDATE notifications
    SET is_read = 1, read_at = NOW()
    WHERE notification_id = ?
  `;

  const [result] = await con.execute(update_query, [notification_id]);

  return result;
};

/**
 * Mark all user notifications as read
 * @param {string} user_id
 * @returns {Promise<object>}
 */
export const markAllAsRead = async (user_id) => {
  const update_query = `
    UPDATE notifications
    SET is_read = 1, read_at = NOW()
    WHERE user_id = ? AND is_read = 0
  `;

  const [result] = await con.execute(update_query, [user_id]);

  return result;
};

/**
 * Delete notification
 * @param {string} notification_id
 * @returns {Promise<object>}
 */
export const deleteNotification = async (notification_id) => {
  const delete_query = `
    DELETE FROM notifications
    WHERE notification_id = ?
  `;

  const [result] = await con.execute(delete_query, [notification_id]);

  return result;
};

/**
 * Update notification delivery status
 * @param {string} notification_id
 * @param {object} status
 * @returns {Promise<object>}
 */
export const updateDeliveryStatus = async (notification_id, status) => {
  const updateFields = [];
  const updateValues = [];

  if (status.is_pushed !== undefined) {
    updateFields.push("is_pushed");
    updateValues.push(status.is_pushed);
  }

  if (status.is_emailed !== undefined) {
    updateFields.push("is_emailed");
    updateValues.push(status.is_emailed);
  }

  if (updateFields.length === 0) {
    return null;
  }

  const update_query = `
    UPDATE notifications
    SET ${updateFields.map((f) => `${f} = ?`).join(", ")}
    WHERE notification_id = ?
  `;

  updateValues.push(notification_id);

  const [result] = await con.execute(update_query, updateValues);

  return result;
};

/**
 * Get unread count
 * @param {string} user_id
 * @returns {Promise<number>}
 */
export const getUnreadCount = async (user_id) => {
  const [result] = await con.execute(
    `
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ? AND is_read = 0
  `,
    [user_id],
  );

  return result[0].count;
};

/**
 * Bulk create notifications
 * @param {Array} notifications
 * @returns {Promise<Array>}
 */
export const bulkCreateNotifications = async (notifications) => {
  const results = [];

  for (const notif of notifications) {
    try {
      const created = await createNotification(notif);
      results.push(created);
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  }

  return results;
};

/**
 * Create notification for multiple users
 * @param {Array} user_ids
 * @param {object} notificationData
 * @returns {Promise<Array>}
 */
export const createNotificationForUsers = async (
  user_ids,
  notificationData,
) => {
  const notifications = user_ids.map((user_id) => ({
    ...notificationData,
    user_id,
  }));

  return await bulkCreateNotifications(notifications);
};
