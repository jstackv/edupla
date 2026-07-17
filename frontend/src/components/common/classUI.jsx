// Shared small presentational helpers used by both the admin Classes page
// and the ManageClassModal. Lives outside pages/ so neither file has to
// import from the other (avoids a circular import between the page and
// the modal it renders).

export const LEVEL_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#64748b'];
export const TRADE_COLORS = ['#f59e0b', '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#10b981', '#3b82f6', '#8b5cf6'];
export const LEVEL_BG    = ['#dbeafe', '#d1fae5', '#ede9fe', '#fef3c7', '#fce7f3', '#cffafe', '#ffedd5', '#f1f5f9'];
export const TRADE_BG    = ['#fef3c7', '#cffafe', '#fce7f3', '#ffedd5', '#e0e7ff', '#d1fae5', '#dbeafe', '#ede9fe'];

export const getLevelMeta = (levels, value) => {
  const idx = levels.findIndex(l => l.value === value);
  const i = idx >= 0 ? idx : 0;
  return { label: levels[idx]?.label || value, color: LEVEL_COLORS[i % LEVEL_COLORS.length], bg: LEVEL_BG[i % LEVEL_BG.length], dark: LEVEL_COLORS[i % LEVEL_COLORS.length] };
};
export const getTradeMeta = (trades, value) => {
  const idx = trades.findIndex(t => t.value === value);
  const i = idx >= 0 ? idx : 0;
  return { label: trades[idx]?.label || value, color: TRADE_COLORS[i % TRADE_COLORS.length], bg: TRADE_BG[i % TRADE_BG.length] };
};

const AVATAR_COLORS = [
  ['#6366f1','#4338ca'], ['#0ea5e9','#0284c7'], ['#10b981','#059669'],
  ['#f59e0b','#d97706'], ['#ec4899','#db2777'], ['#8b5cf6','#7c3aed'],
];
export function getAvatarColors(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

/* ── Status Badge ── */
export function StatusBadge({ is_active }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, letterSpacing: 0.3,
      background: is_active !== false ? '#ecfdf5' : '#fef2f2',
      color: is_active !== false ? '#059669' : '#ef4444',
    }}>
      {is_active !== false ? 'Active' : 'Inactive'}
    </span>
  );
}

/* ── Avatar ── */
export function Avatar({ name, size = 36 }) {
  const [from, to] = getAvatarColors(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `linear-gradient(135deg, ${from}, ${to})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: `0 2px 8px ${from}55`,
    }}>
      <span style={{ color: '#fff', fontWeight: 800, fontSize: size * 0.4, letterSpacing: '-0.01em' }}>
        {name?.[0]?.toUpperCase()}
      </span>
    </div>
  );
}

/* ── Level pill ── */
export function LevelBadge({ level, levels = [] }) {
  if (!level) return null;
  const idx = levels.findIndex(l => l.value === level);
  const i = idx >= 0 ? idx : (level.charCodeAt(0) % LEVEL_COLORS.length);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: LEVEL_BG[i % LEVEL_BG.length], color: LEVEL_COLORS[i % LEVEL_COLORS.length], letterSpacing: '0.04em',
    }}>{level}</span>
  );
}

/* ── Trade pill ── */
export function TradeBadge({ trade, trades = [] }) {
  if (!trade) return null;
  const idx = trades.findIndex(t => t.value === trade);
  const i = idx >= 0 ? idx : (trade.charCodeAt(0) % TRADE_COLORS.length);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: TRADE_BG[i % TRADE_BG.length], color: TRADE_COLORS[i % TRADE_COLORS.length],
    }}>{trade}</span>
  );
}
