/**
 * Builds the filename a browser should SAVE a file as, preferring the
 * human-facing title (assignment/document title) over the raw uploaded
 * filename — while still keeping the real file extension.
 *
 * e.g. buildDownloadFilename('VUE DIRECTIVE ASSIGNMENT', 'L3 SOD - SWDVF301 - VUE JS FRAMEWORK.pdf')
 *      → 'VUE DIRECTIVE ASSIGNMENT.pdf'
 */
function buildDownloadFilename(title, originalName) {
  const source = originalName || 'download';
  const dotIndex = source.lastIndexOf('.');
  const ext = dotIndex > -1 ? source.slice(dotIndex + 1).toLowerCase() : '';
  const base = (title && title.trim()) || source.replace(/\.[^/.]+$/, '') || 'download';
  const safeBase = base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return ext ? `${safeBase}.${ext}` : safeBase;
}

/**
 * Fetches a file from its Cloudinary URL and streams it back to the client
 * with a Content-Disposition header carrying the correct, title-based filename.
 * Falls back to a plain redirect if the fetch fails, so downloads never break.
 */
async function streamWithFilename(res, fileUrl, filename, disposition = 'attachment') {
  try {
    const upstream = await fetch(fileUrl);
    if (!upstream.ok || !upstream.body) throw new Error(`Upstream responded ${upstream.status}`);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename.replace(/"/g, '')}"`);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    console.error('Download stream error, falling back to redirect:', err.message);
    if (!res.headersSent) res.redirect(fileUrl);
  }
}

module.exports = { buildDownloadFilename, streamWithFilename };