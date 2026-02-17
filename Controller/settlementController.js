import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import {
  createSettlement,
  getSettlementById,
  updateSettlement,
  updateBalanceAfterSettlement,
  reverseBalanceUpdate,
  checkAndUpdateExpenseSplits,
  getGroupSettlements,
  getUserSettlements,
  getPendingConfirmations,
  getSettlementStatistics,
  cancelSettlement,
  getBalanceBetweenUsers,
} from "../services/settlement.service.js";
import { checkGroupMembership } from "../services/group.service.js";
import { simplifyGroupDebts } from "../services/balance.service.js";
import { createActivityLog } from "../services/activitylog.service.js";

/**
 * Create new settlement
 */
const recordSettlement = async (req, res) => {
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
    user_id,
  } = req.body;

  // Step 3: Validate input
  if (!payer_id || !payee_id || !amount || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "payer_id, payee_id, amount, and user_id are required",
    });
  }

  // Step 4: Validate user is the payer
  if (payer_id !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "Only the payer can record a settlement",
    });
  }

  // Validate amount
  const settlementAmount = parseFloat(amount);
  if (settlementAmount <= 0) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Amount must be greater than 0",
    });
  }

  // Get current balance
  const currentBalance = await getBalanceBetweenUsers(
    group_id,
    payer_id,
    payee_id,
  );

  if (settlementAmount > currentBalance) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: `Settlement amount ($${settlementAmount}) exceeds current debt ($${currentBalance})`,
    });
  }

  // Check if user is member of group
  if (group_id) {
    const membership = await checkGroupMembership(group_id, user_id);

    if (membership.length === 0) {
      return res.status(403).json({
        status: 403,
        success: false,
        message: "You are not a member of this group",
      });
    }
  }

  // Step 5-6: Create settlement
  const settlementData = {
    group_id,
    payer_id,
    payee_id,
    amount: settlementAmount,
    currency,
    settlement_date,
    payment_method,
    payment_reference,
    notes,
    status: "pending",
    created_by: user_id,
  };

  const newSettlement = await createSettlement(settlementData);

  // Step 7: Update user balances
  if (group_id) {
    await updateBalanceAfterSettlement(
      group_id,
      payer_id,
      payee_id,
      settlementAmount,
    );
  }

  // Step 8: Check if full settlement
  const remainingBalance = await getBalanceBetweenUsers(
    group_id,
    payer_id,
    payee_id,
  );

  if (Math.abs(remainingBalance) < 0.01) {
    await checkAndUpdateExpenseSplits(group_id, payer_id, payee_id);
  }

  // Step 9: Recalculate simplified debts
  if (group_id) {
    await simplifyGroupDebts(group_id);
  }

  // Step 10: Create notification for payee
  // TODO: Implement notification system

  // Step 11: Log activity
  const activity_data = {
    user_id,
    group_id: group_id || null,
    activity_type: "settlement_management",
    entity_type: "settlement",
    entity_id: newSettlement.settlement_id,
    action: "create",
    new_values: JSON.stringify(settlementData),
    description: `Settlement of $${settlementAmount} recorded`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  // Step 12: Return settlement details
  const settlement = await getSettlementById(newSettlement.settlement_id);

  return res.status(201).json({
    status: 201,
    success: true,
    message:
      "Settlement recorded successfully. Waiting for payee confirmation.",
    data: settlement,
  });
};

/**
 * Confirm settlement (by payee)
 */
const confirmSettlement = async (req, res) => {
  const { settlement_id, user_id } = req.body;

  if (!settlement_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "settlement_id and user_id are required",
    });
  }

  // Step 2: Get settlement details
  const settlement = await getSettlementById(settlement_id);

  if (!settlement) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Settlement not found",
    });
  }

  // Validate user is the payee
  if (settlement.payee_id !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "Only the payee can confirm this settlement",
    });
  }

  if (settlement.status !== "pending") {
    return res.status(400).json({
      status: 400,
      success: false,
      message: `Settlement is already ${settlement.status}`,
    });
  }

  // Step 4: Confirm settlement
  await updateSettlement(
    ["confirmed_by_payee", "confirmed_at", "status"],
    [1, new Date(), "completed"],
    "settlement_id",
    settlement_id,
  );

  // Step 6: Log activity
  const activity_data = {
    user_id,
    group_id: settlement.group_id || null,
    activity_type: "settlement_management",
    entity_type: "settlement",
    entity_id: settlement_id,
    action: "confirm",
    old_values: JSON.stringify(settlement),
    new_values: JSON.stringify({ status: "completed", confirmed_by_payee: 1 }),
    description: `Settlement of $${settlement.amount} confirmed`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  // Step 7: Return updated status
  const updatedSettlement = await getSettlementById(settlement_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Settlement confirmed successfully",
    data: updatedSettlement,
  });
};

/**
 * Dispute settlement (by payee)
 */
const disputeSettlement = async (req, res) => {
  const { settlement_id, user_id, reason } = req.body;

  if (!settlement_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "settlement_id and user_id are required",
    });
  }

  // Get settlement details
  const settlement = await getSettlementById(settlement_id);

  if (!settlement) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Settlement not found",
    });
  }

  // Validate user is the payee
  if (settlement.payee_id !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "Only the payee can dispute this settlement",
    });
  }

  if (settlement.status !== "pending") {
    return res.status(400).json({
      status: 400,
      success: false,
      message: `Cannot dispute a ${settlement.status} settlement`,
    });
  }

  // Step 5: Update status to disputed
  await updateSettlement(
    ["status", "notes"],
    ["disputed", `Disputed: ${reason || "No reason provided"}`],
    "settlement_id",
    settlement_id,
  );

  // Reverse balance update
  if (settlement.group_id) {
    await reverseBalanceUpdate(
      settlement.group_id,
      settlement.payer_id,
      settlement.payee_id,
      parseFloat(settlement.amount),
    );

    // Recalculate simplified debts
    await simplifyGroupDebts(settlement.group_id);
  }

  // Create notification for payer and admin
  // TODO: Implement notification system

  // Step 6: Log activity
  const activity_data = {
    user_id,
    group_id: settlement.group_id || null,
    activity_type: "settlement_management",
    entity_type: "settlement",
    entity_id: settlement_id,
    action: "dispute",
    old_values: JSON.stringify(settlement),
    new_values: JSON.stringify({ status: "disputed", reason }),
    description: `Settlement of $${settlement.amount} disputed`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  // Step 7: Return updated status
  const updatedSettlement = await getSettlementById(settlement_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Settlement disputed. Balance has been reversed.",
    data: updatedSettlement,
  });
};

/**
 * Cancel settlement (by payer, only if pending)
 */
const cancelSettlementController = async (req, res) => {
  const { settlement_id, user_id } = req.body;

  if (!settlement_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "settlement_id and user_id are required",
    });
  }

  const settlement = await getSettlementById(settlement_id);

  if (!settlement) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Settlement not found",
    });
  }

  // Only payer can cancel
  if (settlement.payer_id !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "Only the payer can cancel this settlement",
    });
  }

  if (settlement.status !== "pending") {
    return res.status(400).json({
      status: 400,
      success: false,
      message: `Cannot cancel a ${settlement.status} settlement`,
    });
  }

  await cancelSettlement(settlement_id);

  // Reverse balance update
  if (settlement.group_id) {
    await reverseBalanceUpdate(
      settlement.group_id,
      settlement.payer_id,
      settlement.payee_id,
      parseFloat(settlement.amount),
    );

    // Recalculate simplified debts
    await simplifyGroupDebts(settlement.group_id);
  }

  // Log activity
  const activity_data = {
    user_id,
    group_id: settlement.group_id || null,
    activity_type: "settlement_management",
    entity_type: "settlement",
    entity_id: settlement_id,
    action: "cancel",
    old_values: JSON.stringify(settlement),
    description: `Settlement of $${settlement.amount} cancelled`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Settlement cancelled and balance reversed",
  });
};

/**
 * Get settlement details
 */
const getSettlementDetails = async (req, res) => {
  const { settlement_id } = req.params;

  if (!settlement_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "settlement_id is required",
    });
  }

  const settlement = await getSettlementById(settlement_id);

  if (!settlement) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Settlement not found",
    });
  }

  return res.status(200).json({
    status: 200,
    success: true,
    data: settlement,
  });
};

/**
 * Get group settlements
 */
const getGroupSettlementsController = async (req, res) => {
  const { group_id, status, payer_id, payee_id, date_from, date_to, limit } =
    req.query;

  if (!group_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id is required",
    });
  }

  const filters = {
    status,
    payer_id,
    payee_id,
    date_from,
    date_to,
    limit,
  };

  const settlements = await getGroupSettlements(group_id, filters);

  return res.status(200).json({
    status: 200,
    success: true,
    data: settlements,
    count: settlements.length,
  });
};

/**
 * Get user settlements
 */
const getUserSettlementsController = async (req, res) => {
  const { user_id, group_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const settlements = await getUserSettlements(user_id, group_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: settlements,
  });
};

/**
 * Get pending confirmations for user
 */
const getPendingConfirmationsController = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const confirmations = await getPendingConfirmations(user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: confirmations,
    count: confirmations.length,
  });
};

/**
 * Get settlement statistics for a group
 */
const getSettlementStats = async (req, res) => {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id is required",
    });
  }

  const stats = await getSettlementStatistics(group_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: stats,
  });
};

// Routes
router.post("/record", Errorhandler(recordSettlement));
router.post("/confirm", Errorhandler(confirmSettlement));
router.post("/dispute", Errorhandler(disputeSettlement));
router.post("/cancel", Errorhandler(cancelSettlementController));
router.get("/:settlement_id", Errorhandler(getSettlementDetails));
router.get("/group/:group_id", Errorhandler(getGroupSettlementsController));
router.get("/user/:user_id", Errorhandler(getUserSettlementsController));
router.get(
  "/pending/confirmations",
  Errorhandler(getPendingConfirmationsController),
);
router.get("/stats/group", Errorhandler(getSettlementStats));

export default router;
