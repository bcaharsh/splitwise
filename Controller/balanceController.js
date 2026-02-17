import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import {
  calculateGroupBalances,
  getGroupBalances,
  getUserNetBalance,
  getUserBalances,
  simplifyGroupDebts,
  getSimplifiedDebts,
  calculateAndSimplifyDebts,
  getGroupBalanceSummary,
  recalculateGroupBalances,
} from "../services/balance.service.js";
import { checkGroupMembership } from "../services/group.service.js";
import { createActivityLog } from "../services/activitylog.service.js";

/**
 * Calculate balances for a group
 */
const calculateBalances = async (req, res) => {
  const { group_id, user_id } = req.body;

  if (!group_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and user_id are required",
    });
  }

  // Check if user is member
  const membership = await checkGroupMembership(group_id, user_id);

  if (membership.length === 0) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not a member of this group",
    });
  }

  const result = await calculateGroupBalances(group_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id,
    activity_type: "balance_management",
    entity_type: "balance",
    entity_id: group_id,
    action: "calculate",
    new_values: JSON.stringify({ balance_count: result.balances.length }),
    description: "Group balances calculated",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: result.message,
    data: result.balances,
  });
};

/**
 * Get group balances
 */
const getBalances = async (req, res) => {
  const { group_id, user_id } = req.query;

  if (!group_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and user_id are required",
    });
  }

  // Check if user is member
  const membership = await checkGroupMembership(group_id, user_id);

  if (membership.length === 0) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not a member of this group",
    });
  }

  const balances = await getGroupBalances(group_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: balances,
    count: balances.length,
  });
};

/**
 * Get user's net balance in a group
 */
const getNetBalance = async (req, res) => {
  const { group_id, user_id } = req.query;

  if (!group_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and user_id are required",
    });
  }

  const netBalance = await getUserNetBalance(group_id, user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: netBalance,
  });
};

/**
 * Get all balances involving a user
 */
const getMyBalances = async (req, res) => {
  const { user_id, group_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const balances = await getUserBalances(user_id, group_id);

  // Separate into owes and owed
  const iOwe = balances.filter((b) => b.balance_type === "owes");
  const owedToMe = balances.filter((b) => b.balance_type === "owed");

  const totalIOwe = iOwe.reduce(
    (sum, b) => sum + parseFloat(b.balance_amount),
    0,
  );
  const totalOwedToMe = owedToMe.reduce(
    (sum, b) => sum + parseFloat(b.balance_amount),
    0,
  );

  return res.status(200).json({
    status: 200,
    success: true,
    data: {
      i_owe: iOwe,
      owed_to_me: owedToMe,
      total_i_owe: parseFloat(totalIOwe.toFixed(2)),
      total_owed_to_me: parseFloat(totalOwedToMe.toFixed(2)),
      net_balance: parseFloat((totalOwedToMe - totalIOwe).toFixed(2)),
    },
  });
};

/**
 * Simplify group debts
 */
const simplifyDebts = async (req, res) => {
  const { group_id, user_id } = req.body;

  if (!group_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and user_id are required",
    });
  }

  // Check if user is member
  const membership = await checkGroupMembership(group_id, user_id);

  if (membership.length === 0) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not a member of this group",
    });
  }

  const result = await simplifyGroupDebts(group_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id,
    activity_type: "balance_management",
    entity_type: "simplified_debt",
    entity_id: group_id,
    action: "simplify",
    new_values: JSON.stringify({
      original_count: result.original_count,
      simplified_count: result.simplified_count,
    }),
    description: result.message,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: result.message,
    data: {
      transactions: result.transactions,
      original_count: result.original_count,
      simplified_count: result.simplified_count,
    },
  });
};

/**
 * Get simplified debts
 */
const getSimplified = async (req, res) => {
  const { group_id, user_id } = req.query;

  if (!group_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and user_id are required",
    });
  }

  // Check if user is member
  const membership = await checkGroupMembership(group_id, user_id);

  if (membership.length === 0) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not a member of this group",
    });
  }

  const debts = await getSimplifiedDebts(group_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: debts,
    count: debts.length,
  });
};

/**
 * Calculate and simplify (combined operation)
 */
const calculateAndSimplify = async (req, res) => {
  const { group_id, user_id } = req.body;

  if (!group_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and user_id are required",
    });
  }

  // Check if user is member
  const membership = await checkGroupMembership(group_id, user_id);

  if (membership.length === 0) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not a member of this group",
    });
  }

  const result = await calculateAndSimplifyDebts(group_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id,
    activity_type: "balance_management",
    entity_type: "balance",
    entity_id: group_id,
    action: "calculate_and_simplify",
    new_values: JSON.stringify({
      simplified_count: result.simplified_count,
    }),
    description: "Balances calculated and debts simplified",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: result.message,
    data: result.transactions,
  });
};

/**
 * Get balance summary for a group
 */
const getBalanceSummary = async (req, res) => {
  const { group_id, user_id } = req.query;

  if (!group_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and user_id are required",
    });
  }

  // Check if user is member
  const membership = await checkGroupMembership(group_id, user_id);

  if (membership.length === 0) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not a member of this group",
    });
  }

  const summary = await getGroupBalanceSummary(group_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: summary,
  });
};

/**
 * Recalculate all balances for a group
 */
const recalculateBalances = async (req, res) => {
  const { group_id, user_id } = req.body;

  if (!group_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and user_id are required",
    });
  }

  // Check if user is admin
  const membership = await checkGroupMembership(group_id, user_id);

  if (membership.length === 0 || membership[0].role !== "admin") {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "Only admins can recalculate balances",
    });
  }

  await recalculateGroupBalances(group_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id,
    activity_type: "balance_management",
    entity_type: "balance",
    entity_id: group_id,
    action: "recalculate",
    description: "Group balances recalculated from scratch",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Balances recalculated successfully",
  });
};

// Routes
router.post("/calculate", Errorhandler(calculateBalances));
router.get("/list", Errorhandler(getBalances));
router.get("/net", Errorhandler(getNetBalance));
router.get("/my-balances", Errorhandler(getMyBalances));
router.post("/simplify", Errorhandler(simplifyDebts));
router.get("/simplified", Errorhandler(getSimplified));
router.post("/calculate-and-simplify", Errorhandler(calculateAndSimplify));
router.get("/summary", Errorhandler(getBalanceSummary));
router.post("/recalculate", Errorhandler(recalculateBalances));

export default router;
