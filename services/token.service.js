import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { transporter } from "../utils/mailhandler.js";

export const createToken = async (param) => {
  const token_query = `
    insert into user_auth_tokens(
    token_id,
    user_id,
    token_type,
    token_hash,
    device_info,
    ip_address,
    expires_at,
    is_revoked
    )
    values (?,?,?,?,?,?,?,?)
    `;

  const hash_token = crypto
    .createHash("sha256")
    .update(param.token_hash)
    .digest("hex");
  const now = new Date();
  const expires_at = new Date(now.getTime() + 30 * 60 * 1000);
  const token_id = uuidv4();

  const param_data = [
    token_id,
    param.user_id,
    param.token_type,
    hash_token,
    param.device_info,
    param.ip_address,
    expires_at,
    param.is_revoked,
  ];

  //   Object.keys(param).map((data) => {
  //     if (data === "token_hash") {
  //       const hashtoken = crypto
  //         .createHash("sha256")
  //         .update(param[data])
  //         .digest("hex");
  //       param_data.push(hashtoken);
  //     } else if (data === "expires_at") {
  //       const now = new Date(param[data]);
  //       const expires_at = new Date(now.getTime() + 30 * 60 * 1000);
  //       param_data.push(expires_at);
  //     } else {
  //       param_data.push(param[data]);
  //     }
  //   });

  const [token] = await con.execute(token_query, param_data);

  const verifymail = {
    to: process.env.Email_ID,
    from: email,
    subject: `Verify with splitwise ${param.first_name}`,
    body: `<div>please click the link and verify the mail</div><div>${process.env.FRONTEND_URL}/verify-mail/${param.token_hash}</div>`,
  };

  await transporter.sendMail(verifymail);

  return token;
};
