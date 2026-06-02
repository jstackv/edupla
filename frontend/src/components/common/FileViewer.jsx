/**
 * FileViewer — opens document content in a new browser tab.
 *
 * Clicking the Eye icon calls openFileInNewTab(file):
 *   - PDF, images, video, audio, text → opens /api/.../view directly (streamed inline by backend)
 *   - Word / Excel / PowerPoint → Google Docs Viewer (production) or download (localhost)
 *   - Unknown types → triggers download
 *
 * A dedicated ViewerPage component handles the /view-doc route so students/teachers
 * can see a rich, styled wrapper around the file content with file metadata.
 */

import { useEffect } from 'react';

export function getViewUrl(file) {
  if (!file) return null;
  // Submission files (student uploads)
  if (file.type === 'submission') {
    return `/api/assignments/${file.submission_id || file.id}/submission/view`;
  }
  // Assignment files (teacher uploads)
  if (file.type === 'assignment') {
    return `/api/assignments/${file.id}/view`;
  }
  // Documents (notes, materials)
  return `/api/documents/${file.id}/view`;
}

export function getDownloadUrl(file) {
  if (!file) return null;
  if (file.type === 'submission') {
    return `/api/assignments/${file.submission_id || file.id}/submission/download`;
  }
  if (file.type === 'assignment') {
    return `/api/assignments/${file.id}/download`;
  }
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
 * Opens a file in a new tab for viewing.
 * For office docs on production, uses Google Docs Viewer.
 * For everything else, streams directly from backend.
 */
export function openFileInNewTab(file) {
  if (!file) return;
  const origin = window.location.origin;
  const viewUrl = `${origin}${getViewUrl(file)}`;
  const downloadUrl = `${origin}${getDownloadUrl(file)}`;
  const fileType = getFileType(file.original_name || file.name || file.filename, file.mime_type);

  // Build a viewer page URL with metadata encoded in search params
  const params = new URLSearchParams({
    url: getViewUrl(file),
    type: fileType,
    name: file.original_name || file.name || file.filename || 'Document',
    title: file.title || file.original_name || file.name || 'Document',
    ...(file.description ? { description: file.description } : {}),
    ...(file.class_name ? { class_name: file.class_name } : {}),
  });

  // For natively renderable files, open our viewer wrapper page
  if (['pdf', 'image', 'video', 'audio', 'text'].includes(fileType)) {
    window.open(`/view-doc?${params.toString()}`, '_blank', 'noopener,noreferrer');
    return;
  }

  // Office docs: Google Docs Viewer on production, download on localhost
  if (['word', 'excel', 'powerpoint'].includes(fileType)) {
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
    if (isLocal) {
      // On localhost, Google Docs Viewer can't reach the server — open download instead
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } else {
      const gv = `https://docs.google.com/viewer?url=${encodeURIComponent(viewUrl)}&embedded=false`;
      window.open(gv, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  // Unknown — trigger download
  window.open(downloadUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Thin component wrapper — existing callers that render
 * <FileViewer file={f} onClose={fn} /> still work without changes.
 */
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
