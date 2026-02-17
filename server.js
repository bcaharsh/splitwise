import "dotenv/config";
import con from "./config/database.js";
import express from "express";
import { app } from "./utils/expressapphandle.js";
import { startCronJobs } from "./jobs/cronJobs.js";
// Controllers
import userController from "./Controller/userController.js";
import loginController from "./Controller/loginContoller.js";
import prefrenceController from "./Controller/prefrenceController.js";
import friendController from "./Controller/friendController.js";
import groupController from "./Controller/groupController.js";
import expenseController from "./Controller/expenseController.js";
import expenseCommentController from "./Controller/expenseCommentController.js";
import balanceController from "./Controller/balanceController.js";
import settlementController from "./Controller/settlementController.js";
import recurringExpenseController from "./Controller/recurringExpenseController.js";
import notificationController from "./Controller/notificationController.js";
import reminderController from "./Controller/reminderController.js";
import reportController from "./Controller/reportController.js";
import analyticsController from "./Controller/analyticsController.js";

app.set("trust proxy", true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (reports)
app.use("/reports", express.static("reports"));

// Routes
app.use("/user", userController);
app.use("/", loginController);
app.use("/preference", prefrenceController);
app.use("/friend", friendController);
app.use("/group", groupController);
app.use("/expense", expenseController);
app.use("/expense/comment", expenseCommentController);
app.use("/balance", balanceController);
app.use("/settlement", settlementController);
app.use("/recurring", recurringExpenseController);
app.use("/notification", notificationController);
app.use("/reminder", reminderController);
app.use("/report", reportController);
app.use("/analytics", analyticsController);

// Start cron jobs
startCronJobs();

app.listen(8000, () => {
  console.log("Server listening at port 8000");
});
