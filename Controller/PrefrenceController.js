import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import { upload } from "../Middleware/upload.middleware.js";
import { getUserCustom_Data, updateUser } from "../services/user.service.js";
import { updatePrefrence } from "../services/userPrefrence.service.js";
import { createActivityLog } from "../services/activitylog.service.js";

const userProfile = async (req, res) => {
  const { first_name, last_name, phone, email, user_id, default_currency } =
    req.body;
  const profile_image_url = req.file ? req.file.path : null;

  const payload = {
    first_name,
    last_name,
    phone,
    email,
    profile_image_url,
    default_currency,
  };

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const updatevalues = [];
  const updateFields = [];

  // ✅ FIX: Destructure [key, value] from Object.entries()
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      updateFields.push(key); // Push key first
      updatevalues.push(value); // Push value second
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "No fields to update",
    });
  }

  const old_user_data = await getUserCustom_Data(["user_id"], [user_id]);

  if (old_user_data.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "User not found",
    });
  }

  await updateUser(updateFields, updatevalues, "user_id", user_id);

  const get_user_data = await getUserCustom_Data(["user_id"], [user_id]);

  const activity_data = {
    user_id: user_id,
    activity_type: "user_management",
    entity_type: "user",
    entity_id: user_id,
    action: "update",
    old_values: JSON.stringify(old_user_data[0]),
    new_values: JSON.stringify(get_user_data[0]),
    description: "user profile is updated",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createActivityLog(activity_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Profile updated successfully",
    data: get_user_data[0],
  });
};

const userPrefrence = async (req, res) => {
  const {
    notification_push,
    notification_email,
    weekly_summary_email,
    payment_reminder_days,
    default_split_type,
    show_running_balance,
    theme,
    user_id,
  } = req.body;

  if (!user_id) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id is required",
    });
  }

  const payload = {
    notification_push,
    notification_email,
    weekly_summary_email,
    payment_reminder_days,
    default_split_type,
    show_running_balance,
    theme,
  };

  const updatevalues = [];
  const updatefields = [];

  // ✅ FIX: Destructure [key, value] from Object.entries()
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      updatefields.push(key); // Push key first
      updatevalues.push(value); // Push value second
    }
  });

  if (updatefields.length === 0) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "No fields to update",
    });
  }

  await updatePrefrence(updatefields, updatevalues, "user_id", user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Preferences updated successfully",
  });
};

// ✅ Add upload middleware for profile image
router.put("/user", upload.single("profile_image"), Errorhandler(userProfile));
router.put("/", Errorhandler(userPrefrence));

export default router;
