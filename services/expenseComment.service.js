import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Add expense comment
 * @param {object} commentData
 * @returns {Promise<object>}
 */
export const addExpenseComment = async (commentData) => {
  const { expense_id, user_id, comment_text, parent_comment_id } = commentData;

  if (!expense_id || !user_id || !comment_text) {
    throw new Error("expense_id, user_id, and comment_text are required");
  }

  const comment_id = uuidv4();

  const insert_query = `
    INSERT INTO expense_comments (
      comment_id,
      expense_id,
      user_id,
      comment_text,
      parent_comment_id,
      is_edited,
      is_deleted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    comment_id,
    expense_id,
    user_id,
    comment_text,
    parent_comment_id || null,
    0,
    0,
  ];

  const [comment] = await con.execute(insert_query, params);

  return { comment_id, ...comment };
};

/**
 * Get expense comments
 * @param {string} expense_id
 * @returns {Promise<Array>}
 */
export const getExpenseComments = async (expense_id) => {
  const get_query = `
    SELECT 
      ec.*,
      u.first_name,
      u.last_name,
      u.profile_image_url
    FROM expense_comments ec
    LEFT JOIN users u ON ec.user_id = u.user_id
    WHERE ec.expense_id = ? AND ec.is_deleted = 0
    ORDER BY ec.created_at ASC
  `;

  const [comments] = await con.execute(get_query, [expense_id]);

  return comments;
};

/**
 * Update comment
 * @param {string} comment_id
 * @param {string} comment_text
 * @returns {Promise<object>}
 */
export const updateComment = async (comment_id, comment_text) => {
  const update_query = `
    UPDATE expense_comments
    SET comment_text = ?, is_edited = 1, updated_at = NOW()
    WHERE comment_id = ?
  `;

  const [result] = await con.execute(update_query, [comment_text, comment_id]);

  return result;
};

/**
 * Delete comment (soft delete)
 * @param {string} comment_id
 * @returns {Promise<object>}
 */
export const deleteComment = async (comment_id) => {
  const delete_query = `
    UPDATE expense_comments
    SET is_deleted = 1, updated_at = NOW()
    WHERE comment_id = ?
  `;

  const [result] = await con.execute(delete_query, [comment_id]);

  return result;
};

/**
 * Get comment by ID
 * @param {string} comment_id
 * @returns {Promise<Array>}
 */
export const getCommentById = async (comment_id) => {
  const get_query = `
    SELECT * FROM expense_comments
    WHERE comment_id = ?
  `;

  const [comment] = await con.execute(get_query, [comment_id]);

  return comment;
};
