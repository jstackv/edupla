const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createStorage = (uploadPath) => multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

// Allow ALL file types
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const documentUpload = multer({
  storage: createStorage('uploads/documents'),
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

const assignmentUpload = multer({
  storage: createStorage('uploads/assignments'),
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

module.exports = { documentUpload, assignmentUpload };
