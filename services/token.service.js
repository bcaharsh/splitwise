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
  const expires_at =
    !param.expires_at || param.expires_at === null
      ? new Date(now.getTime() + 30 * 60 * 1000)
      : param.expires_at;
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

  if (param.email && param.first_name) {
    const verifymail = {
      from: process.env.Email_ID,
      to: param.email,
      subject: `Verify with splitwise ${param.first_name}`,
      html: `<p>Please click below to verify</p><a href="${process.env.FRONTEND_URL}/verify-mail/${param.token_hash}"> Verify Email</a>`,
    };

    await transporter.sendMail(verifymail);
  }

  return token;
};

export const getfilterToken = async (fields = [], values = []) => {
  const get_token_query = `
  select * from user_auth_tokens where ${fields.length !== 0 ? fields.map((f) => `${f}=?`).join("AND") : "1=1"}
  `;
  const [get_token] = await con.execute(get_token_query, values);

  return get_token;
};

export const update_Token = async (
  fields = [],
  values = [],
  wherefield,
  wherevalue,
) => {
  if (fields.length === 0 || values.length !== fields.length) {
    return [];
  }
  const token_update_query = `
  update user_auth_tokens
  set ${fields.map((f) => `${f}=?`).join(",")}
  where ${wherefield}=?
  `;
  values.push(wherevalue);
  const [token_update] = await con.execute(token_update_query, values);

  return token_update;
};
