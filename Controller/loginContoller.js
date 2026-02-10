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
    ["email", "is_active", "is_email_verified"],
    [email, 1, 1],
  );

  if (getUserData.length == 0) {
    return res.status(204).message({
      success: false,
      message: "No data found",
    });
  }

  const UserPassword = getUserData[0].password_hash;
  const VerifyPassword = bcrypt.compare(password, UserPassword);
  if (!VerifyPassword) {
    return res.status(401).json({
      success: false,
      message: "Password is wrong",
    });
  }
  const payload = {
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
    description: "user is create",
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
    user: getUserData,
  });
};

const verifytoken = async (req, res) => {
  const { token } = req.params;
  const hash_token = crypto.createHash("sha256").update(token).digest("hex");
  const gettoken_data = await getfilterToken(["token_hash"], [hash_token]);
  const isrevoke = gettoken_data[0].is_revoked === 1;
  const isexpire = new Date(gettoken_data[0].expires_at);
  const now = new Date();
  if (gettoken_data.length === 0 || isrevoke) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "token not match",
    });
  }
  if (now > isexpire) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "token has expired",
    });
  }

  await updateUser(
    ["is_email_verified"],
    [1],
    "user_id",
    gettoken_data[0].user_id,
  );

  await update_Token(
    ["is_revoked"],
    [1],
    "token_id",
    gettoken_data[0].token_id,
  );

  return res.redirect("/login");
};

const Refreshtoken = async (req, res) => {
  const { user_id, Refreshtoken } = req.body;

  const token_hash = crypto
    .createHash("sha256")
    .update(Refreshtoken)
    .digest("hex");
  const now = new Date();
  const check_token = await getfilterToken(
    ["token_hash", "user_id"],
    [token_hash, user_id],
  );
  const isexpire = new Date(check_token[0].expires_at);
  if (check_token.length === 0) {
    return res.status(400).json({
      status: 400,
      status: false,
      message: "refresh token not found",
    });
  }
  if (now < isexpire) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "token has not expired",
    });
  }

  const get_user = await getUserCustom_Data(["user_id"], [user_id]);
  if (get_user.length === 0) {
    return res.status(400).json({
      status: 400,
      status: false,
      message: "user not found",
    });
  }

  const payload = {
    username: get_user[0].first_name,
    email: get_user[0].email,
  };

  const RefreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRETKEY, {
    expiresIn: "7d",
  });

  const token_data = {
    user_id: get_user[0].user_id,
    token_type: "refresh",
    token_hash: RefreshToken,
    device_info: req.headers["user-agent"],
    ip_address: req.ip,
    is_revoked: false,
  };

  await createToken(token_data);

  return res.status(200).json({
    status: 200,
    success: true,
    RefreshToken,
  });
};

router.post("/login", Errorhandler(loginuser));
router.get("/verify-mail/:token", Errorhandler(verifytoken));
router.post("/refresh-token", Errorhandler(Refreshtoken));

export default router;
