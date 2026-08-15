import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Image as ImageIcon, FileText, File as FileIcon, FileSpreadsheet,
  FileType2, Download, Maximize2, AlertTriangle, X, ExternalLink,
} from 'lucide-react';
import { downloadFile, getFileType } from './FileViewer';

/* ── Format bytes into a short human label ── */
export function fmtFileSize(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Icon + accent color per file type ── */
const FILE_STYLE = {
  pdf:        { Icon: FileText,       color: '#dc2626' },
  word:       { Icon: FileText,       color: '#2563eb' },
  excel:      { Icon: FileSpreadsheet, color: '#059669' },
  powerpoint: { Icon: FileType2,      color: '#ea580c' },
  text:       { Icon: FileText,       color: '#6366f1' },
  video:      { Icon: FileType2,      color: '#7c3aed' },
  audio:      { Icon: FileType2,      color: '#0891b2' },
  other:      { Icon: FileIcon,       color: '#6366f1' },
};

const OFFICE_TYPES = new Set(['word', 'excel', 'powerpoint']);

/* ══════════════════════════════════════════════════════════════════
   In-app file viewer modal. Renders via a portal on document.body so
   it always sits above the chat scroll container, regardless of which
   bubble opened it. Never opens a new tab.
   ══════════════════════════════════════════════════════════════════ */
function FileViewerModal({ file, onClose }) {
  const { url, name, mimeType, fileType } = file;
  const [downloading, setDownloading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const isImage = fileType === 'image' || (mimeType || '').startsWith('image/');
  const isVideo = fileType === 'video' || (mimeType || '').startsWith('video/');
  const isAudio = fileType === 'audio' || (mimeType || '').startsWith('audio/');
  const isPdf = fileType === 'pdf';
  const isOffice = OFFICE_TYPES.has(fileType);
  const { Icon, color } = FILE_STYLE[fileType] || FILE_STYLE.other;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadFile({ file_url: url, name, mime_type: mimeType }); }
    finally { setDownloading(false); }
  };

  const officeViewerUrl = isOffice
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
    : null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8,9,12,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '28px 16px', animation: 'fvModalBackdropIn 0.18s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: isImage || isVideo ? 860 : 760,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          animation: 'fvModalSheetIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          borderBottom: '1px solid var(--card-border)', flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon style={{ width: 15, height: 15, color }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }} title={name}>{name || 'File'}</div>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            title="Download"
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: 'var(--surface-100)', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            {downloading
              ? <div style={{ width: 13, height: 13, border: '2px solid rgba(120,120,120,0.3)', borderTopColor: 'var(--text-secondary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <Download style={{ width: 14, height: 14 }} />}
          </button>
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: 'var(--surface-100)', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, minHeight: 0, overflow: isImage ? 'auto' : 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isImage || isVideo ? '#0b0c10' : 'var(--card-bg)',
        }}>
          {isImage && (
            <>
              {!imgLoaded && !imgFailed && (
                <div style={{ width: 30, height: 30, border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              )}
              {imgFailed ? (
                <ViewerFallback color={color} Icon={AlertTriangle} message="Couldn't load this photo." onDownload={handleDownload} downloading={downloading} url={url} />
              ) : (
                <img
                  src={url}
                  alt={name || 'Shared photo'}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgFailed(true)}
                  style={{ display: imgLoaded ? 'block' : 'none', maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
                />
              )}
            </>
          )}

          {isVideo && (
            <video src={url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '80vh' }} />
          )}

          {isAudio && (
            <div style={{ width: '100%', padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ width: 24, height: 24, color }} />
              </div>
              <audio src={url} controls style={{ width: '100%' }} />
            </div>
          )}

          {isPdf && (
            <iframe title={name || 'PDF preview'} src={url} style={{ width: '100%', height: '78vh', border: 'none' }} />
          )}

          {isOffice && (
            <div style={{ width: '100%', height: '78vh', display: 'flex', flexDirection: 'column' }}>
              <iframe title={name || 'Document preview'} src={officeViewerUrl} style={{ flex: 1, width: '100%', border: 'none' }} />
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '7px 10px', fontSize: 11, color: 'var(--text-secondary)',
                borderTop: '1px solid var(--card-border)', flexShrink: 0,
              }}>
                Preview not loading?
                <button onClick={handleDownload} style={{ background: 'none', border: 'none', color, fontWeight: 700, cursor: 'pointer', fontSize: 11, padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                  Download instead <ExternalLink style={{ width: 10, height: 10 }} />
                </button>
              </div>
            </div>
          )}

          {(fileType === 'text' || fileType === 'other') && (
            <ViewerFallback color={color} Icon={Icon} message="No inline preview for this file type." onDownload={handleDownload} downloading={downloading} url={url} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes fvModalBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fvModalSheetIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>,
    document.body
  );
}

function ViewerFallback({ color, Icon, message, onDownload, downloading }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 32px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 26, height: 26, color }} />
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>{message}</p>
      <button
        onClick={onDownload}
        disabled={downloading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 20,
          border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
        }}
      >
        {downloading
          ? <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          : <Download style={{ width: 14, height: 14 }} />}
        Download
      </button>
    </div>
  );
}

/* ── Shared photo bubble: rounded thumbnail, click to view full-size in modal ── */
export function ChatImageBubble({ url, name, mimeType }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleOpen = () => {
    if (failed) return;
    setViewerOpen(true);
  };

  return (
    <>
      <div
        onClick={handleOpen}
        title={name || 'Photo'}
        style={{
          position: 'relative', width: 208, maxWidth: '100%',
          borderRadius: 14, overflow: 'hidden', cursor: failed ? 'default' : 'pointer',
          background: 'var(--surface-100)', lineHeight: 0,
        }}
      >
        {!loaded && !failed && (
          <div style={{
            width: '100%', height: 156, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 22, height: 22, border: '2.5px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
        {failed ? (
          <div style={{ width: '100%', height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-secondary)' }}>
            <AlertTriangle style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Couldn't load photo</span>
          </div>
        ) : (
          <img
            src={url}
            alt={name || 'Shared photo'}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{
              display: loaded ? 'block' : 'none',
              width: '100%', maxHeight: 260, objectFit: 'cover',
            }}
          />
        )}
        {loaded && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6,
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Maximize2 style={{ width: 12, height: 12, color: '#fff' }} />
          </div>
        )}
      </div>

      {viewerOpen && (
        <FileViewerModal
          file={{ url, name, mimeType, fileType: 'image' }}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

/* ── Shared file card: icon + name + size + download button, click to preview in modal ── */
export function ChatFileBubble({ name, size, url, mimeType }) {
  const [downloading, setDownloading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const fileType = getFileType(name, mimeType);
  const { Icon, color } = FILE_STYLE[fileType] || FILE_STYLE.other;

  const handleDownload = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await downloadFile({ file_url: url, name, mime_type: mimeType });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div
        onClick={() => setViewerOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: 220, maxWidth: '100%', padding: '9px 10px',
          borderRadius: 13, cursor: 'pointer',
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: 17, height: 17, color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }} title={name}>
            {name || 'File'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 1 }}>
            {fmtFileSize(size)}
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          title="Download"
          style={{
            width: 28, height: 28, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {downloading
            ? <div style={{ width: 12, height: 12, border: '2px solid rgba(0,0,0,0.15)', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            : <Download style={{ width: 13, height: 13 }} />
          }
        </button>
      </div>

      {viewerOpen && (
        <FileViewerModal
          file={{ url, name, mimeType, fileType }}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

/* ── Attach ("+") popup menu — kept intentionally short: only the two
   actions this app actually supports, Document and Photos & videos. ── */
const ATTACH_ROWS = [
  { key: 'document', label: 'Document',        Icon: FileText,  color: '#7f66ff', action: 'file' },
  { key: 'media',    label: 'Photos & videos',  Icon: ImageIcon, color: '#1fa2d8', action: 'image' },
];

export function AttachMenu({ open, onClose, onPickImage, onPickFile }) {
  if (!open) return null;

  const handlers = { file: onPickFile, image: onPickImage };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'transparent' }} />
      <div
        className="wa-attach-menu"
        style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, zIndex: 50,
          background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16,
          boxShadow: '0 16px 38px rgba(0,0,0,0.24)', padding: 7,
          display: 'flex', flexDirection: 'column', gap: 2, minWidth: 200,
        }}
      >
        {ATTACH_ROWS.map(({ key, label, Icon, color, action }) => (
          <button
            key={key}
            onClick={() => { const fn = handlers[action]; if (fn) fn(); onClose(); }}
            className="wa-attach-row"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 11,
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left',
            }}
          >
            <div className="wa-attach-icon" style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon style={{ width: 18, height: 18, color: '#fff' }} />
            </div>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

/* ── Emoji picker popup — a small curated grid, inserted at the cursor via
   onPick(emoji); stays open after a pick so multiple emoji can be added. ── */
const EMOJI_SET = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😜',
  '🤔', '😎', '🙂', '😉', '😢', '😭', '😡', '🥳',
  '👍', '👎', '👏', '🙏', '💪', '🔥', '🎉', '✨',
  '❤️', '💯', '👋', '😅', '🤗', '😴', '🤝', '⭐',
];

export function EmojiPicker({ open, onClose, onPick }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'transparent' }} />
      <div
        className="wa-emoji-picker"
        style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, zIndex: 50,
          background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16,
          boxShadow: '0 16px 38px rgba(0,0,0,0.24)', padding: 10,
        }}
      >
        {EMOJI_SET.map(e => (
          <button key={e} type="button" className="wa-emoji-btn" onClick={() => onPick(e)}>{e}</button>
        ))}
      </div>
    </>
  );
}

/* ── Small preview icon for "sending…" staged attachment rows ── */
export function AttachmentTypeIcon({ mimeType, style }) {
  const isImage = (mimeType || '').startsWith('image/');
  return isImage
    ? <ImageIcon style={style} />
    : <FileIcon style={style} />;
}