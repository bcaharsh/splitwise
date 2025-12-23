import { Errorhandler } from "../utils/errorhandle.js";
import { router } from "../utils/routerhandle.js";
import con from "../config/database.js";

const userget = async (req, res) => {
  const [data] = await con.execute(`select * from users`);
  return res.status(200).json({
    data,
    message: "success",
  });
};

const userpost = async (req, res) => {};

router.get("/", Errorhandler(userget));

export default router;
