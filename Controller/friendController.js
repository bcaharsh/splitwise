import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import {
  sendFriendRequest,
  getFriendshipCustomData,
  getUserFriends,
  getPendingRequests,
  getSentRequests,
  updateFriendship,
  deleteFriendship,
  checkFriendshipExists,
  getBlockedUsers,
  searchUsersToAdd,
} from "../services/friend.service.js";
import { getUserCustom_Data } from "../services/user.service.js";
import { createActivityLog } from "../services/activitylog.service.js";

/**
 * Send friend request
 */
const sendRequest = async (req, res) => {
  const { user_id, friend_email } = req.body;

  if (!user_id || !friend_email) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id and friend_email are required",
    });
  }

  // Get friend by email
  const friendUser = await getUserCustom_Data(
    ["email", "is_active"],
    [friend_email, 1],
  );

  if (friendUser.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "User not found",
    });
  }

  const friend_id = friendUser[0].user_id;

  if (user_id === friend_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Cannot send friend request to yourself",
    });
  }

  // Check if friendship already exists
  const existingFriendship = await checkFriendshipExists(user_id, friend_id);

  if (existingFriendship.length > 0) {
    const status = existingFriendship[0].status;
    return res.status(400).json({
      status: 400,
      success: false,
      message: `Friend request already ${status}`,
    });
  }

  const friendData = {
    user_id,
    friend_id,
    requested_by: user_id,
  };

  const newFriendship = await sendFriendRequest(friendData);

  const activity_data = {
    user_id,
    activity_type: "friend_management",
    entity_type: "friendship",
    entity_id: newFriendship.friendship_id,
    action: "create",
    new_values: JSON.stringify(friendData),
    description: `Friend request sent to ${friendUser[0].first_name}`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(201).json({
    status: 201,
    success: true,
    message: "Friend request sent successfully",
    data: newFriendship,
  });
};

/**
 * Accept friend request
 */
const acceptRequest = async (req, res) => {
  const { friendship_id, user_id } = req.body;

  if (!friendship_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "friendship_id and user_id are required",
    });
  }

  const friendship = await getFriendshipCustomData(
    ["friendship_id"],
    [friendship_id],
  );

  if (friendship.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Friend request not found",
    });
  }

  // Verify the user is the receiver of the request
  if (friendship[0].friend_id !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not authorized to accept this request",
    });
  }

  if (friendship[0].status !== "pending") {
    return res.status(400).json({
      status: 400,
      success: false,
      message: `Request is already ${friendship[0].status}`,
    });
  }

  const old_values = JSON.stringify(friendship[0]);

  await updateFriendship(
    ["status"],
    ["accepted"],
    "friendship_id",
    friendship_id,
  );

  const updated_friendship = await getFriendshipCustomData(
    ["friendship_id"],
    [friendship_id],
  );

  const activity_data = {
    user_id,
    activity_type: "friend_management",
    entity_type: "friendship",
    entity_id: friendship_id,
    action: "update",
    old_values,
    new_values: JSON.stringify(updated_friendship[0]),
    description: "Friend request accepted",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Friend request accepted",
    data: updated_friendship[0],
  });
};

/**
 * Decline friend request
 */
const declineRequest = async (req, res) => {
  const { friendship_id, user_id } = req.body;

  if (!friendship_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "friendship_id and user_id are required",
    });
  }

  const friendship = await getFriendshipCustomData(
    ["friendship_id"],
    [friendship_id],
  );

  if (friendship.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Friend request not found",
    });
  }

  if (friendship[0].friend_id !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not authorized to decline this request",
    });
  }

  const old_values = JSON.stringify(friendship[0]);

  await updateFriendship(
    ["status"],
    ["declined"],
    "friendship_id",
    friendship_id,
  );

  const activity_data = {
    user_id,
    activity_type: "friend_management",
    entity_type: "friendship",
    entity_id: friendship_id,
    action: "update",
    old_values,
    new_values: JSON.stringify({ status: "declined" }),
    description: "Friend request declined",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Friend request declined",
  });
};

/**
 * Block user
 */
const blockUser = async (req, res) => {
  const { user_id, friend_id } = req.body;

  if (!user_id || !friend_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id and friend_id are required",
    });
  }

  const existingFriendship = await checkFriendshipExists(user_id, friend_id);

  let friendship_id;

  if (existingFriendship.length > 0) {
    friendship_id = existingFriendship[0].friendship_id;
    await updateFriendship(
      ["status"],
      ["blocked"],
      "friendship_id",
      friendship_id,
    );
  } else {
    const newBlock = await sendFriendRequest({
      user_id,
      friend_id,
      requested_by: user_id,
    });
    friendship_id = newBlock.friendship_id;
    await updateFriendship(
      ["status"],
      ["blocked"],
      "friendship_id",
      friendship_id,
    );
  }

  const activity_data = {
    user_id,
    activity_type: "friend_management",
    entity_type: "friendship",
    entity_id: friendship_id,
    action: "block",
    new_values: JSON.stringify({ user_id, friend_id, status: "blocked" }),
    description: "User blocked",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "User blocked successfully",
  });
};

/**
 * Unblock user
 */
const unblockUser = async (req, res) => {
  const { friendship_id, user_id } = req.body;

  if (!friendship_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "friendship_id and user_id are required",
    });
  }

  const friendship = await getFriendshipCustomData(
    ["friendship_id"],
    [friendship_id],
  );

  if (friendship.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Blocked user not found",
    });
  }

  if (friendship[0].user_id !== user_id) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not authorized to unblock this user",
    });
  }

  await deleteFriendship(friendship_id);

  const activity_data = {
    user_id,
    activity_type: "friend_management",
    entity_type: "friendship",
    entity_id: friendship_id,
    action: "unblock",
    old_values: JSON.stringify(friendship[0]),
    description: "User unblocked",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "User unblocked successfully",
  });
};

/**
 * Remove friend
 */
const removeFriend = async (req, res) => {
  const { friendship_id, user_id } = req.body;

  if (!friendship_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "friendship_id and user_id are required",
    });
  }

  const friendship = await getFriendshipCustomData(
    ["friendship_id"],
    [friendship_id],
  );

  if (friendship.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Friendship not found",
    });
  }

  if (
    friendship[0].user_id !== user_id &&
    friendship[0].friend_id !== user_id
  ) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not authorized to remove this friendship",
    });
  }

  const old_values = JSON.stringify(friendship[0]);

  await deleteFriendship(friendship_id);

  const activity_data = {
    user_id,
    activity_type: "friend_management",
    entity_type: "friendship",
    entity_id: friendship_id,
    action: "delete",
    old_values,
    description: "Friend removed",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Friend removed successfully",
  });
};

/**
 * Get all friends
 */
const getFriends = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const friends = await getUserFriends(user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: friends,
    count: friends.length,
  });
};

/**
 * Get pending requests (received)
 */
const getPending = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const requests = await getPendingRequests(user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: requests,
    count: requests.length,
  });
};

/**
 * Get sent requests
 */
const getSent = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const requests = await getSentRequests(user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: requests,
    count: requests.length,
  });
};

/**
 * Get blocked users
 */
const getBlocked = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const blocked = await getBlockedUsers(user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: blocked,
    count: blocked.length,
  });
};

/**
 * Search users to add
 */
const searchUsers = async (req, res) => {
  const { user_id, search } = req.query;

  if (!user_id || !search) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id and search query are required",
    });
  }

  if (search.length < 2) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Search term must be at least 2 characters",
    });
  }

  const users = await searchUsersToAdd(user_id, search);

  return res.status(200).json({
    status: 200,
    success: true,
    data: users,
    count: users.length,
  });
};

/**
 * Update friend nickname
 */
const updateNickname = async (req, res) => {
  const { friendship_id, user_id, nickname } = req.body;

  if (!friendship_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "friendship_id and user_id are required",
    });
  }

  const friendship = await getFriendshipCustomData(
    ["friendship_id"],
    [friendship_id],
  );

  if (friendship.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Friendship not found",
    });
  }

  if (
    friendship[0].user_id !== user_id &&
    friendship[0].friend_id !== user_id
  ) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not authorized to update this friendship",
    });
  }

  const old_values = JSON.stringify(friendship[0]);

  await updateFriendship(
    ["nickname"],
    [nickname],
    "friendship_id",
    friendship_id,
  );

  const updated = await getFriendshipCustomData(
    ["friendship_id"],
    [friendship_id],
  );

  const activity_data = {
    user_id,
    activity_type: "friend_management",
    entity_type: "friendship",
    entity_id: friendship_id,
    action: "update",
    old_values,
    new_values: JSON.stringify(updated[0]),
    description: "Friend nickname updated",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Nickname updated successfully",
    data: updated[0],
  });
};

// Routes
router.post("/request", Errorhandler(sendRequest));
router.post("/accept", Errorhandler(acceptRequest));
router.post("/decline", Errorhandler(declineRequest));
router.post("/block", Errorhandler(blockUser));
router.post("/unblock", Errorhandler(unblockUser));
router.delete("/remove", Errorhandler(removeFriend));
router.get("/list", Errorhandler(getFriends));
router.get("/pending", Errorhandler(getPending));
router.get("/sent", Errorhandler(getSent));
router.get("/blocked", Errorhandler(getBlocked));
router.get("/search", Errorhandler(searchUsers));
router.put("/nickname", Errorhandler(updateNickname));

export default router;
