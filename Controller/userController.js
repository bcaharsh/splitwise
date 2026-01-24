import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import { getUsers, createUser } from "../services/user.service.js";
import { upload } from "../Middleware/upload.middleware.js";
import jwt from "jsonwebtoken"

const getuser = async (req, res) => {
  const data = await getUsers();

  return res.status(200).json({
    data,
    message: "success",
  });
};

const postuser = async (req, res) => {
  const userData = req.body;
  const data = {
    ...userData,
    profile_image_url: req.file ? req.file.path : null,
  };
  const newUser = await createUser(data, req);
  const payload={username:userData.first_name,email:userData.email}
  const AccessToken=jwt.sign(payload,process.env.JWT_ACCESS_SECRETKEY,{
    expiresIn:"1h"
  })  
  const RefreshToken=jwt.sign(payload,process.env.JWT_REFRESH_SECRETKEY,{
  expiresIn:"'7d"
  })

  return res.status(201).json({
    status: 201,
    data: newUser,
    AccessToken,
    RefreshToken,
    message: "User created successfully",
  });
};

router.get("/", Errorhandler(getuser));
router.post("/", upload.single("profile_image"), Errorhandler(postuser));

export default router;
