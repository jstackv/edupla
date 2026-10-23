/**
 * AnnouncementLetter — shows an announcement as a plain, formal letter.
 *
 *   EDUPLA                                      15 October 2026
 *   Class announcement                          Ref. EDU/ANN/4F2A9C
 *   ═══════════════════════════════════════════════════════════
 *   To:       Students of L4 NIT
 *   From:     JMV, Teacher
 *   Subject:  HOMEWORK ANNOUNCEMENT
 *
 *   Dear Students,
 *   …paragraphs, numbered headings, numbered steps, a short facts table…
 *   Thank you, and best of luck!
 *   Kind regards,
 *   JMV
 *
 * Deliberately restrained: no icons, emoji or coloured cards — just
 * typography (in EDUPLA's own font), one rule and a facts table, like a printed school notice.
 * Used by the student feed, the teacher list (the teacher passes `actions`
 * for edit / delete) and the live preview while composing.
 */
import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { parseLetter } from '../../utils/letterParser';

// The same font as the rest of EDUPLA (and as the announcement e-mail).
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const COLLAPSED_PX = 520;
const ACCENT = '#c2410c';

const body = { fontFamily: FONT, fontSize: 14.5, lineHeight: 1.75, color: 'var(--text-primary)' };

// Emoji are for chat, not for a formal letter.
const clean = (s) => String(s || '').replace(/\p{Extended_Pictographic}[\uFE0F\u200D]*/gu, '').replace(/[ \t]{2,}/g, ' ').trim();

const formatDate = (d, lang) => {
  const date = d ? new Date(d) : new Date();
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  try { return date.toLocaleDateString(lang === 'rw' ? 'en-GB' : lang, opts); }
  catch { return date.toLocaleDateString('en-GB', opts); }
};

const Heading = ({ n, children }) => (
  <h4 className="font-bold" style={{ ...body, fontSize: 15.5, marginBottom: 2 }}>{n ? `${n}. ` : ''}{clean(children)}</h4>
);

function Items({ items, ordered }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} pl-6 space-y-0.5 marker:font-semibold`} style={{ ...body, fontSize: 14.5 }}>
      {items.map((it, i) => <li key={i}>{clean(it)}</li>)}
    </Tag>
  );
}

function Block({ b, n }) {
  switch (b.type) {
    case 'paragraph':
      return <p style={body}>{clean(b.text)}</p>;

    case 'labelled':
      return <p style={body}><strong>{clean(b.label)}:</strong> {clean(b.text)}</p>;

    case 'section':
      return (
        <div>
          <Heading n={n}>{b.heading}</Heading>
          {b.items ? <Items items={b.items} ordered={b.ordered} />
            : b.text ? <p style={{ ...body, fontSize: 14.5 }}>{clean(b.text)}</p> : null}
        </div>
      );

    case 'steps':
      return (
        <div>
          <Heading n={n}>{b.heading}</Heading>
          <Items items={b.items} ordered />
        </div>
      );

    case 'list':
      return <Items items={b.items} ordered={b.ordered} />;

    case 'warning':
      return (
        <p style={{ ...body, borderLeft: `3px solid ${ACCENT}`, paddingLeft: 14 }}>
          {b.heading && <strong>{clean(b.heading)}: </strong>}{clean(b.text)}
        </p>
      );

    default:
      return null;
  }
}

/* Consecutive facts (deadline, date, venue…) form one small table. */
function Facts({ facts }) {
  return (
    <dl className="my-1" style={{ borderTop: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)' }}>
      {facts.map((f, i) => (
        <div key={i} className="grid sm:grid-cols-[minmax(0,210px)_minmax(0,1fr)] gap-x-4 py-1.5"
          style={i > 0 ? { borderTop: '1px solid var(--card-border)' } : undefined}>
          <dt className="font-bold" style={{ ...body, fontSize: 14.5, lineHeight: 1.6 }}>{clean(f.label)}</dt>
          <dd style={{ ...body, fontSize: 14.5, lineHeight: 1.6 }}>{clean(f.value)}</dd>
        </div>
      ))}
    </dl>
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
  const subject = clean(a.title) || a.title;
  const ref = `EDU/ANN/${String(a.id || a._id || 'DRAFT').slice(-6).toUpperCase()}`;

  // Group consecutive facts; number the headed parts when there are at least two.
  const groups = [];
  parsed.blocks.forEach(b => {
    const prev = groups[groups.length - 1];
    if (b.type === 'fact') { if (prev && prev.facts) prev.facts.push(b); else groups.push({ facts: [b] }); }
    else groups.push({ block: b });
  });
  const headed = (b) => b && (b.type === 'steps' || (b.type === 'section' && b.heading));
  const numbered = parsed.blocks.filter(headed).length >= 2;
  let counter = 0;

  return (
    <article className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        boxShadow: flash ? `0 0 0 3px rgba(194,65,12,0.5), 0 14px 40px rgba(194,65,12,0.25)` : 'none',
        transition: 'box-shadow .4s ease',
      }}>
      {/* Letterhead */}
      <header className="px-6 sm:px-10 pt-7 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="font-display font-extrabold text-xl leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
            EDU<span style={{ color: ACCENT }}>PLA</span>
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5 text-muted">
            {a.class_name ? t('announcementLetter.classAnnouncement') : t('announcementLetter.generalAnnouncement')}
          </p>
        </div>
        <div className="sm:text-right">
          <p style={{ fontFamily: FONT, fontSize: 14, color: 'var(--text-primary)' }}>{formatDate(a.created_at, i18n.language)}</p>
          <p className="text-[11px] text-muted mt-0.5 tracking-wide">{t('announcementLetter.ref')} {ref}</p>
          {actions && <div className="mt-1.5 flex sm:justify-end gap-1">{actions}</div>}
        </div>
      </header>
      <div className="mx-6 sm:mx-10" style={{ height: 2, background: ACCENT }} />

      {/* To / From / Subject */}
      <div className="px-6 sm:px-10 pt-5 space-y-1" style={{ fontFamily: FONT, fontSize: 15, color: 'var(--text-primary)' }}>
        {[[t('announcementLetter.to'), recipient], [t('announcementLetter.from'), sender ? `${sender}, ${t('announcementLetter.teacher')}` : t('announcementLetter.teacher')]].map(([label, value]) => (
          <p key={label} className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-2">
            <strong>{label}:</strong><span className="break-words">{value}</span>
          </p>
        ))}
        <p className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-2 pt-1">
          <strong>{t('announcementLetter.subject')}:</strong>
          <span className="font-bold break-words underline" style={{ textUnderlineOffset: 4, textDecorationThickness: 1 }}>{subject}</span>
        </p>
      </div>

      {/* Body */}
      <div className="relative">
        <div ref={bodyRef} className="px-6 sm:px-10 pt-6 pb-7 space-y-4"
          style={!expanded ? { maxHeight: COLLAPSED_PX, overflow: 'hidden' } : undefined}>
          <p style={body}>{parsed.salutation || t('announcementLetter.dearFallback')}</p>

          {groups.map((g, i) => (
            <div key={i}>
              {g.facts ? <Facts facts={g.facts} /> : <Block b={g.block} n={numbered && headed(g.block) ? ++counter : null} />}
            </div>
          ))}

          {parsed.closing && <p style={body}>{clean(parsed.closing)}</p>}

          <div className="pt-2">
            {!parsed.hasSignoff && <p style={body}>{t('announcementLetter.kindRegards')}</p>}
            <p className="mt-6 font-bold" style={{ ...body, fontSize: 16 }}>{sender || t('announcementLetter.teacher')}</p>
            <p className="text-[12px] text-muted" style={{ fontFamily: FONT }}>
              {t('announcementLetter.teacher')}{a.class_name ? `, ${a.class_name}` : ''}
            </p>
          </div>
        </div>
        {!expanded && (
          <div className="absolute inset-x-0 bottom-0 h-28 flex items-end justify-center pb-4 pointer-events-none"
            style={{ background: 'linear-gradient(to top, var(--card-bg) 30%, transparent)' }}>
            <button type="button" onClick={() => setOpen(true)}
              className="pointer-events-auto px-5 py-1.5 rounded-full text-xs font-bold transition-colors hover:opacity-80"
              style={{ border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--card-bg)' }}>
              {t('announcementLetter.readFull')}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-6 sm:px-10 py-3 flex items-center justify-between gap-3 flex-wrap text-[11px] font-semibold text-muted"
        style={{ borderTop: '1px solid var(--card-border)' }}>
        <span>{t('announcementLetter.sentVia')}</span>
        {tall && collapsible && open && !forceOpen
          ? <button type="button" onClick={() => setOpen(false)} className="font-bold hover:opacity-80" style={{ color: ACCENT }}>{t('announcementLetter.showLess')}</button>
          : <span>{recipient}</span>}
      </footer>
    </article>
  );
}