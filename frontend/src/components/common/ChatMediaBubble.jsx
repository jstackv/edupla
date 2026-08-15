import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Image as ImageIcon, FileText, File as FileIcon, FileSpreadsheet,
  FileType2, Music, Download, Maximize2, AlertTriangle, X, ExternalLink,
  ZoomIn, ZoomOut, Play, Pause, Eye,
} from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { downloadFile, getFileType, toInlineUrl } from './FileViewer';

/* ── Format bytes into a short human label ── */
export function fmtFileSize(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Icon + accent color per file type. Kept clear of indigo/violet
   (matches the graphite/no-indigo direction used across the app) so
   every type reads as its own distinct color at a glance. ── */
const FILE_STYLE = {
  pdf:        { Icon: FileText,       color: '#dc2626', label: 'PDF' },
  word:       { Icon: FileText,       color: '#2563eb', label: 'DOC' },
  excel:      { Icon: FileSpreadsheet, color: '#059669', label: 'SHEET' },
  powerpoint: { Icon: FileType2,      color: '#ea580c', label: 'SLIDES' },
  text:       { Icon: FileText,       color: '#0d9488', label: 'TEXT' },
  video:      { Icon: FileType2,      color: '#c026d3', label: 'VIDEO' },
  audio:      { Icon: Music,          color: '#0891b2', label: 'AUDIO' },
  image:      { Icon: ImageIcon,      color: '#db2777', label: 'PHOTO' },
  other:      { Icon: FileIcon,       color: '#475569', label: 'FILE' },
};

function isLocalOrigin() {
  if (typeof window === 'undefined') return false;
  const o = window.location.origin;
  return o.includes('localhost') || o.includes('127.0.0.1');
}

function extOf(name) {
  const m = /\.([a-zA-Z0-9]{1,6})$/.exec(name || '');
  return m ? m[1].toUpperCase() : '';
}

/* ══════════════════════════════════════════════════════════════════
   In-app file viewer modal. Renders via a portal on document.body so
   it always sits above the chat scroll container, regardless of which
   bubble opened it. Never opens a new tab on its own — but always
   offers one, since preview can occasionally fail even when a file is
   perfectly downloadable.

   BUG FIX — round 2: office docs first went through Microsoft's Office
   Online viewer (view.officeapps.live.com), which returned "File not
   found" for files it couldn't confidently re-fetch. Swapping to
   Google Docs Viewer looked like the standard fix... except Google's
   embed endpoint turned out to be just as unreliable here, failing
   with its own "Could not preview the file" message for the exact
   same files. Two different third-party iframe services failing on
   the same real, publicly-downloadable file (Download always worked)
   points at the services, not the file.

   So Word (.docx) and Excel (.xlsx/.xls) no longer depend on any
   external embed service at all — they're fetched and rendered
   directly in the browser with mammoth.js and SheetJS. That removes
   the point of failure entirely for the two most common attachment
   types. PowerPoint has no solid client-side renderer available, so
   it keeps an opt-in Google Docs Viewer attempt behind a "Try preview"
   button, with Download/Open always front and center as the reliable
   path.
   ══════════════════════════════════════════════════════════════════ */
function FileViewerModal({ file, onClose }) {
  const { url, name, mimeType, fileType, size } = file;
  const [downloading, setDownloading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [docLoaded, setDocLoaded] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const isImage = fileType === 'image' || (mimeType || '').startsWith('image/');
  const isVideo = fileType === 'video' || (mimeType || '').startsWith('video/');
  const isAudio = fileType === 'audio' || (mimeType || '').startsWith('audio/');
  const isPdf = fileType === 'pdf';
  const isWord = fileType === 'word';
  const isExcel = fileType === 'excel';
  const isPpt = fileType === 'powerpoint';
  const local = isLocalOrigin();
  const { Icon, color, label } = FILE_STYLE[fileType] || FILE_STYLE.other;

  // Cloudinary stores everything as resource_type:'raw' by default, which
  // forces a download instead of rendering inline — transform the URL so
  // images/pdf/video/audio actually preview. (No-op for non-Cloudinary URLs,
  // and a no-op for word/excel, which are rendered client-side instead.)
  const displayUrl = toInlineUrl(url, fileType);

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

  const handleOpenExternal = () => window.open(url, '_blank', 'noopener,noreferrer');

  const ext = extOf(name);
  const metaBits = [size ? fmtFileSize(size) : null, ext].filter(Boolean);

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(6,7,10,0.78)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '28px 16px', animation: 'fvModalBackdropIn 0.18s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: isImage || isVideo ? 880 : 780,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 22, overflow: 'hidden', position: 'relative',
          boxShadow: `0 28px 70px rgba(0,0,0,0.5), 0 0 0 1px ${color}12`,
          animation: 'fvModalSheetIn 0.22s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        {/* Signature top beam — a thin gradient rule in the file's accent color */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 14px',
          borderBottom: '1px solid var(--card-border)', flexShrink: 0,
        }}>
          <div style={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}>
            {/* Soft pulsing halo behind the icon badge */}
            <div style={{
              position: 'absolute', inset: -8, borderRadius: 16,
              background: `radial-gradient(circle, ${color}30, transparent 70%)`,
              animation: 'fvHaloPulse 2.6s ease-in-out infinite',
            }} />
            <div style={{
              position: 'relative', width: 42, height: 42, borderRadius: 13,
              background: `${color}18`, border: `1px solid ${color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon style={{ width: 19, height: 19, color }} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }} title={name}>{name || 'File'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color,
                background: `${color}16`, padding: '2px 7px', borderRadius: 6,
              }}>{label}</span>
              {metaBits.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {metaBits.join(' · ')}
                </span>
              )}
            </div>
          </div>

          {isImage && imgLoaded && !imgFailed && (
            <HeaderIconButton title={zoomed ? 'Zoom out' : 'Zoom in'} onClick={() => setZoomed(z => !z)}>
              {zoomed ? <ZoomOut style={{ width: 14, height: 14 }} /> : <ZoomIn style={{ width: 14, height: 14 }} />}
            </HeaderIconButton>
          )}
          <HeaderIconButton title="Open in new tab" onClick={handleOpenExternal}>
            <ExternalLink style={{ width: 14, height: 14 }} />
          </HeaderIconButton>
          <HeaderIconButton title="Download" onClick={handleDownload} disabled={downloading}>
            {downloading
              ? <Spinner size={13} color="var(--text-secondary)" />
              : <Download style={{ width: 14, height: 14 }} />}
          </HeaderIconButton>
          <HeaderIconButton title="Close" onClick={onClose}>
            <X style={{ width: 15, height: 15 }} />
          </HeaderIconButton>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, minHeight: 0, overflow: isImage && zoomed ? 'auto' : 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isImage || isVideo ? '#08090c' : 'var(--stage-bg, var(--surface-100))',
          backgroundImage: isImage || isVideo
            ? 'radial-gradient(ellipse at center, rgba(255,255,255,0.05), transparent 65%)'
            : undefined,
        }}>
          {isImage && (
            <>
              {!imgLoaded && !imgFailed && <ImageSkeleton color={color} />}
              {imgFailed ? (
                <ViewerFallback color={color} Icon={AlertTriangle} message="Couldn't load this photo."
                  onDownload={handleDownload} onOpenExternal={handleOpenExternal} downloading={downloading} />
              ) : (
                <img
                  src={displayUrl}
                  alt={name || 'Shared photo'}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgFailed(true)}
                  onClick={() => setZoomed(z => !z)}
                  style={{
                    display: imgLoaded ? 'block' : 'none',
                    maxWidth: zoomed ? 'none' : '100%',
                    width: zoomed ? '160%' : 'auto',
                    maxHeight: zoomed ? 'none' : '80vh',
                    objectFit: 'contain',
                    cursor: zoomed ? 'zoom-out' : 'zoom-in',
                    animation: 'fvImageIn 0.25s ease both',
                    transition: 'width 0.2s ease',
                  }}
                />
              )}
            </>
          )}

          {isVideo && (
            <video src={displayUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '80vh', animation: 'fvImageIn 0.25s ease both' }} />
          )}

          {isAudio && <AudioStage url={displayUrl} name={name} color={color} Icon={Icon} />}

          {isPdf && (
            <div style={{ position: 'relative', width: '100%', height: '78vh' }}>
              {!docLoaded && <DocSkeleton color={color} label="Opening PDF" />}
              <iframe
                title={name || 'PDF preview'}
                src={displayUrl}
                onLoad={() => setDocLoaded(true)}
                style={{ width: '100%', height: '100%', border: 'none', opacity: docLoaded ? 1 : 0, transition: 'opacity 0.25s ease' }}
              />
            </div>
          )}

          {isWord && (
            <WordStage url={displayUrl} color={color} Icon={Icon}
              onDownload={handleDownload} onOpenExternal={handleOpenExternal} downloading={downloading} />
          )}

          {isExcel && (
            <ExcelStage url={displayUrl} color={color} Icon={Icon}
              onDownload={handleDownload} onOpenExternal={handleOpenExternal} downloading={downloading} />
          )}

          {isPpt && (
            <SlidesStage url={displayUrl} name={name} color={color} Icon={Icon} local={local}
              onDownload={handleDownload} onOpenExternal={handleOpenExternal} downloading={downloading} />
          )}

          {(fileType === 'text' || fileType === 'other') && (
            <ViewerFallback color={color} Icon={Icon} message="No inline preview for this file type."
              onDownload={handleDownload} onOpenExternal={handleOpenExternal} downloading={downloading} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes fvModalBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fvModalSheetIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes fvImageIn { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: scale(1); } }
        @keyframes fvHaloPulse { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        @keyframes fvShimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
        @media (prefers-reduced-motion: reduce) {
          .fv-halo, [style*="fvHaloPulse"] { animation: none !important; }
        }
      `}</style>
    </div>,
    document.body
  );
}

/* ── Small chrome-y icon button used in the viewer header ── */
function HeaderIconButton({ children, title, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: '50%', border: 'none', flexShrink: 0,
        background: 'var(--surface-100)', color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
    >
      {children}
    </button>
  );
}

function FooterLink({ children, color, onClick, Icon }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', color, fontWeight: 700, cursor: 'pointer', fontSize: 11.5, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
      <Icon style={{ width: 11, height: 11 }} /> {children}
    </button>
  );
}

function Spinner({ size = 13, color = '#fff', trackAlpha = 0.3 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(120,120,120,${trackAlpha})`, borderTopColor: color,
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}

/* ── Shimmering skeleton shown while a photo loads, in the file's accent ── */
function ImageSkeleton({ color }) {
  return (
    <div style={{
      width: 320, maxWidth: '90%', height: 210, borderRadius: 16,
      background: `linear-gradient(90deg, ${color}0d 25%, ${color}22 37%, ${color}0d 63%)`,
      backgroundSize: '400px 100%', animation: 'fvShimmer 1.3s ease-in-out infinite',
    }} />
  );
}

/* ── Loading overlay shown while a PDF/Office iframe is fetching ── */
function DocSkeleton({ color, label }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--card-bg)',
    }}>
      <Spinner size={26} color={color} trackAlpha={0.18} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}…</span>
    </div>
  );
}

/* ── Polished inline audio player for the modal stage ── */
function AudioStage({ url, name, color, Icon }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause(); else el.play();
  };

  return (
    <div style={{ width: '100%', maxWidth: 380, padding: '40px 28px', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 18px' }}>
        <div style={{
          position: 'absolute', inset: -10, borderRadius: '50%',
          background: `radial-gradient(circle, ${color}30, transparent 70%)`,
          animation: playing ? 'fvHaloPulse 1.6s ease-in-out infinite' : 'none',
        }} />
        <button onClick={toggle} style={{
          position: 'relative', width: 68, height: 68, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {playing
            ? <Pause style={{ width: 24, height: 24, color }} />
            : <Play style={{ width: 24, height: 24, color, marginLeft: 2 }} />}
        </button>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
        {name || 'Voice note'}
      </div>
      <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-100)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: color, borderRadius: 4, transition: 'width 0.1s linear' }} />
      </div>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const { currentTime, duration } = e.currentTarget;
          if (duration) setProgress(currentTime / duration);
        }}
        style={{ display: 'none' }}
      />
    </div>
  );
}

/* ── Fetches an attachment as an ArrayBuffer with a hard timeout, so a
   stalled network request degrades to the error state instead of
   spinning forever. Shared by WordStage and ExcelStage. ── */
function useDocumentBuffer(url, { timeoutMs = 20000 } = {}) {
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [buffer, setBuffer] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setBuffer(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    fetch(url, { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer(); })
      .then((buf) => { if (!cancelled) { setBuffer(buf); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); })
      .finally(() => clearTimeout(timer));

    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [url, timeoutMs]);

  return { state, buffer };
}

/* ── Word (.docx) preview — converted to HTML with mammoth.js and laid
   out as a paper page, entirely client-side. No third-party iframe
   service involved, so nothing outside this browser can reject the
   file. ── */
function WordStage({ url, color, Icon, onDownload, onOpenExternal, downloading }) {
  const { state, buffer } = useDocumentBuffer(url);
  const [html, setHtml] = useState('');
  const [convertError, setConvertError] = useState(false);

  useEffect(() => {
    if (state !== 'ready' || !buffer) return;
    let cancelled = false;
    mammoth.convertToHtml(
      { arrayBuffer: buffer },
      { convertImage: mammoth.images.imgElement((image) => image.read('base64').then((b64) => ({ src: `data:${image.contentType};base64,${b64}` }))) }
    )
      .then((result) => { if (!cancelled) setHtml(result.value); })
      .catch(() => { if (!cancelled) setConvertError(true); });
    return () => { cancelled = true; };
  }, [state, buffer]);

  if (state === 'loading') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '78vh' }}>
        <DocSkeleton color={color} label="Opening document" />
      </div>
    );
  }
  if (state === 'error' || convertError) {
    return (
      <ViewerFallback color={color} Icon={Icon} message="Couldn't read this document — the connection may have dropped."
        onDownload={onDownload} onOpenExternal={onOpenExternal} downloading={downloading} />
    );
  }
  if (!html) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '78vh' }}>
        <DocSkeleton color={color} label="Formatting document" />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '78vh', overflow: 'auto', padding: '32px 16px', background: 'var(--stage-bg, var(--surface-100))' }}>
      <div
        className="fv-docx-page"
        style={{
          maxWidth: 680, margin: '0 auto', background: '#ffffff', color: '#1a1a1a',
          borderRadius: 4, padding: '56px 60px', boxShadow: '0 12px 34px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)',
          minHeight: 400,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{`
        .fv-docx-page { font-family: Georgia, 'Times New Roman', serif; font-size: 14.5px; line-height: 1.65; }
        .fv-docx-page h1, .fv-docx-page h2, .fv-docx-page h3 { font-family: system-ui, -apple-system, sans-serif; font-weight: 700; color: #111; margin: 1.4em 0 0.5em; }
        .fv-docx-page h1 { font-size: 1.7em; } .fv-docx-page h2 { font-size: 1.4em; } .fv-docx-page h3 { font-size: 1.15em; }
        .fv-docx-page p { margin: 0 0 1em; }
        .fv-docx-page table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.92em; }
        .fv-docx-page td, .fv-docx-page th { border: 1px solid #d8d8d8; padding: 6px 9px; }
        .fv-docx-page img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.5em 0; }
        .fv-docx-page ul, .fv-docx-page ol { margin: 0 0 1em; padding-left: 1.6em; }
        .fv-docx-page a { color: ${color}; }
        .fv-docx-page strong { font-weight: 700; }
      `}</style>
    </div>
  );
}

/* ── Excel (.xlsx/.xls) preview — parsed with SheetJS into a real,
   zebra-striped table with tabs for multi-sheet workbooks. Also fully
   client-side, no iframe embed involved. ── */
const EXCEL_ROW_CAP = 500;
const EXCEL_COL_CAP = 60;

function ExcelStage({ url, color, Icon, onDownload, onOpenExternal, downloading }) {
  const { state, buffer } = useDocumentBuffer(url);
  const [sheets, setSheets] = useState(null);      // { names, rowsByName }
  const [activeSheet, setActiveSheet] = useState(null);
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    if (state !== 'ready' || !buffer) return;
    try {
      const wb = XLSX.read(buffer, { type: 'array' });
      const rowsByName = {};
      wb.SheetNames.forEach((n) => {
        rowsByName[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' });
      });
      setSheets({ names: wb.SheetNames, rowsByName });
      setActiveSheet(wb.SheetNames[0]);
    } catch {
      setParseError(true);
    }
  }, [state, buffer]);

  if (state === 'loading') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '78vh' }}>
        <DocSkeleton color={color} label="Opening spreadsheet" />
      </div>
    );
  }
  if (state === 'error' || parseError) {
    return (
      <ViewerFallback color={color} Icon={Icon} message="Couldn't read this spreadsheet — the connection may have dropped."
        onDownload={onDownload} onOpenExternal={onOpenExternal} downloading={downloading} />
    );
  }
  if (!sheets) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '78vh' }}>
        <DocSkeleton color={color} label="Reading rows" />
      </div>
    );
  }

  const rows = sheets.rowsByName[activeSheet] || [];
  const shownRows = rows.slice(0, EXCEL_ROW_CAP);
  const colCount = Math.min(EXCEL_COL_CAP, shownRows.reduce((m, r) => Math.max(m, r.length), 0));
  const truncatedRows = rows.length > EXCEL_ROW_CAP;

  return (
    <div style={{ width: '100%', height: '78vh', display: 'flex', flexDirection: 'column' }}>
      {sheets.names.length > 1 && (
        <div style={{ display: 'flex', gap: 4, padding: '8px 10px 0', overflowX: 'auto', flexShrink: 0 }}>
          {sheets.names.map((n) => (
            <button
              key={n}
              onClick={() => setActiveSheet(n)}
              style={{
                padding: '6px 12px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                background: n === activeSheet ? `${color}18` : 'transparent',
                color: n === activeSheet ? color : 'var(--text-secondary)',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--card-border)', margin: '0 10px 10px', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%' }}>
          <tbody>
            {shownRows.map((row, ri) => (
              <tr key={ri} style={{ background: ri === 0 ? `${color}14` : ri % 2 === 0 ? 'var(--card-bg)' : 'var(--surface-100)' }}>
                {Array.from({ length: colCount }).map((_, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: '6px 12px', borderBottom: '1px solid var(--card-border)', borderRight: '1px solid var(--card-border)',
                      whiteSpace: 'nowrap', color: 'var(--text-primary)',
                      fontWeight: ri === 0 ? 700 : 400,
                    }}
                  >
                    {row[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncatedRows && (
        <div style={{ padding: '0 10px 10px', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', flexShrink: 0 }}>
          Showing first {EXCEL_ROW_CAP} rows of {rows.length} — download for the full sheet.
        </div>
      )}
    </div>
  );
}

/* ── PowerPoint preview — there's no dependable client-side .pptx
   renderer, so this leads with the reliable actions (Download / Open)
   and offers a Google Docs Viewer attempt only as an opt-in, rather
   than auto-loading an iframe that may just show its own error. ── */
function SlidesStage({ url, name, color, Icon, local, onDownload, onOpenExternal, downloading }) {
  const [tryPreview, setTryPreview] = useState(false);
  const [docLoaded, setDocLoaded] = useState(false);
  const officeViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  if (tryPreview && !local) {
    return (
      <div style={{ width: '100%', height: '78vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {!docLoaded && <DocSkeleton color={color} label="Opening slides" />}
          <iframe
            title={name || 'Slides preview'}
            src={officeViewerUrl}
            onLoad={() => setDocLoaded(true)}
            style={{ width: '100%', height: '100%', border: 'none', opacity: docLoaded ? 1 : 0, transition: 'opacity 0.25s ease' }}
          />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
          padding: '9px 10px', fontSize: 11.5, color: 'var(--text-secondary)',
          borderTop: '1px solid var(--card-border)', flexShrink: 0,
        }}>
          <span>Preview not loading?</span>
          <FooterLink color={color} onClick={onOpenExternal} Icon={ExternalLink}>Open in new tab</FooterLink>
          <FooterLink color={color} onClick={onDownload} Icon={Download}>Download instead</FooterLink>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '52px 32px' }}>
      <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 16px' }}>
        <div style={{ position: 'absolute', inset: -10, borderRadius: 20, background: `radial-gradient(circle, ${color}28, transparent 70%)` }} />
        <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 18, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 27, height: 27, color }} />
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 18, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
        Slide decks don't have a dependable inline preview yet — download or open the file directly for the best result.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={onDownload}
          disabled={downloading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 20, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
        >
          {downloading ? <Spinner size={13} color="#fff" trackAlpha={0.35} /> : <Download style={{ width: 14, height: 14 }} />}
          Download
        </button>
        <button
          onClick={onOpenExternal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 20, border: `1px solid ${color}40`, background: 'transparent', color, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
        >
          <ExternalLink style={{ width: 13, height: 13 }} /> Open
        </button>
        {!local && (
          <button
            onClick={() => setTryPreview(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 20, border: 'none', background: 'var(--surface-100)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
          >
            <Eye style={{ width: 13, height: 13 }} /> Try preview
          </button>
        )}
      </div>
    </div>
  );
}

function ViewerFallback({ color, Icon, message, onDownload, onOpenExternal, downloading }) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 32px' }}>
      <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 16px' }}>
        <div style={{
          position: 'absolute', inset: -10, borderRadius: 20,
          background: `radial-gradient(circle, ${color}28, transparent 70%)`,
        }} />
        <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 18, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 27, height: 27, color }} />
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 18, maxWidth: 260, marginLeft: 'auto', marginRight: 'auto' }}>{message}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <button
          onClick={onDownload}
          disabled={downloading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 20,
            border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          }}
        >
          {downloading ? <Spinner size={13} color="#fff" trackAlpha={0.35} /> : <Download style={{ width: 14, height: 14 }} />}
          Download
        </button>
        <button
          onClick={onOpenExternal}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 20,
            border: `1px solid ${color}40`, background: 'transparent', color, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          }}
        >
          <ExternalLink style={{ width: 13, height: 13 }} /> Open
        </button>
      </div>
    </div>
  );
}

/* ── Shared photo bubble: rounded thumbnail, click to view full-size in modal ── */
export function ChatImageBubble({ url, name, mimeType }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const displayUrl = toInlineUrl(url, 'image');

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
          <div style={{ width: '100%', height: 156, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={22} color="#db2777" trackAlpha={0.25} />
          </div>
        )}
        {failed ? (
          <div style={{ width: '100%', height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-secondary)' }}>
            <AlertTriangle style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Couldn't load photo</span>
          </div>
        ) : (
          <img
            src={displayUrl}
            alt={name || 'Shared photo'}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{
              display: loaded ? 'block' : 'none',
              width: '100%', maxHeight: 260, objectFit: 'cover',
              transition: 'transform 0.25s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
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
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${color}55`; e.currentTarget.style.boxShadow = `0 4px 14px ${color}1a`; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.boxShadow = 'none'; }}
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
            ? <Spinner size={12} color={color} trackAlpha={0.15} />
            : <Download style={{ width: 13, height: 13 }} />
          }
        </button>
      </div>

      {viewerOpen && (
        <FileViewerModal
          file={{ url, name, mimeType, fileType, size }}
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