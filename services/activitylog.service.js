import con from "../config/database";
import { v4 as uuidv4 } from "uuid";

export const createActivityLog = async (activityData) => {
  const {
    user_id,
    group_id = null,
    activity_type,
    entity_type,
    entity_id,
    action,
    old_values = null,
    new_values = null,
    description,
    ip_address,
    user_agent,
  } = activityData;

  const log_id = uuidv4();

  const param_data = [
    log_id,
    user_id,
    group_id || null,
    activity_type,
    entity_type,
    entity_id,
    action,
    old_values || null,
    new_values || null,
    description || null,
    ip_address,
    user_agent,
  ];

  const query = `
  insert into activity_logs (
   log_id,
    user_id,
    group_id,
    activity_type,
    entity_type,
    entity_id,
    action,
    old_values,
    new_values,
    description,
    ip_address,
    user_agent
  )
  values (?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  const [activity_logs] = await con.execute(query, param_data);

  return activity_logs;
};
