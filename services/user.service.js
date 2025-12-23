import con from "../config/database.js";

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
  const { name, email } = userData;
  const [result] = await con.execute(
    `INSERT INTO users (name, email) VALUES (?, ?)`,
    [name, email]
  );
  return { id: result.insertId, name, email };
};
