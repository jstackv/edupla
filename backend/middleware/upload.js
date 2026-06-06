const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const makeStorage = (folder) => new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: `edupla/${folder}`,
    resource_type: 'raw',   // supports PDFs, docx, zip — all non-image types
    public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    use_filename: false,
  }),
});

const documentUpload = multer({
  storage: makeStorage('documents'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

const assignmentUpload = multer({
  storage: makeStorage('assignments'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

module.exports = { documentUpload, assignmentUpload, cloudinary };
