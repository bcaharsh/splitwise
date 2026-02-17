import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import { upload } from "../Middleware/upload.middleware.js";
import {
  createExpense,
  addExpensePayer,
  addExpenseSplit,
  calculateSplits,
  updateUserBalances,
  addExpenseAttachment,
  getExpenseCustomData,
  getExpenseSplits,
  getExpensePayers,
  getExpenseAttachments,
  updateExpense,
  deleteExpenseSplits,
  deleteExpensePayers,
  softDeleteExpense,
  getExpenseById,
  getGroupExpenses,
  getUserExpenses,
  validateSplitAmounts,
} from "../services/expense.service.js";
import { checkGroupMembership } from "../services/group.service.js";
import { createActivityLog } from "../services/activitylog.service.js";
import { calculateAndSimplifyDebts } from "../services/balance.service.js";

/**
 * Create new expense
 */
const createNewExpense = async (req, res) => {
  const connection = await con.getConnection();

  try {
    // START TRANSACTION
    await connection.beginTransaction();

    const {
      group_id,
      description,
      amount,
      currency,
      category_id,
      expense_date,
      split_type,
      paid_by,
      notes,
      created_by,
      payers,
      participants,
    } = req.body;

    // Step 1: Validation
    if (!description || !amount || !created_by) {
      await connection.rollback();
      return res.status(400).json({
        status: 400,
        success: false,
        message: "description, amount, and created_by are required",
      });
    }

    if (parseFloat(amount) <= 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    // Step 2: Check if user is member of group
    if (group_id) {
      const membership = await checkGroupMembership(group_id, created_by);

      if (membership.length === 0) {
        await connection.rollback();
        return res.status(403).json({
          status: 403,
          success: false,
          message: "You are not a member of this group",
        });
      }

      if (membership[0].can_add_expenses !== 1) {
        await connection.rollback();
        return res.status(403).json({
          status: 403,
          success: false,
          message: "You don't have permission to add expenses",
        });
      }
    }

    // Parse payers and participants
    const payersList = payers
      ? JSON.parse(payers)
      : [{ user_id: paid_by, paid_amount: amount }];
    const participantsList = participants
      ? JSON.parse(participants)
      : [{ user_id: created_by }];

    // Validate split amounts
    const isValidSplit = validateSplitAmounts(
      split_type,
      parseFloat(amount),
      participantsList,
    );

    if (!isValidSplit) {
      await connection.rollback();
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Split amounts/percentages don't add up correctly",
      });
    }

    // Step 3-4: Create expense
    const expenseData = {
      group_id,
      description,
      amount: parseFloat(amount),
      currency,
      category_id,
      expense_date,
      split_type,
      paid_by,
      notes,
      created_by,
    };

    const newExpense = await createExpense(expenseData);

    // Step 5: Handle multiple payers
    for (const payer of payersList) {
      await addExpensePayer({
        expense_id: newExpense.expense_id,
        user_id: payer.user_id,
        paid_amount: parseFloat(payer.paid_amount),
        payment_method: payer.payment_method || null,
      });
    }

    // Step 6-7: Calculate and add splits
    const splits = calculateSplits(
      split_type,
      parseFloat(amount),
      participantsList,
    );

    for (const split of splits) {
      // Check if this user also paid
      const payer = payersList.find((p) => p.user_id === split.user_id);
      const paidAmount = payer ? parseFloat(payer.paid_amount) : 0;

      await addExpenseSplit({
        expense_id: newExpense.expense_id,
        user_id: split.user_id,
        owed_amount: split.owed_amount,
        paid_amount: paidAmount,
        share_value: split.share_value,
        percentage: split.percentage,
      });
    }

    // Step 8: Update user balances
    if (group_id) {
      await updateUserBalances(group_id, splits, payersList);
    }

    // Step 9: Handle attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await addExpenseAttachment({
          expense_id: newExpense.expense_id,
          file_name: file.filename,
          original_file_name: file.originalname,
          file_type: file.mimetype,
          file_size: file.size,
          file_url: file.path,
          thumbnail_url: null, // TODO: Generate thumbnails
          is_receipt: 1,
          uploaded_by: created_by,
        });
      }
    }

    // Step 10: Trigger debt simplification (async - implement later)
    // TODO: Queue job for debt simplification

    // Step 11: Create notifications (implement in notifications phase)
    // TODO: Create notifications for participants

    // Step 12: Log activity
    const activity_data = {
      user_id: created_by,
      group_id: group_id || null,
      activity_type: "expense_management",
      entity_type: "expense",
      entity_id: newExpense.expense_id,
      action: "create",
      new_values: JSON.stringify(expenseData),
      description: `Expense "${description}" created`,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    };

    await createActivityLog(activity_data);

    if (group_id) {
      await calculateAndSimplifyDebts(group_id);
    }

    // COMMIT TRANSACTION
    await connection.commit();

    // Step 14: Return expense details with split breakdown
    const expenseDetails = await getExpenseById(newExpense.expense_id);

    return res.status(201).json({
      status: 201,
      success: true,
      message: "Expense created successfully",
      data: expenseDetails,
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Update expense
 */
const updateExpenseController = async (req, res) => {
  const connection = await con.getConnection();

  try {
    // START TRANSACTION
    await connection.beginTransaction();

    const {
      expense_id,
      user_id,
      description,
      amount,
      currency,
      category_id,
      expense_date,
      split_type,
      notes,
      payers,
      participants,
    } = req.body;

    if (!expense_id || !user_id) {
      await connection.rollback();
      return res.status(400).json({
        status: 400,
        success: false,
        message: "expense_id and user_id are required",
      });
    }

    // Step 3: Fetch current expense data
    const currentExpense = await getExpenseById(expense_id);

    if (!currentExpense) {
      await connection.rollback();
      return res.status(404).json({
        status: 404,
        success: false,
        message: "Expense not found",
      });
    }

    // Step 2: Verify permissions
    let hasPermission = false;

    if (currentExpense.created_by === user_id) {
      hasPermission = true;
    } else if (currentExpense.group_id) {
      const membership = await checkGroupMembership(
        currentExpense.group_id,
        user_id,
      );
      if (membership.length > 0 && membership[0].can_edit_expenses === 1) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      await connection.rollback();
      return res.status(403).json({
        status: 403,
        success: false,
        message: "You don't have permission to edit this expense",
      });
    }

    // Step 4: Check if expense is settled
    if (currentExpense.is_settled === 1) {
      await connection.rollback();
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Cannot edit settled expense",
      });
    }

    // Step 6: Update expense
    const updateFields = [];
    const updateValues = [];

    const payload = {
      description,
      amount,
      currency,
      category_id,
      expense_date,
      split_type,
      notes,
    };

    Object.entries(payload).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        updateFields.push(key);
        updateValues.push(value);
      }
    });

    if (updateFields.length > 0) {
      await updateExpense(updateFields, updateValues, "expense_id", expense_id);
    }

    // Step 7: Delete old splits
    await deleteExpenseSplits(expense_id);

    // Step 8: Delete old payers
    await deleteExpensePayers(expense_id);

    // Recalculate and insert new splits
    const payersList = payers ? JSON.parse(payers) : currentExpense.payers;
    const participantsList = participants
      ? JSON.parse(participants)
      : currentExpense.splits.map((s) => ({ user_id: s.user_id }));

    const newAmount = amount ? parseFloat(amount) : currentExpense.amount;
    const newSplitType = split_type || currentExpense.split_type;

    const splits = calculateSplits(newAmount, newSplitType, participantsList);

    for (const payer of payersList) {
      await addExpensePayer({
        expense_id,
        user_id: payer.user_id,
        paid_amount: parseFloat(payer.paid_amount),
        payment_method: payer.payment_method || null,
      });
    }

    for (const split of splits) {
      const payer = payersList.find((p) => p.user_id === split.user_id);
      const paidAmount = payer ? parseFloat(payer.paid_amount) : 0;

      await addExpenseSplit({
        expense_id,
        user_id: split.user_id,
        owed_amount: split.owed_amount,
        paid_amount: paidAmount,
        share_value: split.share_value,
        percentage: split.percentage,
      });
    }

    // Step 9-10: Reverse old balances and apply new ones
    // This is complex - for simplicity, we'll recalculate from scratch
    // In production, you'd want to calculate the diff
    if (currentExpense.group_id) {
      await updateUserBalances(currentExpense.group_id, splits, payersList);
    }

    // Step 14: Log activity
    const updatedExpense = await getExpenseById(expense_id);

    const activity_data = {
      user_id,
      group_id: currentExpense.group_id || null,
      activity_type: "expense_management",
      entity_type: "expense",
      entity_id: expense_id,
      action: "update",
      old_values: JSON.stringify(currentExpense),
      new_values: JSON.stringify(updatedExpense),
      description: `Expense "${currentExpense.description}" updated`,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    };

    await createActivityLog(activity_data);

    // COMMIT TRANSACTION
    await connection.commit();

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Expense updated successfully",
      data: updatedExpense,
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Delete expense
 */
const deleteExpenseController = async (req, res) => {
  const { expense_id, user_id } = req.body;

  if (!expense_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "expense_id and user_id are required",
    });
  }

  const expense = await getExpenseById(expense_id);

  if (!expense) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Expense not found",
    });
  }

  // Check permissions
  let hasPermission = false;

  if (expense.created_by === user_id) {
    hasPermission = true;
  } else if (expense.group_id) {
    const membership = await checkGroupMembership(expense.group_id, user_id);
    if (membership.length > 0 && membership[0].can_delete_expenses === 1) {
      hasPermission = true;
    }
  }

  if (!hasPermission) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You don't have permission to delete this expense",
    });
  }

  if (expense.is_settled === 1) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Cannot delete settled expense",
    });
  }

  await softDeleteExpense(expense_id, user_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id: expense.group_id || null,
    activity_type: "expense_management",
    entity_type: "expense",
    entity_id: expense_id,
    action: "delete",
    old_values: JSON.stringify(expense),
    description: `Expense "${expense.description}" deleted`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Expense deleted successfully",
  });
};

/**
 * Get expense details
 */
const getExpenseDetails = async (req, res) => {
  const { expense_id } = req.params;

  if (!expense_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "expense_id is required",
    });
  }

  const expense = await getExpenseById(expense_id);

  if (!expense) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Expense not found",
    });
  }

  return res.status(200).json({
    status: 200,
    success: true,
    data: expense,
  });
};

/**
 * Get group expenses
 */
const getGroupExpensesController = async (req, res) => {
  const { group_id, category_id, paid_by, date_from, date_to, limit } =
    req.query;

  if (!group_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id is required",
    });
  }

  const filters = {
    category_id,
    paid_by,
    date_from,
    date_to,
    limit,
  };

  const expenses = await getGroupExpenses(group_id, filters);

  return res.status(200).json({
    status: 200,
    success: true,
    data: expenses,
    count: expenses.length,
  });
};

/**
 * Get user expenses
 */
const getUserExpensesController = async (req, res) => {
  const { user_id, group_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const expenses = await getUserExpenses(user_id, group_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: expenses,
    count: expenses.length,
  });
};

// Routes
router.post(
  "/create",
  upload.array("attachments", 5),
  Errorhandler(createNewExpense),
);
router.put("/update", Errorhandler(updateExpenseController));
router.delete("/delete", Errorhandler(deleteExpenseController));
router.get("/:expense_id", Errorhandler(getExpenseDetails));
router.get("/group/:group_id", Errorhandler(getGroupExpensesController));
router.get("/user/:user_id", Errorhandler(getUserExpensesController));

export default router;
