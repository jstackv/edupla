import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { Shuffle, Download, Users, Layers, RefreshCw, Save, Trash2, ChevronDown, Search, CheckSquare, Square } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from './ConfirmDialog';

/* ══════════════════════════════════════════════════════════════════════
   Task Groups
   Embedded in the Task Manager (Assignment → Discussion). The teacher picks
   which students take part, says how many groups (or how many students per
   group), shuffles them into balanced random groups, and SAVES the set.
   Saved groups are what a discussion task is later assigned to — a task given
   to one group is invisible to every other group.
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


function exportGroupsPdf({ result, lightPdf, t, user }) {
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
  }

const sizeLabel = (t, n) => (n === 1 ? t('randomGroups.oneStudent') : t('randomGroups.studentsCount', { count: n }));

/* Group cards, shared by the unsaved preview and the saved sets. */
function GroupCards({ groups, t, footer }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g, gi) => (
        <div key={g.id || gi} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ background: 'linear-gradient(135deg, #9a3412, #7c2d12)' }}>
            <span className="text-white text-sm font-bold truncate">{g.name || t('randomGroups.group', { n: gi + 1 })}</span>
            <span className="text-white/75 text-[11px] font-semibold flex-shrink-0">{sizeLabel(t, g.members.length)}</span>
          </div>
          <ol className="py-1.5">
            {g.members.map((s, i) => (
              <li key={s._id || s.id || i} className="flex items-center gap-2.5 px-4 py-1.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                <span className="w-5 text-right text-xs font-bold flex-shrink-0" style={{ color: '#b45309' }}>{i + 1}</span>
                <span className="truncate">{s.name}</span>
              </li>
            ))}
          </ol>
          {footer?.(g)}
        </div>
      ))}
    </div>
  );
}

export default function TaskGroupsPanel({ cls, module: mod, onChanged }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const classId = cls?._id;
  const courseId = mod?._id;

  const [roster, setRoster] = useState([]);          // every student in the class
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [picked, setPicked] = useState(new Set());   // ids of students taking part
  const [studentSearch, setStudentSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const [mode, setMode] = useState('groups');        // 'groups' | 'size'
  const [value, setValue] = useState('');
  const [lightPdf, setLightPdf] = useState(false);
  const [draft, setDraft] = useState(null);          // { groups: [[student]] } — generated, not yet saved
  const [batchName, setBatchName] = useState('');
  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState([]);            // saved groups (flat)
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [openBatch, setOpenBatch] = useState(null);
  const [deleteBatch, setDeleteBatch] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* ── load roster + saved sets ── */
  useEffect(() => {
    if (!classId) return;
    setLoadingRoster(true);
    api.get(`/classes/${classId}/students`)
      .then(r => {
        const list = (r.data.students || []).slice().sort(byName);
        setRoster(list);
        setPicked(new Set(list.map(s => String(s._id))));
      })
      .catch(() => toast.error(t('randomGroups.loadStudentsFailed')))
      .finally(() => setLoadingRoster(false));
  }, [classId, t]);

  const fetchSaved = useCallback(async () => {
    if (!classId) return;
    setLoadingSaved(true);
    try {
      const r = await api.get('/task-groups', { params: { classId, courseId } });
      setSaved(r.data.groups || []);
    } catch { toast.error(t('randomGroups.loadGroupsFailed')); }
    finally { setLoadingSaved(false); }
  }, [classId, courseId, t]);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  /* ── generator maths ── */
  const pickedStudents = useMemo(() => roster.filter(s => picked.has(String(s._id))), [roster, picked]);
  const total = pickedStudents.length;
  const numericValue = parseInt(value, 10);
  const maxValue = Math.max(total, 1);
  const valueValid = Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= maxValue;

  const previewText = useMemo(() => {
    if (!valueValid || total === 0) return '';
    const g = resolveGroupCount(mode, numericValue, total);
    const sizes = balancedSizes(total, g);
    const big = Math.max(...sizes);
    const small = Math.min(...sizes);
    if (big === small) return t('randomGroups.previewSame', { groups: g, size: big });
    const bigCount = sizes.filter(s => s === big).length;
    return t('randomGroups.preview', {
      groups: g,
      detail: t('randomGroups.previewMixed', { big: bigCount, bigSize: big, small: g - bigCount, smallSize: small }),
    });
  }, [valueValid, total, mode, numericValue, t]);

  const buildGroups = () => {
    const g = resolveGroupCount(mode, numericValue, pickedStudents.length);
    const sizes = balancedSizes(pickedStudents.length, g);
    const shuffled = shuffle(pickedStudents);
    let cursor = 0;
    return sizes.map(size => {
      const members = shuffled.slice(cursor, cursor + size).sort(byName);
      cursor += size;
      return members;
    });
  };

  const handleGenerate = () => {
    if (!valueValid || total === 0) return;
    setDraft({ groups: buildGroups() });
  };

  const draftAsGroups = draft ? draft.groups.map((members, i) => ({ name: t('randomGroups.group', { n: i + 1 }), members })) : [];

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await api.post('/task-groups', {
        classId, courseId,
        batchName: batchName.trim(),
        groups: draftAsGroups.map(g => ({ name: g.name, members: g.members.map(m => m._id) })),
      });
      toast.success(t('randomGroups.saved'));
      setDraft(null); setBatchName(''); setValue('');
      await fetchSaved();
      onChanged?.();
    } catch (err) { toast.error(err.response?.data?.message || t('randomGroups.saveFailed')); }
    finally { setSaving(false); }
  };

  const handleDeleteBatch = async () => {
    if (!deleteBatch) return;
    setDeleting(true);
    try {
      await api.delete(`/task-groups/batch/${deleteBatch.batch_id}`);
      toast.success(t('randomGroups.deleted'));
      setDeleteBatch(null);
      await fetchSaved();
      onChanged?.();
    } catch (err) { toast.error(err.response?.data?.message || t('randomGroups.deleteFailed')); }
    finally { setDeleting(false); }
  };

  /* ── saved groups, bucketed by the set they were generated in ── */
  const batches = useMemo(() => {
    const map = new Map();
    saved.forEach(g => {
      const key = String(g.batch_id);
      if (!map.has(key)) map.set(key, { batch_id: key, batch_name: g.batch_name, created_at: g.created_at, groups: [] });
      map.get(key).groups.push(g);
    });
    map.forEach(b => b.groups.sort((a, c) => a.name.localeCompare(c.name, undefined, { numeric: true })));
    return Array.from(map.values());
  }, [saved]);

  const pdfFor = (groups, label) => exportGroupsPdf({
    result: {
      className: `${cls?.name || ''}${label ? ` — ${label}` : ''}`,
      students: groups.reduce((n, g) => n + g.members.length, 0),
      groups: groups.map(g => g.members),
    },
    lightPdf, t, user,
  });

  /* ── picker helpers ── */
  const toggleStudent = (id) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const visibleRoster = roster.filter(s => !studentSearch || s.name?.toLowerCase().includes(studentSearch.toLowerCase()));

  const inputStyle = { background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' };
  const canGenerate = total > 0 && valueValid;

  return (
    <div className="space-y-5">
      {/* ── Generator ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="px-5 py-4 text-white flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #2a0c03 0%, #431407 45%, #7c2d12 100%)' }}>
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0"><Shuffle className="w-5 h-5" /></div>
          <div className="min-w-0">
            <h3 className="text-base font-bold">{t('randomGroups.title')}</h3>
            <p className="text-xs text-white/70 mt-0.5">{t('randomGroups.subtitle')}</p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {loadingRoster ? (
            <div className="flex justify-center py-6"><div className="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : roster.length === 0 ? (
            <p className="text-sm" style={{ color: '#dc2626' }}>{t('randomGroups.noStudents')}</p>
          ) : (
            <>
              {/* Who takes part */}
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                    {t('randomGroups.participants')} <span className="font-semibold">({total}/{roster.length})</span>
                  </label>
                  <button type="button" onClick={() => setShowPicker(v => !v)}
                    className="text-xs font-bold flex items-center gap-1" style={{ color: '#c2410c' }}>
                    {showPicker ? t('randomGroups.hideStudents') : t('randomGroups.chooseStudents')}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {showPicker && (
                  <div className="mt-2 rounded-xl p-3 space-y-2" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                        <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                          className="input-field pl-8 py-1.5 text-sm" placeholder={t('randomGroups.searchStudents')} />
                      </div>
                      <button type="button" onClick={() => setPicked(new Set(roster.map(s => String(s._id))))} className="text-xs font-bold" style={{ color: '#c2410c' }}>{t('randomGroups.selectAll')}</button>
                      <button type="button" onClick={() => setPicked(new Set())} className="text-xs font-bold text-muted">{t('randomGroups.clearAll')}</button>
                    </div>
                    <div className="max-h-56 overflow-y-auto grid gap-1 sm:grid-cols-2">
                      {visibleRoster.map(s => {
                        const id = String(s._id);
                        const on = picked.has(id);
                        return (
                          <button key={id} type="button" onClick={() => toggleStudent(id)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors"
                            style={{ background: on ? 'rgba(194,65,12,0.10)' : 'transparent', color: 'var(--text-primary)' }}>
                            {on ? <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: '#c2410c' }} /> : <Square className="w-4 h-4 flex-shrink-0 text-muted" />}
                            <span className="truncate">{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                <input type="number" min={1} max={maxValue} value={value} disabled={total === 0}
                  onChange={e => setValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && canGenerate) handleGenerate(); }}
                  className="w-full sm:w-48 px-3.5 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50" style={inputStyle} />
                {total === 0 && <p className="text-xs mt-1.5" style={{ color: '#dc2626' }}>{t('randomGroups.pickSomeone')}</p>}
                {total > 0 && value !== '' && !valueValid && (
                  <p className="text-xs mt-1.5" style={{ color: '#dc2626' }}>{t('randomGroups.invalidValue', { max: maxValue })}</p>
                )}
                {previewText && <p className="text-xs mt-1.5 font-semibold" style={{ color: '#9a3412' }}>{previewText}</p>}
              </div>

              <button onClick={handleGenerate} disabled={!canGenerate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #c2410c, #9a3412)' }}>
                <Shuffle className="w-4 h-4" /> {draft ? t('randomGroups.regenerate') : t('randomGroups.generate')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Draft: review, reshuffle, then save ── */}
      {draft && (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t('randomGroups.draftTitle')}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('randomGroups.resultSummary', { students: total, groups: draft.groups.length })}
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={lightPdf} onChange={e => setLightPdf(e.target.checked)} style={{ accentColor: '#c2410c' }} />
                {t('randomGroups.pdfLight')}
              </label>
              <button onClick={() => setDraft({ groups: buildGroups() })}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: 'var(--surface-100)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                <RefreshCw className="w-3.5 h-3.5" /> {t('randomGroups.shuffleAgain')}
              </button>
              <button onClick={() => pdfFor(draftAsGroups, '')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: 'var(--surface-100)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                <Download className="w-3.5 h-3.5" /> {t('randomGroups.downloadPdf')}
              </button>
            </div>
          </div>

          <GroupCards groups={draftAsGroups} t={t} />

          <div className="flex items-center gap-3 flex-wrap rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <input value={batchName} onChange={e => setBatchName(e.target.value)} maxLength={80}
              className="input-field flex-1 min-w-[200px]" placeholder={t('randomGroups.setNamePlaceholder')} />
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #c2410c, #9a3412)' }}>
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {t('randomGroups.saveGroups')}
            </button>
          </div>
          <p className="text-xs text-muted -mt-2">{t('randomGroups.saveHint')}</p>
        </div>
      )}

      {/* ── Saved sets ── */}
      <div className="space-y-3">
        <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t('randomGroups.savedTitle')}</h3>
        {loadingSaved ? (
          <div className="flex justify-center py-6"><div className="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
        ) : batches.length === 0 ? (
          <div className="card text-center py-8">
            <Users className="w-10 h-10 mx-auto mb-2 text-muted opacity-30" />
            <p className="text-sm text-muted">{t('randomGroups.noSaved')}</p>
          </div>
        ) : batches.map(b => {
          const open = openBatch === b.batch_id;
          const studentsInBatch = b.groups.reduce((n, g) => n + g.members.length, 0);
          const tasksInBatch = b.groups.reduce((n, g) => n + (g.task_count || 0), 0);
          return (
            <div key={b.batch_id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setOpenBatch(open ? null : b.batch_id)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                  <ChevronDown className={`w-4 h-4 text-muted transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{b.batch_name}</p>
                    <p className="text-xs text-muted">
                      {t('randomGroups.resultSummary', { students: studentsInBatch, groups: b.groups.length })}
                      {tasksInBatch > 0 && ` · ${t('randomGroups.tasksGiven', { count: tasksInBatch })}`}
                    </p>
                  </div>
                </button>
                <button onClick={() => pdfFor(b.groups, b.batch_name)} title={t('randomGroups.downloadPdf')}
                  className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"><Download className="w-4 h-4 text-muted" /></button>
                <button onClick={() => setDeleteBatch(b)} title={t('randomGroups.deleteSet')}
                  className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4 text-muted" /></button>
              </div>
              {open && (
                <div className="px-4 pb-4">
                  <GroupCards t={t} groups={b.groups.map(g => ({ ...g, members: g.members.map(m => ({ id: m.id, name: m.name || '—' })) }))}
                    footer={g => g.task_count > 0 && (
                      <div className="px-4 py-2 text-[11px] font-semibold" style={{ borderTop: '1px solid var(--card-border)', color: '#9a3412' }}>
                        {t('randomGroups.tasksGiven', { count: g.task_count })}
                      </div>
                    )} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={!!deleteBatch}
        onClose={() => setDeleteBatch(null)}
        onConfirm={handleDeleteBatch}
        loading={deleting}
        title={t('randomGroups.deleteSet')}
        message={t('randomGroups.deleteSetConfirm', { name: deleteBatch?.batch_name })}
        confirmText={t('common.delete', { defaultValue: 'Delete' })}
        variant="danger"
      />
    </div>
  );
}
