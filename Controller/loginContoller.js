import bcrypt from "bcryptjs";
import { Errorhandler } from "../utils/errorhandle";
import { router } from "../utils/routerhandle";
import { getUserCustom_Data, updateUser } from "../services/user.service";
import { createToken } from "../services/token.service";
import { createActivityLog } from "../services/activitylog.service";
import jwt from "jsonwebtoken"

const loginuser = async (req, res) => {
  const { email, passowrd } = req.body;

  if (!email || !passowrd) {
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
  const VerifyPassword = bcrypt.compare(passowrd, UserPassword);
  if (!VerifyPassword) {
    return res.status(401).json({
      success: false,
      message: "Password is wrong",
    });
  }
  const payload = { username: getUserData[0].first_name, email: getUserData[0].email };

  const AccessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRETKEY, {
    expiresIn: "1h",
  });

  const RefreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRETKEY, {
    expiresIn: "'7d",
  });

  const token_data = {
    user_id:getUserData[0].user_id,
    token_type: "refresh",
    token_hash: RefreshToken,
    device_info: req.headers["user-agent"],
    ip_address: req.ip,
    is_revoked: false,
  };

  const activity_data = {
    user_id:getUserData[0].user_id,
    activity_type: "user_management",
    entity_type: "user",
    entity_id: getUserData[0].user_id,
    action: "login",
    new_values: JSON.stringify(params),
    description: "user is create",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  const currentDate_time=new Date()

  await createToken(token_data);
  await createActivityLog(activity_data)
  await updateUser(['last_login_at'],[currentDate_time],"user_id",getUserData[0].user_id)
  
  return res.status(200).json({
    success:true,
    message:"Login successfully",
    AccessToken,
    RefreshToken
  })
};

router.post("/", Errorhandler(loginuser));
