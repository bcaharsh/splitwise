import con from "../config/database.js"
import jwt from "jsonwebtoken"
import { Errorhandler } from "../utils/errorhandle.js"
import { excludeRoute } from "../config/excludeRoute.config.js"

const ValidateUserToken=async(req,res,next)=>{

    const isExcluded =excludeRoute.some(route=>(
        req.path.startsWith(route)
    ))

    if(isExcluded){
        return next()
    }
    const authhedaer=req.header.authorization

    if(!authhedaer || !authhedaer.startsWith('Bearer ')){
        return res.status(401).json({
            status:false,
            message:"Token is required"
        })
    }

    const token=token.split(' ')[0]

    const verify=jwt.verify(token,process.env.JWT_ACCESS_SECRETKEY)

    if(!verify){
        return res.status(401).json({
            status:false,
            message:"You are not authorize"
        })
    }

    return next()
}

export default Errorhandler(ValidateUserToken)