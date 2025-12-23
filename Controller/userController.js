import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import { getUsers, createUser } from "../services/user.service.js";

const userget = async (req, res) => {
  const data = await getUsers();
  return res.status(200).json({
    data,
    message: "success",
  });
};

const userpost = async (req, res) => {
  const userData = req.body;
  const newUser = await createUser(userData);
  return res.status(201).json({
    data: newUser,
    message: "User created successfully",
  });
};

router.get("/", Errorhandler(userget));
router.post("/", Errorhandler(userpost));

export default router;
