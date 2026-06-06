/**
 * FileViewer utilities
 *
 * openFileInNewTab(file) → opens the file in a styled viewer in a new browser tab
 * downloadFile(file)     → triggers a real browser download (saves to local storage)
 *
 * Both use file.file_url (Cloudinary) directly — no backend auth roundtrip.
 */

export function getViewUrl(file) {
  if (!file) return null;
  if (file.type === 'submission') return `/api/assignments/${file.submission_id || file.id}/submission/view`;
  if (file.type === 'assignment')  return `/api/assignments/${file.id}/view`;
  return `/api/documents/${file.id}/view`;
}

export function getDownloadUrl(file) {
  if (!file) return null;
  if (file.type === 'submission') return `/api/assignments/${file.submission_id || file.id}/submission/download`;
  if (file.type === 'assignment')  return `/api/assignments/${file.id}/download`;
  return `/api/documents/${file.id}/download`;
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
 * Opens the file for VIEWING in a new tab.
 * Uses Cloudinary URL directly — no auth needed.
 * - PDFs, images, video, audio, text → styled ViewerPage wrapper
 * - Office docs → Google Docs Viewer (production) or direct Cloudinary (localhost)
 */
export function openFileInNewTab(file) {
  if (!file) return;
  const cloudUrl = file.file_url;
  const origin   = window.location.origin;
  const fileType = getFileType(file.original_name || file.name || file.filename, file.mime_type);
  const fileName = file.original_name || file.name || file.filename || 'Document';
  const fileTitle = file.title || fileName;

  if (cloudUrl) {
    if (['pdf', 'image', 'video', 'audio', 'text'].includes(fileType)) {
      const params = new URLSearchParams({
        url:   cloudUrl,
        type:  fileType,
        name:  fileName,
        title: fileTitle,
        ...(file.description ? { description: file.description } : {}),
        ...(file.class_name  ? { class_name:  file.class_name  } : {}),
        direct: '1',
      });
      window.open(`/view-doc?${params.toString()}`, '_blank', 'noopener,noreferrer');
    } else if (['word','excel','powerpoint'].includes(fileType)) {
      const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
      if (isLocal) {
        // Google Docs Viewer can't reach localhost — open Cloudinary URL directly
        window.open(cloudUrl, '_blank', 'noopener,noreferrer');
      } else {
        const gv = `https://docs.google.com/viewer?url=${encodeURIComponent(cloudUrl)}&embedded=false`;
        window.open(gv, '_blank', 'noopener,noreferrer');
      }
    } else {
      // Unknown type — open Cloudinary URL directly
      window.open(cloudUrl, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  // Legacy fallback (no Cloudinary URL stored yet)
  const viewUrl = `${origin}${getViewUrl(file)}`;
  const dlUrl   = `${origin}${getDownloadUrl(file)}`;
  const params  = new URLSearchParams({
    url: getViewUrl(file), type: fileType, name: fileName, title: fileTitle,
    ...(file.description ? { description: file.description } : {}),
    ...(file.class_name  ? { class_name:  file.class_name  } : {}),
  });
  if (['pdf','image','video','audio','text'].includes(fileType)) {
    window.open(`/view-doc?${params.toString()}`, '_blank', 'noopener,noreferrer');
  } else if (['word','excel','powerpoint'].includes(fileType)) {
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
    window.open(isLocal ? dlUrl : `https://docs.google.com/viewer?url=${encodeURIComponent(viewUrl)}&embedded=false`, '_blank', 'noopener,noreferrer');
  } else {
    window.open(dlUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Triggers a real browser DOWNLOAD (saves file to user's local storage).
 * Uses Cloudinary URL with a hidden <a download> trick.
 * For cross-origin Cloudinary URLs, fetches the file as a blob first
 * so the browser treats it as a download rather than navigation.
 */
export async function downloadFile(file) {
  if (!file) return;
  const fileName = file.original_name || file.name || file.filename || 'download';
  const url = file.file_url || `${window.location.origin}${getDownloadUrl(file)}`;

  try {
    // Fetch as blob so browser always saves it (even for cross-origin Cloudinary URLs)
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
    // Fallback: open in new tab (browser will prompt download for most file types)
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
