import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create recurring expense template
 * @param {object} recurringData
 * @returns {Promise<object>}
 */
export const createRecurringExpense = async (recurringData) => {
  const {
    group_id,
    description,
    amount,
    currency,
    category_id,
    paid_by,
    split_type,
    frequency,
    start_date,
    end_date,
    day_of_month,
    day_of_week,
    max_occurrences,
    created_by,
  } = recurringData;

  if (
    !description ||
    !amount ||
    !paid_by ||
    !frequency ||
    !start_date ||
    !created_by
  ) {
    throw new Error(
      "description, amount, paid_by, frequency, start_date, and created_by are required",
    );
  }

  const recurring_id = uuidv4();

  const insert_query = `
    INSERT INTO recurring_expenses (
      recurring_id,
      group_id,
      description,
      amount,
      currency,
      category_id,
      paid_by,
      split_type,
      frequency,
      start_date,
      end_date,
      next_occurrence,
      day_of_month,
      day_of_week,
      occurrence_count,
      max_occurrences,
      is_active,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    recurring_id,
    group_id || null,
    description,
    parseFloat(amount),
    currency || "USD",
    category_id || null,
    paid_by,
    split_type || "equal",
    frequency,
    start_date,
    end_date || null,
    start_date, // next_occurrence = start_date initially
    day_of_month || null,
    day_of_week || null,
    0,
    max_occurrences || null,
    1,
    created_by,
  ];

  const [recurring] = await con.execute(insert_query, params);

  return { recurring_id, ...recurring };
};

/**
 * Add recurring expense split
 * @param {object} splitData
 * @returns {Promise<object>}
 */
export const addRecurringSplit = async (splitData) => {
  const { recurring_id, user_id, share_value, percentage, fixed_amount } =
    splitData;

  if (!recurring_id || !user_id) {
    throw new Error("recurring_id and user_id are required");
  }

  const rec_split_id = uuidv4();

  const insert_query = `
    INSERT INTO recurring_expense_splits (
      rec_split_id,
      recurring_id,
      user_id,
      share_value,
      percentage,
      fixed_amount
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const params = [
    rec_split_id,
    recurring_id,
    user_id,
    share_value || null,
    percentage || null,
    fixed_amount || null,
  ];

  const [split] = await con.execute(insert_query, params);

  return { rec_split_id, ...split };
};

/**
 * Get recurring expenses with filters
 * @param {Array} fieldName
 * @param {Array} Values
 * @returns {Promise<Array>}
 */
export const getRecurringExpenseCustomData = async (
  fieldName = [],
  Values = [],
) => {
  const get_query = `
    SELECT 
      re.*,
      u.first_name as payer_first_name,
      u.last_name as payer_last_name,
      ec.category_name,
      ec.icon as category_icon,
      g.group_name
    FROM recurring_expenses re
    LEFT JOIN users u ON re.paid_by = u.user_id
    LEFT JOIN expense_categories ec ON re.category_id = ec.category_id
    LEFT JOIN expense_groups g ON re.group_id = g.group_id
    WHERE ${
      fieldName.length !== 0 && fieldName.length === Values.length
        ? fieldName.map((f) => `re.${f} = ?`).join(" AND ")
        : "1 = 1"
    }
    ORDER BY re.created_at DESC
  `;

  const [recurring] = await con.execute(get_query, Values);

  return recurring;
};

/**
 * Get recurring expense splits
 * @param {string} recurring_id
 * @returns {Promise<Array>}
 */
export const getRecurringSplits = async (recurring_id) => {
  const get_query = `
    SELECT 
      res.*,
      u.first_name,
      u.last_name,
      u.email
    FROM recurring_expense_splits res
    LEFT JOIN users u ON res.user_id = u.user_id
    WHERE res.recurring_id = ?
  `;

  const [splits] = await con.execute(get_query, [recurring_id]);

  return splits;
};

/**
 * Get recurring expense by ID with details
 * @param {string} recurring_id
 * @returns {Promise<object|null>}
 */
export const getRecurringExpenseById = async (recurring_id) => {
  const [recurring] = await getRecurringExpenseCustomData(
    ["recurring_id"],
    [recurring_id],
  );

  if (recurring.length === 0) {
    return null;
  }

  const splits = await getRecurringSplits(recurring_id);

  return {
    ...recurring[0],
    splits,
  };
};

/**
 * Update recurring expense
 * @param {Array} fieldName
 * @param {Array} Values
 * @param {string} wherefieldName
 * @param {string} whereValue
 * @returns {Promise<object>}
 */
export const updateRecurringExpense = async (
  fieldName = [],
  Values = [],
  wherefieldName,
  whereValue,
) => {
  if (fieldName.length === 0 || fieldName.length !== Values.length) {
    return [];
  }

  const update_query = `
    UPDATE recurring_expenses
    SET ${fieldName.map((f) => `${f} = ?`).join(", ")}
    WHERE ${wherefieldName} = ?
  `;

  Values.push(whereValue);

  const [update_recurring] = await con.execute(update_query, Values);

  return update_recurring;
};

/**
 * Delete recurring expense splits
 * @param {string} recurring_id
 * @returns {Promise<object>}
 */
export const deleteRecurringSplits = async (recurring_id) => {
  const delete_query = `
    DELETE FROM recurring_expense_splits 
    WHERE recurring_id = ?
  `;

  const [result] = await con.execute(delete_query, [recurring_id]);

  return result;
};

/**
 * Deactivate recurring expense
 * @param {string} recurring_id
 * @returns {Promise<object>}
 */
export const deactivateRecurringExpense = async (recurring_id) => {
  const update_query = `
    UPDATE recurring_expenses
    SET is_active = 0, updated_at = NOW()
    WHERE recurring_id = ?
  `;

  const [result] = await con.execute(update_query, [recurring_id]);

  return result;
};

/**
 * Get user's recurring expenses
 * @param {string} user_id
 * @param {string} group_id (optional)
 * @returns {Promise<Array>}
 */
export const getUserRecurringExpenses = async (user_id, group_id = null) => {
  let query = `
    SELECT DISTINCT
      re.*,
      u.first_name as payer_first_name,
      u.last_name as payer_last_name,
      ec.category_name,
      g.group_name
    FROM recurring_expenses re
    LEFT JOIN users u ON re.paid_by = u.user_id
    LEFT JOIN expense_categories ec ON re.category_id = ec.category_id
    LEFT JOIN expense_groups g ON re.group_id = g.group_id
    LEFT JOIN recurring_expense_splits res ON re.recurring_id = res.recurring_id
    WHERE (re.paid_by = ? OR res.user_id = ?)
  `;

  const params = [user_id, user_id];

  if (group_id) {
    query += ` AND re.group_id = ?`;
    params.push(group_id);
  }

  query += ` ORDER BY re.next_occurrence ASC, re.created_at DESC`;

  const [recurring] = await con.execute(query, params);

  return recurring;
};

/**
 * Get active recurring expenses for group
 * @param {string} group_id
 * @returns {Promise<Array>}
 */
export const getGroupRecurringExpenses = async (group_id) => {
  const query = `
    SELECT 
      re.*,
      u.first_name as payer_first_name,
      u.last_name as payer_last_name,
      ec.category_name
    FROM recurring_expenses re
    LEFT JOIN users u ON re.paid_by = u.user_id
    LEFT JOIN expense_categories ec ON re.category_id = ec.category_id
    WHERE re.group_id = ? AND re.is_active = 1
    ORDER BY re.next_occurrence ASC
  `;

  const [recurring] = await con.execute(query, [group_id]);

  return recurring;
};

/**
 * Calculate next occurrence date based on frequency
 * @param {Date} currentDate
 * @param {string} frequency
 * @param {number} dayOfMonth (optional)
 * @param {number} dayOfWeek (optional)
 * @returns {Date}
 */
export const calculateNextOccurrence = (
  currentDate,
  frequency,
  dayOfMonth = null,
  dayOfWeek = null,
) => {
  const date = new Date(currentDate);

  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;

    case "weekly":
      date.setDate(date.getDate() + 7);
      break;

    case "biweekly":
      date.setDate(date.getDate() + 14);
      break;

    case "monthly":
      if (dayOfMonth) {
        date.setMonth(date.getMonth() + 1);
        date.setDate(dayOfMonth);
      } else {
        date.setMonth(date.getMonth() + 1);
      }
      break;

    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;

    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;

    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }

  return date;
};

/**
 * Get due recurring expenses (for cron job)
 * @returns {Promise<Array>}
 */
export const getDueRecurringExpenses = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const query = `
    SELECT 
      re.*,
      u.first_name as payer_first_name,
      u.last_name as payer_last_name
    FROM recurring_expenses re
    LEFT JOIN users u ON re.paid_by = u.user_id
    WHERE re.is_active = 1
    AND DATE(re.next_occurrence) <= DATE(?)
    AND (re.end_date IS NULL OR DATE(re.end_date) >= DATE(?))
    AND (re.max_occurrences IS NULL OR re.occurrence_count < re.max_occurrences)
    ORDER BY re.next_occurrence ASC
  `;

  const [recurring] = await con.execute(query, [today, today]);

  return recurring;
};
