import fs from "fs";
import path from "path";
import {
  updateReportStatus,
  fetchExpenseDataForReport,
  generateSummaryReport,
  generateDetailedReport,
  generateMemberWiseReport,
  generateTrendReport,
} from "../services/report.service.js";
import { processNotification } from "../services/notificationQueue.service.js";

/**
 * Process report generation
 * @param {object} report
 * @returns {Promise<void>}
 */
export const processReportGeneration = async (report) => {
  try {
    console.log(
      `📊 Generating report: ${report.report_name} (${report.report_id})`,
    );

    // Step 5A: Fetch expenses
    const filters = {
      user_id: report.user_id,
      group_id: report.group_id,
      date_from: report.date_from,
      date_to: report.date_to,
      ...(report.filters_applied ? JSON.parse(report.filters_applied) : {}),
    };

    const expenses = await fetchExpenseDataForReport(filters);

    if (expenses.length === 0) {
      await updateReportStatus(report.report_id, {
        status: "failed",
        generated_at: new Date(),
      });

      await processNotification(report.user_id, {
        notification_type: "report",
        title: "Report Generation Failed",
        message: `No expenses found for "${report.report_name}"`,
        data_payload: { report_id: report.report_id },
      });

      return;
    }

    // Step 5B: Aggregate data based on report type
    let reportData;

    switch (report.report_type) {
      case "summary":
        reportData = await generateSummaryReport(expenses);
        break;
      case "detailed":
        reportData = await generateDetailedReport(expenses);
        break;
      case "member_wise":
        reportData = await generateMemberWiseReport(expenses);
        break;
      case "trend":
        reportData = await generateTrendReport(
          expenses,
          report.date_from,
          report.date_to,
        );
        break;
      case "category_wise":
        reportData = await generateSummaryReport(expenses);
        break;
      default:
        reportData = await generateSummaryReport(expenses);
    }

    // Step 5C: Generate document
    const fileUrl = await generateDocument(report, reportData, expenses);

    // Step 5D & E: Update report status
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Expires in 30 days

    await updateReportStatus(report.report_id, {
      file_url: fileUrl,
      status: "completed",
      generated_at: new Date(),
      expires_at: expiresAt,
    });

    // Step 5F: Notify user
    await processNotification(report.user_id, {
      notification_type: "report",
      title: "Report Ready",
      message: `Your report "${report.report_name}" is ready to download`,
      data_payload: { report_id: report.report_id, file_url: fileUrl },
    });

    console.log(`✅ Report generated successfully: ${report.report_id}`);
  } catch (error) {
    console.error(`❌ Error generating report ${report.report_id}:`, error);

    await updateReportStatus(report.report_id, {
      status: "failed",
      generated_at: new Date(),
    });

    await processNotification(report.user_id, {
      notification_type: "report",
      title: "Report Generation Failed",
      message: `Failed to generate "${report.report_name}". Please try again.`,
      data_payload: { report_id: report.report_id },
    });
  }
};

/**
 * Generate document file
 * @param {object} report
 * @param {object} reportData
 * @param {Array} expenses
 * @returns {Promise<string>}
 */
const generateDocument = async (report, reportData, expenses) => {
  const reportsDir = path.join(process.cwd(), "reports");

  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const fileName = `${report.report_id}.${report.file_format}`;
  const filePath = path.join(reportsDir, fileName);

  switch (report.file_format) {
    case "csv":
      await generateCSV(filePath, reportData, expenses);
      break;
    case "pdf":
      await generatePDF(filePath, report, reportData, expenses);
      break;
    case "json":
      await generateJSON(filePath, reportData, expenses);
      break;
    default:
      await generateCSV(filePath, reportData, expenses);
  }

  // In production, upload to cloud storage (S3, GCS, etc.)
  // For now, return local file path
  return `/reports/${fileName}`;
};

/**
 * Generate CSV file
 * @param {string} filePath
 * @param {object} reportData
 * @param {Array} expenses
 * @returns {Promise<void>}
 */
const generateCSV = async (filePath, reportData, expenses) => {
  let csvContent = "Date,Description,Amount,Currency,Paid By,Category,Group\n";

  expenses.forEach((expense) => {
    csvContent += `${expense.expense_date},${expense.description},${expense.amount},${expense.currency},${expense.payer_first_name} ${expense.payer_last_name},${expense.category_name || "Uncategorized"},${expense.group_name || "Personal"}\n`;
  });

  fs.writeFileSync(filePath, csvContent);
};

/**
 * Generate JSON file
 * @param {string} filePath
 * @param {object} reportData
 * @param {Array} expenses
 * @returns {Promise<void>}
 */
const generateJSON = async (filePath, reportData, expenses) => {
  const jsonData = {
    report_data: reportData,
    expenses,
    generated_at: new Date(),
  };

  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
};

/**
 * Generate PDF file (simplified version)
 * @param {string} filePath
 * @param {object} report
 * @param {object} reportData
 * @param {Array} expenses
 * @returns {Promise<void>}
 */
const generatePDF = async (filePath, report, reportData, expenses) => {
  // For a real implementation, use puppeteer or similar
  // For now, generate a simple text file
  let content = `EXPENSE REPORT\n\n`;
  content += `Report Name: ${report.report_name}\n`;
  content += `Type: ${report.report_type}\n`;
  content += `Period: ${report.date_from} to ${report.date_to}\n`;
  content += `Generated: ${new Date().toLocaleString()}\n\n`;

  if (reportData.summary) {
    content += `SUMMARY\n`;
    content += `Total Expenses: ${reportData.summary.total_expenses}\n`;
    content += `Total Amount: ${reportData.summary.currency} ${reportData.summary.total_amount}\n\n`;
  }

  if (reportData.category_breakdown) {
    content += `CATEGORY BREAKDOWN\n`;
    reportData.category_breakdown.forEach((cat) => {
      content += `${cat.category_name}: ${cat.total_amount} (${cat.percentage}%)\n`;
    });
    content += `\n`;
  }

  content += `EXPENSES\n`;
  expenses.forEach((expense) => {
    content += `${expense.expense_date} - ${expense.description}: ${expense.currency} ${expense.amount}\n`;
  });

  fs.writeFileSync(filePath, content);
};
