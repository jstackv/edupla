import { ChevronRight, ArrowLeft, ClipboardList } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════
   Workspace UI kit — the look of the teacher's Task Manager, shared by
   every "pick a class / pick a module / see the content" screen:
   gradient Hero banner, glass StatTiles, big SelectCards.
══════════════════════════════════════════════════════════════════════ */

export const BRAND_THEME = {
  icon: ClipboardList,
  hero: 'linear-gradient(135deg, #140803 0%, #431407 48%, #c2410c 100%)',
  accent: '#ea580c', accent2: '#f59e0b', soft: 'rgba(234,88,12,0.10)', ring: 'rgba(234,88,12,0.35)',
};

/* Same look, different icon (e.g. the library uses a folder). */
export const brandWith = (icon) => ({ ...BRAND_THEME, icon });

export const initialsOf = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

/* Entrance animation for the children of a `.ws-root` wrapper. */
export const workspaceStyle = `
  @keyframes ws-rise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
  .ws-root > * { animation: ws-rise .45s cubic-bezier(.2,.8,.2,1) both }
  .ws-root > *:nth-child(2) { animation-delay: .05s } .ws-root > *:nth-child(3) { animation-delay: .1s } .ws-root > *:nth-child(4) { animation-delay: .15s }
  @media (prefers-reduced-motion: reduce) { .ws-root > * { animation: none } }
`;

/* Gradient banner at the top of every screen. */
export function Hero({ tone = BRAND_THEME, onBack, trail = [], eyebrow, title, subtitle, actions, children }) {
  const Icon = tone.icon;
  return (
    <div className="relative overflow-hidden rounded-3xl text-white" style={{ background: tone.hero, boxShadow: `0 20px 50px -22px ${tone.accent}` }}>
      <div aria-hidden className="absolute -right-14 -top-20 w-64 h-64 rounded-full blur-3xl opacity-40" style={{ background: tone.accent2 }} />
      <div aria-hidden className="absolute -left-10 -bottom-24 w-56 h-56 rounded-full blur-3xl opacity-25" style={{ background: tone.accent }} />
      <Icon aria-hidden className="absolute right-6 -bottom-4 w-40 h-40 opacity-[0.07]" />
      <div className="relative p-5 sm:p-6">
        {(onBack || trail.length > 0) && (
          <div className="flex items-center gap-3 mb-4">
            {onBack && (
              <button onClick={onBack} aria-label="Back"
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/25 active:scale-95 flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(6px)' }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {trail.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-white/65 min-w-0 flex-wrap">
                {trail.map((t, i) => (
                  <span key={i} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                    <span className={`truncate ${i === trail.length - 1 ? 'font-bold text-white' : ''}`}>{t}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1 min-w-0">
            {eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/60 mb-1.5">{eyebrow}</p>}
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl leading-tight break-words">{title}</h1>
            {subtitle && <p className="text-sm text-white/75 mt-1.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function HeroButton({ onClick, icon: Icon, children, primary }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5 active:scale-95"
      style={primary
        ? { background: '#fff', color: '#18181b', boxShadow: '0 10px 24px -8px rgba(0,0,0,0.5)' }
        : { background: 'rgba(255,255,255,0.16)', color: '#fff', backdropFilter: 'blur(6px)' }}>
      {Icon && <Icon className="w-4 h-4" />} {children}
    </button>
  );
}

export function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)' }}>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}><Icon className="w-4 h-4" /></span>
      <div className="min-w-0">
        <p className="text-xl font-extrabold leading-none">{value}</p>
        <p className="text-[11px] text-white/65 mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

/* Small caps label above a group of cards ("Step 1 · Choose a class"). */
export function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center gap-3 mb-3 px-1">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">{children}</p>
      <span className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
      {right}
    </div>
  );
}

/* Big option card used for classes, modules and kind pickers. */
export function SelectCard({ icon: Icon, lead, title, desc, chips = [], tone = BRAND_THEME, onClick, large }) {
  return (
    <button onClick={onClick}
      className="group relative overflow-hidden text-left rounded-3xl transition-all hover:-translate-y-1 active:scale-[0.99]"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: large ? 24 : 18 }}>
      <span aria-hidden className="absolute -right-10 -top-10 w-36 h-36 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: tone.soft }} />
      <span aria-hidden className="absolute left-0 right-0 bottom-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, ${tone.accent}, ${tone.accent2})` }} />
      <div className="relative flex items-start gap-4">
        <span className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-extrabold transition-transform group-hover:scale-105 group-hover:-rotate-3"
          style={{ width: large ? 60 : 50, height: large ? 60 : 50, fontSize: 14, background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`, boxShadow: `0 10px 22px -8px ${tone.accent}` }}>
          {Icon ? <Icon className={large ? 'w-7 h-7' : 'w-6 h-6'} /> : lead}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-display font-bold truncate ${large ? 'text-lg' : 'text-sm'}`} style={{ color: 'var(--text-primary)' }}>{title}</p>
          {desc && <p className="text-xs text-muted mt-1 leading-relaxed">{desc}</p>}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {chips.map(c => (
                <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: tone.soft, color: tone.accent }}>{c}</span>
              ))}
            </div>
          )}
        </div>
        <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all group-hover:translate-x-1"
          style={{ background: tone.soft }}>
          <ChevronRight className="w-4 h-4" style={{ color: tone.accent }} />
        </span>
      </div>
    </button>
  );
}

export function Loader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
}

/* Friendly empty state in the same dashed-card style as the Task Manager. */
export function EmptyPanel({ icon: Icon, tone = BRAND_THEME, title, text, children }) {
  return (
    <div className="relative overflow-hidden rounded-3xl text-center py-16 px-6" style={{ background: 'var(--card-bg)', border: '1px dashed var(--input-border)' }}>
      <span className="inline-flex w-16 h-16 rounded-3xl items-center justify-center mb-4" style={{ background: tone.soft }}>
        <Icon className="w-8 h-8" style={{ color: tone.accent }} />
      </span>
      <p className="font-display font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {text && <p className="text-sm text-muted max-w-sm mx-auto">{text}</p>}
      {children && <div className="mt-5 flex justify-center">{children}</div>}
    </div>
  );
}
