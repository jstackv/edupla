/**
 * PdfViewer — custom, in-app PDF rendering with pdf.js.
 *
 * Continuous-scroll viewer: every page is mounted in a single vertically
 * scrolling column (like Google Drive / Notion's PDF preview) rather than
 * showing one page at a time. Pages lazily draw onto their own <canvas> as
 * the document loads, a scroll-synced thumbnail rail tracks the page
 * currently in view, and zoom re-renders every page in place.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, PanelLeftClose,
  PanelLeft, Maximize2, AlertTriangle, Download, ArrowUp, FileText,
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
  const [pageNum, setPageNum] = useState(1);         // page currently in view (scroll-driven)
  const [pageInput, setPageInput] = useState('1');
  const [scale, setScale] = useState(1.15);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [thumbUrls, setThumbUrls] = useState({});
  const [pageSizes, setPageSizes] = useState({});     // n -> {width,height} @ scale 1
  const [renderedPages, setRenderedPages] = useState(() => new Set());
  const [renderProgress, setRenderProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const containerRef = useRef(null);
  const wrapperRefs = useRef({});
  const canvasRefs = useRef({});
  const thumbBtnRefs = useRef({});
  const pageObjectsRef = useRef({});
  const renderedAtRef = useRef({});
  const renderTaskRef = useRef({});
  const scaleRef = useRef(scale);
  const thumbRenderedRef = useRef(new Set());
  const loadTokenRef = useRef(0);

  useEffect(() => { scaleRef.current = scale; }, [scale]);

  // ── Load the document ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const token = ++loadTokenRef.current;
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setNumPages(0);
    setPageNum(1);
    setPageInput('1');
    setPageSizes({});
    setThumbUrls({});
    setRenderedPages(new Set());
    setRenderProgress(0);
    pageObjectsRef.current = {};
    renderedAtRef.current = {};
    wrapperRefs.current = {};
    canvasRefs.current = {};
    thumbRenderedRef.current = new Set();

    loadPdfjs()
      .then((pdfjsLib) => pdfjsLib.getDocument(url).promise)
      .then((doc) => {
        if (cancelled || loadTokenRef.current !== token) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || loadTokenRef.current !== token) return;
        setError(err?.message || 'Failed to load PDF');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url]);

  // ── Render one page onto its canvas at the current scale ──────────
  const renderPage = useCallback(async (doc, n) => {
    if (!doc) return;
    try {
      const page = pageObjectsRef.current[n] || await doc.getPage(n);
      pageObjectsRef.current[n] = page;
      const currentScale = scaleRef.current;
      const canvas = canvasRefs.current[n];
      if (!canvas) return;
      const viewport = page.getViewport({ scale: currentScale });
      const ctx = canvas.getContext('2d');
      // Always rasterize at a minimum of 2x pixel density — on a standard
      // (non-Retina) monitor, devicePixelRatio is 1, which renders pages at
      // native on-screen size and looks noticeably softer than a real PDF
      // viewer. Cap at 3x so very high-DPR devices don't blow up memory.
      const outputScale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      if (renderTaskRef.current[n]) {
        try { renderTaskRef.current[n].cancel(); } catch { /* noop */ }
      }
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
      const task = page.render({ canvasContext: ctx, viewport, transform });
      renderTaskRef.current[n] = task;
      await task.promise;
      renderedAtRef.current[n] = currentScale;
      setRenderedPages((prev) => (prev.has(n) ? prev : new Set(prev).add(n)));
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') console.error(err);
    }
  }, []);

  // ── Fetch page geometry, then render pages in order ────────────────
  useEffect(() => {
    if (!pdfDoc || !numPages) return;
    let cancelled = false;

    (async () => {
      const sizes = {};
      for (let i = 1; i <= numPages; i++) {
        if (cancelled) return;
        try {
          const page = pageObjectsRef.current[i] || await pdfDoc.getPage(i);
          pageObjectsRef.current[i] = page;
          const vp = page.getViewport({ scale: 1 });
          sizes[i] = { width: vp.width, height: vp.height };
        } catch { /* skip a bad page */ }
      }
      if (cancelled) return;
      setPageSizes(sizes);

      for (let i = 1; i <= numPages; i++) {
        if (cancelled) return;
        await renderPage(pdfDoc, i);
        if (!cancelled) setRenderProgress(i);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, numPages, renderPage]);

  // ── Re-render already-drawn pages when zoom changes ─────────────────
  useEffect(() => {
    if (!pdfDoc || !numPages) return;
    let cancelled = false;
    (async () => {
      // Prioritize the page currently in view so zoom feels instant there.
      const order = [pageNum, ...Array.from({ length: numPages }, (_, i) => i + 1)];
      const seen = new Set();
      for (const n of order) {
        if (cancelled) return;
        if (seen.has(n)) continue;
        seen.add(n);
        if (renderedAtRef.current[n] === scale) continue;
        if (!renderedPages.has(n)) continue; // not drawn yet, initial pass will handle it
        await renderPage(pdfDoc, n);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  // ── Thumbnails (small, independent scale) ───────────────────────────
  useEffect(() => {
    if (!pdfDoc || !numPages) return;
    let cancelled = false;

    (async () => {
      for (let i = 1; i <= numPages; i++) {
        if (cancelled) return;
        if (thumbRenderedRef.current.has(i)) continue;
        thumbRenderedRef.current.add(i);
        try {
          const page = pageObjectsRef.current[i] || await pdfDoc.getPage(i);
          pageObjectsRef.current[i] = page;
          const viewport = page.getViewport({ scale: 0.22 });
          const c = document.createElement('canvas');
          c.width = viewport.width;
          c.height = viewport.height;
          await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
          if (cancelled) return;
          const dataUrl = c.toDataURL();
          setThumbUrls((prev) => ({ ...prev, [i]: dataUrl }));
        } catch { /* skip a bad page's thumbnail, keep going */ }
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, numPages]);

  // ── Track which page is in view while scrolling ─────────────────────
  useEffect(() => {
    if (!numPages || !containerRef.current) return;
    const el = containerRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        let best = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
        }
        if (best) {
          const n = Number(best.target.dataset.page);
          setPageNum((prev) => (prev === n ? prev : n));
          setPageInput((prev) => (prev === String(n) ? prev : String(n)));
        }
      },
      { root: el, threshold: [0.15, 0.3, 0.5, 0.7, 0.9] }
    );

    Object.values(wrapperRefs.current).forEach((node) => node && observer.observe(node));

    const onScroll = () => setShowScrollTop(el.scrollTop > 600);
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', onScroll);
    };
  }, [numPages]);

  // Keep the active thumbnail in view as the page changes.
  useEffect(() => {
    thumbBtnRefs.current[pageNum]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [pageNum]);

  const goToPage = useCallback((n) => {
    const clamped = Math.min(Math.max(1, n), numPages || 1);
    setPageInput(String(clamped));
    wrapperRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [numPages]);

  const scrollTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goToPage(pageNum + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goToPage(pageNum - 1);
      if (e.key === 'Home') goToPage(1);
      if (e.key === 'End') goToPage(numPages);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageNum, numPages, goToPage]);

  const zoomIn = () => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.4, +(s - 0.15).toFixed(2)));
  const resetZoom = () => setScale(1.15);

  const toolbarBg = dark ? 'rgba(13,17,23,0.82)' : 'rgba(255,255,255,0.82)';
  const railBg = dark ? '#0b0f1a' : '#f8fafc';
  const pageBg = dark ? '#05070d' : '#e7ebf2';
  const chipBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const dotColor = dark ? 'rgba(255,255,255,0.045)' : 'rgba(15,23,42,0.05)';

  const allRendered = numPages > 0 && renderProgress >= numPages;

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
      <style>{`
        .pv-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .pv-scroll::-webkit-scrollbar-track { background: transparent; }
        .pv-scroll::-webkit-scrollbar-thumb {
          background: ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.16)'};
          border-radius: 999px; border: 2px solid transparent; background-clip: padding-box;
        }
        .pv-scroll::-webkit-scrollbar-thumb:hover { background: ${accent}80; background-clip: padding-box; }
        .pv-page-wrap { position: relative; }
        .pv-page-badge {
          opacity: 0; transform: translateY(4px);
          transition: opacity .18s ease, transform .18s ease;
        }
        .pv-page-wrap:hover .pv-page-badge { opacity: 1; transform: translateY(0); }
        @keyframes pv-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        @keyframes pv-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pv-pop-in { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Secondary toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
        background: toolbarBg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`, flexShrink: 0, position: 'sticky', top: 0, zIndex: 20,
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
              outline: 'none', transition: 'border-color .15s ease',
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
        <button onClick={resetZoom} title="Reset zoom" style={iconBtnStyle(dark)}><Maximize2 size={16} /></button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {!allRendered && numPages > 0 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
              color: tm, background: chipBg, padding: '4px 10px', borderRadius: 999,
              animation: 'pv-fade-in .2s ease',
            }}>
              <span style={{ width: 11, height: 11, border: `2px solid ${accent}40`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Rendering {renderProgress}/{numPages}
            </span>
          )}
          {numPages > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: accent, background: `${accent}15`, border: `1px solid ${accent}30`, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
              {numPages} PAGE{numPages === 1 ? '' : 'S'}
            </span>
          )}
        </div>
      </div>

      {/* Body: thumbnail rail + continuous page scroll */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {sidebarOpen && (
          <div className="pv-scroll" style={{
            width: 156, flexShrink: 0, overflowY: 'auto', background: railBg,
            borderRight: `1px solid ${border}`, padding: '14px 12px',
          }}>
            <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', color: tm, textTransform: 'uppercase', margin: '2px 4px 12px' }}>
              Pages
            </p>
            {loading && (
              <p style={{ fontSize: 12, color: tm, textAlign: 'center', marginTop: 20 }}>Loading pages…</p>
            )}
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                ref={(el) => { thumbBtnRefs.current[n] = el; }}
                onClick={() => goToPage(n)}
                style={{
                  display: 'block', width: '100%', marginBottom: 10, padding: 4,
                  borderRadius: 10, cursor: 'pointer', background: 'transparent', border: 'none',
                  transition: 'transform .15s ease',
                }}
              >
                <div style={{
                  width: '100%', aspectRatio: '0.72', borderRadius: 6, overflow: 'hidden',
                  background: cardBg,
                  border: n === pageNum ? `2px solid ${accent}` : `1.5px solid ${border}`,
                  boxShadow: n === pageNum
                    ? `0 0 0 3px ${accent}22, 0 6px 16px ${accent}25`
                    : dark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(15,23,42,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color .15s ease, box-shadow .15s ease',
                }}>
                  {thumbUrls[n]
                    ? <img src={thumbUrls[n]} alt={`Page ${n}`} style={{ width: '100%', display: 'block' }} />
                    : <div style={{ width: 14, height: 14, border: `2px solid ${accent}30`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                </div>
                <span style={{ display: 'block', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: n === pageNum ? accent : tm, marginTop: 5, letterSpacing: '0.02em' }}>
                  {n}
                </span>
              </button>
            ))}
          </div>
        )}

        <div
          ref={containerRef}
          className="pv-scroll"
          style={{
            flex: 1, overflow: 'auto', position: 'relative',
            background: `
              radial-gradient(circle at 1px 1px, ${dotColor} 1.4px, transparent 0) 0 0/22px 22px,
              ${pageBg}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '28px 20px 80px',
          }}
        >
          {loading ? (
            <div style={{ alignSelf: 'center', margin: 'auto', textAlign: 'center' }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12, background: `${accent}12`, border: `1px solid ${accent}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
              }}>
                <FileText size={20} color={accent} />
              </div>
              <div style={{ width: 32, height: 32, border: `3px solid ${accent}30`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: tm, fontWeight: 500 }}>Loading PDF…</p>
            </div>
          ) : (
            Array.from({ length: numPages }, (_, i) => i + 1).map((n) => {
              const isRendered = renderedPages.has(n);
              const size = pageSizes[n] || pageSizes[1];
              const placeholderW = size ? Math.round(size.width * scale) : 620;
              const placeholderH = size ? Math.round(size.height * scale) : 800;
              return (
                <div
                  key={n}
                  ref={(el) => { wrapperRefs.current[n] = el; }}
                  data-page={n}
                  className="pv-page-wrap"
                  style={{ marginBottom: 22, maxWidth: '100%' }}
                >
                  {!isRendered && (
                    <div style={{
                      width: placeholderW, maxWidth: '100%', height: placeholderH,
                      borderRadius: 6, background: dark ? '#0d1117' : '#ffffff',
                      border: `1px solid ${border}`,
                      boxShadow: dark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(15,23,42,0.1)',
                      position: 'relative', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: dark
                          ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.045), transparent)'
                          : 'linear-gradient(90deg, transparent, rgba(15,23,42,0.045), transparent)',
                        backgroundSize: '400px 100%', animation: 'pv-shimmer 1.6s linear infinite',
                      }} />
                      <div style={{ width: 30, height: 30, border: `3px solid ${accent}25`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  )}
                  <canvas
                    ref={(el) => { canvasRefs.current[n] = el; }}
                    style={{
                      display: isRendered ? 'block' : 'none',
                      boxShadow: dark ? '0 10px 30px rgba(0,0,0,0.55)' : '0 10px 30px rgba(15,23,42,0.14)',
                      borderRadius: 6, background: '#fff',
                      animation: 'pv-pop-in .25s ease',
                    }}
                    aria-label={`${title} — page ${n}`}
                  />
                  <div className="pv-page-badge" style={{
                    position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 10.5, fontWeight: 700, color: tm, background: chipBg,
                    padding: '2px 9px', borderRadius: 999, border: `1px solid ${border}`,
                    pointerEvents: 'none',
                  }}>
                    {n} / {numPages}
                  </div>
                </div>
              );
            })
          )}

          {showScrollTop && (
            <button
              onClick={scrollTop}
              title="Scroll to top"
              style={{
                position: 'sticky', bottom: 20, left: '100%', marginTop: -10,
                width: 40, height: 40, borderRadius: '50%', border: `1px solid ${border}`,
                background: dark ? 'rgba(17,24,39,0.9)' : 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: dark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(15,23,42,0.18)',
                animation: 'pv-fade-in .2s ease', flexShrink: 0,
              }}
            >
              <ArrowUp size={17} />
            </button>
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