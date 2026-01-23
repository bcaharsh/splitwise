import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.Email_ID,
    pass: process.env.Email_Pass,
  },
});
