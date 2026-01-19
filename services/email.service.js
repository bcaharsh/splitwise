import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.Email_ID,
    pass: process.env.Email_Pass,
  },
});

export default transporter;
