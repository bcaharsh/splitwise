import "dotenv/config";
import con from "./config/database.js";
import userController from "./Controller/userController.js";
import loginController from "./Controller/loginContoller.js";
import { app } from "./utils/expressapphandle.js";
import express from "express";

app.set("trust proxy", true);
app.use(express.json());
app.use(express.urlencoded());

app.use("/user", userController);
app.use("/", loginController);

app.listen(8000, () => {
  console.log("server listen at 8000 port");
});
