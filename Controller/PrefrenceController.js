import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
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
      message: "user id is require",
    });
  }
  const updatevalues = [];
  const updateFields = [];

  Object.entries(payload).forEach((key, value) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      updatevalues.push(value);
      updateFields.push(key);
    }
  });

  const old_user_data = await getUserCustom_Data(["user_id"], [user_id]);
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
    message: "Data is updated",
    userdata: get_user_data,
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

  Object.entries(payload).forEach((key, value) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      updatevalues.push(value);
      updatefields.push(key);
    }
  });

  await updatePrefrence(updatefields, updatevalues, "user_id", user_id);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "update the user prefrence",
  });
};

router.put("/user", Errorhandler(userProfile));
router.put("/", Errorhandler(userPrefrence));

export default router;
