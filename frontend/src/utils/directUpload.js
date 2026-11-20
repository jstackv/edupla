import axios from 'axios';
import api from './api';

// Vercel serverless functions reject request bodies over ~4.5 MB, so task
// attachments and student submissions are uploaded straight from the browser
// to Cloudinary (using a short-lived signature from our API). Only the small
// file descriptions are then sent to our API.
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export async function uploadFilesDirect(files, onProgress) {
  if (!files || files.length === 0) return [];

  const tooBig = files.find(f => f.size > MAX_FILE_BYTES);
  if (tooBig) throw new Error(`"${tooBig.name}" is larger than 100 MB.`);

  const { data } = await api.post('/uploads/sign', {
    files: files.map(f => ({ name: f.name, type: f.type })),
  });
  const total = files.reduce((n, f) => n + f.size, 0) || 1;
  const loaded = new Array(files.length).fill(0);
  const report = () => onProgress && onProgress(Math.min(100, Math.round((loaded.reduce((a, b) => a + b, 0) / total) * 100)));

  // Upload up to 3 files at the same time (instead of one after another) —
  // noticeably faster for several attachments, still gentle on school Wi-Fi.
  const results = new Array(files.length);
  let next = 0;
  async function worker() {
    while (next < files.length) {
      const i = next++;
      const file = files[i];
      const cfg = data.uploads[i];
      const fd = new FormData();
      Object.entries(cfg.fields).forEach(([k, v]) => fd.append(k, v));
      fd.append('file', file);
      let res;
      try {
        res = await axios.post(cfg.url, fd, {
          timeout: 0,
          onUploadProgress: ev => { loaded[i] = ev.loaded || 0; report(); },
        });
      } catch (err) {
        const reason = err.response?.data?.error?.message;
        throw new Error(`Could not upload "${file.name}"${reason ? `: ${reason}` : '. Check your connection and try again.'}`);
      }
      loaded[i] = file.size; report();
      results[i] = {
        filename: res.data.public_id,
        original_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        file_url: res.data.secure_url,
        size: file.size,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  return results;
}

// Readable message for a failed save, including the proxy's own errors
// (413 "payload too large", 504 timeouts) that carry no JSON message.
export function saveErrorMessage(err, fallback) {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.response?.status === 413) return 'The files are too large to send. Please try again.';
  if (err?.response?.status === 504) return 'The server took too long to respond. Please try again.';
  if (err?.message && !err.response && err.message !== 'Network Error') return err.message;
  if (err?.message === 'Network Error') return 'Network problem — check your connection and try again.';
  return fallback;
}
