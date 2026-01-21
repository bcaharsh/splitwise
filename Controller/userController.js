import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import { getUsers, createUser } from "../services/user.service.js";
import { upload } from "../Middleware/upload.middleware.js";

const userget = async (req, res) => {
  const data = await getUsers();
  const ip = req.ip;
  console.log(ip, "userget api ip");
  const header = req.headers;
  console.log(header, "user get api contain header");
  console.log(header["user-agent"], "user get api contain header");
  return res.status(200).json({
    data,
    message: "success",
  });
};

const userpost = async (req, res) => {
  const userData = req.body;
  const data = {
    ...userData,
    profile_image_url: req.file ? req.file.path : null,
  };
  const newUser = await createUser(data);

  return res.status(201).json({
    status: 201,
    data: newUser,
    message: "User created successfully",
  });
};

router.get("/", Errorhandler(userget));
router.post("/", upload.single("profile_image"), Errorhandler(userpost));

export default router;
