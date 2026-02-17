import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import {
  addExpenseComment,
  getExpenseComments,
  updateComment,
  deleteComment,
  getCommentById,
} from "../services/expenseComment.service.js";
import { getExpenseById } from "../services/expense.service.js";
import { checkGroupMembership } from "../services/group.service.js";
import { createActivityLog } from "../services/activitylog.service.js";

/**
 * Add comment to expense
 */
const addComment = async (req, res) => {
  const { expense_id, user_id, comment_text, parent_comment_id } = req.body;

  if (!expense_id || !user_id || !comment_text) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "expense_id, user_id, and comment_text are required",
    });
  }

  // Step 2: Verify user is group member
  const expense = await getExpenseById(expense_id);

  if (!expense) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Expense not found",
    });
  }

  if (expense.group_id) {
    const membership = await checkGroupMembership(expense.group_id, user_id);

    if (membership.length === 0) {
      return res.status(403).json({
        status: 403,
        success: false,
        message: "You are not a member of this group",
      });
    }
  }

  // Step 3-4: Add comment
  const commentData = {
    expense_id,
    user_id,
    comment_text,
    parent_comment_id,
  };

  const newComment = await addExpenseComment(commentData);

  // Step 5: Create notifications (implement in notifications phase)
  // TODO: Notify expense creator and other commenters

  // Step 6: Log activity
  const activity_data = {
    user_id,
    group_id: expense.group_id || null,
    activity_type: "expense_management",
    entity_type: "expense_comment",
    entity_id: newComment.comment_id,
    action: "create",
    new_values: JSON.stringify(commentData),
    description: `Comment added to expense "${expense.description}"`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  // Step 7: Return comment with user details
  const comments = await getExpenseComments(expense_id);
  const addedComment = comments.find(
    (c) => c.comment_id === newComment.comment_id,
  );

  return res.status(201).json({
    status: 201,
    success: true,
    message: "Comment added successfully",
    data: addedComment,
  });
};

/**
 * Get expense comments
 */
const getComments = async (req, res) => {
  const { expense_id } = req.params;

  if (!expense_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "expense_id is required",
    });
  }

  const comments = await getExpenseComments(expense_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: comments,
    count: comments.length,
  });
};

/**
 * Update comment
 */
const editComment = async (req, res) => {
  const { comment_id, user_id, comment_text } = req.body;

  if (!comment_id || !user_id || !comment_text) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "comment_id, user_id, and comment_text are required",
    });
  }

  const [comment] = await getCommentById(comment_id);

  if (!comment) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Comment not found",
    });
  }

  if (comment.user_id !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You can only edit your own comments",
    });
  }

  await updateComment(comment_id, comment_text);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Comment updated successfully",
  });
};

/**
 * Delete comment
 */
const removeComment = async (req, res) => {
  const { comment_id, user_id } = req.body;

  if (!comment_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "comment_id and user_id are required",
    });
  }

  const [comment] = await getCommentById(comment_id);

  if (!comment) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Comment not found",
    });
  }

  if (comment.user_id !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You can only delete your own comments",
    });
  }

  await deleteComment(comment_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Comment deleted successfully",
  });
};

// Routes
router.post("/", Errorhandler(addComment));
router.get("/:expense_id", Errorhandler(getComments));
router.put("/", Errorhandler(editComment));
router.delete("/", Errorhandler(removeComment));

export default router;
