import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new expense
 * @param {object} expenseData
 * @returns {Promise<object>}
 */
export const createExpense = async (expenseData) => {
  const {
    group_id,
    description,
    amount,
    currency,
    base_currency_amount,
    exchange_rate,
    category_id,
    expense_date,
    expense_type,
    split_type,
    paid_by,
    is_recurring,
    recurring_id,
    notes,
    created_by,
  } = expenseData;

  if (!description || !amount || !paid_by || !created_by) {
    throw new Error(
      "description, amount, paid_by, and created_by are required",
    );
  }

  const expense_id = uuidv4();

  const insert_query = `
    INSERT INTO expenses (
      expense_id,
      group_id,
      description,
      amount,
      currency,
      base_currency_amount,
      exchange_rate,
      category_id,
      expense_date,
      expense_type,
      split_type,
      paid_by,
      is_recurring,
      recurring_id,
      notes,
      is_deleted,
      is_settled,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    expense_id,
    group_id || null,
    description,
    amount,
    currency || "USD",
    base_currency_amount || amount,
    exchange_rate || 1.0,
    category_id || null,
    expense_date || new Date(),
    expense_type || "expense",
    split_type || "equal",
    paid_by,
    is_recurring || 0,
    recurring_id || null,
    notes || null,
    0,
    0,
    created_by,
  ];

  const [expense] = await con.execute(insert_query, params);

  return { expense_id, ...expense };
};

/**
 * Add expense payer
 * @param {object} payerData
 * @returns {Promise<object>}
 */
export const addExpensePayer = async (payerData) => {
  const { expense_id, user_id, paid_amount, payment_method } = payerData;

  if (!expense_id || !user_id || !paid_amount) {
    throw new Error("expense_id, user_id, and paid_amount are required");
  }

  const payer_id = uuidv4();

  const insert_query = `
    INSERT INTO expense_payers (
      payer_id,
      expense_id,
      user_id,
      paid_amount,
      payment_method
    )
    VALUES (?, ?, ?, ?, ?)
  `;

  const params = [
    payer_id,
    expense_id,
    user_id,
    paid_amount,
    payment_method || null,
  ];

  const [payer] = await con.execute(insert_query, params);

  return { payer_id, ...payer };
};

/**
 * Add expense split
 * @param {object} splitData
 * @returns {Promise<object>}
 */
export const addExpenseSplit = async (splitData) => {
  const {
    expense_id,
    user_id,
    owed_amount,
    paid_amount,
    share_value,
    percentage,
  } = splitData;

  if (!expense_id || !user_id || owed_amount === undefined) {
    throw new Error("expense_id, user_id, and owed_amount are required");
  }

  const split_id = uuidv4();

  const insert_query = `
    INSERT INTO expense_splits (
      split_id,
      expense_id,
      user_id,
      owed_amount,
      paid_amount,
      share_value,
      percentage,
      is_settled
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    split_id,
    expense_id,
    user_id,
    owed_amount,
    paid_amount || 0.0,
    share_value || null,
    percentage || null,
    0,
  ];

  const [split] = await con.execute(insert_query, params);

  return { split_id, ...split };
};

/**
 * Calculate splits based on type
 * @param {string} split_type
 * @param {number} total_amount
 * @param {Array} participants
 * @returns {Array}
 */
export const calculateSplits = (split_type, total_amount, participants) => {
  const splits = [];

  switch (split_type) {
    case "equal":
      const equalAmount = parseFloat(
        (total_amount / participants.length).toFixed(2),
      );
      participants.forEach((participant) => {
        splits.push({
          user_id: participant.user_id,
          owed_amount: equalAmount,
          share_value: null,
          percentage: null,
        });
      });
      break;

    case "exact":
      participants.forEach((participant) => {
        splits.push({
          user_id: participant.user_id,
          owed_amount: parseFloat(participant.exact_amount),
          share_value: null,
          percentage: null,
        });
      });
      break;

    case "percentage":
      participants.forEach((participant) => {
        const owedAmount = parseFloat(
          ((total_amount * participant.percentage) / 100).toFixed(2),
        );
        splits.push({
          user_id: participant.user_id,
          owed_amount: owedAmount,
          share_value: null,
          percentage: participant.percentage,
        });
      });
      break;

    case "shares":
      const totalShares = participants.reduce(
        (sum, p) => sum + parseFloat(p.shares),
        0,
      );
      participants.forEach((participant) => {
        const owedAmount = parseFloat(
          ((participant.shares * total_amount) / totalShares).toFixed(2),
        );
        splits.push({
          user_id: participant.user_id,
          owed_amount: owedAmount,
          share_value: participant.shares,
          percentage: null,
        });
      });
      break;

    default:
      throw new Error(`Invalid split type: ${split_type}`);
  }

  return splits;
};

/**
 * Update user balances
 * @param {string} group_id
 * @param {Array} splits
 * @param {Array} payers
 * @returns {Promise<void>}
 */
export const updateUserBalances = async (group_id, splits, payers) => {
  // Create a map of user payments
  const paymentMap = {};
  payers.forEach((payer) => {
    paymentMap[payer.user_id] = parseFloat(payer.paid_amount);
  });

  // Create a map of user debts
  const debtMap = {};
  splits.forEach((split) => {
    debtMap[split.user_id] = parseFloat(split.owed_amount);
  });

  // Get all unique users
  const allUsers = new Set([
    ...Object.keys(paymentMap),
    ...Object.keys(debtMap),
  ]);

  // Calculate net contributions for each user
  const netContributions = {};
  allUsers.forEach((userId) => {
    const paid = paymentMap[userId] || 0;
    const owes = debtMap[userId] || 0;
    netContributions[userId] = paid - owes;
  });

  // Update balances between each pair of users
  const users = Array.from(allUsers);
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const user_i = users[i];
      const user_j = users[j];

      const net_i = netContributions[user_i];
      const net_j = netContributions[user_j];

      // Calculate balance change
      let balanceChange = 0;

      if (net_i > 0 && net_j < 0) {
        // user_i paid more, user_j owes
        balanceChange = Math.min(net_i, Math.abs(net_j));
      } else if (net_i < 0 && net_j > 0) {
        // user_j paid more, user_i owes
        balanceChange = -Math.min(Math.abs(net_i), net_j);
      }

      if (balanceChange !== 0) {
        // Update balance from user_i to user_j
        await upsertUserBalance(group_id, user_i, user_j, balanceChange, "USD");

        // Update balance from user_j to user_i (opposite)
        await upsertUserBalance(
          group_id,
          user_j,
          user_i,
          -balanceChange,
          "USD",
        );
      }
    }
  }
};

/**
 * Upsert user balance
 * @param {string} group_id
 * @param {string} from_user_id
 * @param {string} to_user_id
 * @param {number} amount_change
 * @param {string} currency
 * @returns {Promise<void>}
 */
export const upsertUserBalance = async (
  group_id,
  from_user_id,
  to_user_id,
  amount_change,
  currency,
) => {
  const upsert_query = `
    INSERT INTO user_balances (
      balance_id,
      group_id,
      from_user_id,
      to_user_id,
      balance_amount,
      currency,
      last_calculated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      balance_amount = balance_amount + ?,
      last_calculated_at = NOW()
  `;

  const balance_id = uuidv4();

  const params = [
    balance_id,
    group_id,
    from_user_id,
    to_user_id,
    amount_change,
    currency,
    amount_change,
  ];

  await con.execute(upsert_query, params);
};

/**
 * Add expense attachment
 * @param {object} attachmentData
 * @returns {Promise<object>}
 */
export const addExpenseAttachment = async (attachmentData) => {
  const {
    expense_id,
    file_name,
    original_file_name,
    file_type,
    file_size,
    file_url,
    thumbnail_url,
    is_receipt,
    uploaded_by,
  } = attachmentData;

  if (!expense_id || !file_name || !file_url || !uploaded_by) {
    throw new Error(
      "expense_id, file_name, file_url, and uploaded_by are required",
    );
  }

  const attachment_id = uuidv4();

  const insert_query = `
    INSERT INTO expense_attachments (
      attachment_id,
      expense_id,
      file_name,
      original_file_name,
      file_type,
      file_size,
      file_url,
      thumbnail_url,
      is_receipt,
      uploaded_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    attachment_id,
    expense_id,
    file_name,
    original_file_name,
    file_type,
    file_size,
    file_url,
    thumbnail_url || null,
    is_receipt !== undefined ? is_receipt : 1,
    uploaded_by,
  ];

  const [attachment] = await con.execute(insert_query, params);

  return { attachment_id, ...attachment };
};

/**
 * Get expenses with custom filters
 * @param {Array} fieldName
 * @param {Array} Values
 * @returns {Promise<Array>}
 */
export const getExpenseCustomData = async (fieldName = [], Values = []) => {
  const get_query = `
    SELECT 
      e.*,
      u.first_name as payer_first_name,
      u.last_name as payer_last_name,
      u.email as payer_email,
      ec.category_name,
      ec.icon as category_icon,
      ec.color as category_color
    FROM expenses e
    LEFT JOIN users u ON e.paid_by = u.user_id
    LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
    WHERE ${
      fieldName.length !== 0 && fieldName.length === Values.length
        ? fieldName.map((f) => `e.${f} = ?`).join(" AND ")
        : "1 = 1"
    }
    ORDER BY e.expense_date DESC, e.created_at DESC
  `;

  const [expenses] = await con.execute(get_query, Values);

  return expenses;
};

/**
 * Get expense splits
 * @param {string} expense_id
 * @returns {Promise<Array>}
 */
export const getExpenseSplits = async (expense_id) => {
  const get_query = `
    SELECT 
      es.*,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image_url
    FROM expense_splits es
    LEFT JOIN users u ON es.user_id = u.user_id
    WHERE es.expense_id = ?
    ORDER BY es.owed_amount DESC
  `;

  const [splits] = await con.execute(get_query, [expense_id]);

  return splits;
};

/**
 * Get expense payers
 * @param {string} expense_id
 * @returns {Promise<Array>}
 */
export const getExpensePayers = async (expense_id) => {
  const get_query = `
    SELECT 
      ep.*,
      u.first_name,
      u.last_name,
      u.email
    FROM expense_payers ep
    LEFT JOIN users u ON ep.user_id = u.user_id
    WHERE ep.expense_id = ?
  `;

  const [payers] = await con.execute(get_query, [expense_id]);

  return payers;
};

/**
 * Get expense attachments
 * @param {string} expense_id
 * @returns {Promise<Array>}
 */
export const getExpenseAttachments = async (expense_id) => {
  const get_query = `
    SELECT 
      ea.*,
      u.first_name as uploader_first_name,
      u.last_name as uploader_last_name
    FROM expense_attachments ea
    LEFT JOIN users u ON ea.uploaded_by = u.user_id
    WHERE ea.expense_id = ?
    ORDER BY ea.created_at DESC
  `;

  const [attachments] = await con.execute(get_query, [expense_id]);

  return attachments;
};

/**
 * Update expense
 * @param {Array} fieldName
 * @param {Array} Values
 * @param {string} wherefieldName
 * @param {string} whereValue
 * @returns {Promise<object>}
 */
export const updateExpense = async (
  fieldName = [],
  Values = [],
  wherefieldName,
  whereValue,
) => {
  if (fieldName.length === 0 || fieldName.length !== Values.length) {
    return [];
  }

  const update_query = `
    UPDATE expenses
    SET ${fieldName.map((f) => `${f} = ?`).join(", ")}
    WHERE ${wherefieldName} = ?
  `;

  Values.push(whereValue);

  const [update_expense] = await con.execute(update_query, Values);

  return update_expense;
};

/**
 * Delete expense splits
 * @param {string} expense_id
 * @returns {Promise<object>}
 */
export const deleteExpenseSplits = async (expense_id) => {
  const delete_query = `
    DELETE FROM expense_splits 
    WHERE expense_id = ?
  `;

  const [result] = await con.execute(delete_query, [expense_id]);

  return result;
};

/**
 * Delete expense payers
 * @param {string} expense_id
 * @returns {Promise<object>}
 */
export const deleteExpensePayers = async (expense_id) => {
  const delete_query = `
    DELETE FROM expense_payers 
    WHERE expense_id = ?
  `;

  const [result] = await con.execute(delete_query, [expense_id]);

  return result;
};

/**
 * Soft delete expense
 * @param {string} expense_id
 * @param {string} deleted_by
 * @returns {Promise<object>}
 */
export const softDeleteExpense = async (expense_id, deleted_by) => {
  const update_query = `
    UPDATE expenses
    SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
    WHERE expense_id = ?
  `;

  const [result] = await con.execute(update_query, [deleted_by, expense_id]);

  return result;
};

/**
 * Get expense by ID with full details
 * @param {string} expense_id
 * @returns {Promise<object>}
 */
export const getExpenseById = async (expense_id) => {
  const [expenses] = await getExpenseCustomData(["expense_id"], [expense_id]);

  if (expenses.length === 0) {
    return null;
  }

  const expense = expenses[0];

  // Get splits
  const splits = await getExpenseSplits(expense_id);

  // Get payers
  const payers = await getExpensePayers(expense_id);

  // Get attachments
  const attachments = await getExpenseAttachments(expense_id);

  return {
    ...expense,
    splits,
    payers,
    attachments,
  };
};

/**
 * Get group expenses
 * @param {string} group_id
 * @param {object} filters
 * @returns {Promise<Array>}
 */
export const getGroupExpenses = async (group_id, filters = {}) => {
  let query = `
    SELECT 
      e.*,
      u.first_name as payer_first_name,
      u.last_name as payer_last_name,
      ec.category_name,
      ec.icon as category_icon,
      ec.color as category_color,
      COUNT(DISTINCT es.split_id) as participant_count
    FROM expenses e
    LEFT JOIN users u ON e.paid_by = u.user_id
    LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
    LEFT JOIN expense_splits es ON e.expense_id = es.expense_id
    WHERE e.group_id = ? AND e.is_deleted = 0
  `;

  const params = [group_id];

  // Add filters
  if (filters.category_id) {
    query += ` AND e.category_id = ?`;
    params.push(filters.category_id);
  }

  if (filters.paid_by) {
    query += ` AND e.paid_by = ?`;
    params.push(filters.paid_by);
  }

  if (filters.date_from) {
    query += ` AND e.expense_date >= ?`;
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    query += ` AND e.expense_date <= ?`;
    params.push(filters.date_to);
  }

  query += `
    GROUP BY e.expense_id
    ORDER BY e.expense_date DESC, e.created_at DESC
  `;

  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(parseInt(filters.limit));
  }

  const [expenses] = await con.execute(query, params);

  return expenses;
};

/**
 * Get user expenses (across all groups or specific group)
 * @param {string} user_id
 * @param {string} group_id (optional)
 * @returns {Promise<Array>}
 */
export const getUserExpenses = async (user_id, group_id = null) => {
  let query = `
    SELECT DISTINCT
      e.*,
      u.first_name as payer_first_name,
      u.last_name as payer_last_name,
      ec.category_name,
      ec.icon as category_icon,
      g.group_name
    FROM expenses e
    LEFT JOIN users u ON e.paid_by = u.user_id
    LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
    LEFT JOIN expense_groups g ON e.group_id = g.group_id
    LEFT JOIN expense_splits es ON e.expense_id = es.expense_id
    WHERE e.is_deleted = 0
    AND (e.paid_by = ? OR es.user_id = ?)
  `;

  const params = [user_id, user_id];

  if (group_id) {
    query += ` AND e.group_id = ?`;
    params.push(group_id);
  }

  query += `
    ORDER BY e.expense_date DESC, e.created_at DESC
  `;

  const [expenses] = await con.execute(query, params);

  return expenses;
};

/**
 * Validate split amounts
 * @param {string} split_type
 * @param {number} total_amount
 * @param {Array} participants
 * @returns {boolean}
 */
export const validateSplitAmounts = (
  split_type,
  total_amount,
  participants,
) => {
  let calculatedTotal = 0;

  switch (split_type) {
    case "equal":
      return true; // Always valid

    case "exact":
      calculatedTotal = participants.reduce(
        (sum, p) => sum + parseFloat(p.exact_amount),
        0,
      );
      return Math.abs(calculatedTotal - total_amount) < 0.01;

    case "percentage":
      const totalPercentage = participants.reduce(
        (sum, p) => sum + parseFloat(p.percentage),
        0,
      );
      return Math.abs(totalPercentage - 100) < 0.01;

    case "shares":
      return participants.every((p) => p.shares > 0);

    default:
      return false;
  }
};
