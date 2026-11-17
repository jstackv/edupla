const router = require('express').Router();
const crypto = require('crypto');
const { isAuthenticated } = require('../middleware/auth');
const { cloudinary, getResourceType } = require('../middleware/upload');

// POST /api/uploads/sign  { files: [{ name, type }] }
//
// Why this exists: the API runs as a Vercel serverless function, which rejects
// any request body over ~4.5 MB (HTTP 413) before our code runs. Sending files
// through the API therefore failed for anything bigger than ~4.5 MB (or several
// smaller files together). Instead the browser uploads each file straight to
// Cloudinary using the one-time signature returned here, then sends only the
// small file metadata to the API.
const MAX_SIGN_FILES = 10;

router.post('/sign', isAuthenticated, (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ message: 'File storage is not configured on the server.' });
    }
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) return res.status(400).json({ message: 'No files to upload.' });
    if (files.length > MAX_SIGN_FILES) {
      return res.status(400).json({ message: `You can upload at most ${MAX_SIGN_FILES} files at once.` });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const uploads = files.map((f) => {
      const resourceType = getResourceType(String(f?.name || ''), String(f?.type || ''));
      const publicId = `edupla/assignments/${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
      const signature = cloudinary.utils.api_sign_request(
        { public_id: publicId, timestamp },
        apiSecret,
      );
      return {
        url: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        resource_type: resourceType,
        fields: { api_key: apiKey, timestamp, public_id: publicId, signature },
      };
    });
    res.json({ uploads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
