import con from "./config/database.js";
import userController from "./Controller/userController.js";
import { app } from "./utils/expressapphandle.js";

app.use("/user", userController);

app.listen(8000, () => {
  console.log("server listen at 8000 port");
});
