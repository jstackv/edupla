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
    video: '#8b5cf6',
    audio: '#06b6d4',
    text: '#10b981',
    word: '#3b82f6',
    excel: '#059669',
    powerpoint: '#f97316',
    other: '#6366f1',
  };
  return accents[type] || '#6366f1';
}

function getTypeBadge(type, name) {
  const ext = (name || '').split('.').pop().toUpperCase();
  const labels = {
    pdf: 'PDF', image: ext, video: ext, audio: ext,
    text: ext, word: ext, excel: ext, powerpoint: ext, other: ext,
  };
  return labels[type] || ext || 'FILE';
}

export default function ViewerPage() {
  const [dark, setDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const bg = dark ? '#0b0f1a' : '#f1f5f9';
  const cardBg = dark ? '#111827' : '#ffffff';
  const border = dark ? '#1f2937' : '#e2e8f0';
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
          <button onClick={() => window.close()} style={{ marginTop: 20, padding: '10px 20px', borderRadius: 10, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: tp, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
      `}</style>

      {/* ── TOP HEADER BAR ── */}
      <header style={{
        background: headerBg,
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
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#3b5bdb,#7048e8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg,#3b5bdb,#7048e8)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: '0 3px 10px rgba(99,102,241,0.35)' }}
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
              src={fullUrl}
              alt={fileTitle}
              style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 120px)', objectFit: 'contain', borderRadius: 12, boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.15)', display: loading ? 'none' : 'block' }}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError('Failed to load image'); }}
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
          <TextViewer url={fullUrl} fileName={fileName} dark={dark} accent={accent} tp={tp} tm={tm} border={border} cardBg={cardBg} onLoad={() => setLoading(false)} />
        )}

        {/* Office docs — Google Docs Viewer fallback message for localhost */}
        {['word', 'excel', 'powerpoint', 'other'].includes(fileType) && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, minHeight: 'calc(100vh - 60px)' }}>
            <div style={{ textAlign: 'center', maxWidth: 440 }}>
              <div style={{ width: 80, height: 80, borderRadius: 20, background: `${accent}15`, border: `2px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <TypeIcon size={36} color={accent} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: 22, marginBottom: 12, color: tp, letterSpacing: '-0.03em' }}>{fileTitle}</h3>
              {fileDesc && <p style={{ fontSize: 14, color: tm, marginBottom: 20, lineHeight: 1.6 }}>{fileDesc}</p>}
              <div style={{ padding: '16px 20px', borderRadius: 14, background: dark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: dark ? '#fbbf24' : '#92400e', lineHeight: 1.6 }}>
                  <strong>Preview unavailable on local server.</strong> On a deployed server this would open in Google Docs Viewer. Use the Download button to open the file in your local application.
                </p>
              </div>
              <button
                onClick={handleDownload}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: `linear-gradient(135deg,${accent},${accent}cc)`, color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: `0 6px 20px ${accent}40` }}
              >
                <Download size={16} /> Download & Open
              </button>
            </div>
          </div>
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
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#6366f1', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
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
function TextViewer({ url, fileName, dark, accent, tp, tm, border, cardBg, onLoad }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const ext = (fileName || '').split('.').pop().toLowerCase();

  useEffect(() => {
    fetch(url, { credentials: 'include' })
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