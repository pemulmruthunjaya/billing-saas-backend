const multer = require("multer");

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error("Only PDF, JPG, and PNG attachments are allowed"));
    }
    callback(null, true);
  },
});

module.exports = upload;
