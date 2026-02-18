import bcrypt from "bcryptjs";
import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import { getUserCustom_Data, updateUser } from "../services/user.service.js";
import {
  createToken,
  getfilterToken,
  update_Token,
} from "../services/token.service.js";
import { createActivityLog } from "../services/activitylog.service.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const loginuser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password required",
    });
  }

  const getUserData = await getUserCustom_Data(
    ["email", "is_active"],
    [email, 1],
  );

  if (getUserData.length === 0) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  // ✅ FIX: Check if email is verified
  if (getUserData[0].is_email_verified !== 1) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email first",
    });
  }

  const UserPassword = getUserData[0].password_hash;

  // ✅ FIX: Add await for bcrypt.compare
  const VerifyPassword = await bcrypt.compare(password, UserPassword);

  if (!VerifyPassword) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const payload = {
    user_id: getUserData[0].user_id,
    username: getUserData[0].first_name,
    email: getUserData[0].email,
  };

  const AccessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRETKEY, {
    expiresIn: "1h",
  });

  const RefreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRETKEY, {
    expiresIn: "7d",
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const token_data = {
    user_id: getUserData[0].user_id,
    token_type: "refresh",
    token_hash: RefreshToken,
    device_info: req.headers["user-agent"],
    ip_address: req.ip,
    is_revoked: false,
    expires_at: expiresAt,
  };

  const activity_data = {
    user_id: getUserData[0].user_id,
    activity_type: "user_management",
    entity_type: "user",
    entity_id: getUserData[0].user_id,
    action: "login",
    new_values: JSON.stringify(token_data),
    description: "User logged in",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  const currentDate_time = new Date();

  await createToken(token_data);
  await createActivityLog(activity_data);
  await updateUser(
    ["last_login_at"],
    [currentDate_time],
    "user_id",
    getUserData[0].user_id,
  );

  return res.status(200).json({
    success: true,
    message: "Login successfully",
    AccessToken,
    RefreshToken,
    user: getUserData[0],
  });
};

const verifytoken = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Token is required",
    });
  }

  const hash_token = crypto.createHash("sha256").update(token).digest("hex");
  const gettoken_data = await getfilterToken(["token_hash"], [hash_token]);

  // ✅ FIX: Check length before accessing
  if (!gettoken_data || gettoken_data.length === 0) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Invalid or expired token",
    });
  }

  const tokenInfo = gettoken_data[0];

  // Check if revoked
  if (tokenInfo.is_revoked === 1) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Token has been revoked",
    });
  }

  // Check if expired
  const isexpire = new Date(tokenInfo.expires_at);
  const now = new Date();

  if (now > isexpire) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Token has expired",
    });
  }

  // Update user email verification status
  await updateUser(["is_email_verified"], [1], "user_id", tokenInfo.user_id);

  // Revoke the token so it can't be used again
  await update_Token(["is_revoked"], [1], "token_id", tokenInfo.token_id);

  // ✅ FIX: Redirect to frontend with success message
  return res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
};

const Refreshtoken = async (req, res) => {
  const { user_id, Refreshtoken } = req.body;

  if (!user_id || !Refreshtoken) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "user_id and Refreshtoken are required",
    });
  }

  const token_hash = crypto
    .createHash("sha256")
    .update(Refreshtoken)
    .digest("hex");

  const check_token = await getfilterToken(
    ["token_hash", "user_id"],
    [token_hash, user_id],
  );

  // ✅ FIX: Check token exists
  if (!check_token || check_token.length === 0) {
    return res.status(401).json({
      status: 401,
      success: false,
      message: "Invalid refresh token",
    });
  }

  const tokenInfo = check_token[0];

  // Check if revoked
  if (tokenInfo.is_revoked === 1) {
    return res.status(401).json({
      status: 401,
      success: false,
      message: "Refresh token has been revoked",
    });
  }

  // ✅ FIX: Check if token IS expired (not is NOT expired)
  const now = new Date();
  const isexpire = new Date(tokenInfo.expires_at);

  if (now > isexpire) {
    return res.status(401).json({
      status: 401,
      success: false,
      message: "Refresh token has expired. Please login again.",
    });
  }

  // Get user data
  const get_user = await getUserCustom_Data(["user_id"], [user_id]);

  if (get_user.length === 0) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "User not found",
    });
  }

  const userData = get_user[0];

  // Generate new tokens
  const payload = {
    user_id: userData.user_id,
    username: userData.first_name,
    email: userData.email,
  };

  const newAccessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRETKEY, {
    expiresIn: "1h",
  });

  const newRefreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRETKEY, {
    expiresIn: "7d",
  });

  // Revoke old refresh token
  await update_Token(["is_revoked"], [1], "token_id", tokenInfo.token_id);

  // Create new refresh token
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const token_data = {
    user_id: userData.user_id,
    token_type: "refresh",
    token_hash: newRefreshToken,
    device_info: req.headers["user-agent"],
    ip_address: req.ip,
    is_revoked: false,
    expires_at: expiresAt,
  };

  await createToken(token_data);

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Tokens refreshed successfully",
    AccessToken: newAccessToken,
    RefreshToken: newRefreshToken,
  });
};

router.post("/login", Errorhandler(loginuser));
router.get("/verify-mail/:token", Errorhandler(verifytoken));
router.post("/refresh-token", Errorhandler(Refreshtoken));

export default router;
