import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { Shuffle, Download, Users, Layers, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

/* ══════════════════════════════════════════════════════════════════════
   Random Group Generator
   Standalone teacher tool: pick a class, say how many groups (or how many
   students per group), shuffle the roster into balanced groups and export
   the result as a PDF. Purely client-side — nothing is saved and no
   discussion groups (or anything else) are created or changed.
══════════════════════════════════════════════════════════════════════ */

/* Unbiased Fisher-Yates shuffle, using the browser CSPRNG when available. */
function randomInt(maxExclusive) {
  if (window.crypto?.getRandomValues) {
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const buf = new Uint32Array(1);
    do { window.crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Sizes as evenly as possible: 40 students / 6 groups -> [7,7,7,7,6,6]. */
function balancedSizes(total, groups) {
  const base = Math.floor(total / groups);
  const extra = total % groups;
  return Array.from({ length: groups }, (_, i) => (i < extra ? base + 1 : base));
}

/* Resolve the number of groups from the chosen mode. In "size" mode the
   count is the nearest whole number of groups, so group sizes stay as close
   as possible to what the teacher asked for. */
function resolveGroupCount(mode, value, total) {
  if (!total || !value || value < 1) return 0;
  const g = mode === 'groups' ? value : Math.round(total / value);
  return Math.min(Math.max(g, 1), total);
}

const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });

export default function RandomGroups() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [mode, setMode] = useState('groups'); // 'groups' | 'size'
  const [value, setValue] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lightPdf, setLightPdf] = useState(false); // print-friendly PDF (white page) instead of the dark look
  const [result, setResult] = useState(null); // { className, students, groups: [[student]] }
  const [roster, setRoster] = useState([]);   // students of the last-generated class, for reshuffling

  useEffect(() => {
    api.get('/classes', { params: { limit: 100 } })
      .then(r => setClasses(r.data.classes || []))
      .catch(() => toast.error(t('randomGroups.loadClassesFailed')));
  }, [t]);

  const selectedClass = classes.find(c => String(c.id) === String(classId)) || null;
  const knownTotal = selectedClass?.student_count || 0;
  const numericValue = parseInt(value, 10);
  const maxValue = Math.max(knownTotal, 1);
  const valueValid = Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= maxValue;

  /* Live preview of how the class will be split, before generating. */
  const previewText = useMemo(() => {
    if (!selectedClass || !valueValid || knownTotal === 0) return '';
    const g = resolveGroupCount(mode, numericValue, knownTotal);
    const sizes = balancedSizes(knownTotal, g);
    const big = Math.max(...sizes);
    const small = Math.min(...sizes);
    if (big === small) return t('randomGroups.previewSame', { groups: g, size: big });
    const bigCount = sizes.filter(s => s === big).length;
    return t('randomGroups.preview', {
      groups: g,
      detail: t('randomGroups.previewMixed', { big: bigCount, bigSize: big, small: g - bigCount, smallSize: small }),
    });
  }, [selectedClass, valueValid, knownTotal, mode, numericValue, t]);

  const buildGroups = (students) => {
    const g = resolveGroupCount(mode, numericValue, students.length);
    const sizes = balancedSizes(students.length, g);
    const shuffled = shuffle(students);
    let cursor = 0;
    return sizes.map(size => {
      const members = shuffled.slice(cursor, cursor + size).sort(byName);
      cursor += size;
      return members;
    });
  };

  const handleGenerate = async () => {
    if (!selectedClass || !valueValid) return;
    setGenerating(true);
    try {
      const res = await api.get(`/classes/${selectedClass.id}/students`);
      const students = res.data.students || [];
      if (students.length === 0) {
        toast.error(t('randomGroups.noStudents'));
        setResult(null); setRoster([]);
        return;
      }
      setRoster(students);
      setResult({ className: selectedClass.name, students: students.length, groups: buildGroups(students) });
    } catch (err) {
      toast.error(err.response?.data?.message || t('randomGroups.loadStudentsFailed'));
    } finally { setGenerating(false); }
  };

  const handleReshuffle = () => {
    if (!result || roster.length === 0) return;
    setResult(prev => ({ ...prev, groups: buildGroups(roster) }));
  };

  /* ── PDF ─────────────────────────────────────────────────────────────
     Mirrors the on-screen preview: a 3-column grid of group cards, each with
     an orange header ("Group N" + student count) and a numbered name list.
     Dark by default to match the app; "light background" is the print-friendly
     variant. Cards in the same row share one height, like the on-screen grid. */
  const downloadPdf = () => {
    if (!result) return;
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const margin = 32;
      const HEADER_H = 150;
      const COLS = 3, GAP = 12;
      const cardW = (W - margin * 2 - GAP * (COLS - 1)) / COLS;
      const CARD_HEAD = 28, PAD_Y = 8, RADIUS = 9, FOOTER_SPACE = 40;
      const usableBottom = H - FOOTER_SPACE;

      const P = lightPdf
        ? { page: [255, 255, 255], card: [251, 247, 243], border: [226, 205, 190], name: [40, 32, 28], num: [180, 83, 9], head: [154, 52, 18], headSub: [255, 222, 200], foot: [150, 140, 132] }
        : { page: [15, 15, 15], card: [24, 24, 24], border: [52, 52, 52], name: [240, 240, 240], num: [194, 98, 28], head: [146, 50, 19], headSub: [232, 196, 176], foot: [120, 115, 110] };

      const paintPage = () => { doc.setFillColor(...P.page); doc.rect(0, 0, W, H, 'F'); };
      paintPage();

      // ── Masthead (first page) ──
      doc.setFillColor(20, 10, 6);
      doc.rect(0, 0, W, HEADER_H, 'F');
      doc.setFillColor(194, 65, 12);
      doc.rect(0, 0, 7, HEADER_H, 'F');
      doc.setFillColor(124, 45, 18);
      doc.rect(0, HEADER_H - 4, W, 4, 'F');

      doc.setFillColor(194, 65, 12);
      doc.roundedRect(margin, 21, 40, 40, 11, 11, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text('E', margin + 20, 47, { align: 'center' });

      const wmX = margin + 52;
      doc.setFontSize(21);
      doc.text('EDU', wmX, 39);
      const eduW = doc.getTextWidth('EDU');
      doc.setTextColor(251, 146, 60);
      doc.text('PLA', wmX + eduW, 39);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setCharSpace(1.6);
      doc.setTextColor(196, 158, 133);
      doc.text('EDUCATION MANAGEMENT PLATFORM', wmX, 50);
      doc.setCharSpace(0);

      doc.setDrawColor(80, 45, 28);
      doc.setLineWidth(0.75);
      doc.line(margin, 68, W - margin, 68);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(251, 146, 60);
      doc.text(t('randomGroups.pdfTitle').toUpperCase(), margin, 88);

      doc.setFontSize(19);
      doc.setTextColor(255, 255, 255);
      doc.text(result.className, margin, 112, { maxWidth: W - margin * 2 });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(255, 214, 178);
      const meta = [
        t('randomGroups.pdfStudentsTotal', { count: result.students }),
        t('randomGroups.pdfGroupsTotal', { count: result.groups.length }),
        user?.name ? t('randomGroups.pdfTeacher', { name: user.name }) : null,
        new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      ].filter(Boolean).join('   -   ');
      doc.text(meta, margin, 133, { maxWidth: W - margin * 2 });

      // Shrinks a name to fit its column, truncating with "..." as a last resort.
      const fitName = (text, maxW) => {
        let size = 9.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(size);
        while (doc.getTextWidth(text) > maxW && size > 7) { size -= 0.5; doc.setFontSize(size); }
        if (doc.getTextWidth(text) <= maxW) return text;
        let cut = text;
        while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > maxW) cut = cut.slice(0, -1);
        return `${cut}...`;
      };

      // ── Group cards, COLS per row ──
      let y = HEADER_H + 20;
      for (let start = 0; start < result.groups.length; start += COLS) {
        const rowGroups = result.groups.slice(start, start + COLS);
        const maxRows = Math.max(...rowGroups.map(g => g.length));

        // A very large group still has to fit on a page, so squeeze its rows if needed.
        const fullPageSpace = usableBottom - margin - CARD_HEAD - PAD_Y * 2;
        const rowH = Math.min(17, Math.max(9, fullPageSpace / maxRows));
        const cardH = CARD_HEAD + PAD_Y * 2 + maxRows * rowH;

        if (y + cardH > usableBottom) { doc.addPage(); paintPage(); y = margin; }

        rowGroups.forEach((members, ci) => {
          const gi = start + ci;
          const x = margin + ci * (cardW + GAP);

          // Card body
          doc.setFillColor(...P.card);
          doc.setDrawColor(...P.border);
          doc.setLineWidth(0.75);
          doc.roundedRect(x, y, cardW, cardH, RADIUS, RADIUS, 'FD');

          // Header band (rounded on top, square at the bottom)
          doc.setFillColor(...P.head);
          doc.roundedRect(x, y, cardW, CARD_HEAD, RADIUS, RADIUS, 'F');
          doc.rect(x, y + CARD_HEAD / 2, cardW, CARD_HEAD / 2, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(255, 255, 255);
          doc.text(t('randomGroups.group', { n: gi + 1 }), x + 12, y + 18);
          doc.setFontSize(8);
          doc.setTextColor(...P.headSub);
          doc.text(
            members.length === 1 ? t('randomGroups.oneStudent') : t('randomGroups.studentsCount', { count: members.length }),
            x + cardW - 12, y + 17.5, { align: 'right' }
          );

          // Numbered names
          members.forEach((s, i) => {
            const ty = y + CARD_HEAD + PAD_Y + i * rowH + rowH / 2 + 3;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...P.num);
            doc.text(String(i + 1), x + 20, ty, { align: 'right' });

            doc.setTextColor(...P.name);
            const label = fitName(s.name || '-', cardW - 28 - 8);
            doc.text(label, x + 28, ty);
          });
        });

        y += cardH + GAP;
      }

      // ── Footer on every page (added last so the total page count is known) ──
      const total = doc.internal.getNumberOfPages();
      for (let pg = 1; pg <= total; pg++) {
        doc.setPage(pg);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(194, 65, 12);
        doc.text('EDUPLA', margin, H - 22);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...P.foot);
        doc.text(`  -  ${result.className}  -  ${t('randomGroups.pdfRandom')}`, margin + doc.getTextWidth('EDUPLA'), H - 22);
        doc.text(t('randomGroups.pdfPage', { n: pg, total }), W - margin, H - 22, { align: 'right' });
      }

      const safeName = (result.className || 'class').trim().replace(/[^a-z0-9]+/gi, '_');
      doc.save(`${safeName}_random_groups.pdf`);
      toast.success(t('randomGroups.pdfDownloaded'));
    } catch {
      toast.error(t('randomGroups.pdfFailed'));
    }
  };

  /* ── UI ──────────────────────────────────────────────────────────── */
  const inputStyle = { background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' };
  const canGenerate = !!selectedClass && knownTotal > 0 && valueValid && !generating;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #2a0c03 0%, #431407 45%, #7c2d12 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0"><Shuffle className="w-5 h-5" /></div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold">{t('randomGroups.title')}</h1>
            <p className="text-xs text-white/70 mt-0.5">{t('randomGroups.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        {/* Class */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('randomGroups.class')}</label>
          <select value={classId} onChange={e => { setClassId(e.target.value); setValue(''); setResult(null); setRoster([]); }}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}>
            <option value="">{t('randomGroups.selectClass')}</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.student_count === 1 ? t('randomGroups.oneStudent') : t('randomGroups.studentsCount', { count: c.student_count || 0 })})</option>
            ))}
          </select>
        </div>

        {/* Mode */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('randomGroups.splitBy')}</label>
          <div className="flex gap-2 flex-wrap">
            {[['groups', 'byGroups', Layers], ['size', 'bySize', Users]].map(([val, key, Icon]) => (
              <button key={val} type="button" onClick={() => { setMode(val); setValue(''); }}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95"
                style={mode === val
                  ? { background: 'linear-gradient(135deg, #9a3412, #7c2d12)', color: '#fff' }
                  : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                <Icon className="w-3.5 h-3.5" /> {t(`randomGroups.${key}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Value */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            {mode === 'groups' ? t('randomGroups.numGroups') : t('randomGroups.groupSize')}
          </label>
          <input type="number" min={1} max={maxValue} value={value} disabled={!selectedClass || knownTotal === 0}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canGenerate) handleGenerate(); }}
            className="w-full sm:w-48 px-3.5 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50" style={inputStyle} />
          {selectedClass && knownTotal === 0 && (
            <p className="text-xs mt-1.5" style={{ color: '#dc2626' }}>{t('randomGroups.noStudents')}</p>
          )}
          {selectedClass && knownTotal > 0 && value !== '' && !valueValid && (
            <p className="text-xs mt-1.5" style={{ color: '#dc2626' }}>{t('randomGroups.invalidValue', { max: maxValue })}</p>
          )}
          {previewText && <p className="text-xs mt-1.5 font-semibold" style={{ color: '#9a3412' }}>{previewText}</p>}
        </div>

        <button onClick={handleGenerate} disabled={!canGenerate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #c2410c, #9a3412)' }}>
          {generating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Shuffle className="w-4 h-4" />}
          {t('randomGroups.generate')}
        </button>
      </div>

      {/* Result preview */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{result.className}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('randomGroups.resultSummary', { students: result.students, groups: result.groups.length })}
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={lightPdf} onChange={e => setLightPdf(e.target.checked)} style={{ accentColor: '#c2410c' }} />
                {t('randomGroups.pdfLight')}
              </label>
              <button onClick={handleReshuffle}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: 'var(--surface-100)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                <RefreshCw className="w-3.5 h-3.5" /> {t('randomGroups.shuffleAgain')}
              </button>
              <button onClick={downloadPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #c2410c, #9a3412)' }}>
                <Download className="w-3.5 h-3.5" /> {t('randomGroups.downloadPdf')}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.groups.map((members, gi) => (
              <div key={gi} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #9a3412, #7c2d12)' }}>
                  <span className="text-white text-sm font-bold">{t('randomGroups.group', { n: gi + 1 })}</span>
                  <span className="text-white/75 text-[11px] font-semibold">{members.length === 1 ? t('randomGroups.oneStudent') : t('randomGroups.studentsCount', { count: members.length })}</span>
                </div>
                <ol className="py-1.5">
                  {members.map((s, i) => (
                    <li key={s._id || s.id || i} className="flex items-center gap-2.5 px-4 py-1.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                      <span className="w-5 text-right text-xs font-bold flex-shrink-0" style={{ color: '#b45309' }}>{i + 1}</span>
                      <span className="truncate">{s.name}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}