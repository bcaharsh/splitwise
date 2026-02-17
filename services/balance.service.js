import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Calculate balances for a group
 * @param {string} group_id
 * @returns {Promise<object>}
 */
export const calculateGroupBalances = async (group_id) => {
  // Step 1: Fetch all expenses for the group
  const [expenses] = await con.execute(
    `
    SELECT expense_id, amount, currency
    FROM expenses
    WHERE group_id = ? AND is_deleted = 0
  `,
    [group_id],
  );

  if (expenses.length === 0) {
    return { balances: [], message: "No expenses found" };
  }

  // Get all group members
  const [members] = await con.execute(
    `
    SELECT DISTINCT user_id
    FROM group_members
    WHERE group_id = ? AND is_active = 1
  `,
    [group_id],
  );

  const userIds = members.map((m) => m.user_id);

  // Step 2: Initialize balance matrix
  const balanceMatrix = {};

  // Initialize all pairs
  for (let i = 0; i < userIds.length; i++) {
    for (let j = 0; j < userIds.length; j++) {
      if (i !== j) {
        const key = `${userIds[i]}_${userIds[j]}`;
        balanceMatrix[key] = 0;
      }
    }
  }

  // Step 3: Process each expense
  for (const expense of expenses) {
    const expense_id = expense.expense_id;

    // Get payers for this expense
    const [payers] = await con.execute(
      `
      SELECT user_id, paid_amount
      FROM expense_payers
      WHERE expense_id = ?
    `,
      [expense_id],
    );

    // Get splits for this expense
    const [splits] = await con.execute(
      `
      SELECT user_id, owed_amount
      FROM expense_splits
      WHERE expense_id = ?
    `,
      [expense_id],
    );

    // Create maps for quick lookup
    const paymentMap = {};
    const owedMap = {};

    payers.forEach((p) => {
      paymentMap[p.user_id] = parseFloat(p.paid_amount);
    });

    splits.forEach((s) => {
      owedMap[s.user_id] = parseFloat(s.owed_amount);
    });

    // Calculate net contribution for each user in this expense
    const netContributions = {};

    userIds.forEach((userId) => {
      const paid = paymentMap[userId] || 0;
      const owes = owedMap[userId] || 0;
      netContributions[userId] = paid - owes;
    });

    // Update balance matrix based on net contributions
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const userA = userIds[i];
        const userB = userIds[j];

        const netA = netContributions[userA];
        const netB = netContributions[userB];

        if (netA > 0 && netB < 0) {
          // A paid more, B owes
          const transfer = Math.min(netA, Math.abs(netB));
          balanceMatrix[`${userB}_${userA}`] += transfer;
        } else if (netA < 0 && netB > 0) {
          // B paid more, A owes
          const transfer = Math.min(Math.abs(netA), netB);
          balanceMatrix[`${userA}_${userB}`] += transfer;
        }
      }
    }
  }

  // Step 4: Update user_balances table
  const currency = expenses[0].currency || "USD";
  const balanceUpdates = [];

  for (const [key, amount] of Object.entries(balanceMatrix)) {
    if (amount !== 0) {
      const [from_user_id, to_user_id] = key.split("_");

      const balance_id = uuidv4();

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
          balance_amount = ?,
          last_calculated_at = NOW()
      `;

      await con.execute(upsert_query, [
        balance_id,
        group_id,
        from_user_id,
        to_user_id,
        amount,
        currency,
        amount,
      ]);

      balanceUpdates.push({
        from_user_id,
        to_user_id,
        balance_amount: amount,
        currency,
      });
    }
  }

  return {
    balances: balanceUpdates,
    message: "Balances calculated successfully",
  };
};

/**
 * Get user balances for a group
 * @param {string} group_id
 * @returns {Promise<Array>}
 */
export const getGroupBalances = async (group_id) => {
  const get_query = `
    SELECT 
      ub.*,
      u1.first_name as from_user_first_name,
      u1.last_name as from_user_last_name,
      u1.profile_image_url as from_user_image,
      u2.first_name as to_user_first_name,
      u2.last_name as to_user_last_name,
      u2.profile_image_url as to_user_image
    FROM user_balances ub
    LEFT JOIN users u1 ON ub.from_user_id = u1.user_id
    LEFT JOIN users u2 ON ub.to_user_id = u2.user_id
    WHERE ub.group_id = ? AND ub.balance_amount != 0
    ORDER BY ub.balance_amount DESC
  `;

  const [balances] = await con.execute(get_query, [group_id]);

  return balances;
};

/**
 * Get user's net balance in a group
 * @param {string} group_id
 * @param {string} user_id
 * @returns {Promise<object>}
 */
export const getUserNetBalance = async (group_id, user_id) => {
  const query = `
    SELECT 
      COALESCE(SUM(CASE WHEN to_user_id = ? THEN balance_amount ELSE 0 END), 0) as total_owed_to_me,
      COALESCE(SUM(CASE WHEN from_user_id = ? THEN balance_amount ELSE 0 END), 0) as total_i_owe,
      (
        COALESCE(SUM(CASE WHEN to_user_id = ? THEN balance_amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN from_user_id = ? THEN balance_amount ELSE 0 END), 0)
      ) as net_balance
    FROM user_balances
    WHERE group_id = ? AND balance_amount != 0
  `;

  const [result] = await con.execute(query, [
    user_id,
    user_id,
    user_id,
    user_id,
    group_id,
  ]);

  return result[0];
};

/**
 * Get all balances involving a user
 * @param {string} user_id
 * @param {string} group_id (optional)
 * @returns {Promise<Array>}
 */
export const getUserBalances = async (user_id, group_id = null) => {
  let query = `
    SELECT 
      ub.*,
      CASE 
        WHEN ub.from_user_id = ? THEN 'owes'
        WHEN ub.to_user_id = ? THEN 'owed'
      END as balance_type,
      CASE 
        WHEN ub.from_user_id = ? THEN u2.first_name
        ELSE u1.first_name
      END as other_user_first_name,
      CASE 
        WHEN ub.from_user_id = ? THEN u2.last_name
        ELSE u1.last_name
      END as other_user_last_name,
      CASE 
        WHEN ub.from_user_id = ? THEN u2.user_id
        ELSE u1.user_id
      END as other_user_id,
      g.group_name
    FROM user_balances ub
    LEFT JOIN users u1 ON ub.from_user_id = u1.user_id
    LEFT JOIN users u2 ON ub.to_user_id = u2.user_id
    LEFT JOIN expense_groups g ON ub.group_id = g.group_id
    WHERE (ub.from_user_id = ? OR ub.to_user_id = ?)
    AND ub.balance_amount != 0
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
    query += ` AND ub.group_id = ?`;
    params.push(group_id);
  }

  query += ` ORDER BY ub.balance_amount DESC`;

  const [balances] = await con.execute(query, params);

  return balances;
};

/**
 * Simplify debts for a group using greedy algorithm
 * @param {string} group_id
 * @returns {Promise<object>}
 */
export const simplifyGroupDebts = async (group_id) => {
  // Step 1: Fetch all user_balances for the group
  const [balances] = await con.execute(
    `
    SELECT from_user_id, to_user_id, balance_amount, currency
    FROM user_balances
    WHERE group_id = ? AND balance_amount != 0
  `,
    [group_id],
  );

  if (balances.length === 0) {
    return { transactions: [], message: "No balances to simplify" };
  }

  // Step 2: Calculate net balance for each user
  const netBalances = {};

  balances.forEach((balance) => {
    const { from_user_id, to_user_id, balance_amount } = balance;

    // from_user owes to_user
    if (!netBalances[from_user_id]) {
      netBalances[from_user_id] = 0;
    }
    if (!netBalances[to_user_id]) {
      netBalances[to_user_id] = 0;
    }

    netBalances[from_user_id] -= parseFloat(balance_amount); // Debtor
    netBalances[to_user_id] += parseFloat(balance_amount); // Creditor
  });

  // Step 3: Separate into creditors and debtors
  const creditors = [];
  const debtors = [];

  Object.entries(netBalances).forEach(([user_id, balance]) => {
    const amount = parseFloat(balance.toFixed(2));
    if (amount > 0.01) {
      creditors.push({ user_id, amount });
    } else if (amount < -0.01) {
      debtors.push({ user_id, amount: Math.abs(amount) });
    }
  });

  // Step 4: Sort creditors descending, debtors descending
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Step 5: Apply greedy matching algorithm
  const simplifiedTransactions = [];

  let i = 0; // Creditor index
  let j = 0; // Debtor index

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amount_to_settle = Math.min(creditor.amount, debtor.amount);

    if (amount_to_settle > 0.01) {
      simplifiedTransactions.push({
        from_user_id: debtor.user_id,
        to_user_id: creditor.user_id,
        amount: parseFloat(amount_to_settle.toFixed(2)),
      });
    }

    creditor.amount -= amount_to_settle;
    debtor.amount -= amount_to_settle;

    if (creditor.amount < 0.01) {
      i++;
    }
    if (debtor.amount < 0.01) {
      j++;
    }
  }

  // Step 6: Clear old simplified_debts for this group
  await con.execute(
    `
    DELETE FROM simplified_debts
    WHERE group_id = ?
  `,
    [group_id],
  );

  // Step 7: Insert new simplified transactions
  const currency = balances[0].currency || "USD";

  for (const transaction of simplifiedTransactions) {
    const debt_id = uuidv4();

    await con.execute(
      `
      INSERT INTO simplified_debts (
        debt_id,
        group_id,
        from_user_id,
        to_user_id,
        amount,
        currency,
        calculated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        debt_id,
        group_id,
        transaction.from_user_id,
        transaction.to_user_id,
        transaction.amount,
        currency,
      ],
    );
  }

  // Step 8: Return simplified debt list with user details
  const [simplifiedDebts] = await con.execute(
    `
    SELECT 
      sd.*,
      u1.first_name as from_user_first_name,
      u1.last_name as from_user_last_name,
      u1.profile_image_url as from_user_image,
      u2.first_name as to_user_first_name,
      u2.last_name as to_user_last_name,
      u2.profile_image_url as to_user_image
    FROM simplified_debts sd
    LEFT JOIN users u1 ON sd.from_user_id = u1.user_id
    LEFT JOIN users u2 ON sd.to_user_id = u2.user_id
    WHERE sd.group_id = ?
    ORDER BY sd.amount DESC
  `,
    [group_id],
  );

  return {
    transactions: simplifiedDebts,
    original_count: balances.length,
    simplified_count: simplifiedTransactions.length,
    message: `Simplified from ${balances.length} to ${simplifiedTransactions.length} transactions`,
  };
};

/**
 * Get simplified debts for a group
 * @param {string} group_id
 * @returns {Promise<Array>}
 */
export const getSimplifiedDebts = async (group_id) => {
  const get_query = `
    SELECT 
      sd.*,
      u1.first_name as from_user_first_name,
      u1.last_name as from_user_last_name,
      u1.profile_image_url as from_user_image,
      u2.first_name as to_user_first_name,
      u2.last_name as to_user_last_name,
      u2.profile_image_url as to_user_image
    FROM simplified_debts sd
    LEFT JOIN users u1 ON sd.from_user_id = u1.user_id
    LEFT JOIN users u2 ON sd.to_user_id = u2.user_id
    WHERE sd.group_id = ?
    ORDER BY sd.amount DESC
  `;

  const [debts] = await con.execute(get_query, [group_id]);

  return debts;
};

/**
 * Calculate and simplify debts (combined operation)
 * @param {string} group_id
 * @returns {Promise<object>}
 */
export const calculateAndSimplifyDebts = async (group_id) => {
  // First calculate balances
  await calculateGroupBalances(group_id);

  // Then simplify
  const result = await simplifyGroupDebts(group_id);

  return result;
};

/**
 * Get balance summary for a group
 * @param {string} group_id
 * @returns {Promise<object>}
 */
export const getGroupBalanceSummary = async (group_id) => {
  // Get all balances
  const balances = await getGroupBalances(group_id);

  // Get simplified debts
  const simplifiedDebts = await getSimplifiedDebts(group_id);

  // Calculate total debt in group
  const totalDebt = balances.reduce(
    (sum, b) => sum + parseFloat(b.balance_amount),
    0,
  );

  // Get member count
  const [memberCount] = await con.execute(
    `
    SELECT COUNT(DISTINCT user_id) as count
    FROM group_members
    WHERE group_id = ? AND is_active = 1
  `,
    [group_id],
  );

  return {
    total_debt: parseFloat(totalDebt.toFixed(2)),
    balance_count: balances.length,
    simplified_count: simplifiedDebts.length,
    member_count: memberCount[0].count,
    balances,
    simplified_debts: simplifiedDebts,
  };
};

/**
 * Recalculate balances after expense change
 * @param {string} group_id
 * @returns {Promise<void>}
 */
export const recalculateGroupBalances = async (group_id) => {
  // Clear existing balances
  await con.execute(
    `
    DELETE FROM user_balances
    WHERE group_id = ?
  `,
    [group_id],
  );

  // Recalculate
  await calculateGroupBalances(group_id);

  // Simplify
  await simplifyGroupDebts(group_id);
};
