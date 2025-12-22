-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Dec 22, 2025 at 06:58 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `splitwise_app`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `log_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `group_id` varchar(36) DEFAULT NULL,
  `activity_type` varchar(50) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` varchar(36) NOT NULL,
  `action` varchar(20) NOT NULL,
  `old_values` text DEFAULT NULL,
  `new_values` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `budgets`
--

CREATE TABLE `budgets` (
  `budget_id` varchar(36) NOT NULL,
  `group_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `budget_name` varchar(200) NOT NULL,
  `budget_amount` decimal(15,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `period_type` enum('weekly','monthly','quarterly','yearly','custom') DEFAULT 'monthly',
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `alert_threshold_percent` int(11) DEFAULT 80,
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `currencies`
--

CREATE TABLE `currencies` (
  `currency_id` varchar(36) NOT NULL,
  `currency_code` varchar(3) NOT NULL,
  `currency_name` varchar(100) NOT NULL,
  `currency_symbol` varchar(10) NOT NULL,
  `decimal_places` int(11) DEFAULT 2,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `data_exports`
--

CREATE TABLE `data_exports` (
  `export_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `export_type` enum('all_data','expenses','groups','settlements') NOT NULL,
  `date_from` date DEFAULT NULL,
  `date_to` date DEFAULT NULL,
  `file_format` enum('json','csv','pdf') DEFAULT 'csv',
  `file_url` varchar(500) DEFAULT NULL,
  `status` enum('pending','processing','completed','failed','expired') DEFAULT 'pending',
  `expires_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `exchange_rates`
--

CREATE TABLE `exchange_rates` (
  `rate_id` varchar(36) NOT NULL,
  `from_currency` varchar(3) NOT NULL,
  `to_currency` varchar(3) NOT NULL,
  `exchange_rate` decimal(18,8) NOT NULL,
  `rate_date` date NOT NULL,
  `source` varchar(50) DEFAULT 'manual',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `expense_id` varchar(36) NOT NULL,
  `group_id` varchar(36) DEFAULT NULL,
  `description` varchar(500) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `base_currency_amount` decimal(15,2) DEFAULT NULL,
  `exchange_rate` decimal(18,8) DEFAULT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `expense_date` date NOT NULL,
  `expense_type` enum('expense','payment','income') DEFAULT 'expense',
  `split_type` enum('equal','exact','percentage','shares','adjustment') DEFAULT 'equal',
  `paid_by` varchar(36) NOT NULL,
  `is_recurring` tinyint(1) DEFAULT 0,
  `recurring_id` varchar(36) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT 0,
  `is_settled` tinyint(1) DEFAULT 0,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_attachments`
--

CREATE TABLE `expense_attachments` (
  `attachment_id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `original_file_name` varchar(255) NOT NULL,
  `file_type` varchar(100) NOT NULL,
  `file_size` int(11) NOT NULL,
  `file_url` varchar(500) NOT NULL,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `is_receipt` tinyint(1) DEFAULT 1,
  `uploaded_by` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_categories`
--

CREATE TABLE `expense_categories` (
  `category_id` varchar(36) NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `parent_category_id` varchar(36) DEFAULT NULL,
  `icon` varchar(100) DEFAULT NULL,
  `color` varchar(7) DEFAULT NULL,
  `is_system` tinyint(1) DEFAULT 0,
  `created_by` varchar(36) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `display_order` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_comments`
--

CREATE TABLE `expense_comments` (
  `comment_id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `comment_text` text NOT NULL,
  `parent_comment_id` varchar(36) DEFAULT NULL,
  `is_edited` tinyint(1) DEFAULT 0,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_groups`
--

CREATE TABLE `expense_groups` (
  `group_id` varchar(36) NOT NULL,
  `group_name` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `group_type` enum('home','trip','couple','office','sports','other') DEFAULT 'other',
  `group_image_url` varchar(500) DEFAULT NULL,
  `default_currency` varchar(3) DEFAULT 'USD',
  `created_by` varchar(36) NOT NULL,
  `is_simplify_debts` tinyint(1) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `is_archived` tinyint(1) DEFAULT 0,
  `archived_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_payers`
--

CREATE TABLE `expense_payers` (
  `payer_id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `paid_amount` decimal(15,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_reports`
--

CREATE TABLE `expense_reports` (
  `report_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `group_id` varchar(36) DEFAULT NULL,
  `report_name` varchar(200) NOT NULL,
  `report_type` enum('summary','detailed','category_wise','member_wise','trend') NOT NULL,
  `date_from` date NOT NULL,
  `date_to` date NOT NULL,
  `filters_applied` text DEFAULT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `file_format` enum('pdf','csv','excel') DEFAULT NULL,
  `status` enum('generating','completed','failed') DEFAULT 'generating',
  `generated_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_splits`
--

CREATE TABLE `expense_splits` (
  `split_id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `owed_amount` decimal(15,2) NOT NULL,
  `paid_amount` decimal(15,2) DEFAULT 0.00,
  `share_value` decimal(15,4) DEFAULT NULL,
  `percentage` decimal(5,2) DEFAULT NULL,
  `is_settled` tinyint(1) DEFAULT 0,
  `settled_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_tags`
--

CREATE TABLE `expense_tags` (
  `expense_tag_id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `tag_id` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expense_templates`
--

CREATE TABLE `expense_templates` (
  `template_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `group_id` varchar(36) DEFAULT NULL,
  `template_name` varchar(200) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `default_amount` decimal(15,2) DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `category_id` varchar(36) DEFAULT NULL,
  `split_type` enum('equal','exact','percentage','shares') DEFAULT 'equal',
  `is_active` tinyint(1) DEFAULT 1,
  `usage_count` int(11) DEFAULT 0,
  `last_used_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `friendships`
--

CREATE TABLE `friendships` (
  `friendship_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `friend_id` varchar(36) NOT NULL,
  `status` enum('pending','accepted','blocked','declined') DEFAULT 'pending',
  `requested_by` varchar(36) NOT NULL,
  `nickname` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `group_invitations`
--

CREATE TABLE `group_invitations` (
  `invitation_id` varchar(36) NOT NULL,
  `group_id` varchar(36) NOT NULL,
  `invited_email` varchar(255) DEFAULT NULL,
  `invited_phone` varchar(20) DEFAULT NULL,
  `invited_user_id` varchar(36) DEFAULT NULL,
  `invitation_token` varchar(100) NOT NULL,
  `invited_by` varchar(36) NOT NULL,
  `status` enum('pending','accepted','declined','expired','cancelled') DEFAULT 'pending',
  `message` text DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `responded_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `group_members`
--

CREATE TABLE `group_members` (
  `member_id` varchar(36) NOT NULL,
  `group_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `role` enum('admin','moderator','member') DEFAULT 'member',
  `nickname_in_group` varchar(100) DEFAULT NULL,
  `joined_at` datetime DEFAULT current_timestamp(),
  `left_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `invited_by` varchar(36) DEFAULT NULL,
  `can_add_expenses` tinyint(1) DEFAULT 1,
  `can_edit_expenses` tinyint(1) DEFAULT 0,
  `can_delete_expenses` tinyint(1) DEFAULT 0,
  `can_add_members` tinyint(1) DEFAULT 0,
  `notification_enabled` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `notification_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `notification_type` varchar(50) NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `data_payload` text DEFAULT NULL,
  `related_entity_type` varchar(50) DEFAULT NULL,
  `related_entity_id` varchar(36) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `is_pushed` tinyint(1) DEFAULT 0,
  `is_emailed` tinyint(1) DEFAULT 0,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_methods`
--

CREATE TABLE `payment_methods` (
  `method_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `method_type` enum('cash','bank_transfer','upi','paypal','venmo','card','crypto','other') NOT NULL,
  `method_name` varchar(100) NOT NULL,
  `account_details` text DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `recurring_expenses`
--

CREATE TABLE `recurring_expenses` (
  `recurring_id` varchar(36) NOT NULL,
  `group_id` varchar(36) DEFAULT NULL,
  `description` varchar(500) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `category_id` varchar(36) DEFAULT NULL,
  `paid_by` varchar(36) NOT NULL,
  `split_type` enum('equal','exact','percentage','shares') DEFAULT 'equal',
  `frequency` enum('daily','weekly','biweekly','monthly','quarterly','yearly') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `next_occurrence` date NOT NULL,
  `day_of_month` int(11) DEFAULT NULL,
  `day_of_week` int(11) DEFAULT NULL,
  `occurrence_count` int(11) DEFAULT 0,
  `max_occurrences` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `recurring_expense_splits`
--

CREATE TABLE `recurring_expense_splits` (
  `rec_split_id` varchar(36) NOT NULL,
  `recurring_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `share_value` decimal(15,4) DEFAULT NULL,
  `percentage` decimal(5,2) DEFAULT NULL,
  `fixed_amount` decimal(15,2) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reminders`
--

CREATE TABLE `reminders` (
  `reminder_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `related_user_id` varchar(36) DEFAULT NULL,
  `group_id` varchar(36) DEFAULT NULL,
  `expense_id` varchar(36) DEFAULT NULL,
  `reminder_type` enum('payment_due','settle_up','expense_share','custom') NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text DEFAULT NULL,
  `remind_at` datetime NOT NULL,
  `is_recurring` tinyint(1) DEFAULT 0,
  `recurrence_pattern` varchar(50) DEFAULT NULL,
  `status` enum('pending','sent','dismissed','snoozed') DEFAULT 'pending',
  `snoozed_until` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `settlements`
--

CREATE TABLE `settlements` (
  `settlement_id` varchar(36) NOT NULL,
  `group_id` varchar(36) DEFAULT NULL,
  `payer_id` varchar(36) NOT NULL,
  `payee_id` varchar(36) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `settlement_date` date NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_reference` varchar(200) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('pending','completed','cancelled','disputed') DEFAULT 'completed',
  `confirmed_by_payee` tinyint(1) DEFAULT 0,
  `confirmed_at` datetime DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `simplified_debts`
--

CREATE TABLE `simplified_debts` (
  `debt_id` varchar(36) NOT NULL,
  `group_id` varchar(36) NOT NULL,
  `from_user_id` varchar(36) NOT NULL,
  `to_user_id` varchar(36) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `calculated_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tags`
--

CREATE TABLE `tags` (
  `tag_id` varchar(36) NOT NULL,
  `tag_name` varchar(50) NOT NULL,
  `tag_color` varchar(7) DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `template_splits`
--

CREATE TABLE `template_splits` (
  `template_split_id` varchar(36) NOT NULL,
  `template_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `share_value` decimal(15,4) DEFAULT NULL,
  `percentage` decimal(5,2) DEFAULT NULL,
  `fixed_amount` decimal(15,2) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `profile_image_url` varchar(500) DEFAULT NULL,
  `default_currency` varchar(3) DEFAULT 'USD',
  `timezone` varchar(50) DEFAULT 'UTC',
  `language` varchar(10) DEFAULT 'en',
  `is_email_verified` tinyint(1) DEFAULT 0,
  `is_phone_verified` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_auth_tokens`
--

CREATE TABLE `user_auth_tokens` (
  `token_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `token_type` enum('access','refresh','reset_password','email_verify','phone_verify') NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `device_info` varchar(500) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `is_revoked` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_balances`
--

CREATE TABLE `user_balances` (
  `balance_id` varchar(36) NOT NULL,
  `group_id` varchar(36) DEFAULT NULL,
  `from_user_id` varchar(36) NOT NULL,
  `to_user_id` varchar(36) NOT NULL,
  `balance_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(3) DEFAULT 'USD',
  `last_calculated_at` datetime DEFAULT current_timestamp(),
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_devices`
--

CREATE TABLE `user_devices` (
  `device_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `device_token` varchar(500) NOT NULL,
  `device_type` enum('ios','android','web') NOT NULL,
  `device_name` varchar(100) DEFAULT NULL,
  `device_model` varchar(100) DEFAULT NULL,
  `os_version` varchar(50) DEFAULT NULL,
  `app_version` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `last_active_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_preferences`
--

CREATE TABLE `user_preferences` (
  `preference_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `notification_email` tinyint(1) DEFAULT 1,
  `notification_push` tinyint(1) DEFAULT 1,
  `notification_sms` tinyint(1) DEFAULT 0,
  `weekly_summary_email` tinyint(1) DEFAULT 1,
  `payment_reminder_days` int(11) DEFAULT 7,
  `auto_simplify_debts` tinyint(1) DEFAULT 1,
  `show_running_balance` tinyint(1) DEFAULT 1,
  `default_split_type` enum('equal','exact','percentage','shares') DEFAULT 'equal',
  `date_format` varchar(20) DEFAULT 'YYYY-MM-DD',
  `theme` varchar(20) DEFAULT 'light',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_activity_user` (`user_id`),
  ADD KEY `idx_activity_group` (`group_id`),
  ADD KEY `idx_activity_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_activity_type` (`activity_type`),
  ADD KEY `idx_activity_created` (`created_at`);

--
-- Indexes for table `budgets`
--
ALTER TABLE `budgets`
  ADD PRIMARY KEY (`budget_id`),
  ADD KEY `idx_budget_group` (`group_id`),
  ADD KEY `idx_budget_user` (`user_id`),
  ADD KEY `idx_budget_category` (`category_id`),
  ADD KEY `idx_budget_dates` (`start_date`,`end_date`);

--
-- Indexes for table `currencies`
--
ALTER TABLE `currencies`
  ADD PRIMARY KEY (`currency_id`),
  ADD UNIQUE KEY `uk_currency_code` (`currency_code`);

--
-- Indexes for table `data_exports`
--
ALTER TABLE `data_exports`
  ADD PRIMARY KEY (`export_id`),
  ADD KEY `idx_export_user` (`user_id`),
  ADD KEY `idx_export_status` (`status`);

--
-- Indexes for table `exchange_rates`
--
ALTER TABLE `exchange_rates`
  ADD PRIMARY KEY (`rate_id`),
  ADD UNIQUE KEY `uk_rate_date` (`from_currency`,`to_currency`,`rate_date`),
  ADD KEY `idx_rate_date` (`rate_date`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`expense_id`),
  ADD KEY `idx_expense_group` (`group_id`),
  ADD KEY `idx_expense_paid_by` (`paid_by`),
  ADD KEY `idx_expense_date` (`expense_date`),
  ADD KEY `idx_expense_category` (`category_id`),
  ADD KEY `idx_expense_type` (`expense_type`),
  ADD KEY `idx_expense_deleted` (`is_deleted`),
  ADD KEY `idx_expense_recurring` (`recurring_id`);

--
-- Indexes for table `expense_attachments`
--
ALTER TABLE `expense_attachments`
  ADD PRIMARY KEY (`attachment_id`),
  ADD KEY `idx_attachment_expense` (`expense_id`),
  ADD KEY `idx_attachment_user` (`uploaded_by`);

--
-- Indexes for table `expense_categories`
--
ALTER TABLE `expense_categories`
  ADD PRIMARY KEY (`category_id`),
  ADD KEY `idx_category_parent` (`parent_category_id`),
  ADD KEY `idx_category_system` (`is_system`);

--
-- Indexes for table `expense_comments`
--
ALTER TABLE `expense_comments`
  ADD PRIMARY KEY (`comment_id`),
  ADD KEY `idx_comment_expense` (`expense_id`),
  ADD KEY `idx_comment_user` (`user_id`),
  ADD KEY `idx_comment_parent` (`parent_comment_id`);

--
-- Indexes for table `expense_groups`
--
ALTER TABLE `expense_groups`
  ADD PRIMARY KEY (`group_id`),
  ADD KEY `idx_group_creator` (`created_by`),
  ADD KEY `idx_group_active` (`is_active`),
  ADD KEY `idx_group_type` (`group_type`);

--
-- Indexes for table `expense_payers`
--
ALTER TABLE `expense_payers`
  ADD PRIMARY KEY (`payer_id`),
  ADD UNIQUE KEY `uk_expense_payer` (`expense_id`,`user_id`),
  ADD KEY `idx_payer_user` (`user_id`);

--
-- Indexes for table `expense_reports`
--
ALTER TABLE `expense_reports`
  ADD PRIMARY KEY (`report_id`),
  ADD KEY `idx_report_user` (`user_id`),
  ADD KEY `idx_report_group` (`group_id`),
  ADD KEY `idx_report_status` (`status`);

--
-- Indexes for table `expense_splits`
--
ALTER TABLE `expense_splits`
  ADD PRIMARY KEY (`split_id`),
  ADD UNIQUE KEY `uk_expense_user` (`expense_id`,`user_id`),
  ADD KEY `idx_split_user` (`user_id`),
  ADD KEY `idx_split_settled` (`is_settled`);

--
-- Indexes for table `expense_tags`
--
ALTER TABLE `expense_tags`
  ADD PRIMARY KEY (`expense_tag_id`),
  ADD UNIQUE KEY `uk_expense_tag` (`expense_id`,`tag_id`),
  ADD KEY `idx_tag_expense` (`tag_id`);

--
-- Indexes for table `expense_templates`
--
ALTER TABLE `expense_templates`
  ADD PRIMARY KEY (`template_id`),
  ADD KEY `idx_template_user` (`user_id`),
  ADD KEY `idx_template_group` (`group_id`);

--
-- Indexes for table `friendships`
--
ALTER TABLE `friendships`
  ADD PRIMARY KEY (`friendship_id`),
  ADD UNIQUE KEY `uk_friendship` (`user_id`,`friend_id`),
  ADD KEY `idx_friend_status` (`status`),
  ADD KEY `idx_friend_user` (`friend_id`);

--
-- Indexes for table `group_invitations`
--
ALTER TABLE `group_invitations`
  ADD PRIMARY KEY (`invitation_id`),
  ADD UNIQUE KEY `uk_invitation_token` (`invitation_token`),
  ADD KEY `idx_invitation_group` (`group_id`),
  ADD KEY `idx_invitation_email` (`invited_email`),
  ADD KEY `idx_invitation_status` (`status`);

--
-- Indexes for table `group_members`
--
ALTER TABLE `group_members`
  ADD PRIMARY KEY (`member_id`),
  ADD UNIQUE KEY `uk_group_user` (`group_id`,`user_id`),
  ADD KEY `idx_member_user` (`user_id`),
  ADD KEY `idx_member_active` (`is_active`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `idx_notification_user` (`user_id`),
  ADD KEY `idx_notification_read` (`is_read`),
  ADD KEY `idx_notification_type` (`notification_type`),
  ADD KEY `idx_notification_created` (`created_at`);

--
-- Indexes for table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`method_id`),
  ADD KEY `idx_payment_user` (`user_id`),
  ADD KEY `idx_payment_default` (`is_default`);

--
-- Indexes for table `recurring_expenses`
--
ALTER TABLE `recurring_expenses`
  ADD PRIMARY KEY (`recurring_id`),
  ADD KEY `idx_recurring_group` (`group_id`),
  ADD KEY `idx_recurring_next` (`next_occurrence`),
  ADD KEY `idx_recurring_active` (`is_active`);

--
-- Indexes for table `recurring_expense_splits`
--
ALTER TABLE `recurring_expense_splits`
  ADD PRIMARY KEY (`rec_split_id`),
  ADD UNIQUE KEY `uk_recurring_user` (`recurring_id`,`user_id`),
  ADD KEY `idx_rec_split_user` (`user_id`);

--
-- Indexes for table `reminders`
--
ALTER TABLE `reminders`
  ADD PRIMARY KEY (`reminder_id`),
  ADD KEY `idx_reminder_user` (`user_id`),
  ADD KEY `idx_reminder_time` (`remind_at`),
  ADD KEY `idx_reminder_status` (`status`);

--
-- Indexes for table `settlements`
--
ALTER TABLE `settlements`
  ADD PRIMARY KEY (`settlement_id`),
  ADD KEY `idx_settlement_group` (`group_id`),
  ADD KEY `idx_settlement_payer` (`payer_id`),
  ADD KEY `idx_settlement_payee` (`payee_id`),
  ADD KEY `idx_settlement_date` (`settlement_date`),
  ADD KEY `idx_settlement_status` (`status`);

--
-- Indexes for table `simplified_debts`
--
ALTER TABLE `simplified_debts`
  ADD PRIMARY KEY (`debt_id`),
  ADD KEY `idx_debt_group` (`group_id`),
  ADD KEY `idx_debt_from` (`from_user_id`),
  ADD KEY `idx_debt_to` (`to_user_id`);

--
-- Indexes for table `tags`
--
ALTER TABLE `tags`
  ADD PRIMARY KEY (`tag_id`),
  ADD KEY `idx_tag_creator` (`created_by`),
  ADD KEY `idx_tag_name` (`tag_name`);

--
-- Indexes for table `template_splits`
--
ALTER TABLE `template_splits`
  ADD PRIMARY KEY (`template_split_id`),
  ADD UNIQUE KEY `uk_template_user` (`template_id`,`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `uk_users_email` (`email`),
  ADD KEY `idx_users_phone` (`phone`),
  ADD KEY `idx_users_active` (`is_active`),
  ADD KEY `idx_users_created` (`created_at`);

--
-- Indexes for table `user_auth_tokens`
--
ALTER TABLE `user_auth_tokens`
  ADD PRIMARY KEY (`token_id`),
  ADD KEY `idx_auth_user` (`user_id`),
  ADD KEY `idx_auth_token` (`token_hash`),
  ADD KEY `idx_auth_expires` (`expires_at`);

--
-- Indexes for table `user_balances`
--
ALTER TABLE `user_balances`
  ADD PRIMARY KEY (`balance_id`),
  ADD UNIQUE KEY `uk_balance_users` (`group_id`,`from_user_id`,`to_user_id`),
  ADD KEY `idx_balance_from` (`from_user_id`),
  ADD KEY `idx_balance_to` (`to_user_id`);

--
-- Indexes for table `user_devices`
--
ALTER TABLE `user_devices`
  ADD PRIMARY KEY (`device_id`),
  ADD KEY `idx_device_user` (`user_id`),
  ADD KEY `idx_device_token` (`device_token`(255)),
  ADD KEY `idx_device_active` (`is_active`);

--
-- Indexes for table `user_preferences`
--
ALTER TABLE `user_preferences`
  ADD PRIMARY KEY (`preference_id`),
  ADD UNIQUE KEY `uk_pref_user` (`user_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
