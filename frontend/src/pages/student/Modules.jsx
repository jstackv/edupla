import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  LibraryBig, Search, X, Hash, GraduationCap, BookMarked,
  Target, Globe2, Puzzle, Compass, Layers3, LayoutGrid, Rows3,
  Star, Mail, Copy, Check, ChevronDown,
} from 'lucide-react';

/* Each module category gets its own accent + icon. This accent is threaded
   through the card's top bar, icon badge, teacher avatar and hover glow via
   the --modx-accent CSS variable, so the grid reads as color-coded at a
   glance instead of a flat list of identical tiles. */
const CATEGORY_META = {
  'Specific modules':        { accent: '#8b5cf6', icon: Target,  short: 'Specific' },
  'General modules':         { accent: '#0ea5e9', icon: Globe2,  short: 'General' },
  'Complementary modules':   { accent: '#10b981', icon: Puzzle,  short: 'Complementary' },
  'Elective Non Examinable': { accent: '#f59e0b', icon: Compass, short: 'Elective' },
};
const DEFAULT_META = { accent: '#0d9488', icon: LibraryBig, short: 'Module' };
const getMeta = (category) => CATEGORY_META[category] || DEFAULT_META;

const PIN_KEY = 'edupla_pinned_modules';
const loadPinned = () => {
  try { return new Set(JSON.parse(localStorage.getItem(PIN_KEY)) || []); }
  catch { return new Set(); }
};
const savePinned = (set) => {
  try { localStorage.setItem(PIN_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
};

const SORT_OPTIONS = [
  { value: 'name',     label: 'Sort: Name' },
  { value: 'teacher',  label: 'Sort: Teacher' },
  { value: 'category', label: 'Sort: Category' },
];

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="modx-skel-card" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 13 }} />
            <div className="flex-1 space-y-2 pt-1">
              <div className="skeleton" style={{ height: 12, width: '70%' }} />
              <div className="skeleton" style={{ height: 10, width: '45%' }} />
            </div>
          </div>
          <div className="skeleton mb-3" style={{ height: 18, width: 90, borderRadius: 8 }} />
          <div className="modx-divider" />
          <div className="skeleton" style={{ height: 10, width: '60%' }} />
        </div>
      ))}
    </div>
  );
}

export default function StudentModules() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [pinned, setPinned] = useState(loadPinned);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    api.get('/classes/my/modules')
      .then(r => setModules(r.data.modules || []))
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoading(false));
  }, []);

  const togglePin = (id) => {
    setPinned(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      savePinned(next);
      return next;
    });
  };

  const copyEmail = (email, id) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedId(id);
      toast.success('Email copied');
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1600);
    }).catch(() => toast.error('Could not copy email'));
  };

  const categories = useMemo(
    () => [...new Set(modules.map(m => m.category).filter(Boolean))],
    [modules]
  );
  const teacherCount = useMemo(
    () => new Set(modules.map(m => m.teacher_name).filter(Boolean)).size,
    [modules]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = modules.filter(m => {
      if (activeCategory !== 'all' && m.category !== activeCategory) return false;
      if (!q) return true;
      return (
        m.name?.toLowerCase().includes(q) ||
        m.teacher_name?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      const aPinned = pinned.has(a.id), bPinned = pinned.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (sortBy === 'teacher') return (a.teacher_name || '\uffff').localeCompare(b.teacher_name || '\uffff');
      if (sortBy === 'category') return (a.category || '\uffff').localeCompare(b.category || '\uffff');
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [modules, query, activeCategory, sortBy, pinned]);

  if (loading) return (
    <div className="space-y-5">
      <div className="skeleton" style={{ height: 150, borderRadius: 26 }} />
      <SkeletonGrid />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="modx-hero">
        <div className="modx-hero-dots" />
        <div className="modx-hero-glow" />
        <div className="modx-hero-glow-2" />
        <div className="modx-hero-content">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div className="flex items-center gap-3">
              <div className="modx-hero-icon">
                <LibraryBig className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-extrabold text-xl leading-tight" style={{ letterSpacing: '-0.02em' }}>
                  Your Modules
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Everything you're studying this term, and who's teaching it
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <div className="modx-hero-stat" style={{ animationDelay: '60ms' }}>
              <Layers3 className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.75)' }} />
              <div>
                <div className="modx-hero-stat-num">{modules.length}</div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Modules</div>
              </div>
            </div>
            <div className="modx-hero-stat" style={{ animationDelay: '120ms' }}>
              <GraduationCap className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.75)' }} />
              <div>
                <div className="modx-hero-stat-num">{teacherCount}</div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Teachers</div>
              </div>
            </div>
            <div className="modx-hero-stat" style={{ animationDelay: '180ms' }}>
              <BookMarked className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.75)' }} />
              <div>
                <div className="modx-hero-stat-num">{categories.length}</div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Categories</div>
              </div>
            </div>
            {pinned.size > 0 && (
              <div className="modx-hero-stat" style={{ animationDelay: '240ms' }}>
                <Star className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.75)' }} />
                <div>
                  <div className="modx-hero-stat-num">{pinned.size}</div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Pinned</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Toolbar: search + filters + sort + view toggle ──────── */}
      {modules.length > 0 && (
        <div className="modx-toolbar">
          <div className="modx-search-wrap">
            <Search className="w-4 h-4 modx-search-icon" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search modules or teachers…"
              className="modx-search-input"
            />
            {query && (
              <div className="modx-search-clear" onClick={() => setQuery('')}>
                <X className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          <div className="modx-filter-row">
            <button
              className={`modx-filter-pill ${activeCategory === 'all' ? 'modx-filter-active' : ''}`}
              style={{ '--modx-accent': '#0d9488' }}
              onClick={() => setActiveCategory('all')}
            >
              <span className="modx-filter-dot" />All
            </button>
            {categories.map(cat => {
              const meta = getMeta(cat);
              return (
                <button
                  key={cat}
                  className={`modx-filter-pill ${activeCategory === cat ? 'modx-filter-active' : ''}`}
                  style={{ '--modx-accent': meta.accent }}
                  onClick={() => setActiveCategory(cat)}
                >
                  <span className="modx-filter-dot" />{meta.short}
                </button>
              );
            })}
          </div>

          <div className="modx-select-wrap">
            <select className="modx-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 modx-select-chevron" />
          </div>

          <div className="modx-view-toggle">
            <button
              className={`modx-view-btn ${viewMode === 'grid' ? 'modx-view-active' : ''}`}
              title="Grid view"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              className={`modx-view-btn ${viewMode === 'list' ? 'modx-view-active' : ''}`}
              title="List view"
              onClick={() => setViewMode('list')}
            >
              <Rows3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────── */}
      {modules.length === 0 ? (
        <div className="modx-empty">
          <div className="modx-empty-icon">
            <LibraryBig className="w-7 h-7" />
          </div>
          <p className="font-display font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No modules yet</p>
          <p className="text-sm text-muted">Your admin hasn't assigned any modules to your class yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="modx-empty">
          <div className="modx-empty-icon">
            <Search className="w-6 h-6" />
          </div>
          <p className="font-display font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No matches</p>
          <p className="text-sm text-muted">Try a different search term or category.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="modx-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mod, i) => {
            const meta = getMeta(mod.category);
            const Icon = meta.icon;
            const isPinned = pinned.has(mod.id);
            return (
              <div
                key={mod.id}
                className={`modx-card ${isPinned ? 'modx-is-pinned' : ''}`}
                style={{ '--modx-accent': meta.accent, '--i': i }}
              >
                {isPinned && <span className="modx-pinned-ribbon">Pinned</span>}
                <button
                  type="button"
                  className={`modx-pin-btn ${isPinned ? 'modx-pinned' : ''}`}
                  title={isPinned ? 'Unpin module' : 'Pin module'}
                  onClick={() => togglePin(mod.id)}
                >
                  <Star className="w-3.5 h-3.5" fill={isPinned ? 'currentColor' : 'none'} />
                </button>

                <div className="flex items-start gap-3 mb-3 pr-6">
                  <div className="modx-icon-badge">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {mod.name}
                    </h3>
                    {mod.description && (
                      <p className="text-xs text-muted line-clamp-2 mt-0.5">{mod.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  {mod.category && (
                    <span className="modx-cat-pill">
                      <Icon className="w-3 h-3" />{meta.short}
                    </span>
                  )}
                  {mod.code && (
                    <span className="modx-class-chip">
                      <Hash className="w-3 h-3" />{mod.code}
                    </span>
                  )}
                </div>

                <div className="modx-divider" />

                <div className="flex items-center gap-2 mb-2">
                  {mod.teacher_name ? (
                    <>
                      <div className="modx-avatar">{getInitials(mod.teacher_name)}</div>
                      <div className="text-xs min-w-0 flex-1">
                        <span className="text-muted">Taught by </span>
                        <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{mod.teacher_name}</span>
                        {mod.teacher_email && (
                          <a href={`mailto:${mod.teacher_email}`} className="modx-email-row block truncate">
                            <Mail className="w-2.5 h-2.5" />{mod.teacher_email}
                          </a>
                        )}
                      </div>
                      {mod.teacher_email && (
                        <button
                          type="button"
                          className={`modx-copy-btn ${copiedId === mod.id ? 'modx-copied' : ''}`}
                          title="Copy email"
                          onClick={() => copyEmail(mod.teacher_email, mod.id)}
                        >
                          {copiedId === mod.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted italic">No teacher assigned yet</span>
                  )}
                </div>

                {mod.classes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {mod.classes.map(c => (
                      <span key={c.id} className="modx-class-chip">
                        <BookMarked className="w-3 h-3" />{c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5 modx-grid">
          {filtered.map((mod, i) => {
            const meta = getMeta(mod.category);
            const Icon = meta.icon;
            const isPinned = pinned.has(mod.id);
            return (
              <div key={mod.id} className="modx-row" style={{ '--modx-accent': meta.accent, '--i': i }}>
                <div className="modx-row-icon"><Icon className="w-4.5 h-4.5" /></div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{mod.name}</h3>
                    {mod.category && <span className="modx-cat-pill flex-shrink-0"><Icon className="w-3 h-3" />{meta.short}</span>}
                    {mod.code && <span className="modx-class-chip flex-shrink-0"><Hash className="w-3 h-3" />{mod.code}</span>}
                  </div>
                  {mod.teacher_name && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted">
                      <div className="modx-avatar" style={{ width: 18, height: 18, fontSize: 8 }}>{getInitials(mod.teacher_name)}</div>
                      <span className="truncate">{mod.teacher_name}</span>
                    </div>
                  )}
                </div>

                {mod.teacher_email && (
                  <button
                    type="button"
                    className={`modx-copy-btn ${copiedId === mod.id ? 'modx-copied' : ''}`}
                    title="Copy teacher email"
                    onClick={() => copyEmail(mod.teacher_email, mod.id)}
                    style={{ margin: 0 }}
                  >
                    {copiedId === mod.id ? <Check className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  </button>
                )}

                <button
                  type="button"
                  className={`modx-pin-btn ${isPinned ? 'modx-pinned' : ''}`}
                  title={isPinned ? 'Unpin module' : 'Pin module'}
                  onClick={() => togglePin(mod.id)}
                  style={{ position: 'static', opacity: 1, transform: 'none' }}
                >
                  <Star className="w-3.5 h-3.5" fill={isPinned ? 'currentColor' : 'none'} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}