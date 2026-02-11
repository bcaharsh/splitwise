import con from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

export const createUserPrefrence = async (UserPrefData) => {
  const { user_id } = UserPrefData;

  const prefrence_id = uuidv4();

  const query = `
    insert into user_preferences (preference_id ,user_id) values (?,?)
    `;

  const [userPreferences] = await con.execute(query, [prefrence_id, user_id]);

  return userPreferences;
};

export const getPrefrence = async (fields = [], values = []) => {
  const getprefrence_query = `
    select * from user_preferences where ${fields.length !== 0 ? fields.map((f) => `${f}=?`) : `1=1`}
    `;
  const [get_prefrence] = await con.execute(getprefrence_query, values);
};

export const updatePrefrence = async (
  fields = [],
  values = [],
  wherefield,
  wherevalue,
) => {
  if (fields.length === 0 && fields.length !== values.length) {
    return [];
  }
  const update_prefrence_query = `
    update user_preferences
    set ${fields.map((f) => `${f}=?`)}
    where ${wherefield}=?
    `;
  values.push(wherevalue);
  const [update_prefrence] = await con.execute(update_prefrence_query, values);

  return update_prefrence;
};
