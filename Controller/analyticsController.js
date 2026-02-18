import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import {
  getDashboardAnalytics,
  getExpenseStatistics,
} from "../services/analytics.service.js";

/**
 * Get dashboard analytics
 */
const getDashboard = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const analytics = await getDashboardAnalytics(user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: analytics,
  });
};

/**
 * Get expense statistics
 */
const getStatistics = async (req, res) => {
  const { user_id, period } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const stats = await getExpenseStatistics(user_id, period);

  return res.status(200).json({
    status: 200,
    success: true,
    data: stats,
  });
};

// Routes
router.get("/dashboard", Errorhandler(getDashboard));
router.get("/statistics", Errorhandler(getStatistics));

export default router;
