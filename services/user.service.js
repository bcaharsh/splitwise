import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
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
export const createUser = async (userData) => {
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
  return users;
};
