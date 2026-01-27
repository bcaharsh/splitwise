import con from "../config/database.js";
import { v4 as uuidv4, validate } from "uuid";
import bcrypt from "bcryptjs";
import { StringGenerator } from "../utils/randomgenerator.js";
import { createToken } from "./token.service.js";
import { createActivityLog } from "./activitylog.service.js";
import { createUserPrefrence } from "./userPrefrence.service.js";
/**
 * Get all users
 * @returns {Promise<Array>} Array of user objects
 */
export const getUsers = async () => {
  const [data] = await con.execute(`select * from users`);

  return data;
};

/**
 * Create a new user
 * @param {Promise<object>} userData
 * @returns
 */
export const createUser = async (userData, req) => {
  const {
    email,
    password,
    first_name,
    last_name,
    phone,
    profile_image_url,
    default_currency,
  } = userData;

  if (!password) throw new Error("Password is required");
  if (!email) throw new Error("Email is required");

  const user_id = uuidv4();
  const password_hash = await bcrypt.hash(password, 10);

  const insert_query = `
    insert into users 
    (
    user_id,
    email,
    password_hash,
    first_name,
    last_name,
    phone,
    profile_image_url,
    default_currency,
    last_login_at
    )
    values(?,?,?,?,?,?,?,?,?)
    `;

  const params = [
    user_id,
    email,
    password_hash,
    first_name,
    last_name,
    phone,
    profile_image_url,
    default_currency,
    new Date(),
  ];
  const [users] = await con.execute(insert_query, params);

  const token = StringGenerator(8);

  const token_data = {
    user_id,
    token_type: "email_verify",
    token_hash: token,
    device_info: req.headers["user-agent"],
    ip_address: req.ip,
    is_revoked: false,
    email,
    first_name,
  };

  const activity_data = {
    user_id,
    activity_type: "user_management",
    entity_type: "user",
    entity_id: user_id,
    action: "create",
    new_values: JSON.stringify(params),
    description: "user is create",
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  };

  await createToken(token_data);
  await createUserPrefrence({user_id})
  await createActivityLog(activity_data);

  return users;
};

export const getUserCustom_Data=async(fieldName=[],Values=[])=>{

  const get_query=`
  select * from users where ${fieldName.length !=0 && fieldName.length === Values.length ? fieldName.map(f=>`${f} = ?`).join(" AND ") : '1 = 1'} 
  `
  const [User_data]=await con.execute(get_query,Values)

  return User_data
}


export const updateUser=async(fieldName=[],Values=[],wherefieldName,whereValue)=>{
  if(fieldName.length === 0 && fieldName.length !== Values.length){
    return []
  }

  const update_query=`
  update users
  set ${fieldName.map(f=>`${f} = ?`).join(", ")}
  where ${wherefieldName} =?
  `
  const updated_values=Values.push(whereValue)
  const [update_user]=await con.execute(update_query,updated_values)

  return update_user
}