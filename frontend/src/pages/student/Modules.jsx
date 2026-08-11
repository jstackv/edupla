import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  LibraryBig, Search, X, Hash, GraduationCap, BookMarked,
  Target, Globe2, Puzzle, Compass, Layers3,
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
const DEFAULT_META = { accent: '#6366f1', icon: LibraryBig, short: 'Module' };
const getMeta = (category) => CATEGORY_META[category] || DEFAULT_META;

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
};

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

  useEffect(() => {
    api.get('/classes/my/modules')
      .then(r => setModules(r.data.modules || []))
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoading(false));
  }, []);

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
    return modules.filter(m => {
      if (activeCategory !== 'all' && m.category !== activeCategory) return false;
      if (!q) return true;
      return (
        m.name?.toLowerCase().includes(q) ||
        m.teacher_name?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q)
      );
    });
  }, [modules, query, activeCategory]);

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
          </div>
        </div>
      </div>

      {/* ── Toolbar: search + category filters ──────────────────── */}
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
              style={{ '--modx-accent': '#6366f1' }}
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
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────── */}
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
      ) : (
        <div className="modx-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mod, i) => {
            const meta = getMeta(mod.category);
            const Icon = meta.icon;
            return (
              <div
                key={mod.id}
                className="modx-card"
                style={{ '--modx-accent': meta.accent, '--i': i }}
              >
                <div className="flex items-start gap-3 mb-3">
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
                      <div className="text-xs min-w-0">
                        <span className="text-muted">Taught by </span>
                        <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{mod.teacher_name}</span>
                      </div>
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
      )}
    </div>
  );
}