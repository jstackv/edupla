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

// Voice notes: stored as raw audio files (webm/ogg/mp4) up to 25 MB
const voiceNoteStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'edupla/voice_notes',
    resource_type: 'raw',  // audio files aren't images; 'raw' handles any binary type
    public_id: `voice-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    use_filename: false,
  }),
});

const voiceNoteUpload = multer({
  storage: voiceNoteStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max per voice note
  fileFilter: (req, file, cb) => {
    // Accept common browser MediaRecorder output formats
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed for voice notes.'));
    }
  },
});

module.exports = { documentUpload, assignmentUpload, voiceNoteUpload, cloudinary };
