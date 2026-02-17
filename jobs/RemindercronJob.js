import cron from "node-cron";
import con from "../config/database.js";
import {
  getDueRecurringExpenses,
  getRecurringSplits,
  updateRecurringExpense,
  calculateNextOccurrence,
  deactivateRecurringExpense,
} from "../services/recurringExpense.service.js";
import {
  createExpense,
  addExpensePayer,
  addExpenseSplit,
  calculateSplits,
  updateUserBalances,
} from "../services/expense.service.js";
import { simplifyGroupDebts } from "../services/balance.service.js";
import { createActivityLog } from "../services/activitylog.service.js";
import { transporter } from "./mailhandler.js";
import { getUserBalances } from "../services/balance.service.js";
import {
  createReminder,
  getDueReminders,
  getDueSnoozedReminders,
  markReminderAsSent,
} from "../services/reminder.service.js";
import { processNotification } from "../services/notificationQueue.service.js";
import { deleteExpiredReports } from "../services/report.service.js";

/**
 * Process recurring expenses
 * Runs daily at 12:00 AM UTC
 */
export const processRecurringExpenses = cron.schedule(
  "0 0 * * *", // Every day at midnight
  async () => {
    console.log("⏰ Processing recurring expenses...", new Date());

    try {
      // Step 1: Fetch due recurring expenses
      const dueExpenses = await getDueRecurringExpenses();

      console.log(`📋 Found ${dueExpenses.length} due recurring expenses`);

      const processedGroups = new Set();
      const notificationQueue = [];

      // Step 2: Process each recurring expense
      for (const recurring of dueExpenses) {
        try {
          console.log(
            `Processing: ${recurring.description} (${recurring.recurring_id})`,
          );

          // Step 2A: Create actual expense
          const expenseData = {
            group_id: recurring.group_id,
            description: recurring.description,
            amount: recurring.amount,
            currency: recurring.currency,
            category_id: recurring.category_id,
            expense_date: new Date(),
            expense_type: "expense",
            split_type: recurring.split_type,
            paid_by: recurring.paid_by,
            is_recurring: 1,
            recurring_id: recurring.recurring_id,
            notes: `Auto-generated from recurring expense`,
            created_by: recurring.created_by,
          };

          const newExpense = await createExpense(expenseData);

          // Add payer
          await addExpensePayer({
            expense_id: newExpense.expense_id,
            user_id: recurring.paid_by,
            paid_amount: recurring.amount,
            payment_method: null,
          });

          // Step 2B: Copy splits from recurring template
          const recurringSplits = await getRecurringSplits(
            recurring.recurring_id,
          );

          // Calculate splits based on split type
          const participants = recurringSplits.map((split) => ({
            user_id: split.user_id,
            shares: split.share_value,
            percentage: split.percentage,
            exact_amount: split.fixed_amount,
          }));

          const splits = calculateSplits(
            recurring.split_type,
            recurring.amount,
            participants,
          );

          // Add splits to expense
          for (const split of splits) {
            const paidAmount =
              split.user_id === recurring.paid_by ? recurring.amount : 0;

            await addExpenseSplit({
              expense_id: newExpense.expense_id,
              user_id: split.user_id,
              owed_amount: split.owed_amount,
              paid_amount: paidAmount,
              share_value: split.share_value,
              percentage: split.percentage,
            });
          }

          // Step 2C: Update user balances
          if (recurring.group_id) {
            const payers = [
              { user_id: recurring.paid_by, paid_amount: recurring.amount },
            ];
            await updateUserBalances(recurring.group_id, splits, payers);
            processedGroups.add(recurring.group_id);
          }

          // Step 2D: Calculate next occurrence
          const nextOccurrence = calculateNextOccurrence(
            new Date(recurring.next_occurrence),
            recurring.frequency,
            recurring.day_of_month,
            recurring.day_of_week,
          );

          const newOccurrenceCount = recurring.occurrence_count + 1;

          // Update recurring expense
          await updateRecurringExpense(
            ["occurrence_count", "next_occurrence"],
            [newOccurrenceCount, nextOccurrence],
            "recurring_id",
            recurring.recurring_id,
          );

          // Step 2E: Check if should deactivate
          let shouldDeactivate = false;

          // Check max occurrences
          if (
            recurring.max_occurrences &&
            newOccurrenceCount >= recurring.max_occurrences
          ) {
            shouldDeactivate = true;
            console.log(
              `✓ Reached max occurrences (${recurring.max_occurrences})`,
            );
          }

          // Check end date
          if (
            recurring.end_date &&
            new Date(nextOccurrence) > new Date(recurring.end_date)
          ) {
            shouldDeactivate = true;
            console.log(`✓ Passed end date (${recurring.end_date})`);
          }

          if (shouldDeactivate) {
            await deactivateRecurringExpense(recurring.recurring_id);
            console.log(
              `❌ Deactivated recurring expense: ${recurring.description}`,
            );
          }

          // Step 2F: Queue notifications
          notificationQueue.push({
            recurring,
            expense: newExpense,
            splits: recurringSplits,
          });

          // Step 2G: Log activity
          await createActivityLog({
            user_id: recurring.created_by,
            group_id: recurring.group_id,
            activity_type: "expense_management",
            entity_type: "expense",
            entity_id: newExpense.expense_id,
            action: "create",
            new_values: JSON.stringify(expenseData),
            description: `Recurring expense created: ${recurring.description}`,
            ip_address: "127.0.0.1",
            user_agent: "Cron Job",
          });

          console.log(
            `✅ Successfully created expense: ${newExpense.expense_id}`,
          );
        } catch (error) {
          console.error(
            `❌ Error processing recurring expense ${recurring.recurring_id}:`,
            error,
          );
        }
      }

      // Step 3: Trigger debt simplification for affected groups
      for (const group_id of processedGroups) {
        try {
          await simplifyGroupDebts(group_id);
          console.log(`✅ Simplified debts for group: ${group_id}`);
        } catch (error) {
          console.error(
            `❌ Error simplifying debts for group ${group_id}:`,
            error,
          );
        }
      }

      // Step 4: Send notifications
      if (notificationQueue.length > 0) {
        await sendRecurringExpenseNotifications(notificationQueue);
      }

      console.log(
        `✅ Recurring expenses processing completed. Processed: ${dueExpenses.length}`,
      );
    } catch (error) {
      console.error("❌ Error in recurring expenses cron job:", error);
    }
  },
  {
    scheduled: false, // Don't start automatically
    timezone: "UTC",
  },
);

/**
 * Process payment reminders
 * Runs daily at 9:00 AM UTC
 */
export const processPaymentReminders = cron.schedule(
  "0 9 * * *", // Every day at 9 AM
  async () => {
    console.log("⏰ Processing payment reminders...", new Date());

    try {
      // Step 1: Fetch users with payment reminder enabled
      const [users] = await con.execute(`
        SELECT u.user_id, u.email, u.first_name, u.last_name, up.payment_reminder_days
        FROM users u
        INNER JOIN user_preferences up ON u.user_id = up.user_id
        WHERE up.payment_reminder_days > 0
        AND u.is_active = 1
      `);

      console.log(`📋 Found ${users.length} users with reminders enabled`);

      for (const user of users) {
        try {
          // Step 2A: Calculate pending debts
          const balances = await getUserBalances(user.user_id);
          const debts = balances.filter((b) => b.balance_type === "owes");

          if (debts.length === 0) {
            continue;
          }

          // Step 2B: Check if reminder should be sent
          const totalDebt = debts.reduce(
            (sum, d) => sum + parseFloat(d.balance_amount),
            0,
          );

          if (totalDebt < 1) {
            continue; // Skip if debt is less than $1
          }

          // Step 2C: Create reminder
          const remindAt = new Date();
          remindAt.setDate(remindAt.getDate() + user.payment_reminder_days);

          for (const debt of debts) {
            await createReminder({
              user_id: user.user_id,
              related_user_id: debt.other_user_id,
              group_id: debt.group_id,
              reminder_type: "payment_due",
              title: "Payment Reminder",
              message: `You owe ${debt.currency} ${debt.balance_amount} to ${debt.other_user_first_name}`,
              remind_at: remindAt,
            });

            console.log(
              `✅ Created reminder for ${user.first_name}: ${debt.balance_amount} to ${debt.other_user_first_name}`,
            );
          }
        } catch (error) {
          console.error(
            `❌ Error processing reminders for user ${user.user_id}:`,
            error,
          );
        }
      }

      // Step 3: Process due reminders
      const dueReminders = await getDueReminders();

      for (const reminder of dueReminders) {
        try {
          await processNotification(reminder.user_id, {
            notification_type: reminder.reminder_type,
            title: reminder.title,
            message: reminder.message,
            data_payload: {
              reminder_id: reminder.reminder_id,
              related_user_id: reminder.related_user_id,
              group_id: reminder.group_id,
            },
            related_entity_type: "reminder",
            related_entity_id: reminder.reminder_id,
          });

          await markReminderAsSent(reminder.reminder_id);

          console.log(
            `✅ Sent reminder to: ${reminder.first_name} ${reminder.last_name}`,
          );
        } catch (error) {
          console.error(
            `❌ Error sending reminder ${reminder.reminder_id}:`,
            error,
          );
        }
      }

      // Process snoozed reminders
      const snoozedReminders = await getDueSnoozedReminders();

      for (const reminder of snoozedReminders) {
        try {
          await processNotification(reminder.user_id, {
            notification_type: reminder.reminder_type,
            title: reminder.title,
            message: reminder.message,
            data_payload: { reminder_id: reminder.reminder_id },
            related_entity_type: "reminder",
            related_entity_id: reminder.reminder_id,
          });

          await markReminderAsSent(reminder.reminder_id);

          console.log(
            `✅ Sent snoozed reminder to: ${reminder.first_name} ${reminder.last_name}`,
          );
        } catch (error) {
          console.error(
            `❌ Error sending snoozed reminder ${reminder.reminder_id}:`,
            error,
          );
        }
      }

      console.log(`✅ Payment reminders processing completed`);
    } catch (error) {
      console.error("❌ Error in payment reminders cron job:", error);
    }
  },
  {
    scheduled: false,
    timezone: "UTC",
  },
);

/**
 * Clean up expired reports
 * Runs daily at 2:00 AM UTC
 */
export const cleanupExpiredReports = cron.schedule(
  "0 2 * * *", // Every day at 2 AM
  async () => {
    console.log("⏰ Cleaning up expired reports...", new Date());

    try {
      const deletedCount = await deleteExpiredReports();

      console.log(`✅ Deleted ${deletedCount} expired reports`);
    } catch (error) {
      console.error("❌ Error in cleanup expired reports cron job:", error);
    }
  },
  {
    scheduled: false,
    timezone: "UTC",
  },
);

/**
 * Send notifications for recurring expenses
 * @param {Array} notificationQueue
 */
const sendRecurringExpenseNotifications = async (notificationQueue) => {
  console.log(
    `📧 Sending ${notificationQueue.length} recurring expense notifications...`,
  );

  for (const item of notificationQueue) {
    try {
      const { recurring, splits } = item;

      // Get unique user emails
      const userEmails = new Set();

      splits.forEach((split) => {
        if (split.email) {
          userEmails.add(split.email);
        }
      });

      // Send email to each participant
      for (const email of userEmails) {
        const emailContent = {
          from: process.env.Email_ID,
          to: email,
          subject: `Recurring Expense: ${recurring.description}`,
          html: `
            <h2>Recurring Expense Created</h2>
            <p>A recurring expense has been automatically created:</p>
            <ul>
              <li><strong>Description:</strong> ${recurring.description}</li>
              <li><strong>Amount:</strong> ${recurring.currency} ${recurring.amount}</li>
              <li><strong>Paid by:</strong> ${recurring.payer_first_name} ${recurring.payer_last_name}</li>
              <li><strong>Frequency:</strong> ${recurring.frequency}</li>
              <li><strong>Next occurrence:</strong> ${new Date(
                recurring.next_occurrence,
              ).toLocaleDateString()}</li>
            </ul>
            <p><a href="${process.env.FRONTEND_URL}/expenses">View Expense</a></p>
          `,
        };

        await transporter.sendMail(emailContent);
      }

      console.log(`✅ Sent notifications for: ${recurring.description}`);
    } catch (error) {
      console.error("❌ Error sending notification:", error);
    }
  }
};

/**
 * Start all cron jobs
 */
export const startCronJobs = () => {
  console.log("🚀 Starting cron jobs...");

  // Start all cron jobs
  processRecurringExpenses.start();
  processPaymentReminders.start();
  cleanupExpiredReports.start();

  console.log("✅ Cron jobs started successfully");
  console.log("⏰ Recurring expenses: Daily at 12:00 AM UTC");
  console.log("⏰ Payment reminders: Daily at 9:00 AM UTC");
  console.log("⏰ Report cleanup: Daily at 2:00 AM UTC");
};

/**
 * Stop all cron jobs
 */
export const stopCronJobs = () => {
  console.log("⏹️ Stopping cron jobs...");

  processRecurringExpenses.stop();
  processPaymentReminders.stop();
  cleanupExpiredReports.stop();

  console.log("✅ Cron jobs stopped");
};
