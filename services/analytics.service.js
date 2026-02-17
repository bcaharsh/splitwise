import con from "../config/database.js";

/**
 * Get dashboard analytics for user
 * @param {string} user_id
 * @returns {Promise<object>}
 */
export const getDashboardAnalytics = async (user_id) => {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // A. Current month summary
  const monthSummary = await getCurrentMonthSummary(
    user_id,
    firstDayOfMonth,
    lastDayOfMonth,
  );

  // B. Category breakdown
  const categoryBreakdown = await getCategoryBreakdown(
    user_id,
    firstDayOfMonth,
    lastDayOfMonth,
  );

  // C. Spending trends
  const spendingTrends = await getSpendingTrends(user_id);

  // D. Top expenses
  const topExpenses = await getTopExpenses(user_id, 10);

  // E. Active groups and balances
  const activeGroups = await getActiveGroupBalances(user_id);

  return {
    month_summary: monthSummary,
    category_breakdown: categoryBreakdown,
    spending_trends: spendingTrends,
    top_expenses: topExpenses,
    active_groups: activeGroups,
  };
};

/**
 * Get current month summary
 * @param {string} user_id
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<object>}
 */
const getCurrentMonthSummary = async (user_id, startDate, endDate) => {
  // Total spent (paid by user)
  const [spent] = await con.execute(
    `
    SELECT COALESCE(SUM(amount), 0) as total_spent
    FROM expenses
    WHERE paid_by = ?
    AND expense_date BETWEEN ? AND ?
    AND is_deleted = 0
  `,
    [user_id, startDate, endDate],
  );

  // Total owed by user
  const [owed] = await con.execute(
    `
    SELECT COALESCE(SUM(owed_amount - paid_amount), 0) as total_owed
    FROM expense_splits es
    INNER JOIN expenses e ON es.expense_id = e.expense_id
    WHERE es.user_id = ?
    AND e.expense_date BETWEEN ? AND ?
    AND e.is_deleted = 0
    AND es.is_settled = 0
  `,
    [user_id, startDate, endDate],
  );

  // Total owed to user
  const [owedToUser] = await con.execute(
    `
    SELECT COALESCE(SUM(es.owed_amount - es.paid_amount), 0) as total_owed_to_user
    FROM expense_splits es
    INNER JOIN expenses e ON es.expense_id = e.expense_id
    WHERE e.paid_by = ?
    AND es.user_id != ?
    AND e.expense_date BETWEEN ? AND ?
    AND e.is_deleted = 0
    AND es.is_settled = 0
  `,
    [user_id, user_id, startDate, endDate],
  );

  // Net balance
  const [netBalance] = await con.execute(
    `
    SELECT 
      COALESCE(SUM(CASE WHEN to_user_id = ? THEN balance_amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN from_user_id = ? THEN balance_amount ELSE 0 END), 0) as net_balance
    FROM user_balances
    WHERE (from_user_id = ? OR to_user_id = ?)
    AND balance_amount != 0
  `,
    [user_id, user_id, user_id, user_id],
  );

  return {
    total_spent: parseFloat(spent[0].total_spent.toFixed(2)),
    total_owed: parseFloat(owed[0].total_owed.toFixed(2)),
    total_owed_to_user: parseFloat(owedToUser[0].total_owed_to_user.toFixed(2)),
    net_balance: parseFloat(netBalance[0].net_balance.toFixed(2)),
  };
};

/**
 * Get category breakdown
 * @param {string} user_id
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
const getCategoryBreakdown = async (user_id, startDate, endDate) => {
  const [categories] = await con.execute(
    `
    SELECT 
      COALESCE(ec.category_name, 'Uncategorized') as category_name,
      ec.icon,
      ec.color,
      COUNT(DISTINCT e.expense_id) as expense_count,
      COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses e
    LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
    LEFT JOIN expense_splits es ON e.expense_id = es.expense_id
    WHERE (e.paid_by = ? OR es.user_id = ?)
    AND e.expense_date BETWEEN ? AND ?
    AND e.is_deleted = 0
    GROUP BY e.category_id, ec.category_name, ec.icon, ec.color
    ORDER BY total_amount DESC
  `,
    [user_id, user_id, startDate, endDate],
  );

  const total = categories.reduce(
    (sum, cat) => sum + parseFloat(cat.total_amount),
    0,
  );

  return categories.map((cat) => ({
    ...cat,
    total_amount: parseFloat(cat.total_amount.toFixed(2)),
    percentage:
      total > 0 ? parseFloat(((cat.total_amount / total) * 100).toFixed(2)) : 0,
  }));
};

/**
 * Get spending trends (last 30 days)
 * @param {string} user_id
 * @returns {Promise<object>}
 */
const getSpendingTrends = async (user_id) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Daily spending
  const [dailySpending] = await con.execute(
    `
    SELECT 
      DATE(e.expense_date) as date,
      COUNT(DISTINCT e.expense_id) as expense_count,
      COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses e
    LEFT JOIN expense_splits es ON e.expense_id = es.expense_id
    WHERE (e.paid_by = ? OR es.user_id = ?)
    AND e.expense_date >= ?
    AND e.is_deleted = 0
    GROUP BY DATE(e.expense_date)
    ORDER BY date ASC
  `,
    [user_id, user_id, thirtyDaysAgo],
  );

  // Compare with previous period
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [currentPeriod] = await con.execute(
    `
    SELECT COALESCE(SUM(e.amount), 0) as total
    FROM expenses e
    LEFT JOIN expense_splits es ON e.expense_id = es.expense_id
    WHERE (e.paid_by = ? OR es.user_id = ?)
    AND e.expense_date >= ?
    AND e.is_deleted = 0
  `,
    [user_id, user_id, thirtyDaysAgo],
  );

  const [previousPeriod] = await con.execute(
    `
    SELECT COALESCE(SUM(e.amount), 0) as total
    FROM expenses e
    LEFT JOIN expense_splits es ON e.expense_id = es.expense_id
    WHERE (e.paid_by = ? OR es.user_id = ?)
    AND e.expense_date BETWEEN ? AND ?
    AND e.is_deleted = 0
  `,
    [user_id, user_id, sixtyDaysAgo, thirtyDaysAgo],
  );

  const currentTotal = parseFloat(currentPeriod[0].total);
  const previousTotal = parseFloat(previousPeriod[0].total);
  const percentageChange =
    previousTotal > 0
      ? parseFloat(
          (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(2),
        )
      : 0;

  return {
    daily_spending: dailySpending.map((day) => ({
      date: day.date,
      expense_count: day.expense_count,
      total_amount: parseFloat(day.total_amount.toFixed(2)),
    })),
    comparison: {
      current_period: parseFloat(currentTotal.toFixed(2)),
      previous_period: parseFloat(previousTotal.toFixed(2)),
      percentage_change: percentageChange,
      trend:
        percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable",
    },
  };
};

/**
 * Get top expenses
 * @param {string} user_id
 * @param {number} limit
 * @returns {Promise<Array>}
 */
const getTopExpenses = async (user_id, limit = 10) => {
  const [expenses] = await con.execute(
    `
    SELECT 
      e.*,
      u.first_name as payer_first_name,
      u.last_name as payer_last_name,
      ec.category_name,
      g.group_name
    FROM expenses e
    LEFT JOIN users u ON e.paid_by = u.user_id
    LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
    LEFT JOIN expense_groups g ON e.group_id = g.group_id
    LEFT JOIN expense_splits es ON e.expense_id = es.expense_id
    WHERE (e.paid_by = ? OR es.user_id = ?)
    AND e.is_deleted = 0
    GROUP BY e.expense_id
    ORDER BY e.amount DESC
    LIMIT ?
  `,
    [user_id, user_id, limit],
  );

  return expenses;
};

/**
 * Get active groups with balances
 * @param {string} user_id
 * @returns {Promise<Array>}
 */
const getActiveGroupBalances = async (user_id) => {
  const [groups] = await con.execute(
    `
    SELECT 
      g.group_id,
      g.group_name,
      g.group_image_url,
      g.default_currency,
      COALESCE(SUM(CASE 
        WHEN ub.to_user_id = ? THEN ub.balance_amount 
        ELSE 0 
      END), 0) as owed_to_me,
      COALESCE(SUM(CASE 
        WHEN ub.from_user_id = ? THEN ub.balance_amount 
        ELSE 0 
      END), 0) as i_owe,
      COUNT(DISTINCT gm.member_id) as member_count,
      COUNT(DISTINCT e.expense_id) as expense_count
    FROM group_members gm
    INNER JOIN expense_groups g ON gm.group_id = g.group_id
    LEFT JOIN user_balances ub ON g.group_id = ub.group_id 
      AND (ub.from_user_id = ? OR ub.to_user_id = ?)
    LEFT JOIN expenses e ON g.group_id = e.group_id AND e.is_deleted = 0
    WHERE gm.user_id = ?
    AND gm.is_active = 1
    AND g.is_active = 1
    GROUP BY g.group_id
    ORDER BY g.group_name ASC
  `,
    [user_id, user_id, user_id, user_id, user_id],
  );

  return groups.map((group) => ({
    ...group,
    owed_to_me: parseFloat(group.owed_to_me.toFixed(2)),
    i_owe: parseFloat(group.i_owe.toFixed(2)),
    net_balance: parseFloat((group.owed_to_me - group.i_owe).toFixed(2)),
  }));
};

/**
 * Get expense statistics
 * @param {string} user_id
 * @param {string} period (week, month, year, all)
 * @returns {Promise<object>}
 */
export const getExpenseStatistics = async (user_id, period = "month") => {
  let dateFrom;
  const now = new Date();

  switch (period) {
    case "week":
      dateFrom = new Date(now.setDate(now.getDate() - 7));
      break;
    case "month":
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      dateFrom = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      dateFrom = new Date(0); // All time
  }

  const [stats] = await con.execute(
    `
    SELECT 
      COUNT(DISTINCT e.expense_id) as total_expenses,
      COALESCE(SUM(e.amount), 0) as total_amount,
      COALESCE(AVG(e.amount), 0) as avg_amount,
      MAX(e.amount) as max_amount,
      MIN(e.amount) as min_amount
    FROM expenses e
    LEFT JOIN expense_splits es ON e.expense_id = es.expense_id
    WHERE (e.paid_by = ? OR es.user_id = ?)
    AND e.expense_date >= ?
    AND e.is_deleted = 0
  `,
    [user_id, user_id, dateFrom],
  );

  return {
    total_expenses: stats[0].total_expenses,
    total_amount: parseFloat(stats[0].total_amount.toFixed(2)),
    avg_amount: parseFloat(stats[0].avg_amount.toFixed(2)),
    max_amount: parseFloat((stats[0].max_amount || 0).toFixed(2)),
    min_amount: parseFloat((stats[0].min_amount || 0).toFixed(2)),
    period,
  };
};
