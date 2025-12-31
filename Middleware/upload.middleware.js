import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const uniqueName = `${
      file.originalname.split(".")[0]
    }-${Date.now()}.${file.originalname.split(".").pop()}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({ storage: storage });
