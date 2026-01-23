import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import { getUsers, createUser } from "../services/user.service.js";
import { upload } from "../Middleware/upload.middleware.js";

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

  return res.status(201).json({
    status: 201,
    data: newUser,
    message: "User created successfully",
  });
};

router.get("/", Errorhandler(getuser));
router.post("/", upload.single("profile_image"), Errorhandler(postuser));

export default router;
