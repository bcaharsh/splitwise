import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import {
  createRecurringExpense,
  addRecurringSplit,
  getRecurringExpenseById,
  updateRecurringExpense,
  deleteRecurringSplits,
  deactivateRecurringExpense,
  getUserRecurringExpenses,
  getGroupRecurringExpenses,
} from "../services/recurringExpense.service.js";
import { checkGroupMembership } from "../services/group.service.js";
import { createActivityLog } from "../services/activitylog.service.js";

/**
 * Create recurring expense template
 */
const createRecurring = async (req, res) => {
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
    participants,
  } = req.body;

  // Step 2: Validate
  if (
    !description ||
    !amount ||
    !paid_by ||
    !frequency ||
    !start_date ||
    !created_by
  ) {
    return res.status(400).json({
      status: 400,
      success: false,
      message:
        "description, amount, paid_by, frequency, start_date, and created_by are required",
    });
  }

  if (parseFloat(amount) <= 0) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Amount must be greater than 0",
    });
  }

  // Check group membership
  if (group_id) {
    const membership = await checkGroupMembership(group_id, created_by);

    if (membership.length === 0) {
      return res.status(403).json({
        status: 403,
        success: false,
        message: "You are not a member of this group",
      });
    }

    if (membership[0].can_add_expenses !== 1) {
      return res.status(403).json({
        status: 403,
        success: false,
        message: "You don't have permission to add expenses",
      });
    }
  }

  // Step 3-4: Create recurring expense
  const recurringData = {
    group_id,
    description,
    amount: parseFloat(amount),
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
  };

  const newRecurring = await createRecurringExpense(recurringData);

  // Step 5: Add split templates
  const participantsList = participants
    ? JSON.parse(participants)
    : [{ user_id: created_by }];

  for (const participant of participantsList) {
    await addRecurringSplit({
      recurring_id: newRecurring.recurring_id,
      user_id: participant.user_id,
      share_value: participant.shares || null,
      percentage: participant.percentage || null,
      fixed_amount: participant.exact_amount || null,
    });
  }

  // Step 6: Log activity
  const activity_data = {
    user_id: created_by,
    group_id: group_id || null,
    activity_type: "expense_management",
    entity_type: "recurring_expense",
    entity_id: newRecurring.recurring_id,
    action: "create",
    new_values: JSON.stringify(recurringData),
    description: `Recurring expense created: ${description}`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  // Step 7: Return details
  const recurringDetails = await getRecurringExpenseById(
    newRecurring.recurring_id,
  );

  return res.status(201).json({
    status: 201,
    success: true,
    message: "Recurring expense created successfully",
    data: recurringDetails,
  });
};

/**
 * Get recurring expense details
 */
const getRecurringDetails = async (req, res) => {
  const { recurring_id } = req.params;

  if (!recurring_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "recurring_id is required",
    });
  }

  const recurring = await getRecurringExpenseById(recurring_id);

  if (!recurring) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Recurring expense not found",
    });
  }

  return res.status(200).json({
    status: 200,
    success: true,
    data: recurring,
  });
};

/**
 * Update recurring expense
 */
const updateRecurring = async (req, res) => {
  const {
    recurring_id,
    user_id,
    description,
    amount,
    currency,
    category_id,
    frequency,
    end_date,
    max_occurrences,
    participants,
  } = req.body;

  if (!recurring_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "recurring_id and user_id are required",
    });
  }

  const recurring = await getRecurringExpenseById(recurring_id);

  if (!recurring) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Recurring expense not found",
    });
  }

  // Check permissions
  if (recurring.created_by !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "Only the creator can update this recurring expense",
    });
  }

  // Update fields
  const updateFields = [];
  const updateValues = [];

  const payload = {
    description,
    amount,
    currency,
    category_id,
    frequency,
    end_date,
    max_occurrences,
  };

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      updateFields.push(key);
      updateValues.push(value);
    }
  });

  if (updateFields.length > 0) {
    await updateRecurringExpense(
      updateFields,
      updateValues,
      "recurring_id",
      recurring_id,
    );
  }

  // Update splits if provided
  if (participants) {
    await deleteRecurringSplits(recurring_id);

    const participantsList = JSON.parse(participants);

    for (const participant of participantsList) {
      await addRecurringSplit({
        recurring_id,
        user_id: participant.user_id,
        share_value: participant.shares || null,
        percentage: participant.percentage || null,
        fixed_amount: participant.exact_amount || null,
      });
    }
  }

  // Log activity
  const activity_data = {
    user_id,
    group_id: recurring.group_id || null,
    activity_type: "expense_management",
    entity_type: "recurring_expense",
    entity_id: recurring_id,
    action: "update",
    old_values: JSON.stringify(recurring),
    new_values: JSON.stringify(payload),
    description: `Recurring expense updated: ${recurring.description}`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  const updated = await getRecurringExpenseById(recurring_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Recurring expense updated successfully",
    data: updated,
  });
};

/**
 * Deactivate recurring expense
 */
const deactivateRecurring = async (req, res) => {
  const { recurring_id, user_id } = req.body;

  if (!recurring_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "recurring_id and user_id are required",
    });
  }

  const recurring = await getRecurringExpenseById(recurring_id);

  if (!recurring) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Recurring expense not found",
    });
  }

  // Check permissions
  if (recurring.created_by !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "Only the creator can deactivate this recurring expense",
    });
  }

  await deactivateRecurringExpense(recurring_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id: recurring.group_id || null,
    activity_type: "expense_management",
    entity_type: "recurring_expense",
    entity_id: recurring_id,
    action: "deactivate",
    old_values: JSON.stringify(recurring),
    description: `Recurring expense deactivated: ${recurring.description}`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Recurring expense deactivated successfully",
  });
};

/**
 * Get user's recurring expenses
 */
const getUserRecurring = async (req, res) => {
  const { user_id, group_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const recurring = await getUserRecurringExpenses(user_id, group_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: recurring,
    count: recurring.length,
  });
};

/**
 * Get group recurring expenses
 */
const getGroupRecurring = async (req, res) => {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id is required",
    });
  }

  const recurring = await getGroupRecurringExpenses(group_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: recurring,
    count: recurring.length,
  });
};

// Routes
router.post("/create", Errorhandler(createRecurring));
router.get("/:recurring_id", Errorhandler(getRecurringDetails));
router.put("/update", Errorhandler(updateRecurring));
router.put("/deactivate", Errorhandler(deactivateRecurring));
router.get("/user/list", Errorhandler(getUserRecurring));
router.get("/group/list", Errorhandler(getGroupRecurring));

export default router;
