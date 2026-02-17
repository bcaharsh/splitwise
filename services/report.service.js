import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create expense report
 * @param {object} reportData
 * @returns {Promise<object>}
 */
export const createExpenseReport = async (reportData) => {
  const {
    user_id,
    group_id,
    report_name,
    report_type,
    date_from,
    date_to,
    filters_applied,
    file_format,
  } = reportData;

  if (!user_id || !report_name || !report_type || !date_from || !date_to) {
    throw new Error(
      "user_id, report_name, report_type, date_from, and date_to are required",
    );
  }

  const report_id = uuidv4();

  const insert_query = `
    INSERT INTO expense_reports (
      report_id,
      user_id,
      group_id,
      report_name,
      report_type,
      date_from,
      date_to,
      filters_applied,
      file_format,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    report_id,
    user_id,
    group_id || null,
    report_name,
    report_type,
    date_from,
    date_to,
    filters_applied ? JSON.stringify(filters_applied) : null,
    file_format || "pdf",
    "generating",
  ];

  const [report] = await con.execute(insert_query, params);

  return { report_id, ...report };
};

/**
 * Update report status
 * @param {string} report_id
 * @param {object} updates
 * @returns {Promise<object>}
 */
export const updateReportStatus = async (report_id, updates) => {
  const updateFields = [];
  const updateValues = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      updateFields.push(key);
      updateValues.push(value);
    }
  });

  if (updateFields.length === 0) {
    return null;
  }

  const update_query = `
    UPDATE expense_reports
    SET ${updateFields.map((f) => `${f} = ?`).join(", ")}
    WHERE report_id = ?
  `;

  updateValues.push(report_id);

  const [result] = await con.execute(update_query, updateValues);

  return result;
};

/**
 * Get user reports
 * @param {string} user_id
 * @param {object} filters
 * @returns {Promise<Array>}
 */
export const getUserReports = async (user_id, filters = {}) => {
  let query = `
    SELECT *
    FROM expense_reports
    WHERE user_id = ?
  `;

  const params = [user_id];

  if (filters.status) {
    query += ` AND status = ?`;
    params.push(filters.status);
  }

  if (filters.report_type) {
    query += ` AND report_type = ?`;
    params.push(filters.report_type);
  }

  query += ` ORDER BY created_at DESC`;

  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(parseInt(filters.limit));
  }

  const [reports] = await con.execute(query, params);

  return reports;
};

/**
 * Get report by ID
 * @param {string} report_id
 * @returns {Promise<object|null>}
 */
export const getReportById = async (report_id) => {
  const [reports] = await con.execute(
    `SELECT * FROM expense_reports WHERE report_id = ?`,
    [report_id],
  );

  return reports.length > 0 ? reports[0] : null;
};

/**
 * Delete expired reports (for cron job)
 * @returns {Promise<number>}
 */
export const deleteExpiredReports = async () => {
  const [result] = await con.execute(
    `
    DELETE FROM expense_reports
    WHERE status = 'completed'
    AND expires_at IS NOT NULL
    AND expires_at < NOW()
  `,
  );

  return result.affectedRows;
};

/**
 * Fetch expense data for report
 * @param {object} filters
 * @returns {Promise<Array>}
 */
export const fetchExpenseDataForReport = async (filters) => {
  const { user_id, group_id, date_from, date_to, category_id } = filters;

  let query = `
    SELECT 
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
    AND e.expense_date BETWEEN ? AND ?
  `;

  const params = [date_from, date_to];

  if (user_id) {
    query += ` AND (e.paid_by = ? OR es.user_id = ?)`;
    params.push(user_id, user_id);
  }

  if (group_id) {
    query += ` AND e.group_id = ?`;
    params.push(group_id);
  }

  if (category_id) {
    query += ` AND e.category_id = ?`;
    params.push(category_id);
  }

  query += ` GROUP BY e.expense_id ORDER BY e.expense_date DESC`;

  const [expenses] = await con.execute(query, params);

  return expenses;
};

/**
 * Generate summary report data
 * @param {Array} expenses
 * @returns {Promise<object>}
 */
export const generateSummaryReport = async (expenses) => {
  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0,
  );

  // Category breakdown
  const categoryMap = {};
  expenses.forEach((expense) => {
    const category = expense.category_name || "Uncategorized";
    if (!categoryMap[category]) {
      categoryMap[category] = {
        category_name: category,
        count: 0,
        total_amount: 0,
      };
    }
    categoryMap[category].count++;
    categoryMap[category].total_amount += parseFloat(expense.amount);
  });

  const categoryBreakdown = Object.values(categoryMap).map((cat) => ({
    ...cat,
    percentage: ((cat.total_amount / totalAmount) * 100).toFixed(2),
  }));

  // Top expenses
  const topExpenses = expenses
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
    .slice(0, 10);

  return {
    summary: {
      total_expenses: totalExpenses,
      total_amount: parseFloat(totalAmount.toFixed(2)),
      currency: expenses[0]?.currency || "USD",
    },
    category_breakdown: categoryBreakdown,
    top_expenses: topExpenses,
  };
};

/**
 * Generate detailed report data
 * @param {Array} expenses
 * @returns {Promise<object>}
 */
export const generateDetailedReport = async (expenses) => {
  const summary = await generateSummaryReport(expenses);

  // Get expense splits
  const expenseIds = expenses.map((e) => e.expense_id);

  if (expenseIds.length === 0) {
    return { ...summary, expenses: [] };
  }

  const placeholders = expenseIds.map(() => "?").join(",");

  const [splits] = await con.execute(
    `
    SELECT 
      es.*,
      u.first_name,
      u.last_name
    FROM expense_splits es
    LEFT JOIN users u ON es.user_id = u.user_id
    WHERE es.expense_id IN (${placeholders})
  `,
    expenseIds,
  );

  // Map splits to expenses
  const expensesWithSplits = expenses.map((expense) => ({
    ...expense,
    splits: splits.filter((s) => s.expense_id === expense.expense_id),
  }));

  return {
    ...summary,
    expenses: expensesWithSplits,
  };
};

/**
 * Generate member-wise report data
 * @param {Array} expenses
 * @returns {Promise<object>}
 */
export const generateMemberWiseReport = async (expenses) => {
  const memberMap = {};

  // Get all splits for these expenses
  const expenseIds = expenses.map((e) => e.expense_id);

  if (expenseIds.length === 0) {
    return { members: [] };
  }

  const placeholders = expenseIds.map(() => "?").join(",");

  const [splits] = await con.execute(
    `
    SELECT 
      es.*,
      e.expense_date,
      e.description,
      u.first_name,
      u.last_name,
      u.email
    FROM expense_splits es
    LEFT JOIN expenses e ON es.expense_id = e.expense_id
    LEFT JOIN users u ON es.user_id = u.user_id
    WHERE es.expense_id IN (${placeholders})
  `,
    expenseIds,
  );

  splits.forEach((split) => {
    const userId = split.user_id;
    if (!memberMap[userId]) {
      memberMap[userId] = {
        user_id: userId,
        first_name: split.first_name,
        last_name: split.last_name,
        email: split.email,
        total_paid: 0,
        total_owed: 0,
        net_balance: 0,
        expense_count: 0,
      };
    }

    memberMap[userId].total_paid += parseFloat(split.paid_amount);
    memberMap[userId].total_owed += parseFloat(split.owed_amount);
    memberMap[userId].expense_count++;
  });

  const members = Object.values(memberMap).map((member) => ({
    ...member,
    net_balance: parseFloat((member.total_paid - member.total_owed).toFixed(2)),
  }));

  return {
    members: members.sort((a, b) => b.total_paid - a.total_paid),
  };
};

/**
 * Generate trend report data
 * @param {Array} expenses
 * @param {string} date_from
 * @param {string} date_to
 * @returns {Promise<object>}
 */
export const generateTrendReport = async (expenses, date_from, date_to) => {
  // Group by date
  const dailyMap = {};

  expenses.forEach((expense) => {
    const date = new Date(expense.expense_date).toISOString().split("T")[0];
    if (!dailyMap[date]) {
      dailyMap[date] = {
        date,
        count: 0,
        total_amount: 0,
      };
    }
    dailyMap[date].count++;
    dailyMap[date].total_amount += parseFloat(expense.amount);
  });

  const dailyTrend = Object.values(dailyMap).sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  // Calculate averages
  const totalDays = dailyTrend.length;
  const totalAmount = expenses.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0,
  );

  return {
    daily_trend: dailyTrend,
    summary: {
      total_days: totalDays,
      total_expenses: expenses.length,
      total_amount: parseFloat(totalAmount.toFixed(2)),
      avg_per_day:
        totalDays > 0 ? parseFloat((totalAmount / totalDays).toFixed(2)) : 0,
      avg_expense_amount:
        expenses.length > 0
          ? parseFloat((totalAmount / expenses.length).toFixed(2))
          : 0,
    },
  };
};
