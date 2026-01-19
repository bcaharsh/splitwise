import con from "../config/database"
import {v4 as uuidv4} from "uuid"

export const createToken=async(param)=>{
    const token_query=`
    insert into user_auth_tokens(
    token_id,
    user_id,
    token_type,
    
    )
    values (?,?)
    `
    const [token]=
}