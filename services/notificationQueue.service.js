import {
  createNotification,
  updateDeliveryStatus,
} from "./notification.service.js";
import { transporter } from "../utils/mailhandler.js";
import { getUserCustom_Data } from "./user.service.js";

/**
 * Process notification for a user
 * @param {string} user_id
 * @param {object} notificationData
 * @returns {Promise<void>}
 */
export const processNotification = async (user_id, notificationData) => {
  try {
    // Get user preferences
    const [user] = await getUserCustom_Data(["user_id"], [user_id]);

    if (!user || user.length === 0) {
      console.error(`User not found: ${user_id}`);
      return;
    }

    const userData = user[0];

    // Get user preferences
    const [preferences] = await con.execute(
      `SELECT * FROM user_preferences WHERE user_id = ?`,
      [user_id],
    );

    const userPrefs = preferences[0] || {
      notification_push: 1,
      notification_email: 1,
      notification_sms: 0,
    };

    // Create notification in database
    const notification = await createNotification({
      user_id,
      ...notificationData,
    });

    // Step 3B: Push notification
    if (userPrefs.notification_push === 1) {
      await sendPushNotification(
        user_id,
        notificationData,
        notification.notification_id,
      );
    }

    // Step 3C: Email notification
    if (userPrefs.notification_email === 1) {
      await sendEmailNotification(
        userData,
        notificationData,
        notification.notification_id,
      );
    }

    // Step 3D: SMS notification (if enabled)
    if (userPrefs.notification_sms === 1 && userData.phone) {
      await sendSMSNotification(userData, notificationData);
    }

    return notification;
  } catch (error) {
    console.error("Error processing notification:", error);
    throw error;
  }
};

/**
 * Send push notification
 * @param {string} user_id
 * @param {object} notificationData
 * @param {string} notification_id
 * @returns {Promise<void>}
 */
const sendPushNotification = async (
  user_id,
  notificationData,
  notification_id,
) => {
  try {
    // TODO: Implement Firebase Cloud Messaging
    // For now, just mark as pushed
    console.log(`📱 Push notification sent to user: ${user_id}`);

    // In production, you would:
    // 1. Get device tokens from user_devices table
    // 2. Send to FCM API
    // 3. Handle success/failure

    await updateDeliveryStatus(notification_id, { is_pushed: 1 });
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

/**
 * Send email notification
 * @param {object} userData
 * @param {object} notificationData
 * @param {string} notification_id
 * @returns {Promise<void>}
 */
const sendEmailNotification = async (
  userData,
  notificationData,
  notification_id,
) => {
  try {
    const emailContent = {
      from: process.env.Email_ID,
      to: userData.email,
      subject: notificationData.title,
      html: formatEmailTemplate(notificationData, userData),
    };

    await transporter.sendMail(emailContent);

    console.log(`📧 Email sent to: ${userData.email}`);

    await updateDeliveryStatus(notification_id, { is_emailed: 1 });
  } catch (error) {
    console.error("Error sending email notification:", error);
  }
};

/**
 * Send SMS notification
 * @param {object} userData
 * @param {object} notificationData
 * @returns {Promise<void>}
 */
const sendSMSNotification = async (userData, notificationData) => {
  try {
    // TODO: Implement Twilio SMS
    console.log(`📱 SMS sent to: ${userData.phone}`);

    // In production:
    // const client = require('twilio')(accountSid, authToken);
    // await client.messages.create({
    //   body: notificationData.message,
    //   from: process.env.TWILIO_PHONE,
    //   to: userData.phone
    // });
  } catch (error) {
    console.error("Error sending SMS notification:", error);
  }
};

/**
 * Format email template
 * @param {object} notificationData
 * @param {object} userData
 * @returns {string}
 */
const formatEmailTemplate = (notificationData, userData) => {
  const { title, message, notification_type, data_payload } = notificationData;

  let actionButton = "";

  if (data_payload) {
    const payload =
      typeof data_payload === "string"
        ? JSON.parse(data_payload)
        : data_payload;

    if (payload.expense_id) {
      actionButton = `<a href="${process.env.FRONTEND_URL}/expense/${payload.expense_id}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">View Expense</a>`;
    } else if (payload.group_id) {
      actionButton = `<a href="${process.env.FRONTEND_URL}/group/${payload.group_id}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">View Group</a>`;
    } else if (payload.settlement_id) {
      actionButton = `<a href="${process.env.FRONTEND_URL}/settlement/${payload.settlement_id}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">View Settlement</a>`;
    }
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .header {
          background-color: #4CAF50;
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          background-color: white;
          padding: 30px;
          margin-top: 20px;
          border-radius: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          color: #777;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Splitwise</h1>
        </div>
        <div class="content">
          <h2>Hi ${userData.first_name},</h2>
          <h3>${title}</h3>
          <p>${message}</p>
          ${actionButton}
        </div>
        <div class="footer">
          <p>This is an automated notification from Splitwise.</p>
          <p><a href="${process.env.FRONTEND_URL}/settings">Manage notification preferences</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Notify expense participants
 * @param {object} expenseData
 * @param {Array} participants
 * @param {string} action
 * @returns {Promise<void>}
 */
export const notifyExpenseParticipants = async (
  expenseData,
  participants,
  action,
) => {
  const { expense_id, description, amount, currency, payer_first_name } =
    expenseData;

  let title, message;

  switch (action) {
    case "created":
      title = "New Expense Added";
      message = `${payer_first_name} added "${description}" for ${currency} ${amount}`;
      break;
    case "updated":
      title = "Expense Updated";
      message = `${payer_first_name} updated "${description}"`;
      break;
    case "deleted":
      title = "Expense Deleted";
      message = `${payer_first_name} deleted "${description}"`;
      break;
    default:
      title = "Expense Notification";
      message = `An expense has been ${action}`;
  }

  const notifications = participants.map((user_id) => ({
    user_id,
    notification_type: "expense",
    title,
    message,
    data_payload: { expense_id },
    related_entity_type: "expense",
    related_entity_id: expense_id,
  }));

  for (const notif of notifications) {
    await processNotification(notif.user_id, notif);
  }
};

/**
 * Notify settlement confirmation
 * @param {object} settlementData
 * @param {string} payer_id
 * @param {string} payee_id
 * @returns {Promise<void>}
 */
export const notifySettlement = async (settlementData, payer_id, payee_id) => {
  const { settlement_id, amount, currency, status } = settlementData;

  // Notify payee
  await processNotification(payee_id, {
    notification_type: "settlement",
    title: "Settlement Confirmation Needed",
    message: `You received a settlement of ${currency} ${amount}. Please confirm.`,
    data_payload: { settlement_id },
    related_entity_type: "settlement",
    related_entity_id: settlement_id,
  });

  if (status === "completed") {
    // Notify payer when confirmed
    await processNotification(payer_id, {
      notification_type: "settlement",
      title: "Settlement Confirmed",
      message: `Your settlement of ${currency} ${amount} has been confirmed.`,
      data_payload: { settlement_id },
      related_entity_type: "settlement",
      related_entity_id: settlement_id,
    });
  }
};

/**
 * Notify group invitation
 * @param {string} invited_user_id
 * @param {object} groupData
 * @param {string} inviter_name
 * @returns {Promise<void>}
 */
export const notifyGroupInvitation = async (
  invited_user_id,
  groupData,
  inviter_name,
) => {
  const { group_id, group_name } = groupData;

  await processNotification(invited_user_id, {
    notification_type: "group_invitation",
    title: "Group Invitation",
    message: `${inviter_name} invited you to join "${group_name}"`,
    data_payload: { group_id },
    related_entity_type: "group",
    related_entity_id: group_id,
  });
};

/**
 * Notify friend request
 * @param {string} friend_id
 * @param {string} requester_name
 * @param {string} friendship_id
 * @returns {Promise<void>}
 */
export const notifyFriendRequest = async (
  friend_id,
  requester_name,
  friendship_id,
) => {
  await processNotification(friend_id, {
    notification_type: "friend_request",
    title: "Friend Request",
    message: `${requester_name} sent you a friend request`,
    data_payload: { friendship_id },
    related_entity_type: "friendship",
    related_entity_id: friendship_id,
  });
};
