/**
 * PdfViewer — custom, in-app PDF rendering with pdf.js.
 *
 * Replaces embedding the browser's native PDF plugin in an <iframe>. Renders
 * pages onto <canvas>, with a styled thumbnail rail, zoom controls, and page
 * navigation that match the rest of the app's theme instead of the browser's
 * generic PDF toolbar.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, PanelLeftClose,
  PanelLeft, Maximize2, AlertTriangle, Download,
} from 'lucide-react';

let pdfjsLibPromise = null;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${mod.version}/pdf.worker.min.mjs`;
      return mod;
    });
  }
  return pdfjsLibPromise;
}

export default function PdfViewer({ url, title, dark, accent, tp, tm, border, cardBg, bg, onDownload }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [scale, setScale] = useState(1.1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [thumbUrls, setThumbUrls] = useState({});

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const thumbRenderedRef = useRef(new Set());

  // Load the document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setNumPages(0);
    setPageNum(1);
    setPageInput('1');
    thumbRenderedRef.current = new Set();
    setThumbUrls({});

    loadPdfjs()
      .then((pdfjsLib) => pdfjsLib.getDocument(url).promise)
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load PDF');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url]);

  // Render the current page onto the main canvas
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;

    (async () => {
      const page = await pdfDoc.getPage(pageNum);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* noop */ }
      }
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
      const task = page.render({ canvasContext: ctx, viewport, transform });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') console.error(err);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, pageNum, scale]);

  // Lazily render thumbnails once the doc is ready
  useEffect(() => {
    if (!pdfDoc || !numPages) return;
    let cancelled = false;

    (async () => {
      for (let i = 1; i <= numPages; i++) {
        if (cancelled) return;
        if (thumbRenderedRef.current.has(i)) continue;
        thumbRenderedRef.current.add(i);
        try {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.22 });
          const c = document.createElement('canvas');
          c.width = viewport.width;
          c.height = viewport.height;
          await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
          if (cancelled) return;
          const dataUrl = c.toDataURL();
          setThumbUrls((prev) => ({ ...prev, [i]: dataUrl }));
        } catch {
          // skip a bad page's thumbnail, keep going
        }
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, numPages]);

  const goToPage = useCallback((n) => {
    const clamped = Math.min(Math.max(1, n), numPages || 1);
    setPageNum(clamped);
    setPageInput(String(clamped));
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [numPages]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') goToPage(pageNum + 1);
      if (e.key === 'ArrowLeft') goToPage(pageNum - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageNum, goToPage]);

  const zoomIn = () => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.4, +(s - 0.15).toFixed(2)));
  const resetZoom = () => setScale(1.1);

  const toolbarBg = dark ? '#0d1117' : '#ffffff';
  const railBg = dark ? '#0b0f1a' : '#f8fafc';
  const pageBg = dark ? '#060912' : '#eef1f6';
  const chipBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <AlertTriangle size={44} color="#f59e0b" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, color: tp }}>Couldn't render this PDF</h3>
          <p style={{ fontSize: 13, color: tm, marginBottom: 18 }}>{error}</p>
          {onDownload && (
            <button
              onClick={onDownload}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: accent, color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}
            >
              <Download size={14} /> Download instead
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)' }}>
      {/* Secondary toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        background: toolbarBg, borderBottom: `1px solid ${border}`, flexShrink: 0,
      }}>
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          title={sidebarOpen ? 'Hide thumbnails' : 'Show thumbnails'}
          style={iconBtnStyle(dark)}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>

        <div style={{ width: 1, height: 20, background: border, margin: '0 4px' }} />

        <button onClick={() => goToPage(pageNum - 1)} disabled={pageNum <= 1} title="Previous page" style={iconBtnStyle(dark, pageNum <= 1)}>
          <ChevronLeft size={16} />
        </button>
        <form
          onSubmit={(e) => { e.preventDefault(); goToPage(parseInt(pageInput, 10) || 1); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => goToPage(parseInt(pageInput, 10) || 1)}
            style={{
              width: 40, textAlign: 'center', fontSize: 13, fontWeight: 600, color: tp,
              background: chipBg, border: `1px solid ${border}`, borderRadius: 7, padding: '5px 0',
            }}
          />
          <span style={{ fontSize: 13, color: tm }}>/ {numPages || '—'}</span>
        </form>
        <button onClick={() => goToPage(pageNum + 1)} disabled={pageNum >= numPages} title="Next page" style={iconBtnStyle(dark, pageNum >= numPages)}>
          <ChevronRight size={16} />
        </button>

        <div style={{ width: 1, height: 20, background: border, margin: '0 4px' }} />

        <button onClick={zoomOut} title="Zoom out" style={iconBtnStyle(dark)}><ZoomOut size={16} /></button>
        <button onClick={resetZoom} title="Reset zoom" style={{ fontSize: 12, fontWeight: 600, color: tm, background: 'transparent', border: 'none', cursor: 'pointer', minWidth: 44 }}>
          {Math.round(scale * 100)}%
        </button>
        <button onClick={zoomIn} title="Zoom in" style={iconBtnStyle(dark)}><ZoomIn size={16} /></button>
        <button onClick={resetZoom} title="Fit / reset" style={iconBtnStyle(dark)}><Maximize2 size={16} /></button>

        {numPages > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: accent, background: `${accent}15`, border: `1px solid ${accent}30`, padding: '4px 10px', borderRadius: 999 }}>
            {numPages} PAGE{numPages === 1 ? '' : 'S'}
          </span>
        )}
      </div>

      {/* Body: thumbnail rail + page canvas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {sidebarOpen && (
          <div style={{
            width: 148, flexShrink: 0, overflowY: 'auto', background: railBg,
            borderRight: `1px solid ${border}`, padding: 12,
          }}>
            {loading && (
              <p style={{ fontSize: 12, color: tm, textAlign: 'center', marginTop: 20 }}>Loading pages…</p>
            )}
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => goToPage(n)}
                style={{
                  display: 'block', width: '100%', marginBottom: 10, padding: 4,
                  borderRadius: 9, cursor: 'pointer',
                  background: n === pageNum ? `${accent}18` : 'transparent',
                  border: n === pageNum ? `2px solid ${accent}` : `2px solid transparent`,
                }}
              >
                <div style={{
                  width: '100%', aspectRatio: '0.72', borderRadius: 5, overflow: 'hidden',
                  background: cardBg, border: `1px solid ${border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {thumbUrls[n]
                    ? <img src={thumbUrls[n]} alt={`Page ${n}`} style={{ width: '100%', display: 'block' }} />
                    : <div style={{ width: 14, height: 14, border: `2px solid ${accent}30`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                </div>
                <span style={{ display: 'block', textAlign: 'center', fontSize: 10.5, fontWeight: 600, color: n === pageNum ? accent : tm, marginTop: 4 }}>
                  {n}
                </span>
              </button>
            ))}
          </div>
        )}

        <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: pageBg, display: 'flex', justifyContent: 'center', padding: '28px 20px' }}>
          {loading ? (
            <div style={{ alignSelf: 'center', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, border: `3px solid ${accent}30`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: tm }}>Loading PDF…</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{ boxShadow: dark ? '0 10px 40px rgba(0,0,0,0.6)' : '0 10px 40px rgba(15,23,42,0.15)', borderRadius: 4, background: '#fff', height: 'fit-content' }}
              aria-label={title}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function iconBtnStyle(dark, disabled) {
  return {
    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, background: 'transparent', border: 'none',
    color: disabled ? (dark ? '#3f4a5f' : '#cbd5e1') : (dark ? '#cbd5e1' : '#475569'),
    cursor: disabled ? 'default' : 'pointer',
  };
}