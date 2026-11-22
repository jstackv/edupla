/**
 * ViewerPage — renders at /view-doc?url=...&type=...&name=...
 * Opens in a new tab when the Eye icon is clicked on any document.
 *
 * Shows a minimal, styled wrapper with file metadata at the top,
 * then renders the file inline (PDF embed, <img>, <video>, <audio>,
 * or <iframe> for text). Includes a Download button in the header.
 */
import { useState, useEffect } from 'react';
import {
  FileText, Download, ArrowLeft, Eye, FileImage,
  Film, Music, Code2, GraduationCap, BookOpen,
  AlertTriangle, Loader2
} from 'lucide-react';
import PdfViewer from '../components/common/PdfViewer';

function getIconForType(type) {
  const icons = {
    pdf: FileText,
    image: FileImage,
    video: Film,
    audio: Music,
    text: Code2,
    word: FileText,
    excel: FileText,
    powerpoint: FileText,
    other: FileText,
  };
  return icons[type] || FileText;
}

function getAccentForType(type) {
  const accents = {
    pdf: '#ef4444',
    image: '#ec4899',
    video: '#c2410c',
    audio: '#06b6d4',
    text: '#10b981',
    word: '#3b82f6',
    excel: '#059669',
    powerpoint: '#c2410c',
    other: '#c2410c',
  };
  return accents[type] || '#c2410c';
}

function getTypeBadge(type, name) {
  const ext = (name || '').split('.').pop().toUpperCase();
  const labels = {
    pdf: 'PDF', image: ext, video: ext, audio: ext,
    text: ext, word: ext, excel: ext, powerpoint: ext, other: ext,
  };
  return labels[type] || ext || 'FILE';
}

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif', ico: 'image/x-icon',
};
function mimeFromName(name = '') {
  return MIME_BY_EXT[(name.split('.').pop() || '').toLowerCase()] || 'image/jpeg';
}

export default function ViewerPage() {
  const [dark, setDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imgSrc, setImgSrc] = useState('');

  const params = new URLSearchParams(window.location.search);
  const fileUrl = params.get('url');
  const fileType = params.get('type') || 'other';
  const fileName = params.get('name') || 'Document';
  const fileTitle = params.get('title') || fileName;
  const fileDownloadName = params.get('download_name') || fileName;
  const fileDesc = params.get('description') || '';
  const className = params.get('class_name') || '';
  const isDirect = params.get('direct') === '1'; // file_url is already an absolute Cloudinary URL
  const fullUrl = fileUrl
    ? (isDirect ? fileUrl : `${window.location.origin}${fileUrl}`)
    : null;

  useEffect(() => {
    document.title = `${fileTitle} — EDUPLA Viewer`;
  }, [fileTitle]);

  const handleDownload = async () => {
    try {
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileDownloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // fallback
      const a = document.createElement('a');
      a.href = fullUrl; a.download = fileDownloadName; a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  };

  const TypeIcon = getIconForType(fileType);
  const accent = getAccentForType(fileType);
  const badge = getTypeBadge(fileType, fileName);

  const bg = dark ? '#0a0a0a' : '#f1f5f9';
  const cardBg = dark ? '#131313' : '#ffffff';
  const border = dark ? '#2e2e2e' : '#e2e8f0';
  const tp = dark ? '#f1f5f9' : '#0f172a';
  const tm = dark ? '#94a3b8' : '#64748b';
  const headerBg = dark ? '#0d1117' : '#ffffff';

  if (!fileUrl) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: tp }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>No document specified</h2>
          <p style={{ color: tm, fontSize: 14 }}>This viewer requires a document URL parameter.</p>
          <button onClick={() => window.close()} style={{ marginTop: 20, padding: '10px 20px', borderRadius: 10, background: '#c2410c', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: tp, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
      `}</style>

      {/* ── TOP HEADER BAR ── */}
      <header style={{
        background: dark ? 'rgba(13,17,23,0.85)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: dark ? '0 1px 0 rgba(255,255,255,0.04)' : '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#ea580c,#9a3412)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={15} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.03em', color: tp }}>EDUPLA</span>
        </div>

        <div style={{ width: 1, height: 24, background: border }} />

        {/* File type badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 8, background: `${accent}15`, border: `1px solid ${accent}30` }}>
          <TypeIcon size={13} color={accent} />
          <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.05em' }}>{badge}</span>
        </div>

        {/* File name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: tp, letterSpacing: '-0.01em', truncate: true, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{fileTitle}</p>
          {(fileDesc || className) && (
            <p style={{ fontSize: 11, color: tm, marginTop: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {className && <><BookOpen size={10} style={{ display: 'inline', marginRight: 4 }} />{className}{fileDesc ? ' · ' : ''}</>}
              {fileDesc}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Theme toggle */}
          <button
            onClick={() => setDark(d => !d)}
            style={{ width: 36, height: 36, borderRadius: 9, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}
          >
            {dark ? '☀️' : '🌙'}
          </button>

          {/* Download button */}
          <button
            onClick={handleDownload}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg,#ea580c,#9a3412)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: '0 3px 10px rgba(194, 65, 12,0.35)' }}
          >
            <Download size={14} /> Download
          </button>
        </div>
      </header>

      {/* ── CONTENT AREA ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* PDF viewer */}
        {fileType === 'pdf' && (
          <PdfViewer
            url={fullUrl}
            title={fileTitle}
            dark={dark}
            accent={accent}
            tp={tp}
            tm={tm}
            border={border}
            cardBg={cardBg}
            bg={bg}
            onDownload={handleDownload}
          />
        )}

        {/* Image viewer */}
        {fileType === 'image' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 'calc(100vh - 60px)', background: dark ? '#060912' : '#f8faff' }}>
            {loading && (
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, border: `3px solid ${accent}30`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
              </div>
            )}
            <img
              src={imgSrc || fullUrl}
              alt={fileTitle}
              style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 120px)', objectFit: 'contain', borderRadius: 12, boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.15)', display: loading ? 'none' : 'block' }}
              onLoad={() => setLoading(false)}
              onError={async () => {
                // Some stored files are served without an image content-type
                // (older uploads). Fetch the bytes and show them with the right
                // type instead of giving up — one retry only.
                if (imgSrc) { setLoading(false); setError('This image could not be displayed. Try downloading it instead.'); return; }
                try {
                  const r = await fetch(fullUrl, { credentials: isDirect ? 'omit' : 'include' });
                  if (!r.ok) throw new Error(`HTTP ${r.status}`);
                  const buf = await r.arrayBuffer();
                  setImgSrc(URL.createObjectURL(new Blob([buf], { type: mimeFromName(fileName) })));
                } catch (e) {
                  setLoading(false);
                  setError('This image could not be loaded. Try downloading it instead.');
                }
              }}
            />
          </div>
        )}

        {/* Video player */}
        {fileType === 'video' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#000', minHeight: 'calc(100vh - 60px)' }}>
            <video
              controls
              autoPlay={false}
              style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 120px)', borderRadius: 12 }}
              onLoadedData={() => setLoading(false)}
              onError={() => { setLoading(false); setError('Failed to load video'); }}
            >
              <source src={fullUrl} />
              Your browser does not support video playback.
            </video>
          </div>
        )}

        {/* Audio player */}
        {fileType === 'audio' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)', padding: 40 }}>
            <div style={{ textAlign: 'center', width: '100%', maxWidth: 500 }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}30, ${accent}10)`, border: `2px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
                <Music size={40} color={accent} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: tp }}>{fileTitle}</h3>
              {className && <p style={{ fontSize: 13, color: tm, marginBottom: 24 }}>{className}</p>}
              <audio
                controls
                style={{ width: '100%', borderRadius: 12 }}
                onLoadedData={() => setLoading(false)}
                onError={() => { setLoading(false); setError('Failed to load audio'); }}
              >
                <source src={fullUrl} />
              </audio>
            </div>
          </div>
        )}

        {/* Text / code viewer */}
        {fileType === 'text' && (
          <TextViewer url={fullUrl} direct={isDirect} fileName={fileName} dark={dark} accent={accent} tp={tp} tm={tm} border={border} cardBg={cardBg} onLoad={() => setLoading(false)} />
        )}

        {/* Word / Excel — rendered right here in the browser */}
        {fileType === 'word' && (
          <WordViewer url={fullUrl} direct={isDirect} fileName={fileName} accent={accent} tp={tp} tm={tm} dark={dark}
            fallback={(msg) => <FallbackPanel Icon={TypeIcon} accent={accent} tp={tp} tm={tm} dark={dark} title={fileTitle} desc={fileDesc} message={msg} onDownload={handleDownload} />} />
        )}
        {fileType === 'excel' && (
          <ExcelViewer url={fullUrl} direct={isDirect} accent={accent} tp={tp} tm={tm} dark={dark} border={border} cardBg={cardBg}
            fallback={(msg) => <FallbackPanel Icon={TypeIcon} accent={accent} tp={tp} tm={tm} dark={dark} title={fileTitle} desc={fileDesc} message={msg} onDownload={handleDownload} />} />
        )}

        {/* PowerPoint and anything else a browser can't draw */}
        {['powerpoint', 'other'].includes(fileType) && (
          <FallbackPanel Icon={TypeIcon} accent={accent} tp={tp} tm={tm} dark={dark} title={fileTitle} desc={fileDesc}
            message="This type of file can't be previewed in the browser. Download it to open it in the app that made it." onDownload={handleDownload} />
        )}

        {/* Error state */}
        {error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: tp }}>Failed to load document</h3>
              <p style={{ fontSize: 14, color: tm, marginBottom: 20 }}>{error}</p>
              <button
                onClick={handleDownload}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#c2410c', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
              >
                <Download size={14} /> Try Download Instead
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

/* ── Async text/code viewer ── */
function TextViewer({ url, direct, fileName, dark, accent, tp, tm, border, cardBg, onLoad }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const ext = (fileName || '').split('.').pop().toLowerCase();

  useEffect(() => {
    fetch(url, { credentials: direct ? 'omit' : 'include' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => { setContent(text); setLoading(false); onLoad?.(); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [url]);

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${accent}30`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 14, color: tm }}>Loading…</p>
      </div>
    </div>
  );

  if (err) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <p style={{ color: '#ef4444', fontSize: 14 }}>Failed to load: {err}</p>
    </div>
  );

  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', minHeight: 'calc(100vh - 60px)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <pre style={{
          fontFamily: "'Fira Code', 'JetBrains Mono', 'Menlo', monospace",
          fontSize: 13.5,
          lineHeight: 1.75,
          color: tp,
          background: cardBg,
          border: `1px solid ${border}`,
          borderRadius: 14,
          padding: 28,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)',
          overflowX: 'auto',
        }}>
          {content}
        </pre>
      </div>
    </div>
  );
}

/* ── Shared: fetch a file as an ArrayBuffer ──
   Files stored on Cloudinary ("direct") are fetched without cookies — a
   wildcard CORS answer is refused when credentials are included. Files
   served by our own API keep their cookie/token. */
function useBuffer(url, direct) {
  const [state, setState] = useState('loading');
  const [buffer, setBuffer] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    const ctl = new AbortController();
    setState('loading');
    fetch(url, { credentials: direct ? 'omit' : 'include', signal: ctl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then(b => { if (!cancelled) { setBuffer(b); setState('ready'); } })
      .catch(e => { if (!cancelled) { setErr(e.message || 'failed'); setState('error'); } });
    return () => { cancelled = true; ctl.abort(); };
  }, [url, direct]);
  return { state, buffer, err };
}

function Busy({ accent, tm, label }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${accent}30`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 14, color: tm }}>{label}</p>
      </div>
    </div>
  );
}

/* Shown when a file can't be drawn in the browser: says why, offers download. */
function FallbackPanel({ Icon, accent, tp, tm, dark, title, desc, message, onDownload }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, minHeight: 'calc(100vh - 60px)' }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: `${accent}15`, border: `2px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Icon size={36} color={accent} />
        </div>
        <h3 style={{ fontWeight: 800, fontSize: 22, marginBottom: 12, color: tp, letterSpacing: '-0.03em' }}>{title}</h3>
        {desc && <p style={{ fontSize: 14, color: tm, marginBottom: 20, lineHeight: 1.6 }}>{desc}</p>}
        <div style={{ padding: '16px 20px', borderRadius: 14, background: dark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: dark ? '#fbbf24' : '#92400e', lineHeight: 1.6 }}>{message}</p>
        </div>
        <button onClick={onDownload}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: `linear-gradient(135deg,${accent},${accent}cc)`, color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: `0 6px 20px ${accent}40` }}>
          <Download size={16} /> Download &amp; Open
        </button>
      </div>
    </div>
  );
}

/* ── Word (.docx): converted to HTML with mammoth and shown as a page ── */
function WordViewer({ url, direct, fileName, accent, tp, tm, dark, fallback }) {
  const isOldDoc = /\.doc$/i.test(fileName || '');
  const { state, buffer } = useBuffer(isOldDoc ? null : url, direct);
  const [html, setHtml] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isOldDoc || state !== 'ready' || !buffer) return;
    let cancelled = false;
    import('mammoth').then(({ default: mammoth }) =>
      mammoth.convertToHtml(
        { arrayBuffer: buffer },
        { convertImage: mammoth.images.imgElement(img => img.read('base64').then(b64 => ({ src: `data:${img.contentType};base64,${b64}` }))) }
      )
    )
      .then(r => { if (!cancelled) setHtml(r.value || '<p><em>This document is empty.</em></p>'); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [state, buffer, isOldDoc]);

  if (isOldDoc) return fallback('Older Word files (.doc) can\'t be previewed in the browser. Download it to open in Word — .docx files open right here.');
  if (state === 'error' || failed) return fallback("Couldn't read this document. Download it to open in Word.");
  if (state === 'loading' || !html) return <Busy accent={accent} tm={tm} label="Opening document…" />;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px 16px', background: dark ? '#060912' : '#eef1f6' }}>
      <div className="vp-docx-page" style={{ maxWidth: 820, margin: '0 auto', background: '#ffffff', color: '#1a1a1a', borderRadius: 6, padding: '56px 64px', boxShadow: '0 12px 34px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)', minHeight: 480 }}
        dangerouslySetInnerHTML={{ __html: html }} />
      <style>{`
        .vp-docx-page { font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.7; word-wrap: break-word; }
        .vp-docx-page h1, .vp-docx-page h2, .vp-docx-page h3 { font-family: system-ui, -apple-system, sans-serif; font-weight: 700; color: #111; margin: 1.4em 0 0.5em; }
        .vp-docx-page h1 { font-size: 1.7em; } .vp-docx-page h2 { font-size: 1.4em; } .vp-docx-page h3 { font-size: 1.15em; }
        .vp-docx-page p { margin: 0 0 1em; }
        .vp-docx-page table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.92em; }
        .vp-docx-page td, .vp-docx-page th { border: 1px solid #d0d0d0; padding: 6px 9px; vertical-align: top; }
        .vp-docx-page img { max-width: 100%; height: auto; margin: 0.5em 0; }
        .vp-docx-page ul, .vp-docx-page ol { margin: 0 0 1em; padding-left: 1.6em; }
        .vp-docx-page a { color: ${accent}; }
        @media (max-width: 640px) { .vp-docx-page { padding: 28px 20px !important; } }
      `}</style>
    </div>
  );
}

/* ── Excel (.xlsx / .xls): parsed with SheetJS into tabs + a real table ── */
const ROW_CAP = 500;
const COL_CAP = 60;
function ExcelViewer({ url, direct, accent, tp, tm, dark, border, cardBg, fallback }) {
  const { state, buffer } = useBuffer(url, direct);
  const [sheets, setSheets] = useState(null);
  const [active, setActive] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (state !== 'ready' || !buffer) return;
    let cancelled = false;
    import('xlsx').then(XLSX => {
      if (cancelled) return;
      const wb = XLSX.read(buffer, { type: 'array' });
      const rowsByName = {};
      wb.SheetNames.forEach(n => { rowsByName[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }); });
      setSheets({ names: wb.SheetNames, rowsByName });
      setActive(wb.SheetNames[0]);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [state, buffer]);

  if (state === 'error' || failed) return fallback("Couldn't read this spreadsheet. Download it to open in Excel.");
  if (state === 'loading' || !sheets) return <Busy accent={accent} tm={tm} label="Opening spreadsheet…" />;

  const rows = (sheets.rowsByName[active] || []);
  const shown = rows.slice(0, ROW_CAP);
  const cols = Math.min(COL_CAP, shown.reduce((m, r) => Math.max(m, r.length), 0));
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {sheets.names.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: `1px solid ${border}`, overflowX: 'auto', background: cardBg }}>
          {sheets.names.map(n => (
            <button key={n} onClick={() => setActive(n)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', border: `1px solid ${n === active ? accent : border}`, background: n === active ? accent : 'transparent', color: n === active ? '#fff' : tm }}>{n}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {shown.length === 0 ? <p style={{ color: tm, fontSize: 14, textAlign: 'center', padding: 40 }}>This sheet is empty.</p> : (
          <table style={{ borderCollapse: 'collapse', fontSize: 13, color: tp, background: cardBg }}>
            <tbody>
              {shown.map((r, ri) => (
                <tr key={ri} style={{ background: ri === 0 ? `${accent}18` : ri % 2 ? (dark ? '#ffffff05' : '#f8fafc') : 'transparent' }}>
                  <td style={{ padding: '5px 8px', border: `1px solid ${border}`, color: tm, fontSize: 11, textAlign: 'right', position: 'sticky', left: 0, background: cardBg }}>{ri + 1}</td>
                  {Array.from({ length: cols }, (_, ci) => (
                    <td key={ci} style={{ padding: '5px 10px', border: `1px solid ${border}`, whiteSpace: 'nowrap', fontWeight: ri === 0 ? 700 : 400 }}>{r[ci] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > ROW_CAP && <p style={{ color: tm, fontSize: 12, textAlign: 'center', padding: 14 }}>Showing the first {ROW_CAP} of {rows.length} rows — download the file to see everything.</p>}
      </div>
    </div>
  );
}
