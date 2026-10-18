import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import {
  Shuffle, Download, Users, Layers, RefreshCw, Save, Trash2, ChevronDown, Search, Check, X, Plus, Minus,
  Pencil, ChevronRight, ClipboardList, CalendarClock, Paperclip, Rocket, ArrowRightLeft,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from './ConfirmDialog';
import Modal from './Modal';

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

/* ══════════════════════════════════════════════════════════════════════
   Visual language: every group gets its own colour so teams are instantly
   recognisable — in the draft, the saved sets and the group workspace.
══════════════════════════════════════════════════════════════════════ */
const PALETTE = [
  ['#f97316', '#c2410c'], ['#ec4899', '#9d174d'], ['#8b5cf6', '#5b21b6'], ['#06b6d4', '#0e7490'],
  ['#10b981', '#047857'], ['#f59e0b', '#b45309'], ['#3b82f6', '#1d4ed8'], ['#ef4444', '#991b1b'],
];
const colorOf = (i) => { const [a, b] = PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]; return { a, b, grad: `linear-gradient(135deg, ${a}, ${b})` }; };
const groupIndex = (name = '', fallback = 0) => { const m = String(name).match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) - 1 : fallback; };

const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
};

const STYLES = `
  @keyframes tg-rise { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
  @keyframes tg-pop { 0% { opacity: 0; transform: scale(.6) rotate(-6deg) } 70% { transform: scale(1.06) rotate(1deg) } 100% { opacity: 1; transform: none } }
  @keyframes tg-float { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(12px,-14px) scale(1.12) } }
  @keyframes tg-pan { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
  @keyframes tg-jig { 0%,100% { transform: translate(0,0) rotate(0) } 20% { transform: translate(7px,-9px) rotate(6deg) } 40% { transform: translate(-8px,6px) rotate(-7deg) } 60% { transform: translate(9px,8px) rotate(5deg) } 80% { transform: translate(-6px,-7px) rotate(-4deg) } }
  @keyframes tg-spin { to { transform: rotate(360deg) } }
  @keyframes tg-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(251,146,60,.55) } 50% { box-shadow: 0 0 0 9px rgba(251,146,60,0) } }
  .tg-rise { animation: tg-rise .45s cubic-bezier(.2,.8,.2,1) both }
  .tg-pop { animation: tg-pop .5s cubic-bezier(.2,.8,.2,1) both }
  .tg-hero { background-size: 200% 200%; animation: tg-pan 12s linear infinite }
  .tg-tile { transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s }
  .tg-tile:hover { transform: translateY(-4px) }
  @media (prefers-reduced-motion: reduce) { .tg-rise, .tg-pop, .tg-hero, .tg-tile { animation: none; transition: none } }
`;

function Avatar({ name, size = 28, bg = 'rgba(255,255,255,0.22)', color = '#fff', ring }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full font-extrabold flex-shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: bg, color, boxShadow: ring ? `0 0 0 2px ${ring}` : 'none' }}>
      {initials(name)}
    </span>
  );
}

function AvatarStack({ members, color, max = 5, size = 28 }) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <span key={m.id || m._id || i} style={{ marginLeft: i === 0 ? 0 : -size * 0.3, zIndex: max - i }}>
          <Avatar name={m.name} size={size} bg={color.grad} ring="var(--card-bg)" />
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center justify-center rounded-full text-[10px] font-extrabold"
          style={{ width: size, height: size, marginLeft: -size * 0.3, background: 'var(--surface-100)', color: 'var(--text-secondary)', boxShadow: '0 0 0 2px var(--card-bg)' }}>+{extra}</span>
      )}
    </div>
  );
}

/* Little bar chart of the group sizes the current settings will produce. */
function SizeBars({ sizes, label }) {
  if (!sizes.length) return null;
  const shown = sizes.slice(0, 30);
  const maxS = Math.max(...shown);
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted mb-1.5">{label}</p>
      <div className="flex items-end gap-1 h-10">
        {shown.map((n, i) => {
          const c = colorOf(i);
          return <span key={i} title={n} className="tg-pop flex-1 max-w-[18px] rounded-md" style={{ height: `${Math.max(18, (n / maxS) * 100)}%`, background: c.grad, animationDelay: `${i * 18}ms` }} />;
        })}
        {sizes.length > shown.length && <span className="text-[10px] text-muted font-bold pl-1">+{sizes.length - shown.length}</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Group workspace — opens when a saved group is clicked. Shows the tasks
   given to that group (with how many members have handed in) or, when there
   are none, a big button to give the group its own independent task.
══════════════════════════════════════════════════════════════════════ */
function GroupWorkspace({ group, color, cls, mod, t, hidden, refreshKey, onClose, onAssign, onOpenTask, onRenamed }) {
  const [tasks, setTasks] = useState(null);       // null = loading
  const [progress, setProgress] = useState({});
  const [memberCount, setMemberCount] = useState(group.members.length);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => { setName(group.name); }, [group.name]);

  useEffect(() => {
    if (hidden) return;           // another window is on top — refetch when it closes
    let live = true;
    Promise.all([
      api.get('/assignments', { params: { classId: cls._id, courseId: mod?._id, taskType: 'assignment', mode: 'discussion', groupId: group.id, limit: 50 } }),
      api.get(`/task-groups/${group.id}/progress`),
    ]).then(([a, p]) => {
      if (!live) return;
      setTasks(a.data.assignments || []);
      setMemberCount(p.data.member_count ?? group.members.length);
      setProgress(Object.fromEntries((p.data.tasks || []).map(x => [String(x.assignment_id), x])));
    }).catch(() => { if (live) { setTasks([]); toast.error(t('randomGroups.loadTasksFailed')); } });
    return () => { live = false; };
  }, [group.id, hidden, refreshKey, cls._id, mod?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === group.name) { setEditing(false); setName(group.name); return; }
    setSavingName(true);
    try {
      await api.patch(`/task-groups/${group.id}`, { name: next });
      toast.success(t('randomGroups.renamed'));
      onRenamed?.(next);
      setEditing(false);
    } catch (err) { toast.error(err.response?.data?.message || t('randomGroups.renameFailed')); }
    finally { setSavingName(false); }
  };

  const now = Date.now();
  return (
    <Modal isOpen onClose={onClose} hidden={hidden} size="xl" title={group.name} icon={Users} accent={color.a} accent2={color.b}>
      <style>{STYLES}</style>
      <div className="space-y-5">
        {/* Banner */}
        <div className="relative rounded-2xl overflow-hidden p-5 text-white" style={{ background: color.grad }}>
          <span aria-hidden className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/10" style={{ animation: 'tg-float 9s ease-in-out infinite' }} />
          <span aria-hidden className="absolute right-24 -bottom-12 w-28 h-28 rounded-full bg-white/10" style={{ animation: 'tg-float 11s ease-in-out infinite reverse' }} />
          <div className="relative flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder={t('randomGroups.groupNamePlaceholder')}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditing(false); setName(group.name); } }}
                    className="px-3 py-1.5 rounded-xl text-sm font-bold outline-none text-gray-900 bg-white/95 min-w-0 w-44" />
                  <button onClick={saveName} disabled={savingName} className="p-2 rounded-xl bg-white/25 hover:bg-white/35 transition-colors"><Check className="w-4 h-4" /></button>
                  <button onClick={() => { setEditing(false); setName(group.name); }} className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-extrabold text-xl truncate">{group.name}</h3>
                  <button onClick={() => setEditing(true)} title={t('randomGroups.renameGroup')} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/30 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <p className="text-xs text-white/80 mt-1 font-semibold">
                {sizeLabel(t, memberCount)}{tasks ? ` · ${t('randomGroups.tasksCount', { count: tasks.length })}` : ''}
              </p>
            </div>
            <button onClick={() => onAssign(group)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-extrabold transition-all hover:-translate-y-0.5 active:scale-95"
              style={{ background: '#fff', color: color.b, boxShadow: '0 12px 24px -10px rgba(0,0,0,.5)' }}>
              <Plus className="w-4 h-4" /> {t('randomGroups.assignTask')}
            </button>
          </div>
        </div>

        {/* Members */}
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-2">{t('randomGroups.membersTitle')}</p>
          <div className="flex flex-wrap gap-2">
            {group.members.map((m, i) => (
              <span key={m.id || i} className="tg-rise inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-xs font-semibold"
                style={{ animationDelay: `${i * 25}ms`, background: 'var(--surface-100)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}>
                <Avatar name={m.name} size={22} bg={color.grad} /> {m.name}
              </span>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> {t('randomGroups.tasksForGroup')}</p>
          {tasks === null ? (
            <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-4 border-t-transparent rounded-full" style={{ borderColor: `${color.a} transparent ${color.a} ${color.a}` }} /></div>
          ) : tasks.length === 0 ? (
            <div className="tg-rise text-center rounded-3xl py-10 px-6" style={{ border: `2px dashed ${color.a}55`, background: `${color.a}0d` }}>
              <span className="inline-flex w-16 h-16 rounded-3xl items-center justify-center mb-3 text-white" style={{ background: color.grad, boxShadow: `0 14px 28px -10px ${color.a}`, animation: 'tg-float 5s ease-in-out infinite' }}>
                <Rocket className="w-8 h-8" />
              </span>
              <p className="font-display font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>{t('randomGroups.noTasksTitle')}</p>
              <p className="text-sm text-muted mt-1 max-w-sm mx-auto">{t('randomGroups.noTasksText', { name: group.name, count: memberCount })}</p>
              <button onClick={() => onAssign(group)}
                className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-extrabold text-white transition-all hover:-translate-y-0.5 active:scale-95"
                style={{ background: color.grad, boxShadow: `0 14px 28px -10px ${color.a}`, animation: 'tg-pulse 2.4s ease-in-out infinite' }}>
                <Plus className="w-4 h-4" /> {t('randomGroups.assignTaskTo', { name: group.name })}
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {tasks.map((a, i) => {
                const p = progress[String(a.id)] || { submitted: 0, graded: 0 };
                const pct = memberCount ? Math.round((p.submitted / memberCount) * 100) : 0;
                const closed = new Date(a.deadline).getTime() < now;
                const complete = memberCount > 0 && p.submitted >= memberCount;
                return (
                  <li key={a.id} className="tg-rise rounded-2xl p-4 transition-shadow hover:shadow-lg"
                    style={{ animationDelay: `${i * 50}ms`, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderLeft: `4px solid ${color.a}` }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[11px] font-semibold">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={closed ? { background: 'rgba(239,68,68,.12)', color: '#dc2626' } : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                            <CalendarClock className="w-3 h-3" /> {closed ? t('randomGroups.closed') : t('randomGroups.due', { date: new Date(a.deadline).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}
                          </span>
                          {!a.is_active && <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,.15)', color: '#b45309' }}>{t('randomGroups.hiddenTask')}</span>}
                          {(a.attachments || []).length > 0 && <span className="inline-flex items-center gap-1 text-muted"><Paperclip className="w-3 h-3" /> {a.attachments.length}</span>}
                        </div>
                      </div>
                      <button onClick={() => onOpenTask(a)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full transition-all hover:-translate-y-0.5 active:scale-95 flex-shrink-0"
                        style={{ background: `${color.a}1a`, color: color.a }}>
                        {t('randomGroups.viewSubmissions')} <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                        <span style={{ color: complete ? '#059669' : 'var(--text-secondary)' }}>{t('randomGroups.submittedOf', { done: p.submitted, total: memberCount })}</span>
                        {p.graded > 0 && <span className="text-muted">{t('randomGroups.gradedCount', { count: p.graded })}</span>}
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: complete ? 'linear-gradient(90deg,#10b981,#34d399)' : color.grad }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function TaskGroupsPanel({ cls, module: mod, onChanged, onAssignTask, onOpenTask, coverOpen = false, refreshKey }) {
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
  const [draft, setDraft] = useState(null);          // { groups: [{ name, members }] } — generated, not yet saved
  const [shuffling, setShuffling] = useState(false);
  const [sel, setSel] = useState(null);              // { gi, si } student picked for a swap / move
  const [batchName, setBatchName] = useState('');
  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState([]);            // saved groups (flat)
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [openBatch, setOpenBatch] = useState(null);
  const [deleteBatch, setDeleteBatch] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [active, setActive] = useState(null);        // group whose workspace is open

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
  // Task counts on the tiles change whenever a task is created / deleted elsewhere on the page.
  useEffect(() => { if (refreshKey) fetchSaved(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── generator maths ── */
  const pickedStudents = useMemo(() => roster.filter(s => picked.has(String(s._id))), [roster, picked]);
  const total = pickedStudents.length;
  const numericValue = parseInt(value, 10);
  const maxValue = Math.max(total, 1);
  const valueValid = Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= maxValue;

  const sizes = useMemo(() => {
    if (!valueValid || total === 0) return [];
    return balancedSizes(total, resolveGroupCount(mode, numericValue, total));
  }, [valueValid, total, mode, numericValue]);

  const previewText = useMemo(() => {
    if (!sizes.length) return '';
    const g = sizes.length;
    const big = Math.max(...sizes);
    const small = Math.min(...sizes);
    if (big === small) return t('randomGroups.previewSame', { groups: g, size: big });
    const bigCount = sizes.filter(s => s === big).length;
    return t('randomGroups.preview', {
      groups: g,
      detail: t('randomGroups.previewMixed', { big: bigCount, bigSize: big, small: g - bigCount, smallSize: small }),
    });
  }, [sizes, t]);

  const quickPicks = (mode === 'groups' ? [2, 3, 4, 5, 6, 8] : [2, 3, 4, 5, 6]).filter(n => n <= maxValue);
  const bump = (d) => setValue(String(Math.min(Math.max((parseInt(value, 10) || 0) + d, 1), maxValue)));

  const buildGroups = () => {
    const g = resolveGroupCount(mode, numericValue, pickedStudents.length);
    const sz = balancedSizes(pickedStudents.length, g);
    const shuffled = shuffle(pickedStudents);
    let cursor = 0;
    return sz.map((size, i) => {
      const members = shuffled.slice(cursor, cursor + size).sort(byName);
      cursor += size;
      return { name: t('randomGroups.group', { n: i + 1 }), members };
    });
  };

  // A short "shuffling" moment before the reveal makes the draw feel like a draw.
  const runShuffle = () => {
    if (shuffling || !valueValid || total === 0) return;
    setShuffling(true); setSel(null);
    setTimeout(() => { setDraft({ groups: buildGroups() }); setShuffling(false); }, 950);
  };

  /* ── editing the draft: swap two students, move one, rename a group ── */
  const clickStudent = (gi, si) => {
    if (!sel) return setSel({ gi, si });
    if (sel.gi === gi && sel.si === si) return setSel(null);
    setDraft(d => {
      const groups = d.groups.map(g => ({ ...g, members: [...g.members] }));
      const a = groups[sel.gi].members[sel.si];
      const b = groups[gi].members[si];
      groups[sel.gi].members[sel.si] = b;
      groups[gi].members[si] = a;
      groups[sel.gi].members.sort(byName);
      groups[gi].members.sort(byName);
      return { groups };
    });
    setSel(null);
  };
  const moveHere = (gi) => {
    if (!sel || sel.gi === gi) return;
    if (draft.groups[sel.gi].members.length <= 1) { toast.error(t('randomGroups.lastMember')); return; }
    setDraft(d => {
      const groups = d.groups.map(g => ({ ...g, members: [...g.members] }));
      const [m] = groups[sel.gi].members.splice(sel.si, 1);
      groups[gi].members.push(m);
      groups[gi].members.sort(byName);
      return { groups };
    });
    setSel(null);
  };
  const renameDraft = (gi, name) => setDraft(d => ({ groups: d.groups.map((g, i) => (i === gi ? { ...g, name } : g)) }));
  const selName = sel && draft ? draft.groups[sel.gi]?.members[sel.si]?.name : null;

  const draftAsGroups = draft ? draft.groups : [];

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await api.post('/task-groups', {
        classId, courseId,
        batchName: batchName.trim(),
        groups: draftAsGroups.map((g, i) => ({ name: (g.name || '').trim() || t('randomGroups.group', { n: i + 1 }), members: g.members.map(m => m._id) })),
      });
      toast.success(t('randomGroups.saved'));
      setDraft(null); setBatchName(''); setValue(''); setSel(null);
      setOpenBatch(null);
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

  // Newest set opens by default.
  useEffect(() => { if (openBatch === null && batches.length) setOpenBatch(batches[0].batch_id); }, [batches, openBatch]);

  // Keep the open workspace in step with refreshed data (renames, task counts).
  const activeGroup = active ? saved.find(g => String(g.id) === String(active.id)) || active : null;

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
  const canGenerate = total > 0 && valueValid && !shuffling;
  const pickedPct = roster.length ? Math.round((total / roster.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <style>{STYLES}</style>

      {/* ── Generator ── */}
      <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="tg-hero relative px-6 py-6 text-white overflow-hidden" style={{ backgroundImage: 'linear-gradient(115deg, #2a0c03, #7c2d12, #be185d, #7c2d12, #2a0c03)' }}>
          <span aria-hidden className="absolute -left-10 -top-12 w-44 h-44 rounded-full bg-orange-400/20 blur-2xl" style={{ animation: 'tg-float 10s ease-in-out infinite' }} />
          <span aria-hidden className="absolute right-10 -bottom-14 w-52 h-52 rounded-full bg-pink-500/20 blur-2xl" style={{ animation: 'tg-float 13s ease-in-out infinite reverse' }} />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)' }}>
                <Shuffle className="w-7 h-7" style={shuffling ? { animation: 'tg-spin .6s linear infinite' } : undefined} />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-extrabold">{t('randomGroups.title')}</h3>
                <p className="text-xs text-white/75 mt-1 max-w-xl">{t('randomGroups.subtitle')}</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              {[[t('randomGroups.studentsLabel'), total], [t('randomGroups.groupsLabel'), sizes.length || '–']].map(([label, n]) => (
                <div key={label} className="rounded-2xl px-4 py-2 text-center bg-white/12 backdrop-blur" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.2)' }}>
                  <p className="font-display font-extrabold text-xl leading-none">{n}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loadingRoster ? (
            <div className="flex justify-center py-6"><div className="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : roster.length === 0 ? (
            <p className="text-sm" style={{ color: '#dc2626' }}>{t('randomGroups.noStudents')}</p>
          ) : (
            <>
              {/* Who takes part */}
              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <AvatarStack members={pickedStudents} color={colorOf(0)} max={6} size={30} />
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{t('randomGroups.participants')} <span className="text-muted font-semibold">({total}/{roster.length})</span></p>
                      <div className="h-1.5 w-36 rounded-full overflow-hidden mt-1" style={{ background: 'var(--card-border)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pickedPct}%`, background: colorOf(0).grad }} />
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowPicker(v => !v)}
                    className="text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors hover:bg-orange-500/10" style={{ color: '#c2410c' }}>
                    {showPicker ? t('randomGroups.hideStudents') : t('randomGroups.chooseStudents')}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {showPicker && (
                  <div className="tg-rise mt-3 rounded-2xl p-3 space-y-2" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                        <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                          className="input-field pl-8 py-1.5 text-sm" placeholder={t('randomGroups.searchStudents')} />
                      </div>
                      <button type="button" onClick={() => setPicked(new Set(roster.map(s => String(s._id))))} className="text-xs font-bold" style={{ color: '#c2410c' }}>{t('randomGroups.selectAll')}</button>
                      <button type="button" onClick={() => setPicked(new Set())} className="text-xs font-bold text-muted">{t('randomGroups.clearAll')}</button>
                    </div>
                    <div className="max-h-60 overflow-y-auto grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleRoster.map(s => {
                        const id = String(s._id);
                        const on = picked.has(id);
                        return (
                          <button key={id} type="button" onClick={() => toggleStudent(id)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-left text-sm transition-all active:scale-[.98]"
                            style={{ background: on ? 'rgba(194,65,12,0.12)' : 'transparent', color: 'var(--text-primary)', opacity: on ? 1 : 0.6 }}>
                            <Avatar name={s.name} size={26} bg={on ? colorOf(0).grad : 'var(--card-border)'} color={on ? '#fff' : 'var(--text-secondary)'} />
                            <span className="truncate flex-1">{s.name}</span>
                            {on && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#c2410c' }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mode */}
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>{t('randomGroups.splitBy')}</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[['groups', 'byGroups', Layers], ['size', 'bySize', Users]].map(([val, key, Icon]) => {
                    const on = mode === val;
                    return (
                      <button key={val} type="button" onClick={() => { setMode(val); setValue(''); }}
                        className="flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[.98]"
                        style={on
                          ? { background: 'linear-gradient(135deg, #c2410c, #7c2d12)', color: '#fff', boxShadow: '0 14px 28px -12px #c2410c' }
                          : { background: 'var(--surface-100)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: on ? 'rgba(255,255,255,.2)' : 'var(--card-border)' }}><Icon className="w-5 h-5" /></span>
                        <span className="font-bold text-sm">{t(`randomGroups.${key}`)}</span>
                        {on && <Check className="w-4 h-4 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Value */}
              <div className="space-y-3">
                <label className="block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                  {mode === 'groups' ? t('randomGroups.numGroups') : t('randomGroups.groupSize')}
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="inline-flex items-center rounded-2xl overflow-hidden" style={inputStyle}>
                    <button type="button" onClick={() => bump(-1)} disabled={total === 0} className="w-11 h-11 flex items-center justify-center hover:bg-orange-500/10 transition-colors disabled:opacity-40"><Minus className="w-4 h-4" /></button>
                    <input type="number" min={1} max={maxValue} value={value} disabled={total === 0}
                      onChange={e => setValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && canGenerate) runShuffle(); }}
                      className="w-16 h-11 text-center text-lg font-extrabold bg-transparent outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      style={{ color: 'var(--text-primary)' }} />
                    <button type="button" onClick={() => bump(1)} disabled={total === 0} className="w-11 h-11 flex items-center justify-center hover:bg-orange-500/10 transition-colors disabled:opacity-40"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted mr-1">{t('randomGroups.quickPick')}</span>
                    {quickPicks.map(n => (
                      <button key={n} type="button" onClick={() => setValue(String(n))}
                        className="w-9 h-9 rounded-xl text-sm font-extrabold transition-all active:scale-90"
                        style={String(n) === value
                          ? { background: 'linear-gradient(135deg, #c2410c, #9a3412)', color: '#fff' }
                          : { background: 'var(--surface-100)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>{n}</button>
                    ))}
                  </div>
                </div>
                {total === 0 && <p className="text-xs" style={{ color: '#dc2626' }}>{t('randomGroups.pickSomeone')}</p>}
                {total > 0 && value !== '' && !valueValid && <p className="text-xs" style={{ color: '#dc2626' }}>{t('randomGroups.invalidValue', { max: maxValue })}</p>}
                {previewText && <p className="text-xs font-semibold" style={{ color: '#c2410c' }}>{previewText}</p>}
                <SizeBars sizes={sizes} label={t('randomGroups.sizesPreview')} />
              </div>

              <button onClick={runShuffle} disabled={!canGenerate}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-extrabold text-white transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:hover:translate-y-0"
                style={{ background: 'linear-gradient(135deg, #f97316, #c2410c 55%, #be185d)', boxShadow: canGenerate ? '0 16px 30px -12px #ea580c' : 'none' }}>
                <Shuffle className="w-4 h-4" style={shuffling ? { animation: 'tg-spin .6s linear infinite' } : undefined} />
                {shuffling ? t('randomGroups.shuffling', { count: total }) : draft ? t('randomGroups.regenerate') : t('randomGroups.generate')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── The draw ── */}
      {shuffling && (
        <div className="rounded-3xl p-6 text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="flex flex-wrap justify-center gap-2.5 max-w-2xl mx-auto">
            {pickedStudents.slice(0, 28).map((s, i) => (
              <span key={s._id} style={{ animation: `tg-jig ${0.5 + (i % 5) * 0.08}s ease-in-out infinite`, animationDelay: `${(i % 7) * -0.09}s` }}>
                <Avatar name={s.name} size={38} bg={colorOf(i).grad} />
              </span>
            ))}
          </div>
          <p className="text-sm font-bold mt-4" style={{ color: 'var(--text-secondary)' }}>{t('randomGroups.shuffling', { count: total })}</p>
        </div>
      )}

      {/* ── Draft: review, tweak, then save ── */}
      {draft && !shuffling && (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-display font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>{t('randomGroups.draftTitle')}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('randomGroups.resultSummary', { students: total, groups: draft.groups.length })}
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={lightPdf} onChange={e => setLightPdf(e.target.checked)} style={{ accentColor: '#c2410c' }} />
                {t('randomGroups.pdfLight')}
              </label>
              <button onClick={runShuffle}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 hover:-translate-y-0.5"
                style={{ background: 'var(--surface-100)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                <RefreshCw className="w-3.5 h-3.5" /> {t('randomGroups.shuffleAgain')}
              </button>
              <button onClick={() => pdfFor(draftAsGroups, '')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 hover:-translate-y-0.5"
                style={{ background: 'var(--surface-100)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                <Download className="w-3.5 h-3.5" /> {t('randomGroups.downloadPdf')}
              </button>
            </div>
          </div>

          {/* swap / move hint bar */}
          <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-xs font-semibold backdrop-blur"
            style={sel
              ? { background: 'rgba(194,65,12,.92)', color: '#fff', boxShadow: '0 12px 28px -12px #c2410c' }
              : { background: 'var(--surface-100)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
            <span className="flex items-center gap-2 min-w-0"><ArrowRightLeft className="w-4 h-4 flex-shrink-0" /><span className="truncate">{sel ? t('randomGroups.selectedStudent', { name: selName }) : t('randomGroups.swapHint')}</span></span>
            {sel && <button onClick={() => setSel(null)} className="font-extrabold underline-offset-2 hover:underline flex-shrink-0">{t('randomGroups.cancelSelect')}</button>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {draft.groups.map((g, gi) => {
              const c = colorOf(gi);
              const canReceive = sel && sel.gi !== gi;
              return (
                <div key={gi} className="tg-pop rounded-3xl overflow-hidden" style={{ animationDelay: `${gi * 55}ms`, background: 'var(--card-bg)', border: `1px solid ${canReceive ? c.a : 'var(--card-border)'}`, boxShadow: canReceive ? `0 0 0 3px ${c.a}33` : 'none' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ background: c.grad }}>
                    <input value={g.name} maxLength={80} onChange={e => renameDraft(gi, e.target.value)} aria-label={t('randomGroups.renameGroup')}
                      placeholder={t('randomGroups.groupNamePlaceholder')}
                      className="min-w-0 flex-1 bg-transparent text-white text-sm font-extrabold outline-none placeholder-white/60 rounded-lg px-1.5 py-0.5 focus:bg-white/15 transition-colors" />
                    {canReceive ? (
                      <button onClick={() => moveHere(gi)} className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-white transition-transform active:scale-90 hover:scale-105 flex-shrink-0" style={{ color: c.b }}>{t('randomGroups.moveHere')}</button>
                    ) : (
                      <span className="text-white/80 text-[11px] font-bold flex-shrink-0">{sizeLabel(t, g.members.length)}</span>
                    )}
                  </div>
                  <ol className="p-2">
                    {g.members.map((s, si) => {
                      const on = sel && sel.gi === gi && sel.si === si;
                      return (
                        <li key={s._id || si}>
                          <button type="button" onClick={() => clickStudent(gi, si)}
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-sm text-left transition-all"
                            style={on ? { background: `${c.a}26`, boxShadow: `inset 0 0 0 1.5px ${c.a}` } : { background: 'transparent' }}>
                            <Avatar name={s.name} size={26} bg={c.grad} />
                            <span className="truncate flex-1" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                            {on && <ArrowRightLeft className="w-3.5 h-3.5 flex-shrink-0" style={{ color: c.a }} />}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <input value={batchName} onChange={e => setBatchName(e.target.value)} maxLength={80}
              className="input-field flex-1 min-w-[200px]" placeholder={t('randomGroups.setNamePlaceholder')} />
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-extrabold text-white transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #f97316, #c2410c)', boxShadow: '0 14px 28px -12px #ea580c' }}>
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {t('randomGroups.saveGroups')}
            </button>
          </div>
          <p className="text-xs text-muted -mt-2">{t('randomGroups.saveHint')}</p>
        </div>
      )}

      {/* ── Saved sets ── */}
      <div className="space-y-4">
        <h3 className="font-display font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>{t('randomGroups.savedTitle')}</h3>
        {loadingSaved ? (
          <div className="flex justify-center py-6"><div className="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
        ) : batches.length === 0 ? (
          <div className="card text-center py-10">
            <Users className="w-10 h-10 mx-auto mb-2 text-muted opacity-30" />
            <p className="text-sm text-muted">{t('randomGroups.noSaved')}</p>
          </div>
        ) : batches.map((b, bi) => {
          const open = openBatch === b.batch_id;
          const studentsInBatch = b.groups.reduce((n, g) => n + g.members.length, 0);
          const tasksInBatch = b.groups.reduce((n, g) => n + (g.task_count || 0), 0);
          return (
            <div key={b.batch_id} className="tg-rise rounded-3xl overflow-hidden" style={{ animationDelay: `${bi * 60}ms`, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-3 px-5 py-4">
                <button type="button" onClick={() => setOpenBatch(open ? null : b.batch_id)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                  <span className="w-10 h-10 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: colorOf(bi).grad, boxShadow: `0 10px 20px -10px ${colorOf(bi).a}` }}>
                    <Layers className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      {b.batch_name}
                      {bi === 0 && <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,.15)', color: '#c2410c' }}>{t('randomGroups.latestSet')}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {t('randomGroups.resultSummary', { students: studentsInBatch, groups: b.groups.length })}
                      {tasksInBatch > 0 && ` · ${t('randomGroups.tasksGiven', { count: tasksInBatch })}`}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted transition-transform flex-shrink-0 ml-auto ${open ? 'rotate-180' : ''}`} />
                </button>
                <button onClick={() => pdfFor(b.groups, b.batch_name)} title={t('randomGroups.downloadPdf')}
                  className="p-2 rounded-xl hover:bg-surface-100 transition-colors"><Download className="w-4 h-4 text-muted" /></button>
                <button onClick={() => setDeleteBatch(b)} title={t('randomGroups.deleteSet')}
                  className="p-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4 text-muted" /></button>
              </div>

              {open && (
                <div className="px-5 pb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {b.groups.map((g, gi) => {
                    const c = colorOf(groupIndex(g.name, gi));
                    const members = g.members.map(m => ({ id: m.id, name: m.name || '—' }));
                    return (
                      <div key={g.id} role="button" tabIndex={0} aria-label={`${t('randomGroups.openGroup')}: ${g.name}`}
                        onClick={() => setActive({ ...g, members })}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive({ ...g, members }); } }}
                        className="tg-tile tg-rise group cursor-pointer rounded-3xl overflow-hidden outline-none focus-visible:ring-2"
                        style={{ animationDelay: `${gi * 45}ms`, background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 1px 0 rgba(0,0,0,.04)' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 22px 40px -22px ${c.a}`; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 0 rgba(0,0,0,.04)'; }}>
                        <div className="relative px-4 py-3.5 text-white overflow-hidden" style={{ background: c.grad }}>
                          <span aria-hidden className="absolute -right-6 -top-8 w-24 h-24 rounded-full bg-white/10" />
                          <div className="relative flex items-center justify-between gap-2">
                            <span className="font-extrabold text-sm truncate">{g.name}</span>
                            <span className="text-[11px] font-bold text-white/85 flex-shrink-0">{sizeLabel(t, g.members.length)}</span>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          <AvatarStack members={members} color={c} />
                          <ul className="text-xs space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {members.slice(0, 3).map(m => <li key={m.id} className="truncate">{m.name}</li>)}
                            {members.length > 3 && <li className="text-muted">+{members.length - 3}…</li>}
                          </ul>
                          <div className="flex items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={g.task_count > 0 ? { background: `${c.a}1f`, color: c.a } : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                              {g.task_count > 0 ? t('randomGroups.tasksCount', { count: g.task_count }) : t('randomGroups.noTaskYet')}
                            </span>
                            {onAssignTask && (
                              <button type="button" onClick={e => { e.stopPropagation(); onAssignTask({ ...g, members }); }}
                                className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1.5 rounded-full text-white transition-transform active:scale-90 hover:scale-105"
                                style={{ background: c.grad }}>
                                <Plus className="w-3 h-3" /> {t('randomGroups.assignTask')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeGroup && (
        <GroupWorkspace
          group={activeGroup} color={colorOf(groupIndex(activeGroup.name, 0))} cls={cls} mod={mod} t={t}
          hidden={coverOpen} refreshKey={refreshKey}
          onClose={() => setActive(null)}
          onAssign={g => onAssignTask?.(g)}
          onOpenTask={task => onOpenTask?.(task)}
          onRenamed={() => { fetchSaved(); onChanged?.(); }} />
      )}

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
