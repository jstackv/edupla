/**
 * FileViewer utilities
 *
 * openFileInNewTab(file) → opens the file for VIEWING in a new browser tab
 * downloadFile(file)     → triggers a real browser download
 *
 * KEY FIX: Cloudinary stores all files as resource_type:'raw', which means
 * the URL forces a download. To display PDFs/images inline we must transform
 * the URL: replace /raw/upload/ with /image/upload/ (for images) or add
 * fl_inline flag (for PDFs). Office docs go through Google Docs Viewer.
 */

export function getViewUrl(file) {
  if (!file) return null;
  if (file.type === 'submission') return `/api/assignments/${file.assignment_id}/submissions/${file.submission_id || file.id}/view`;
  if (file.type === 'assignment')  return `/api/assignments/${file.id}/view`;
  return `/api/documents/${file.id}/view`;
}

export function getDownloadUrl(file) {
  if (!file) return null;
  if (file.type === 'submission') return `/api/assignments/${file.assignment_id}/submissions/${file.submission_id || file.id}/download`;
  if (file.type === 'assignment')  return `/api/assignments/${file.id}/download`;
  return `/api/documents/${file.id}/download`;
}

/**
 * Builds the filename a browser should SAVE a file as, preferring the
 * human-facing title (assignment/document title) over the raw uploaded
 * filename — while still keeping the real file extension.
 *
 * e.g. buildDownloadFilename('VUE DIRECTIVE ASSIGNMENT', 'L3 SOD - SWDVF301 - VUE JS FRAMEWORK.pdf')
 *      → 'VUE DIRECTIVE ASSIGNMENT.pdf'
 */
export function buildDownloadFilename(title, originalName) {
  const source = originalName || 'download';
  const dotIndex = source.lastIndexOf('.');
  const ext = dotIndex > -1 ? source.slice(dotIndex + 1).toLowerCase() : '';
  const base = (title && title.trim()) || source.replace(/\.[^/.]+$/, '') || 'download';
  // strip characters that are invalid in filenames on Windows/macOS
  const safeBase = base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return ext ? `${safeBase}.${ext}` : safeBase;
}

export function getFileType(filename, mimeType) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  const mime = mimeType || '';
  if (['jpg','jpeg','png','gif','webp','svg','bmp','avif'].includes(ext) || mime.startsWith('image/')) return 'image';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (['mp4','webm','ogg','mov','avi'].includes(ext) || mime.startsWith('video/')) return 'video';
  if (['mp3','wav','ogg','m4a','flac'].includes(ext) || mime.startsWith('audio/')) return 'audio';
  if (['txt','md','json','csv','xml','html','js','ts','jsx','tsx','py','css','sh','yaml','yml'].includes(ext) || mime.startsWith('text/')) return 'text';
  if (['doc','docx'].includes(ext) || mime.includes('word')) return 'word';
  if (['xls','xlsx'].includes(ext) || mime.includes('excel') || mime.includes('spreadsheet')) return 'excel';
  if (['ppt','pptx'].includes(ext) || mime.includes('presentation')) return 'powerpoint';
  return 'other';
}

/**
 * Transform a Cloudinary raw URL so the browser renders the file INLINE
 * instead of forcing a download.
 *
 * Cloudinary raw URLs look like:
 *   https://res.cloudinary.com/<cloud>/raw/upload/<public_id>
 *
 * Transformations:
 *  - PDF   → insert fl_inline so browser renders it:
 *              /raw/upload/ → /raw/upload/fl_inline/
 *  - Image → swap resource type to image for native rendering:
 *              /raw/upload/ → /image/upload/
 *  - Video → swap to video:
 *              /raw/upload/ → /video/upload/
 *  - Audio → swap to video (Cloudinary uses video resource type for audio):
 *              /raw/upload/ → /video/upload/
 *  - Others → keep as-is (will go through Google Docs Viewer or download)
 */
function toInlineUrl(cloudUrl, fileType) {
  if (!cloudUrl) return cloudUrl;
  if (!cloudUrl.includes('res.cloudinary.com')) return cloudUrl; // not Cloudinary, leave alone

  switch (fileType) {
    case 'pdf':
      // New uploads are stored as resource_type:'image' (see backend/middleware/upload.js)
      // specifically to dodge Cloudinary's default block on delivering raw PDF/ZIP files —
      // those URLs already look like /image/upload/... and render inline as-is.
      if (cloudUrl.includes('/image/upload/')) return cloudUrl;
      // Legacy documents uploaded before that fix are still resource_type:'raw'. fl_inline
      // only works for these if the Cloudinary account has "Allow delivery of PDF and ZIP
      // files" enabled under Console → Settings → Security.
      return cloudUrl.replace('/raw/upload/', '/raw/upload/fl_inline/');
    case 'image':
      // Images: change resource type from raw → image
      return cloudUrl.replace('/raw/upload/', '/image/upload/');
    case 'video':
      // Videos: change resource type from raw → video
      return cloudUrl.replace('/raw/upload/', '/video/upload/');
    case 'audio':
      // Audio: Cloudinary uses video resource type for audio too
      return cloudUrl.replace('/raw/upload/', '/video/upload/');
    default:
      return cloudUrl; // raw URL fine for download / Google Docs Viewer
  }
}

/**
 * Opens the file for VIEWING in a new tab.
 * Transforms Cloudinary raw URLs to inline-viewable URLs first.
 * - PDFs, images, video, audio, text → styled ViewerPage wrapper (/view-doc)
 * - Office docs → Google Docs Viewer (deployed) or Download prompt (localhost)
 */
export function openFileInNewTab(file) {
  if (!file) return;
  const rawCloudUrl = file.file_url;
  const origin = window.location.origin;
  const fileType = getFileType(file.original_name || file.name || file.filename, file.mime_type);
  const fileName = file.original_name || file.name || file.filename || 'Document';
  const fileTitle = file.title || fileName;
  // What the browser should actually SAVE the file as — title-based, not the raw upload name
  const downloadName = buildDownloadFilename(file.title, fileName);

  if (rawCloudUrl) {
    // Transform raw Cloudinary URL to inline-viewable URL
    const inlineUrl = toInlineUrl(rawCloudUrl, fileType);

    if (['pdf', 'image', 'video', 'audio', 'text'].includes(fileType)) {
      // For PDFs specifically, route through our own backend view endpoint instead of the
      // raw Cloudinary URL. Chrome's built-in PDF viewer has its own Download button that
      // re-fetches whatever URL is in the iframe's src and saves it using that response's
      // Content-Disposition filename — so pointing straight at Cloudinary always saves under
      // Cloudinary's internal name no matter what we do client-side. Our backend endpoint
      // streams the same file back with a Content-Disposition header carrying the correct,
      // title-based filename, so both our own Download button AND Chrome's native one save
      // it correctly.
      const useBackendView = fileType === 'pdf' && getViewUrl(file);
      const params = new URLSearchParams({
        url:    useBackendView ? getViewUrl(file) : inlineUrl,
        type:   fileType,
        name:   fileName,
        title:  fileTitle,
        download_name: downloadName,
        direct: useBackendView ? '0' : '1',
        ...(file.description ? { description: file.description } : {}),
        ...(file.class_name  ? { class_name:  file.class_name  } : {}),
      });
      window.open(`/view-doc?${params.toString()}`, '_blank', 'noopener,noreferrer');

    } else if (['word', 'excel', 'powerpoint'].includes(fileType)) {
      // Office docs: use Google Docs Viewer with the raw Cloudinary URL
      // (Google Docs Viewer fetches from Cloudinary directly — raw URL works fine)
      const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
      if (isLocal) {
        // Google Docs Viewer can't reach localhost — show download page
        const params = new URLSearchParams({
          url:    rawCloudUrl,
          type:   fileType,
          name:   fileName,
          title:  fileTitle,
          download_name: downloadName,
          direct: '1',
          ...(file.description ? { description: file.description } : {}),
          ...(file.class_name  ? { class_name:  file.class_name  } : {}),
        });
        window.open(`/view-doc?${params.toString()}`, '_blank', 'noopener,noreferrer');
      } else {
        const gv = `https://docs.google.com/viewer?url=${encodeURIComponent(rawCloudUrl)}&embedded=false`;
        window.open(gv, '_blank', 'noopener,noreferrer');
      }

    } else {
      // Unknown type — open raw URL (browser will decide what to do)
      window.open(rawCloudUrl, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  // ── Legacy fallback: no Cloudinary URL stored (old uploads) ──
  const viewUrl  = `${origin}${getViewUrl(file)}`;
  const dlUrl    = `${origin}${getDownloadUrl(file)}`;
  const params   = new URLSearchParams({
    url: getViewUrl(file), type: fileType, name: fileName, title: fileTitle,
    download_name: downloadName,
    ...(file.description ? { description: file.description } : {}),
    ...(file.class_name  ? { class_name:  file.class_name  } : {}),
  });
  if (['pdf', 'image', 'video', 'audio', 'text'].includes(fileType)) {
    window.open(`/view-doc?${params.toString()}`, '_blank', 'noopener,noreferrer');
  } else if (['word', 'excel', 'powerpoint'].includes(fileType)) {
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
    window.open(
      isLocal
        ? dlUrl
        : `https://docs.google.com/viewer?url=${encodeURIComponent(viewUrl)}&embedded=false`,
      '_blank', 'noopener,noreferrer'
    );
  } else {
    window.open(dlUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Triggers a real browser DOWNLOAD (saves file to user's local storage).
 * Always uses the raw Cloudinary URL (not the inline-transformed one).
 */
export async function downloadFile(file) {
  if (!file) return;
  const originalName = file.original_name || file.name || file.filename || 'download';
  // Prefer the title (assignment/document name) over the raw uploaded filename,
  // so re-used or generically-named source files still download with a meaningful name.
  const fileName = buildDownloadFilename(file.title, originalName);
  // Always use the raw file_url for downloads (not the fl_inline transformed version)
  const url = file.file_url || `${window.location.origin}${getDownloadUrl(file)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.warn('Blob download failed, falling back to direct URL:', err.message);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Thin component wrapper for callers using <FileViewer file={f} onClose={fn} />
 */
import { useEffect } from 'react';
export default function FileViewer({ file, onClose }) {
  useEffect(() => {
    if (file) {
      openFileInNewTab(file);
      const t = setTimeout(() => { if (onClose) onClose(); }, 150);
      return () => clearTimeout(t);
    }
  }, [file, onClose]);
  return null;
}