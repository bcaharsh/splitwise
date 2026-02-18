import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import { upload } from "../Middleware/upload.middleware.js";
import con from "../config/database.js"; // ✅ ADD THIS
import {
  createGroup,
  addGroupMember,
  getGroupCustomData,
  getUserGroups,
  getGroupMembers,
  checkGroupMembership,
  updateGroup,
  updateGroupMember,
  createGroupInvitation,
  getInvitationByToken,
  updateGroupInvitation,
  initializeUserBalances,
  getGroupStatistics,
  getSimplifiedDebts,
  getGroupActivities,
  removeMemberFromGroup,
  archiveGroup,
  deleteGroup,
} from "../services/group.service.js";
import { getUserCustom_Data } from "../services/user.service.js";
import { createActivityLog } from "../services/activitylog.service.js";
import { transporter } from "../utils/mailhandler.js";

/**
 * Create new group
 */
const createNewGroup = async (req, res) => {
  const {
    group_name,
    description,
    group_type,
    default_currency,
    created_by,
    is_simplify_debts,
  } = req.body;

  if (!group_name || !created_by) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_name and created_by are required",
    });
  }

  const groupData = {
    group_name,
    description,
    group_type,
    group_image_url: req.file ? req.file.path : null,
    default_currency,
    created_by,
    is_simplify_debts,
  };

  // Step 1-4: Create group
  const newGroup = await createGroup(groupData);

  // Step 5: Add creator as admin
  const memberData = {
    group_id: newGroup.group_id,
    user_id: created_by,
    role: "admin",
    invited_by: created_by,
    can_add_expenses: 1,
    can_edit_expenses: 1,
    can_delete_expenses: 1,
    can_add_members: 1,
  };

  await addGroupMember(memberData);

  // Step 6: Log activity
  const activity_data = {
    user_id: created_by,
    group_id: newGroup.group_id,
    activity_type: "group_management",
    entity_type: "group",
    entity_id: newGroup.group_id,
    action: "create",
    new_values: JSON.stringify(groupData),
    description: `Group "${group_name}" created`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  // Step 7: Return group details
  const groupDetails = await getGroupCustomData(
    ["group_id"],
    [newGroup.group_id],
  );

  return res.status(201).json({
    status: 201,
    success: true,
    message: "Group created successfully",
    data:
      groupDetails.length > 0
        ? groupDetails[0]
        : { group_id: newGroup.group_id },
  });
};

/**
 * Invite user to group
 */
const inviteToGroup = async (req, res) => {
  const { group_id, invited_email, invited_by, message } = req.body;

  if (!group_id || !invited_by) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and invited_by are required",
    });
  }

  if (!invited_email) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "invited_email is required",
    });
  }

  // Check if inviter is a member with permission
  const membership = await checkGroupMembership(group_id, invited_by);

  if (membership.length === 0) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not a member of this group",
    });
  }

  if (membership[0].role !== "admin" && membership[0].can_add_members !== 1) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You don't have permission to invite members",
    });
  }

  // Check if user exists
  const invitedUser = await getUserCustom_Data(["email"], [invited_email]);

  const invited_user_id =
    invitedUser.length > 0 ? invitedUser[0].user_id : null;

  // Check if already a member
  if (invited_user_id) {
    const alreadyMember = await checkGroupMembership(group_id, invited_user_id);
    if (alreadyMember.length > 0) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "User is already a member of this group",
      });
    }
  }

  // Create invitation
  const invitationData = {
    group_id,
    invited_email,
    invited_user_id,
    invited_by,
    message,
  };

  const invitation = await createGroupInvitation(invitationData);

  // ✅ FIX: Get group details with proper error handling
  const groupDetails = await getGroupCustomData(["group_id"], [group_id]);

  if (!groupDetails || groupDetails.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Group not found",
    });
  }

  const inviterDetails = await getUserCustom_Data(["user_id"], [invited_by]);

  if (!inviterDetails || inviterDetails.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Inviter not found",
    });
  }

  // Send invitation email
  const invitationEmail = {
    from: process.env.Email_ID,
    to: invited_email,
    subject: `You're invited to join "${groupDetails[0].group_name}" on Splitwise`,
    html: `
      <h2>Group Invitation</h2>
      <p>Hi there!</p>
      <p>${inviterDetails[0].first_name} ${inviterDetails[0].last_name} has invited you to join the group "${groupDetails[0].group_name}".</p>
      ${message ? `<p>Message: ${message}</p>` : ""}
      <p><a href="${process.env.FRONTEND_URL}/group/accept-invitation/${invitation.invitation_token}">Click here to accept the invitation</a></p>
      <p>This invitation will expire in 7 days.</p>
    `,
  };

  await transporter.sendMail(invitationEmail);

  // Log activity
  const activity_data = {
    user_id: invited_by,
    group_id,
    activity_type: "group_management",
    entity_type: "invitation",
    entity_id: invitation.invitation_id,
    action: "create",
    new_values: JSON.stringify(invitationData),
    description: `Invitation sent to ${invited_email}`,
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(201).json({
    status: 201,
    success: true,
    message: "Invitation sent successfully",
    data: invitation,
  });
};

/**
 * Accept group invitation
 */
const acceptInvitation = async (req, res) => {
  const { invitation_token, user_id } = req.body;

  if (!invitation_token || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "invitation_token and user_id are required",
    });
  }

  // Step 2: Validate invitation token
  const invitation = await getInvitationByToken(invitation_token);

  if (invitation.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Invitation not found",
    });
  }

  const invitationData = invitation[0];

  // Step 3: Check status and expiry
  if (invitationData.status !== "pending") {
    return res.status(400).json({
      status: 400,
      success: false,
      message: `Invitation is already ${invitationData.status}`,
    });
  }

  const now = new Date();
  const expiresAt = new Date(invitationData.expires_at);

  if (now > expiresAt) {
    await updateGroupInvitation(
      ["status"],
      ["expired"],
      "invitation_id",
      invitationData.invitation_id,
    );

    return res.status(400).json({
      status: 400,
      success: false,
      message: "Invitation has expired",
    });
  }

  // Check if already a member
  const alreadyMember = await checkGroupMembership(
    invitationData.group_id,
    user_id,
  );

  if (alreadyMember.length > 0) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "You are already a member of this group",
    });
  }

  // Step 4: Add user as member
  const memberData = {
    group_id: invitationData.group_id,
    user_id,
    role: "member",
    invited_by: invitationData.invited_by,
    can_add_expenses: 1,
    can_edit_expenses: 0,
    can_delete_expenses: 0,
    can_add_members: 0,
  };

  await addGroupMember(memberData);

  // Step 5: Update invitation status
  await updateGroupInvitation(
    ["status", "responded_at"],
    ["accepted", now],
    "invitation_id",
    invitationData.invitation_id,
  );

  // Step 7: Initialize user balances
  await initializeUserBalances(invitationData.group_id, user_id);

  // Step 8: Log activity
  const userData = await getUserCustom_Data(["user_id"], [user_id]);

  const activity_data = {
    user_id,
    group_id: invitationData.group_id,
    activity_type: "group_management",
    entity_type: "group_member",
    entity_id: invitationData.group_id,
    action: "join",
    new_values: JSON.stringify(memberData),
    description:
      userData.length > 0
        ? `${userData[0].first_name} joined the group`
        : "User joined the group",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  // Step 9: Return group details
  const groupDetails = await getGroupCustomData(
    ["group_id"],
    [invitationData.group_id],
  );

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Invitation accepted successfully",
    data: groupDetails.length > 0 ? groupDetails[0] : null,
  });
};

/**
 * Decline group invitation
 */
const declineInvitation = async (req, res) => {
  const { invitation_token } = req.body;

  if (!invitation_token) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "invitation_token is required",
    });
  }

  const invitation = await getInvitationByToken(invitation_token);

  if (invitation.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Invitation not found",
    });
  }

  await updateGroupInvitation(
    ["status", "responded_at"],
    ["declined", new Date()],
    "invitation_id",
    invitation[0].invitation_id,
  );

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Invitation declined",
  });
};

/**
 * Get user's groups
 */
const getMyGroups = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const groups = await getUserGroups(user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: groups,
    count: groups.length,
  });
};

/**
 * Get group dashboard (comprehensive data)
 */
const getGroupDashboard = async (req, res) => {
  const { group_id, user_id } = req.query;

  if (!group_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id and user_id are required",
    });
  }

  // Step 2: Verify membership
  const membership = await checkGroupMembership(group_id, user_id);

  if (membership.length === 0) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You are not a member of this group",
    });
  }

  // Step 3: Fetch group details
  const groupDetails = await getGroupCustomData(["group_id"], [group_id]);

  if (groupDetails.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Group not found",
    });
  }

  // Step 4: Fetch all members
  const members = await getGroupMembers(group_id);

  // Step 5: Calculate group statistics
  const statistics = await getGroupStatistics(group_id);

  // Step 6: Fetch simplified debts
  const debts = await getSimplifiedDebts(group_id);

  // Step 7: Fetch recent activities
  const activities = await getGroupActivities(group_id, 20);

  // Step 8: Return comprehensive dashboard data
  return res.status(200).json({
    status: 200,
    success: true,
    data: {
      group: groupDetails[0],
      members,
      statistics,
      debts,
      recentActivities: activities,
      userRole: membership[0].role,
      userPermissions: {
        can_add_expenses: membership[0].can_add_expenses,
        can_edit_expenses: membership[0].can_edit_expenses,
        can_delete_expenses: membership[0].can_delete_expenses,
        can_add_members: membership[0].can_add_members,
      },
    },
  });
};

/**
 * Get group members
 */
const getMembers = async (req, res) => {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "group_id is required",
    });
  }

  const members = await getGroupMembers(group_id);

  return res.status(200).json({
    status: 200,
    success: true,
    data: members,
    count: members.length,
  });
};

/**
 * Update group details
 */
const updateGroupDetails = async (req, res) => {
  const {
    group_id,
    user_id,
    group_name,
    description,
    group_type,
    default_currency,
    is_simplify_debts,
  } = req.body;

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
      message: "Only admins can update group details",
    });
  }

  const payload = {
    group_name,
    description,
    group_type,
    default_currency,
    is_simplify_debts,
    group_image_url: req.file ? req.file.path : undefined,
  };

  const updateFields = [];
  const updateValues = [];

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      updateFields.push(key);
      updateValues.push(value);
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "No fields to update",
    });
  }

  const oldGroupData = await getGroupCustomData(["group_id"], [group_id]);

  await updateGroup(updateFields, updateValues, "group_id", group_id);

  const newGroupData = await getGroupCustomData(["group_id"], [group_id]);

  // Log activity
  const activity_data = {
    user_id,
    group_id,
    activity_type: "group_management",
    entity_type: "group",
    entity_id: group_id,
    action: "update",
    old_values:
      oldGroupData.length > 0 ? JSON.stringify(oldGroupData[0]) : null,
    new_values:
      newGroupData.length > 0 ? JSON.stringify(newGroupData[0]) : null,
    description: "Group details updated",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Group updated successfully",
    data: newGroupData.length > 0 ? newGroupData[0] : null,
  });
};

/**
 * Update member role/permissions
 */
const updateMemberRole = async (req, res) => {
  const {
    member_id,
    user_id,
    role,
    can_add_expenses,
    can_edit_expenses,
    can_delete_expenses,
    can_add_members,
  } = req.body;

  if (!member_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "member_id and user_id are required",
    });
  }

  // Get member details to find group_id
  const [memberData] = await con.execute(
    "SELECT * FROM group_members WHERE member_id = ?",
    [member_id],
  );

  if (memberData.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Member not found",
    });
  }

  // Check if requester is admin
  const membership = await checkGroupMembership(
    memberData[0].group_id,
    user_id,
  );

  if (membership.length === 0 || membership[0].role !== "admin") {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "Only admins can update member roles",
    });
  }

  const payload = {
    role,
    can_add_expenses,
    can_edit_expenses,
    can_delete_expenses,
    can_add_members,
  };

  const updateFields = [];
  const updateValues = [];

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      updateFields.push(key);
      updateValues.push(value);
    }
  });

  await updateGroupMember(updateFields, updateValues, "member_id", member_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id: memberData[0].group_id,
    activity_type: "group_management",
    entity_type: "group_member",
    entity_id: member_id,
    action: "update",
    old_values: JSON.stringify(memberData[0]),
    new_values: JSON.stringify(payload),
    description: "Member role/permissions updated",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Member role updated successfully",
  });
};

/**
 * Remove member from group
 */
const removeMember = async (req, res) => {
  const { member_id, user_id } = req.body;

  if (!member_id || !user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "member_id and user_id are required",
    });
  }

  // Get member details
  const [memberData] = await con.execute(
    "SELECT * FROM group_members WHERE member_id = ?",
    [member_id],
  );

  if (memberData.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Member not found",
    });
  }

  // Check if requester is admin or removing themselves
  const membership = await checkGroupMembership(
    memberData[0].group_id,
    user_id,
  );

  const isSelf = memberData[0].user_id === user_id;
  const isAdmin = membership.length > 0 && membership[0].role === "admin";

  if (!isSelf && !isAdmin) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: "You don't have permission to remove this member",
    });
  }

  await removeMemberFromGroup(member_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id: memberData[0].group_id,
    activity_type: "group_management",
    entity_type: "group_member",
    entity_id: member_id,
    action: "remove",
    old_values: JSON.stringify(memberData[0]),
    description: isSelf ? "Member left the group" : "Member removed from group",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: isSelf
      ? "You left the group successfully"
      : "Member removed successfully",
  });
};

/**
 * Archive group
 */
const archiveGroupController = async (req, res) => {
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
      message: "Only admins can archive groups",
    });
  }

  await archiveGroup(group_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id,
    activity_type: "group_management",
    entity_type: "group",
    entity_id: group_id,
    action: "archive",
    description: "Group archived",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Group archived successfully",
  });
};

/**
 * Delete group
 */
const deleteGroupController = async (req, res) => {
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
      message: "Only admins can delete groups",
    });
  }

  await deleteGroup(group_id);

  // Log activity
  const activity_data = {
    user_id,
    group_id,
    activity_type: "group_management",
    entity_type: "group",
    entity_id: group_id,
    action: "delete",
    description: "Group deleted",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Group deleted successfully",
  });
};

// Routes
router.post(
  "/create",
  upload.single("group_image"),
  Errorhandler(createNewGroup),
);
router.post("/invite", Errorhandler(inviteToGroup));
router.post("/accept-invitation", Errorhandler(acceptInvitation));
router.post("/decline-invitation", Errorhandler(declineInvitation));
router.get("/my-groups", Errorhandler(getMyGroups));
router.get("/dashboard", Errorhandler(getGroupDashboard));
router.get("/members", Errorhandler(getMembers));
router.put(
  "/update",
  upload.single("group_image"),
  Errorhandler(updateGroupDetails),
);
router.put("/member/role", Errorhandler(updateMemberRole));
router.delete("/member/remove", Errorhandler(removeMember));
router.put("/archive", Errorhandler(archiveGroupController));
router.delete("/delete", Errorhandler(deleteGroupController));

export default router;
