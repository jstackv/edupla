/**
 * AnnouncementLetter — shows an announcement as a formal letter.
 *
 *   ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 *   [E] EDUPLA                          15 October 2026
 *       Class announcement               Ref. EDU/ANN/4F2A9C
 *   ═════════════════════════════════════════════════
 *   From:  JMV · Teacher        To:  Students of L4 NIT
 *   SUBJECT   Homework announcement
 *   Dear Students,
 *   …body: paragraphs, step lists, key facts, notices…
 *   Thank you, and best of luck!
 *   Kind regards,
 *   JMV
 *
 * Used by both the student feed and the teacher's list (the teacher passes
 * `actions` for edit / delete) and by the live preview while composing.
 * The structure comes from utils/letterParser — teachers just type plain text.
 */
import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { parseLetter } from '../../utils/letterParser';
import { AlertTriangle, CalendarClock, ListChecks, FileText, ChevronDown, Check, Sparkles } from 'lucide-react';

const SERIF = "Georgia, 'Times New Roman', 'Noto Serif', serif";
const COLLAPSED_PX = 520;

const formatDate = (d, lang) => {
  const date = d ? new Date(d) : new Date();
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  try { return date.toLocaleDateString(lang === 'rw' ? 'en-GB' : lang, opts); }
  catch { return date.toLocaleDateString('en-GB', opts); }
};

/* Small square that holds a section's emoji (or a fallback icon). */
function Tile({ emoji, Icon, tint = 'rgba(194,65,12,0.12)', color = '#c2410c', size = 36 }) {
  return (
    <span className="inline-flex items-center justify-center rounded-xl flex-shrink-0 select-none"
      style={{ width: size, height: size, background: tint, color, fontSize: size * 0.5 }}>
      {emoji ? <span aria-hidden>{emoji}</span> : <Icon style={{ width: size * 0.5, height: size * 0.5 }} />}
    </span>
  );
}

const sectionTitle = { fontSize: 14, letterSpacing: '0.01em', color: 'var(--text-primary)' };
const bodyText = { fontFamily: SERIF, fontSize: 15, lineHeight: 1.75, color: 'var(--text-primary)' };

function Block({ b }) {
  switch (b.type) {
    case 'paragraph':
      return <p style={bodyText}>{b.emoji && <span aria-hidden className="mr-1.5">{b.emoji}</span>}{b.text}</p>;

    case 'section':
      return (
        <div className="flex gap-3 rounded-2xl p-4" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
          <Tile emoji={b.emoji} Icon={FileText} />
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-extrabold" style={sectionTitle}>{b.heading}</h4>
            {b.text && <p className="mt-1" style={{ ...bodyText, fontSize: 14.5 }}>{b.text}</p>}
          </div>
        </div>
      );

    case 'steps':
      return (
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <Tile emoji={b.emoji} Icon={ListChecks} />
            <h4 className="font-display font-extrabold" style={sectionTitle}>{b.heading}</h4>
          </div>
          <ol className="space-y-2.5">
            {b.items.map((it, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white flex-shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #f97316, #c2410c)' }}>{i + 1}</span>
                <span style={{ ...bodyText, fontSize: 14.5, lineHeight: 1.6 }}>{it}</span>
              </li>
            ))}
          </ol>
        </div>
      );

    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul';
      return (
        <Tag className="space-y-1.5 pl-1">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 items-start" style={{ ...bodyText, fontSize: 14.5 }}>
              <span className="flex-shrink-0 font-extrabold" style={{ color: '#c2410c', minWidth: 16 }}>{b.ordered ? `${i + 1}.` : '•'}</span>
              <span>{it}</span>
            </li>
          ))}
        </Tag>
      );
    }

    case 'warning':
      return (
        <div className="flex gap-3 rounded-2xl p-4" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', borderLeft: '4px solid #f59e0b' }}>
          <Tile emoji={b.emoji} Icon={AlertTriangle} tint="rgba(245,158,11,0.18)" color="#d97706" />
          <div className="min-w-0 flex-1">
            {b.heading && <h4 className="font-display font-extrabold" style={{ ...sectionTitle, color: '#d97706' }}>{b.heading}</h4>}
            <p className={b.heading ? 'mt-1' : ''} style={{ ...bodyText, fontSize: 14.5 }}>{b.text}</p>
          </div>
        </div>
      );

    default:
      return null;
  }
}

/* Consecutive key facts (deadline, date, venue…) sit side by side. */
function FactGrid({ facts }) {
  return (
    <div className={`grid gap-3 ${facts.length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {facts.map((f, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl p-3.5"
          style={{ background: 'linear-gradient(135deg, rgba(194,65,12,0.10), rgba(194,65,12,0.03))', border: '1px solid rgba(194,65,12,0.30)' }}>
          <Tile emoji={f.emoji} Icon={CalendarClock} tint="rgba(194,65,12,0.16)" size={40} />
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: '#c2410c' }}>{f.label}</p>
            <p className="font-bold leading-snug" style={{ fontFamily: SERIF, fontSize: 16, color: 'var(--text-primary)' }}>{f.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnnouncementLetter({ announcement: a, senderName, actions, flash = false, forceOpen = false, collapsible = true }) {
  const { t, i18n } = useTranslation();
  const parsed = useMemo(() => parseLetter(a.content), [a.content]);
  const bodyRef = useRef(null);
  const [tall, setTall] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!collapsible || !bodyRef.current) return;
    setTall(bodyRef.current.scrollHeight > COLLAPSED_PX + 80);
  }, [a.content, collapsible]);

  const expanded = !collapsible || open || forceOpen || !tall;
  const sender = senderName || a.teacher_name || '';
  const recipient = a.class_name ? t('announcementLetter.classStudents', { name: a.class_name }) : t('announcementLetter.allStudents');
  // A formal subject line has no emoji marker in front of it.
  const subject = String(a.title || '').replace(/^(?:\p{Extended_Pictographic}[\uFE0F\u200D]*\s*)+/u, '').trim() || a.title;
  const ref = `EDU/ANN/${String(a.id || a._id || 'DRAFT').slice(-6).toUpperCase()}`;

  // Group consecutive facts into one grid.
  const groups = [];
  parsed.blocks.forEach(b => {
    const prev = groups[groups.length - 1];
    if (b.type === 'fact') { if (prev && prev.facts) prev.facts.push(b); else groups.push({ facts: [b] }); }
    else groups.push({ block: b });
  });

  return (
    <article className="rounded-3xl overflow-hidden relative"
      style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        boxShadow: flash ? '0 0 0 3px rgba(194,65,12,0.55), 0 14px 40px rgba(194,65,12,0.3)' : '0 1px 0 rgba(0,0,0,0.04)',
        transition: 'box-shadow .4s ease',
      }}>
      <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #7c2d12, #c2410c, #fb923c)' }} />

      {/* Letterhead */}
      <header className="px-6 sm:px-9 pt-6 pb-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-extrabold text-lg text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #c2410c, #7c2d12)', boxShadow: '0 8px 18px -8px #c2410c' }}>E</span>
          <div>
            <p className="font-display font-extrabold text-lg leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
              EDU<span style={{ color: '#c2410c' }}>PLA</span>
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mt-1.5 text-muted">
              {a.class_name ? t('announcementLetter.classAnnouncement') : t('announcementLetter.generalAnnouncement')}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p style={{ fontFamily: SERIF, fontSize: 14, color: 'var(--text-primary)' }}>{formatDate(a.created_at, i18n.language)}</p>
          <p className="text-[11px] text-muted mt-0.5 tracking-wide">{t('announcementLetter.ref')} {ref}</p>
          {actions && <div className="mt-2 flex sm:justify-end gap-1">{actions}</div>}
        </div>
      </header>

      <div className="mx-6 sm:mx-9" style={{ borderTop: '3px double var(--card-border)' }} />

      {/* From / To */}
      <div className="px-6 sm:px-9 pt-4 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
        {[[t('announcementLetter.from'), sender ? `${sender} · ${t('announcementLetter.teacher')}` : t('announcementLetter.teacher')], [t('announcementLetter.to'), recipient]].map(([label, value]) => (
          <p key={label} className="flex gap-3 items-baseline text-sm">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted w-10 flex-shrink-0">{label}</span>
            <span className="font-semibold min-w-0 break-words" style={{ fontFamily: SERIF, color: 'var(--text-primary)' }}>{value}</span>
          </p>
        ))}
      </div>

      {/* Subject */}
      <div className="px-6 sm:px-9 pt-4">
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(194,65,12,0.08)', borderLeft: '4px solid #c2410c' }}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: '#c2410c' }}>{t('announcementLetter.subject')}</p>
          <h3 className="font-bold mt-0.5 break-words" style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.35, color: 'var(--text-primary)' }}>{subject}</h3>
        </div>
      </div>

      {/* Body */}
      <div className="relative">
        <div ref={bodyRef} className="px-6 sm:px-9 pt-5 pb-7 space-y-4"
          style={!expanded ? { maxHeight: COLLAPSED_PX, overflow: 'hidden' } : undefined}>
          <p className="font-bold" style={{ ...bodyText, fontSize: 16 }}>{parsed.salutation || t('announcementLetter.dearFallback')}</p>

          {groups.map((g, i) => (
            <div key={i}>{g.facts ? <FactGrid facts={g.facts} /> : <Block b={g.block} />}</div>
          ))}

          {parsed.closing && <p className="pt-1" style={bodyText}>{parsed.closing}</p>}

          {/* Sign-off */}
          <div className="pt-3">
            {!parsed.hasSignoff && <p style={bodyText}>{t('announcementLetter.kindRegards')}</p>}
            <p className="mt-3 italic" style={{ fontFamily: SERIF, fontSize: 22, color: '#c2410c', lineHeight: 1.1 }}>{sender || t('announcementLetter.teacher')}</p>
            <div className="mt-2 h-px w-44" style={{ background: 'var(--card-border)' }} />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted mt-1.5">
              {t('announcementLetter.teacher')}{a.class_name ? ` · ${a.class_name}` : ''}
            </p>
          </div>
        </div>
        {!expanded && (
          <div className="absolute inset-x-0 bottom-0 h-28 flex items-end justify-center pb-4 pointer-events-none"
            style={{ background: 'linear-gradient(to top, var(--card-bg) 30%, transparent)' }}>
            <button type="button" onClick={() => setOpen(true)}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-extrabold text-white transition-all hover:-translate-y-0.5 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #f97316, #c2410c)', boxShadow: '0 10px 22px -10px #c2410c' }}>
              {t('announcementLetter.readFull')} <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-6 sm:px-9 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--surface-100)', borderTop: '1px solid var(--card-border)' }}>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Sparkles className="w-3 h-3" style={{ color: '#c2410c' }} /> {t('announcementLetter.sentVia')}</span>
        {tall && collapsible && open && !forceOpen ? (
          <button type="button" onClick={() => setOpen(false)} className="text-[11px] font-bold flex items-center gap-1" style={{ color: '#c2410c' }}>
            <Check className="w-3 h-3" /> {t('announcementLetter.showLess')}
          </button>
        ) : <span className="text-[11px] font-semibold text-muted">{recipient}</span>}
      </footer>
    </article>
  );
}
