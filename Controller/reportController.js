import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import {
  createExpenseReport,
  getUserReports,
  getReportById,
} from "../services/report.service.js";
import { processReportGeneration } from "../utils/reportGenerator.js";
import { createActivityLog } from "../services/activitylog.service.js";

/**
 * Request expense report generation
 */
const requestReport = async (req, res) => {
  const {
    user_id,
    group_id,
    report_name,
    report_type,
    date_from,
    date_to,
    category_id,
    file_format,
  } = req.body;

  if (!user_id || !report_name || !report_type || !date_from || !date_to) {
    return res.status(400).json({
      status: 400,
      success: false,
      message:
        "user_id, report_name, report_type, date_from, and date_to are required",
    });
  }

  const filters_applied = {
    category_id,
  };

  const reportData = {
    user_id,
    group_id,
    report_name,
    report_type,
    date_from,
    date_to,
    filters_applied,
    file_format: file_format || "pdf",
  };

  const report = await createExpenseReport(reportData);

  // Queue background job
  setImmediate(async () => {
    const fullReport = await getReportById(report.report_id);
    await processReportGeneration(fullReport);
  });

  // Log activity
  await createActivityLog({
    user_id,
    group_id: group_id || null,
    activity_type: "report_management",
    entity_type: "report",
    entity_id: report.report_id,
    action: "create",
    new_values: JSON.stringify(reportData),
    description: `Report requested: ${report_name}`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  });

  return res.status(202).json({
    status: 202,
    success: true,
    message: "Report generation queued. You'll be notified when it's ready.",
    data: { report_id: report.report_id },
  });
};

/**
 * Get user reports
 */
const getReports = async (req, res) => {
  const { user_id, status, report_type, limit } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const filters = { status, report_type, limit };

  const reports = await getUserReports(user_id, filters);

  return res.status(200).json({
    status: 200,
    success: true,
    data: reports,
    count: reports.length,
  });
};

/**
 * Get report status
 */
const getReportStatus = async (req, res) => {
  const { report_id } = req.params;

  if (!report_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "report_id is required",
    });
  }

  const report = await getReportById(report_id);

  if (!report) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Report not found",
    });
  }

  return res.status(200).json({
    status: 200,
    success: true,
    data: report,
  });
};

// Routes
router.post("/generate", Errorhandler(requestReport));
router.get("/list", Errorhandler(getReports));
router.get("/:report_id", Errorhandler(getReportStatus));

export default router;
