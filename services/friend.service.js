import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Send friend request
 * @param {object} friendData
 * @returns {Promise<object>}
 */
export const sendFriendRequest = async (friendData) => {
  const { user_id, friend_id, requested_by } = friendData;

  if (!user_id || !friend_id) {
    throw new Error("user_id and friend_id are required");
  }

  if (user_id === friend_id) {
    throw new Error("Cannot send friend request to yourself");
  }

  const friendship_id = uuidv4();

  const insert_query = `
    INSERT INTO friendships (
      friendship_id,
      user_id,
      friend_id,
      status,
      requested_by
    )
    VALUES (?, ?, ?, ?, ?)
  `;

  const params = [friendship_id, user_id, friend_id, "pending", requested_by];

  const [friendship] = await con.execute(insert_query, params);

  return { friendship_id, ...friendship };
};

/**
 * Get friendships with custom filters
 * @param {Array} fieldName
 * @param {Array} Values
 * @returns {Promise<Array>}
 */
export const getFriendshipCustomData = async (fieldName = [], Values = []) => {
  const get_query = `
    SELECT 
      f.*,
      u1.first_name as user_first_name,
      u1.last_name as user_last_name,
      u1.email as user_email,
      u1.profile_image_url as user_profile_image,
      u2.first_name as friend_first_name,
      u2.last_name as friend_last_name,
      u2.email as friend_email,
      u2.profile_image_url as friend_profile_image
    FROM friendships f
    LEFT JOIN users u1 ON f.user_id = u1.user_id
    LEFT JOIN users u2 ON f.friend_id = u2.user_id
    WHERE ${
      fieldName.length !== 0 && fieldName.length === Values.length
        ? fieldName.map((f) => `f.${f} = ?`).join(" AND ")
        : "1 = 1"
    }
  `;

  const [friendships] = await con.execute(get_query, Values);

  return friendships;
};

/**
 * Get all friends for a user (accepted only)
 * @param {string} user_id
 * @returns {Promise<Array>}
 */
export const getUserFriends = async (user_id) => {
  const get_query = `
    SELECT 
      f.friendship_id,
      f.user_id,
      f.friend_id,
      f.status,
      f.nickname,
      f.created_at,
      CASE 
        WHEN f.user_id = ? THEN u2.user_id
        ELSE u1.user_id
      END as actual_friend_id,
      CASE 
        WHEN f.user_id = ? THEN u2.first_name
        ELSE u1.first_name
      END as friend_first_name,
      CASE 
        WHEN f.user_id = ? THEN u2.last_name
        ELSE u1.last_name
      END as friend_last_name,
      CASE 
        WHEN f.user_id = ? THEN u2.email
        ELSE u1.email
      END as friend_email,
      CASE 
        WHEN f.user_id = ? THEN u2.profile_image_url
        ELSE u1.profile_image_url
      END as friend_profile_image,
      CASE 
        WHEN f.user_id = ? THEN u2.default_currency
        ELSE u1.default_currency
      END as friend_currency
    FROM friendships f
    LEFT JOIN users u1 ON f.user_id = u1.user_id
    LEFT JOIN users u2 ON f.friend_id = u2.user_id
    WHERE (f.user_id = ? OR f.friend_id = ?) 
    AND f.status = 'accepted'
  `;

  const params = [
    user_id,
    user_id,
    user_id,
    user_id,
    user_id,
    user_id,
    user_id,
    user_id,
  ];

  const [friends] = await con.execute(get_query, params);

  return friends;
};

/**
 * Get pending friend requests (received)
 * @param {string} user_id
 * @returns {Promise<Array>}
 */
export const getPendingRequests = async (user_id) => {
  const get_query = `
    SELECT 
      f.friendship_id,
      f.user_id,
      f.friend_id,
      f.status,
      f.requested_by,
      f.created_at,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image_url
    FROM friendships f
    LEFT JOIN users u ON f.user_id = u.user_id
    WHERE f.friend_id = ? 
    AND f.status = 'pending'
    AND f.requested_by = f.user_id
  `;

  const [requests] = await con.execute(get_query, [user_id]);

  return requests;
};

/**
 * Get sent friend requests (pending)
 * @param {string} user_id
 * @returns {Promise<Array>}
 */
export const getSentRequests = async (user_id) => {
  const get_query = `
    SELECT 
      f.friendship_id,
      f.user_id,
      f.friend_id,
      f.status,
      f.requested_by,
      f.created_at,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image_url
    FROM friendships f
    LEFT JOIN users u ON f.friend_id = u.user_id
    WHERE f.user_id = ? 
    AND f.status = 'pending'
    AND f.requested_by = f.user_id
  `;

  const [requests] = await con.execute(get_query, [user_id]);

  return requests;
};

/**
 * Update friendship
 * @param {Array} fieldName
 * @param {Array} Values
 * @param {string} wherefieldName
 * @param {string} whereValue
 * @returns {Promise<object>}
 */
export const updateFriendship = async (
  fieldName = [],
  Values = [],
  wherefieldName,
  whereValue,
) => {
  if (fieldName.length === 0 || fieldName.length !== Values.length) {
    return [];
  }

  const update_query = `
    UPDATE friendships
    SET ${fieldName.map((f) => `${f} = ?`).join(", ")}
    WHERE ${wherefieldName} = ?
  `;

  Values.push(whereValue);

  const [update_friendship] = await con.execute(update_query, Values);

  return update_friendship;
};

/**
 * Delete friendship
 * @param {string} friendship_id
 * @returns {Promise<object>}
 */
export const deleteFriendship = async (friendship_id) => {
  const delete_query = `
    DELETE FROM friendships 
    WHERE friendship_id = ?
  `;

  const [deleted] = await con.execute(delete_query, [friendship_id]);

  return deleted;
};

/**
 * Check if friendship exists (any status)
 * @param {string} user_id
 * @param {string} friend_id
 * @returns {Promise<Array>}
 */
export const checkFriendshipExists = async (user_id, friend_id) => {
  const check_query = `
    SELECT * FROM friendships 
    WHERE (user_id = ? AND friend_id = ?) 
    OR (user_id = ? AND friend_id = ?)
  `;

  const [exists] = await con.execute(check_query, [
    user_id,
    friend_id,
    friend_id,
    user_id,
  ]);

  return exists;
};

/**
 * Get blocked users
 * @param {string} user_id
 * @returns {Promise<Array>}
 */
export const getBlockedUsers = async (user_id) => {
  const get_query = `
    SELECT 
      f.friendship_id,
      f.friend_id,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image_url,
      f.created_at
    FROM friendships f
    LEFT JOIN users u ON f.friend_id = u.user_id
    WHERE f.user_id = ? 
    AND f.status = 'blocked'
  `;

  const [blocked] = await con.execute(get_query, [user_id]);

  return blocked;
};

/**
 * Search users (excluding self and existing friends)
 * @param {string} user_id
 * @param {string} searchTerm
 * @returns {Promise<Array>}
 */
export const searchUsersToAdd = async (user_id, searchTerm) => {
  const search_query = `
    SELECT 
      u.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image_url
    FROM users u
    WHERE u.user_id != ?
    AND u.is_active = 1
    AND (
      u.first_name LIKE ? 
      OR u.last_name LIKE ? 
      OR u.email LIKE ?
    )
    AND u.user_id NOT IN (
      SELECT friend_id FROM friendships 
      WHERE user_id = ? AND status IN ('accepted', 'pending')
      UNION
      SELECT user_id FROM friendships 
      WHERE friend_id = ? AND status IN ('accepted', 'pending')
    )
    LIMIT 20
  `;

  const searchPattern = `%${searchTerm}%`;

  const [users] = await con.execute(search_query, [
    user_id,
    searchPattern,
    searchPattern,
    searchPattern,
    user_id,
    user_id,
  ]);

  return users;
};
