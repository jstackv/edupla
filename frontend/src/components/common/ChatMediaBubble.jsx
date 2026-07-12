import { useState } from 'react';
import {
  Image as ImageIcon, FileText, File as FileIcon, FileSpreadsheet,
  FileType2, Download, Maximize2, AlertTriangle,
} from 'lucide-react';
import { openFileInNewTab, downloadFile, getFileType } from './FileViewer';

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

/* ── Shared photo bubble: rounded thumbnail, click to view full-size ── */
export function ChatImageBubble({ url, name, mimeType }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleOpen = () => {
    if (failed) return;
    openFileInNewTab({ file_url: url, name, mime_type: mimeType });
  };

  return (
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
  );
}

/* ── Shared file card: icon + name + size + download button ── */
export function ChatFileBubble({ name, size, url, mimeType }) {
  const [downloading, setDownloading] = useState(false);
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
    <div
      onClick={() => openFileInNewTab({ file_url: url, name, mime_type: mimeType })}
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
