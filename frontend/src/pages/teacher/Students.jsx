import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import {
  Search, Users, Grid, List, Mail, BookOpen,
  ArrowUpDown, Download, CheckSquare, Square, X, Sparkles,
} from 'lucide-react';

/* ── Shared deterministic palette helpers (mirrors Classes.jsx) ── */
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
const AVATAR_BG = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-indigo-500'];
function getColor(name) { return AVATAR_BG[hashStr(name) % AVATAR_BG.length]; }

const LEVEL_CLASSES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
];
const TRADE_CLASSES = [
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
];
const getLevelClass = (val) => LEVEL_CLASSES[hashStr(val) % LEVEL_CLASSES.length];
const getTradeClass = (val) => TRADE_CLASSES[hashStr(val) % TRADE_CLASSES.length];

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'level', label: 'Level' },
  { key: 'joined', label: 'Joined date' },
];

function toCsvValue(val) {
  const s = String(val ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [levels, setLevels] = useState([]);
  const [trades, setTrades] = useState([]);
  const [filterLevel, setFilterLevel] = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('table');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 12 };
      if (filterLevel) params.level = filterLevel;
      if (filterTrade) params.trade = filterTrade;
      if (filterClass) params.classId = filterClass;
      const res = await api.get('/students', { params });
      setStudents(res.data.students);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  }, [search, page, filterLevel, filterTrade, filterClass]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // Class filter now sources from the teacher's own assigned modules —
  // same fix applied to Classes.jsx — instead of the unscoped /classes
  // endpoint, so a teacher can never filter by a class that isn't theirs.
  useEffect(() => {
    api.get('/assessment/teacher/courses')
      .then(r => {
        const map = new Map();
        (r.data.courses || []).forEach(c => {
          const cls = c.class_id;
          if (!cls) return;
          const id = String(cls._id || cls);
          if (!map.has(id)) map.set(id, { id, name: cls.name || 'Class' });
        });
        setClasses(Array.from(map.values()));
      })
      .catch(() => {});
    api.get('/admin/levels').then(r => setLevels(r.data.levels || [])).catch(() => {});
    api.get('/admin/trades').then(r => setTrades(r.data.trades || [])).catch(() => {});
  }, []);

  // Selection resets whenever the underlying page/filter set changes,
  // so a stale checkbox never silently exports the wrong student.
  useEffect(() => { setSelected(new Set()); }, [students]);

  const sortedStudents = useMemo(() => {
    const list = [...students];
    list.sort((a, b) => {
      if (sortBy === 'level') return (a.level || '').localeCompare(b.level || '');
      if (sortBy === 'joined') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return (a.name || '').localeCompare(b.name || '');
    });
    return list;
  }, [students, sortBy]);

  const allOnPageSelected = sortedStudents.length > 0 && sortedStudents.every(s => selected.has(s.id));

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAllOnPage() {
    setSelected(prev => {
      if (allOnPageSelected) {
        const next = new Set(prev);
        sortedStudents.forEach(s => next.delete(s.id));
        return next;
      }
      const next = new Set(prev);
      sortedStudents.forEach(s => next.add(s.id));
      return next;
    });
  }

  function exportSelected() {
    const rows = sortedStudents.filter(s => selected.has(s.id));
    if (rows.length === 0) return;
    const header = ['Name', 'Email', 'Level', 'Trade', 'Classes', 'Joined'];
    const lines = [header.join(',')];
    rows.forEach(s => {
      lines.push([
        toCsvValue(s.name), toCsvValue(s.email), toCsvValue(s.level), toCsvValue(s.trade),
        toCsvValue(s.classes ?? s.class_count ?? ''), toCsvValue(s.created_at ? new Date(s.created_at).toLocaleDateString() : ''),
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} student${rows.length !== 1 ? 's' : ''}`);
  }

  const levelsRepresented = useMemo(() => new Set(students.map(s => s.level).filter(Boolean)).size, [students]);
  const hasActiveFilters = filterClass || filterLevel || filterTrade || search;

  function clearFilters() {
    setSearch(''); setFilterClass(''); setFilterLevel(''); setFilterTrade(''); setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Students</h2>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-sm text-muted mt-0.5">Everyone enrolled across your classes</p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-2">
          {[
            { label: 'Showing', value: total },
            { label: 'Classes', value: classes.length },
            { label: 'Levels', value: levelsRepresented },
          ].map(stat => (
            <div key={stat.label} className="px-3.5 py-2 rounded-xl text-center min-w-[72px]"
              style={{ background: 'var(--surface-100)' }}>
              <p className="font-display font-bold text-base leading-none" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10" placeholder="Search students…" />
        </div>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }} className="input-field w-40">
          <option value="">All my classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setPage(1); }} className="input-field w-28">
          <option value="">All levels</option>
          {levels.map(l => <option key={l.value} value={l.value}>{l.label || l.value}</option>)}
        </select>
        <select value={filterTrade} onChange={e => { setFilterTrade(e.target.value); setPage(1); }} className="input-field w-32">
          <option value="">All trades</option>
          {trades.map(t => <option key={t.value} value={t.value}>{t.label || t.value}</option>)}
        </select>

        {hasActiveFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-xl transition-colors"
            style={{ color: 'var(--text-secondary)' }}>
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="appearance-none pl-8 pr-7 py-2 rounded-xl text-xs font-medium cursor-pointer"
              style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}
            >
              {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>Sort: {o.label}</option>)}
            </select>
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--card-border)' }}>
            <button onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-primary-600 text-white' : ''}`}
              style={viewMode !== 'table' ? { background: 'var(--card-bg)', color: 'var(--text-secondary)' } : {}}>
              <List className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === 'grid' ? 'bg-primary-600 text-white' : ''}`}
              style={viewMode !== 'grid' ? { background: 'var(--card-bg)', color: 'var(--text-secondary)' } : {}}>
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Selection bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl"
          style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {selected.size} student{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
              Clear selection
            </button>
            <button onClick={exportSelected}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-600 text-white">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : students.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No students found</p>
          <p className="text-sm text-muted">{hasActiveFilters ? 'Try adjusting your search or filters.' : 'Students are enrolled by the admin.'}</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-secondary mt-4 mx-auto">Clear filters</button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedStudents.map(s => {
            const isSelected = selected.has(s.id);
            return (
              <div key={s.id}
                className="card hover:shadow-soft transition-all hover:-translate-y-0.5 relative"
                style={isSelected ? { borderColor: 'var(--primary-500, #6366f1)' } : undefined}>
                <button
                  onClick={() => toggleOne(s.id)}
                  aria-label={isSelected ? 'Deselect student' : 'Select student'}
                  className="absolute top-3 right-3 text-muted hover:text-primary-600 transition-colors"
                >
                  {isSelected ? <CheckSquare className="w-4 h-4 text-primary-600" /> : <Square className="w-4 h-4" />}
                </button>
                <div className="flex items-start gap-3 mb-3 pr-6">
                  <div className={`w-11 h-11 rounded-xl ${getColor(s.name)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-bold text-sm">{s.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                    <p className="text-xs text-muted truncate flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {s.level && <span className={`badge text-xs ${getLevelClass(s.level)}`}>{s.level}</span>}
                  {s.trade && <span className={`badge text-xs ${getTradeClass(s.trade)}`}>{s.trade}</span>}
                </div>
                {s.classes && (
                  <p className="text-xs text-muted mt-2 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {s.classes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--table-header)' }}>
                  <th className="table-header w-10">
                    <button onClick={toggleAllOnPage} aria-label="Select all on page" className="flex items-center justify-center">
                      {allOnPageSelected ? <CheckSquare className="w-4 h-4 text-primary-600" /> : <Square className="w-4 h-4 text-muted" />}
                    </button>
                  </th>
                  <th className="table-header">Student</th>
                  <th className="table-header hidden sm:table-cell">Level / Trade</th>
                  <th className="table-header hidden md:table-cell">Classes</th>
                  <th className="table-header hidden lg:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map(s => {
                  const isSelected = selected.has(s.id);
                  return (
                    <tr key={s.id} className="table-row" style={isSelected ? { background: 'var(--surface-100)' } : undefined}>
                      <td className="table-cell">
                        <button onClick={() => toggleOne(s.id)} aria-label={isSelected ? 'Deselect' : 'Select'} className="flex items-center justify-center">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-primary-600" /> : <Square className="w-4 h-4 text-muted" />}
                        </button>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${getColor(s.name)} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white font-bold text-xs">{s.name?.[0]?.toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                            <p className="text-xs text-muted">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {s.level && <span className={`badge text-xs ${getLevelClass(s.level)}`}>{s.level}</span>}
                          {s.trade && <span className={`badge text-xs ${getTradeClass(s.trade)}`}>{s.trade}</span>}
                        </div>
                      </td>
                      <td className="table-cell hidden md:table-cell text-xs text-muted">
                        {s.class_count > 0 ? `${s.class_count} class${s.class_count !== 1 ? 'es' : ''}` : '—'}
                      </td>
                      <td className="table-cell hidden lg:table-cell text-xs text-muted">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />}
    </div>
  );
}