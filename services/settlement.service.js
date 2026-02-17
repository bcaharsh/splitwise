import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new settlement
 * @param {object} settlementData
 * @returns {Promise<object>}
 */
export const createSettlement = async (settlementData) => {
  const {
    group_id,
    payer_id,
    payee_id,
    amount,
    currency,
    settlement_date,
    payment_method,
    payment_reference,
    notes,
    status,
    created_by,
  } = settlementData;

  if (!payer_id || !payee_id || !amount || !created_by) {
    throw new Error("payer_id, payee_id, amount, and created_by are required");
  }

  const settlement_id = uuidv4();

  const insert_query = `
    INSERT INTO settlements (
      settlement_id,
      group_id,
      payer_id,
      payee_id,
      amount,
      currency,
      settlement_date,
      payment_method,
      payment_reference,
      notes,
      status,
      confirmed_by_payee,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    settlement_id,
    group_id || null,
    payer_id,
    payee_id,
    parseFloat(amount),
    currency || "USD",
    settlement_date || new Date(),
    payment_method || null,
    payment_reference || null,
    notes || null,
    status || "pending",
    0,
    created_by,
  ];

  const [settlement] = await con.execute(insert_query, params);

  return { settlement_id, ...settlement };
};

/**
 * Get settlements with custom filters
 * @param {Array} fieldName
 * @param {Array} Values
 * @returns {Promise<Array>}
 */
export const getSettlementCustomData = async (fieldName = [], Values = []) => {
  const get_query = `
    SELECT 
      s.*,
      u1.first_name as payer_first_name,
      u1.last_name as payer_last_name,
      u1.email as payer_email,
      u1.profile_image_url as payer_image,
      u2.first_name as payee_first_name,
      u2.last_name as payee_last_name,
      u2.email as payee_email,
      u2.profile_image_url as payee_image,
      g.group_name
    FROM settlements s
    LEFT JOIN users u1 ON s.payer_id = u1.user_id
    LEFT JOIN users u2 ON s.payee_id = u2.user_id
    LEFT JOIN expense_groups g ON s.group_id = g.group_id
    WHERE ${
      fieldName.length !== 0 && fieldName.length === Values.length
        ? fieldName.map((f) => `s.${f} = ?`).join(" AND ")
        : "1 = 1"
    }
    ORDER BY s.created_at DESC
  `;

  const [settlements] = await con.execute(get_query, Values);

  return settlements;
};

/**
 * Get settlement by ID
 * @param {string} settlement_id
 * @returns {Promise<object|null>}
 */
export const getSettlementById = async (settlement_id) => {
  const [settlements] = await getSettlementCustomData(
    ["settlement_id"],
    [settlement_id],
  );

  return settlements.length > 0 ? settlements[0] : null;
};

/**
 * Update settlement
 * @param {Array} fieldName
 * @param {Array} Values
 * @param {string} wherefieldName
 * @param {string} whereValue
 * @returns {Promise<object>}
 */
export const updateSettlement = async (
  fieldName = [],
  Values = [],
  wherefieldName,
  whereValue,
) => {
  if (fieldName.length === 0 || fieldName.length !== Values.length) {
    return [];
  }

  const update_query = `
    UPDATE settlements
    SET ${fieldName.map((f) => `${f} = ?`).join(", ")}
    WHERE ${wherefieldName} = ?
  `;

  Values.push(whereValue);

  const [update_settlement] = await con.execute(update_query, Values);

  return update_settlement;
};

/**
 * Update user balance after settlement
 * @param {string} group_id
 * @param {string} payer_id
 * @param {string} payee_id
 * @param {number} amount
 * @returns {Promise<void>}
 */
export const updateBalanceAfterSettlement = async (
  group_id,
  payer_id,
  payee_id,
  amount,
) => {
  // Update balance from payer to payee (reduce debt)
  const update_query = `
    UPDATE user_balances
    SET balance_amount = balance_amount - ?,
        last_calculated_at = NOW()
    WHERE group_id = ? 
    AND from_user_id = ? 
    AND to_user_id = ?
  `;

  await con.execute(update_query, [amount, group_id, payer_id, payee_id]);

  // Also update reverse balance if exists
  const reverse_query = `
    UPDATE user_balances
    SET balance_amount = balance_amount + ?,
        last_calculated_at = NOW()
    WHERE group_id = ? 
    AND from_user_id = ? 
    AND to_user_id = ?
  `;

  await con.execute(reverse_query, [amount, group_id, payee_id, payer_id]);
};

/**
 * Reverse balance update (for disputed settlements)
 * @param {string} group_id
 * @param {string} payer_id
 * @param {string} payee_id
 * @param {number} amount
 * @returns {Promise<void>}
 */
export const reverseBalanceUpdate = async (
  group_id,
  payer_id,
  payee_id,
  amount,
) => {
  // Reverse the balance update
  const update_query = `
    UPDATE user_balances
    SET balance_amount = balance_amount + ?,
        last_calculated_at = NOW()
    WHERE group_id = ? 
    AND from_user_id = ? 
    AND to_user_id = ?
  `;

  await con.execute(update_query, [amount, group_id, payer_id, payee_id]);

  // Reverse the opposite direction
  const reverse_query = `
    UPDATE user_balances
    SET balance_amount = balance_amount - ?,
        last_calculated_at = NOW()
    WHERE group_id = ? 
    AND from_user_id = ? 
    AND to_user_id = ?
  `;

  await con.execute(reverse_query, [amount, group_id, payee_id, payer_id]);
};

/**
 * Check and update expense splits if fully settled
 * @param {string} group_id
 * @param {string} payer_id
 * @param {string} payee_id
 * @returns {Promise<void>}
 */
export const checkAndUpdateExpenseSplits = async (
  group_id,
  payer_id,
  payee_id,
) => {
  // Get current balance between payer and payee
  const [balance] = await con.execute(
    `
    SELECT balance_amount
    FROM user_balances
    WHERE group_id = ? 
    AND from_user_id = ? 
    AND to_user_id = ?
  `,
    [group_id, payer_id, payee_id],
  );

  // If balance is zero or near zero, mark related expense splits as settled
  if (
    balance.length > 0 &&
    Math.abs(parseFloat(balance[0].balance_amount)) < 0.01
  ) {
    // Find all expense splits involving these two users
    const update_query = `
      UPDATE expense_splits es
      INNER JOIN expenses e ON es.expense_id = e.expense_id
      SET es.is_settled = 1, es.settled_at = NOW()
      WHERE e.group_id = ?
      AND (
        (e.paid_by = ? AND es.user_id = ?)
        OR
        (e.paid_by = ? AND es.user_id = ?)
      )
      AND es.is_settled = 0
    `;

    await con.execute(update_query, [
      group_id,
      payee_id,
      payer_id,
      payer_id,
      payee_id,
    ]);
  }
};

/**
 * Get group settlements
 * @param {string} group_id
 * @param {object} filters
 * @returns {Promise<Array>}
 */
export const getGroupSettlements = async (group_id, filters = {}) => {
  let query = `
    SELECT 
      s.*,
      u1.first_name as payer_first_name,
      u1.last_name as payer_last_name,
      u1.profile_image_url as payer_image,
      u2.first_name as payee_first_name,
      u2.last_name as payee_last_name,
      u2.profile_image_url as payee_image
    FROM settlements s
    LEFT JOIN users u1 ON s.payer_id = u1.user_id
    LEFT JOIN users u2 ON s.payee_id = u2.user_id
    WHERE s.group_id = ?
  `;

  const params = [group_id];

  if (filters.status) {
    query += ` AND s.status = ?`;
    params.push(filters.status);
  }

  if (filters.payer_id) {
    query += ` AND s.payer_id = ?`;
    params.push(filters.payer_id);
  }

  if (filters.payee_id) {
    query += ` AND s.payee_id = ?`;
    params.push(filters.payee_id);
  }

  if (filters.date_from) {
    query += ` AND s.settlement_date >= ?`;
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    query += ` AND s.settlement_date <= ?`;
    params.push(filters.date_to);
  }

  query += ` ORDER BY s.settlement_date DESC, s.created_at DESC`;

  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(parseInt(filters.limit));
  }

  const [settlements] = await con.execute(query, params);

  return settlements;
};

/**
 * Get user settlements (sent and received)
 * @param {string} user_id
 * @param {string} group_id (optional)
 * @returns {Promise<object>}
 */
export const getUserSettlements = async (user_id, group_id = null) => {
  let query = `
    SELECT 
      s.*,
      CASE 
        WHEN s.payer_id = ? THEN 'sent'
        WHEN s.payee_id = ? THEN 'received'
      END as settlement_type,
      CASE 
        WHEN s.payer_id = ? THEN u2.first_name
        ELSE u1.first_name
      END as other_user_first_name,
      CASE 
        WHEN s.payer_id = ? THEN u2.last_name
        ELSE u1.last_name
      END as other_user_last_name,
      CASE 
        WHEN s.payer_id = ? THEN u2.user_id
        ELSE u1.user_id
      END as other_user_id,
      g.group_name
    FROM settlements s
    LEFT JOIN users u1 ON s.payer_id = u1.user_id
    LEFT JOIN users u2 ON s.payee_id = u2.user_id
    LEFT JOIN expense_groups g ON s.group_id = g.group_id
    WHERE (s.payer_id = ? OR s.payee_id = ?)
  `;

  const params = [
    user_id,
    user_id,
    user_id,
    user_id,
    user_id,
    user_id,
    user_id,
  ];

  if (group_id) {
    query += ` AND s.group_id = ?`;
    params.push(group_id);
  }

  query += ` ORDER BY s.settlement_date DESC, s.created_at DESC`;

  const [settlements] = await con.execute(query, params);

  // Separate into sent and received
  const sent = settlements.filter((s) => s.settlement_type === "sent");
  const received = settlements.filter((s) => s.settlement_type === "received");

  return {
    sent,
    received,
    all: settlements,
  };
};

/**
 * Get pending confirmations for user
 * @param {string} user_id
 * @returns {Promise<Array>}
 */
export const getPendingConfirmations = async (user_id) => {
  const query = `
    SELECT 
      s.*,
      u1.first_name as payer_first_name,
      u1.last_name as payer_last_name,
      u1.profile_image_url as payer_image,
      g.group_name
    FROM settlements s
    LEFT JOIN users u1 ON s.payer_id = u1.user_id
    LEFT JOIN expense_groups g ON s.group_id = g.group_id
    WHERE s.payee_id = ?
    AND s.confirmed_by_payee = 0
    AND s.status = 'pending'
    ORDER BY s.created_at DESC
  `;

  const [settlements] = await con.execute(query, [user_id]);

  return settlements;
};

/**
 * Get settlement statistics for a group
 * @param {string} group_id
 * @returns {Promise<object>}
 */
export const getSettlementStatistics = async (group_id) => {
  const [stats] = await con.execute(
    `
    SELECT 
      COUNT(*) as total_settlements,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_completed_amount,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending_amount,
      COALESCE(SUM(CASE WHEN status = 'disputed' THEN amount ELSE 0 END), 0) as total_disputed_amount,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_count,
      currency
    FROM settlements
    WHERE group_id = ?
    GROUP BY currency
  `,
    [group_id],
  );

  return (
    stats[0] || {
      total_settlements: 0,
      total_completed_amount: 0,
      total_pending_amount: 0,
      total_disputed_amount: 0,
      completed_count: 0,
      pending_count: 0,
      disputed_count: 0,
    }
  );
};

/**
 * Cancel settlement
 * @param {string} settlement_id
 * @returns {Promise<object>}
 */
export const cancelSettlement = async (settlement_id) => {
  const update_query = `
    UPDATE settlements
    SET status = 'cancelled', updated_at = NOW()
    WHERE settlement_id = ? AND status = 'pending'
  `;

  const [result] = await con.execute(update_query, [settlement_id]);

  return result;
};

/**
 * Get current balance between two users
 * @param {string} group_id
 * @param {string} user1_id
 * @param {string} user2_id
 * @returns {Promise<number>}
 */
export const getBalanceBetweenUsers = async (group_id, user1_id, user2_id) => {
  const [balance] = await con.execute(
    `
    SELECT balance_amount
    FROM user_balances
    WHERE group_id = ? 
    AND from_user_id = ? 
    AND to_user_id = ?
  `,
    [group_id, user1_id, user2_id],
  );

  if (balance.length === 0) {
    return 0;
  }

  return parseFloat(balance[0].balance_amount);
};
