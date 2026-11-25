/**
 * Helpers for tasks (assignment / homework / discussion) that carry MORE THAN
 * ONE file — both the teacher's attachments and a student's submission.
 *
 * Storage model
 * -------------
 *  - Assignment.attachments[] and Submission.files[] hold every file.
 *  - The legacy single-file fields (filename, original_name, mime_type,
 *    file_url) still exist and mirror the FIRST file, so records created before
 *    this feature — and any code that still reads them — keep working.
 *  - A legacy record with no array is exposed as a one-item list whose id is
 *    'legacy' (see resolveFiles).
 */

const MAX_TASK_FILES = 10;          // per teacher attachment list / per submission
const LEGACY_FILE_ID = 'legacy';

// Normalise one multer-cloudinary upload into our file shape.
function fileFromUpload(f) {
  return {
    filename: f.filename,
    original_name: f.originalname,
    mime_type: f.mimetype,
    file_url: f.path,
    size: f.size || 0,
    uploaded_at: new Date(),
  };
}

// Files the browser uploaded straight to Cloudinary (see routes/uploads.js) and
// then described to us in a JSON field called `uploadedFiles`. Only objects that
// really live in our own Cloudinary account/folder are accepted.
//
// NOTE: Cloudinary "raw" files (ZIP, Word, Excel, PowerPoint… everything that is
// not a PDF/image) can come back with the file extension inside the public_id
// (e.g. "edupla/assignments/1764-ab12cd.zip"), so dots must be allowed here.
// Rejecting them silently dropped those files and only the comment was saved.
const PUBLIC_ID_RE = /^edupla\/assignments\/[\w.-]+$/;

function rawDirectUploads(req) {
  let raw = req.body && req.body.uploadedFiles;
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

function isOurCloudinaryUrl(url) {
  const cloud = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  if (!cloud || typeof url !== 'string') return false;
  return url.toLowerCase().startsWith(`https://res.cloudinary.com/${cloud.toLowerCase()}/`);
}

function directUploads(req) {
  return rawDirectUploads(req)
    .filter(f => f
      && typeof f.filename === 'string' && PUBLIC_ID_RE.test(f.filename) && !f.filename.includes('..')
      && isOurCloudinaryUrl(f.file_url))
    .map(f => ({
      filename: f.filename,
      original_name: String(f.original_name || 'file').slice(0, 255),
      mime_type: String(f.mime_type || 'application/octet-stream').slice(0, 120),
      file_url: f.file_url,
      size: Number(f.size) || 0,
      uploaded_at: new Date(),
    }));
}

// How many direct-upload descriptions the browser sent that we did NOT accept.
// Callers use it to fail loudly instead of saving a submission without files.
function rejectedDirectUploads(req) {
  return Math.max(0, rawDirectUploads(req).length - directUploads(req).length);
}

// Works for upload.array(), upload.fields() and upload.single(), and also picks
// up files the browser uploaded directly to Cloudinary.
function uploadedFiles(req) {
  const out = [];
  if (Array.isArray(req.files)) out.push(...req.files);
  else if (req.files && typeof req.files === 'object') Object.values(req.files).forEach(list => out.push(...list));
  if (req.file) out.push(req.file);
  return [...out.map(fileFromUpload), ...directUploads(req)];
}

// Every file on a record as plain objects with a string id. `field` is
// 'attachments' (Assignment) or 'files' (Submission).
function resolveFiles(doc, field) {
  if (!doc) return [];
  const list = Array.isArray(doc[field]) ? doc[field] : [];
  if (list.length) {
    return list.map(f => ({
      id: String(f._id),
      filename: f.filename || null,
      original_name: f.original_name || null,
      mime_type: f.mime_type || null,
      file_url: f.file_url || null,
      size: f.size || 0,
      uploaded_at: f.uploaded_at || null,
    }));
  }
  if (doc.filename || doc.file_url) {
    return [{
      id: LEGACY_FILE_ID,
      filename: doc.filename || null,
      original_name: doc.original_name || null,
      mime_type: doc.mime_type || null,
      file_url: doc.file_url || null,
      size: 0,
      uploaded_at: null,
    }];
  }
  return [];
}

// Find one file by its id (or the legacy pseudo-id).
function findFile(doc, field, fileId) {
  const files = resolveFiles(doc, field);
  if (!fileId) return files[0] || null;
  return files.find(f => f.id === String(fileId)) || null;
}

// The legacy single-file fields, derived from the first file of a list.
function legacyMirror(files) {
  const first = files && files[0];
  return {
    filename: first?.filename || null,
    original_name: first?.original_name || null,
    mime_type: first?.mime_type || null,
    file_url: first?.file_url || null,
  };
}

// Parse a list of ids sent as a JSON string, comma list, or array.
function parseIdArray(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = raw.split(','); }
  }
  if (!Array.isArray(list)) list = [list];
  return [...new Set(list.map(x => String(x).trim()).filter(Boolean))];
}

// Every Cloudinary object a record points at (array + legacy mirror, de-duplicated),
// as { filename, original_name, mime_type } — what the clean-up code needs.
function allStoredFiles(doc, field) {
  if (!doc) return [];
  const seen = new Set();
  const out = [];
  const push = (f) => {
    if (!f?.filename || seen.has(f.filename)) return;
    seen.add(f.filename);
    out.push({ filename: f.filename, original_name: f.original_name, mime_type: f.mime_type });
  };
  (doc[field] || []).forEach(push);
  push(doc);
  return out;
}

// Delete a list of stored files from Cloudinary, never throwing.
async function destroyStoredFiles(files, cloudinary, getResourceType) {
  await Promise.all((files || []).map(f =>
    cloudinary.uploader
      .destroy(f.filename, { resource_type: getResourceType(f.original_name, f.mime_type) })
      .catch(() => {})
  ));
}

module.exports = {
  MAX_TASK_FILES, LEGACY_FILE_ID,
  uploadedFiles, rejectedDirectUploads, resolveFiles, findFile, legacyMirror, parseIdArray,
  allStoredFiles, destroyStoredFiles,
};
