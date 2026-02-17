import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new group
 * @param {object} groupData
 * @returns {Promise<object>}
 */
export const createGroup = async (groupData) => {
  const {
    group_name,
    description,
    group_type,
    group_image_url,
    default_currency,
    created_by,
    is_simplify_debts,
  } = groupData;

  if (!group_name || !created_by) {
    throw new Error("group_name and created_by are required");
  }

  const group_id = uuidv4();

  const insert_query = `
    INSERT INTO expense_groups (
      group_id,
      group_name,
      description,
      group_type,
      group_image_url,
      default_currency,
      created_by,
      is_simplify_debts,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    group_id,
    group_name,
    description || null,
    group_type || "other",
    group_image_url || null,
    default_currency || "USD",
    created_by,
    is_simplify_debts !== undefined ? is_simplify_debts : 1,
    1,
  ];

  const [group] = await con.execute(insert_query, params);

  return { group_id, ...group };
};

/**
 * Add member to group
 * @param {object} memberData
 * @returns {Promise<object>}
 */
export const addGroupMember = async (memberData) => {
  const {
    group_id,
    user_id,
    role,
    nickname_in_group,
    invited_by,
    can_add_expenses,
    can_edit_expenses,
    can_delete_expenses,
    can_add_members,
  } = memberData;

  if (!group_id || !user_id) {
    throw new Error("group_id and user_id are required");
  }

  const member_id = uuidv4();

  const insert_query = `
    INSERT INTO group_members (
      member_id,
      group_id,
      user_id,
      role,
      nickname_in_group,
      invited_by,
      can_add_expenses,
      can_edit_expenses,
      can_delete_expenses,
      can_add_members,
      is_active,
      notification_enabled
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    member_id,
    group_id,
    user_id,
    role || "member",
    nickname_in_group || null,
    invited_by || null,
    can_add_expenses !== undefined ? can_add_expenses : 1,
    can_edit_expenses !== undefined ? can_edit_expenses : 0,
    can_delete_expenses !== undefined ? can_delete_expenses : 0,
    can_add_members !== undefined ? can_add_members : 0,
    1,
    1,
  ];

  const [member] = await con.execute(insert_query, params);

  return { member_id, ...member };
};

/**
 * Get groups with custom filters
 * @param {Array} fieldName
 * @param {Array} Values
 * @returns {Promise<Array>}
 */
export const getGroupCustomData = async (fieldName = [], Values = []) => {
  const get_query = `
    SELECT 
      g.*,
      u.first_name as creator_first_name,
      u.last_name as creator_last_name,
      u.email as creator_email
    FROM expense_groups g
    LEFT JOIN users u ON g.created_by = u.user_id
    WHERE ${
      fieldName.length !== 0 && fieldName.length === Values.length
        ? fieldName.map((f) => `g.${f} = ?`).join(" AND ")
        : "1 = 1"
    }
  `;

  const [groups] = await con.execute(get_query, Values);

  return groups;
};

/**
 * Get user's groups
 * @param {string} user_id
 * @returns {Promise<Array>}
 */
export const getUserGroups = async (user_id) => {
  const get_query = `
    SELECT 
      g.group_id,
      g.group_name,
      g.description,
      g.group_type,
      g.group_image_url,
      g.default_currency,
      g.created_by,
      g.is_simplify_debts,
      g.is_active,
      g.is_archived,
      g.created_at,
      gm.role,
      gm.member_id,
      gm.nickname_in_group,
      COUNT(DISTINCT gm2.member_id) as member_count,
      COALESCE(SUM(CASE WHEN e.is_deleted = 0 THEN 1 ELSE 0 END), 0) as expense_count,
      COALESCE(SUM(CASE WHEN e.is_deleted = 0 THEN e.amount ELSE 0 END), 0) as total_spent
    FROM group_members gm
    INNER JOIN expense_groups g ON gm.group_id = g.group_id
    LEFT JOIN group_members gm2 ON g.group_id = gm2.group_id AND gm2.is_active = 1
    LEFT JOIN expenses e ON g.group_id = e.group_id
    WHERE gm.user_id = ? 
    AND gm.is_active = 1
    AND g.is_active = 1
    GROUP BY g.group_id, gm.member_id
    ORDER BY g.created_at DESC
  `;

  const [groups] = await con.execute(get_query, [user_id]);

  return groups;
};

/**
 * Get group members
 * @param {string} group_id
 * @returns {Promise<Array>}
 */
export const getGroupMembers = async (group_id) => {
  const get_query = `
    SELECT 
      gm.member_id,
      gm.group_id,
      gm.user_id,
      gm.role,
      gm.nickname_in_group,
      gm.joined_at,
      gm.can_add_expenses,
      gm.can_edit_expenses,
      gm.can_delete_expenses,
      gm.can_add_members,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image_url,
      u.default_currency
    FROM group_members gm
    LEFT JOIN users u ON gm.user_id = u.user_id
    WHERE gm.group_id = ? 
    AND gm.is_active = 1
    ORDER BY gm.joined_at ASC
  `;

  const [members] = await con.execute(get_query, [group_id]);

  return members;
};

/**
 * Check if user is member of group
 * @param {string} group_id
 * @param {string} user_id
 * @returns {Promise<Array>}
 */
export const checkGroupMembership = async (group_id, user_id) => {
  const check_query = `
    SELECT * FROM group_members 
    WHERE group_id = ? 
    AND user_id = ? 
    AND is_active = 1
  `;

  const [membership] = await con.execute(check_query, [group_id, user_id]);

  return membership;
};

/**
 * Update group
 * @param {Array} fieldName
 * @param {Array} Values
 * @param {string} wherefieldName
 * @param {string} whereValue
 * @returns {Promise<object>}
 */
export const updateGroup = async (
  fieldName = [],
  Values = [],
  wherefieldName,
  whereValue,
) => {
  if (fieldName.length === 0 || fieldName.length !== Values.length) {
    return [];
  }

  const update_query = `
    UPDATE expense_groups
    SET ${fieldName.map((f) => `${f} = ?`).join(", ")}
    WHERE ${wherefieldName} = ?
  `;

  Values.push(whereValue);

  const [update_group] = await con.execute(update_query, Values);

  return update_group;
};

/**
 * Update group member
 * @param {Array} fieldName
 * @param {Array} Values
 * @param {string} wherefieldName
 * @param {string} whereValue
 * @returns {Promise<object>}
 */
export const updateGroupMember = async (
  fieldName = [],
  Values = [],
  wherefieldName,
  whereValue,
) => {
  if (fieldName.length === 0 || fieldName.length !== Values.length) {
    return [];
  }

  const update_query = `
    UPDATE group_members
    SET ${fieldName.map((f) => `${f} = ?`).join(", ")}
    WHERE ${wherefieldName} = ?
  `;

  Values.push(whereValue);

  const [update_member] = await con.execute(update_query, Values);

  return update_member;
};

/**
 * Create group invitation
 * @param {object} invitationData
 * @returns {Promise<object>}
 */
export const createGroupInvitation = async (invitationData) => {
  const {
    group_id,
    invited_email,
    invited_phone,
    invited_user_id,
    invited_by,
    message,
    expires_at,
  } = invitationData;

  if (!group_id || !invited_by) {
    throw new Error("group_id and invited_by are required");
  }

  const invitation_id = uuidv4();
  const invitation_token = uuidv4();

  const insert_query = `
    INSERT INTO group_invitations (
      invitation_id,
      group_id,
      invited_email,
      invited_phone,
      invited_user_id,
      invitation_token,
      invited_by,
      status,
      message,
      expires_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const params = [
    invitation_id,
    group_id,
    invited_email || null,
    invited_phone || null,
    invited_user_id || null,
    invitation_token,
    invited_by,
    "pending",
    message || null,
    expires_at || defaultExpiry,
  ];

  const [invitation] = await con.execute(insert_query, params);

  return { invitation_id, invitation_token, ...invitation };
};

/**
 * Get invitation by token
 * @param {string} invitation_token
 * @returns {Promise<Array>}
 */
export const getInvitationByToken = async (invitation_token) => {
  const get_query = `
    SELECT 
      gi.*,
      g.group_name,
      g.group_type,
      g.group_image_url,
      u.first_name as inviter_first_name,
      u.last_name as inviter_last_name
    FROM group_invitations gi
    LEFT JOIN expense_groups g ON gi.group_id = g.group_id
    LEFT JOIN users u ON gi.invited_by = u.user_id
    WHERE gi.invitation_token = ?
  `;

  const [invitation] = await con.execute(get_query, [invitation_token]);

  return invitation;
};

/**
 * Update group invitation
 * @param {Array} fieldName
 * @param {Array} Values
 * @param {string} wherefieldName
 * @param {string} whereValue
 * @returns {Promise<object>}
 */
export const updateGroupInvitation = async (
  fieldName = [],
  Values = [],
  wherefieldName,
  whereValue,
) => {
  if (fieldName.length === 0 || fieldName.length !== Values.length) {
    return [];
  }

  const update_query = `
    UPDATE group_invitations
    SET ${fieldName.map((f) => `${f} = ?`).join(", ")}
    WHERE ${wherefieldName} = ?
  `;

  Values.push(whereValue);

  const [update_invitation] = await con.execute(update_query, Values);

  return update_invitation;
};

/**
 * Initialize user balances for new member
 * @param {string} group_id
 * @param {string} new_user_id
 * @returns {Promise<void>}
 */
export const initializeUserBalances = async (group_id, new_user_id) => {
  // Get all existing members of the group
  const members = await getGroupMembers(group_id);

  // Get group default currency
  const [groupData] = await getGroupCustomData(["group_id"], [group_id]);
  const currency = groupData[0]?.default_currency || "USD";

  const insert_queries = [];

  // Create balance entries between new user and all existing members
  for (const member of members) {
    if (member.user_id !== new_user_id) {
      const balance_id_1 = uuidv4();
      const balance_id_2 = uuidv4();

      // New user -> Existing member
      insert_queries.push({
        query: `
          INSERT INTO user_balances (
            balance_id,
            group_id,
            from_user_id,
            to_user_id,
            balance_amount,
            currency
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        params: [
          balance_id_1,
          group_id,
          new_user_id,
          member.user_id,
          0.0,
          currency,
        ],
      });

      // Existing member -> New user
      insert_queries.push({
        query: `
          INSERT INTO user_balances (
            balance_id,
            group_id,
            from_user_id,
            to_user_id,
            balance_amount,
            currency
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        params: [
          balance_id_2,
          group_id,
          member.user_id,
          new_user_id,
          0.0,
          currency,
        ],
      });
    }
  }

  // Execute all insertions
  for (const { query, params } of insert_queries) {
    await con.execute(query, params);
  }
};

/**
 * Get group statistics
 * @param {string} group_id
 * @returns {Promise<object>}
 */
export const getGroupStatistics = async (group_id) => {
  // Total expenses
  const [totalExpenses] = await con.execute(
    `
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(amount), 0) as total_amount,
      currency
    FROM expenses
    WHERE group_id = ? AND is_deleted = 0
    GROUP BY currency
  `,
    [group_id],
  );

  // Per member spending
  const [memberSpending] = await con.execute(
    `
    SELECT 
      e.paid_by as user_id,
      u.first_name,
      u.last_name,
      COALESCE(SUM(e.amount), 0) as total_paid,
      COUNT(*) as expense_count
    FROM expenses e
    LEFT JOIN users u ON e.paid_by = u.user_id
    WHERE e.group_id = ? AND e.is_deleted = 0
    GROUP BY e.paid_by
    ORDER BY total_paid DESC
  `,
    [group_id],
  );

  // Category-wise breakdown
  const [categoryBreakdown] = await con.execute(
    `
    SELECT 
      ec.category_name,
      ec.icon,
      ec.color,
      COUNT(e.expense_id) as expense_count,
      COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses e
    LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
    WHERE e.group_id = ? AND e.is_deleted = 0
    GROUP BY e.category_id
    ORDER BY total_amount DESC
  `,
    [group_id],
  );

  // Recent expenses
  const [recentExpenses] = await con.execute(
    `
    SELECT 
      e.*,
      u.first_name as payer_first_name,
      u.last_name as payer_last_name,
      ec.category_name
    FROM expenses e
    LEFT JOIN users u ON e.paid_by = u.user_id
    LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
    WHERE e.group_id = ? AND e.is_deleted = 0
    ORDER BY e.expense_date DESC, e.created_at DESC
    LIMIT 10
  `,
    [group_id],
  );

  return {
    totalExpenses: totalExpenses[0] || { total_count: 0, total_amount: 0 },
    memberSpending,
    categoryBreakdown,
    recentExpenses,
  };
};

/**
 * Get simplified debts for group
 * @param {string} group_id
 * @returns {Promise<Array>}
 */
export const getSimplifiedDebts = async (group_id) => {
  const get_query = `
    SELECT 
      sd.*,
      u1.first_name as from_user_first_name,
      u1.last_name as from_user_last_name,
      u2.first_name as to_user_first_name,
      u2.last_name as to_user_last_name
    FROM simplified_debts sd
    LEFT JOIN users u1 ON sd.from_user_id = u1.user_id
    LEFT JOIN users u2 ON sd.to_user_id = u2.user_id
    WHERE sd.group_id = ?
    ORDER BY sd.amount DESC
  `;

  const [debts] = await con.execute(get_query, [group_id]);

  return debts;
};

/**
 * Get group activities
 * @param {string} group_id
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export const getGroupActivities = async (group_id, limit = 20) => {
  const get_query = `
    SELECT 
      al.*,
      u.first_name,
      u.last_name,
      u.profile_image_url
    FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.user_id
    WHERE al.group_id = ?
    ORDER BY al.created_at DESC
    LIMIT ?
  `;

  const [activities] = await con.execute(get_query, [group_id, limit]);

  return activities;
};

/**
 * Remove member from group (soft delete)
 * @param {string} member_id
 * @returns {Promise<object>}
 */
export const removeMemberFromGroup = async (member_id) => {
  const update_query = `
    UPDATE group_members
    SET is_active = 0, left_at = NOW()
    WHERE member_id = ?
  `;

  const [result] = await con.execute(update_query, [member_id]);

  return result;
};

/**
 * Archive group
 * @param {string} group_id
 * @returns {Promise<object>}
 */
export const archiveGroup = async (group_id) => {
  const update_query = `
    UPDATE expense_groups
    SET is_archived = 1, archived_at = NOW()
    WHERE group_id = ?
  `;

  const [result] = await con.execute(update_query, [group_id]);

  return result;
};

/**
 * Delete group (soft delete)
 * @param {string} group_id
 * @returns {Promise<object>}
 */
export const deleteGroup = async (group_id) => {
  const update_query = `
    UPDATE expense_groups
    SET is_active = 0, deleted_at = NOW()
    WHERE group_id = ?
  `;

  const [result] = await con.execute(update_query, [group_id]);

  return result;
};
