import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import {
  Search, Users, Grid, List,
  Mail, BookOpen
} from 'lucide-react';

const AVATAR_BG = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-rose-500','bg-amber-500','bg-indigo-500'];
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
function getColor(name) { return AVATAR_BG[(name?.charCodeAt(0) || 0) % AVATAR_BG.length]; }

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
  const [viewMode, setViewMode] = useState('table');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

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
  useEffect(() => {
    api.get('/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {});
    api.get('/admin/levels').then(r => setLevels(r.data.levels || [])).catch(() => {});
    api.get('/admin/trades').then(r => setTrades(r.data.trades || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Students</h2>
          <p className="text-sm text-muted">{total} student{total !== 1 ? 's' : ''} enrolled in your classes</p>
        </div>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10" placeholder="Search students…" />
        </div>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }} className="input-field w-40">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setPage(1); }} className="input-field w-28">
          <option value="">All Levels</option>
          {levels.map(l => <option key={l.value} value={l.value}>{l.label || l.value}</option>)}
        </select>
        <select value={filterTrade} onChange={e => { setFilterTrade(e.target.value); setPage(1); }} className="input-field w-32">
          <option value="">All Trades</option>
          {trades.map(t => <option key={t.value} value={t.value}>{t.label || t.value}</option>)}
        </select>
      </div>

      {/* Students */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : students.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No students found</p>
          <p className="text-sm text-muted">Students are enrolled by the admin.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map(s => (
            <div key={s.id} className="card hover:shadow-soft transition-all hover:-translate-y-0.5">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-11 h-11 rounded-xl ${getColor(s.name)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-sm">{s.name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                  <p className="text-xs text-muted truncate flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {s.level && <span className={`badge text-xs ${LEVEL_CLASSES[(levels.findIndex(l => l.value === s.level) + LEVEL_CLASSES.length) % LEVEL_CLASSES.length]}`}>{s.level}</span>}
                {s.trade && <span className={`badge text-xs ${TRADE_CLASSES[(trades.findIndex(t => t.value === s.trade) + TRADE_CLASSES.length) % TRADE_CLASSES.length]}`}>{s.trade}</span>}
              </div>
              {s.classes && (
                <p className="text-xs text-muted mt-2 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> {s.classes}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--table-header)' }}>
                  <th className="table-header">Student</th>
                  <th className="table-header hidden sm:table-cell">Level / Trade</th>
                  <th className="table-header hidden md:table-cell">Classes</th>
                  <th className="table-header hidden lg:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} className="table-row">
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
                        {s.level && <span className={`badge text-xs ${LEVEL_CLASSES[(levels.findIndex(l => l.value === s.level) + LEVEL_CLASSES.length) % LEVEL_CLASSES.length]}`}>{s.level}</span>}
                        {s.trade && <span className={`badge text-xs ${TRADE_CLASSES[(trades.findIndex(t => t.value === s.trade) + TRADE_CLASSES.length) % TRADE_CLASSES.length]}`}>{s.trade}</span>}
                      </div>
                    </td>
                    <td className="table-cell hidden md:table-cell text-xs text-muted">
                      {s.class_count > 0 ? `${s.class_count} class${s.class_count !== 1 ? 'es' : ''}` : '—'}
                    </td>
                    <td className="table-cell hidden lg:table-cell text-xs text-muted">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />}
    </div>
  );
}