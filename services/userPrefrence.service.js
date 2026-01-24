import con from "../config/database.js"
import {v4 as uuidv4} from "uuid"

export const createUserPrefrence=async(UserPrefData)=>{
    const {
        user_id      
    }=UserPrefData

    const prefrence_id=uuidv4()

    const query=`
    insert into user_preferences (preference_id ,user_id) values (?,?)
    `

    const [userPreferences]=await con.execute(query,[prefrence_id,user_id])

    return userPreferences
}