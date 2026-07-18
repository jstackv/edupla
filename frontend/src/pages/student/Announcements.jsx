import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import { Search, Megaphone, BookOpen, Calendar, Sparkles } from 'lucide-react';

export default function StudentAnnouncements() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [announcements, setAnnouncements] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState(searchParams.get('classId') || '');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [flashId, setFlashId] = useState(searchParams.get('highlight') || null);
  const itemRefs = useRef({});

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 10 };
      if (filterClass) params.classId = filterClass;
      const res = await api.get('/announcements', { params });
      setAnnouncements(res.data.announcements || []);
      setTotal(res.data.announcements?.length || 0);
    } catch { toast.error('Failed to load announcements'); }
    finally { setLoading(false); }
  }, [search, page, filterClass]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);
  useEffect(() => {
    api.get('/classes/my').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  /* ── jump to & highlight the announcement a notification pointed to ── */
  useEffect(() => {
    if (!flashId || loading || !announcements.length) return;
    const el = itemRefs.current[flashId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => {
      setFlashId(null);
      const next = new URLSearchParams(searchParams);
      next.delete('highlight');
      setSearchParams(next, { replace: true });
    }, 3500);
    return () => clearTimeout(t);
  }, [flashId, loading, announcements]);

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          from { background-position: -400px 0; }
          to   { background-position: 400px 0; }
        }
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 2px #8b5cf6, 0 8px 24px rgba(139,92,246,0.35); }
          50%  { box-shadow: 0 0 0 5px rgba(139,92,246,0.15), 0 8px 30px rgba(139,92,246,0.45); }
          100% { box-shadow: 0 0 0 2px #8b5cf6, 0 8px 24px rgba(139,92,246,0.35); }
        }
        @keyframes floatIcon {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-6px) rotate(-4deg); }
        }
        @keyframes iconPop {
          0%   { transform: scale(0.6) rotate(-10deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .ann-header-icon { animation: iconPop 0.5s cubic-bezier(0.34,1.56,0.64,1); }
        .ann-fade-in { animation: fadeSlideUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        .ann-skeleton {
          background: linear-gradient(90deg, rgba(148,163,184,0.12) 0%, rgba(148,163,184,0.25) 50%, rgba(148,163,184,0.12) 100%);
          background-size: 800px 100%;
          animation: shimmer 1.6s linear infinite;
        }
        .ann-flash { animation: pulseRing 1.4s ease-in-out infinite; }
        .ann-empty-icon { animation: floatIcon 3.5s ease-in-out infinite; }
        .ann-card {
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .ann-card:hover { transform: translateY(-3px); }
        .ann-icon-wrap { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        .ann-card:hover .ann-icon-wrap { transform: rotate(-8deg) scale(1.08); }
        @media (prefers-reduced-motion: reduce) {
          .ann-header-icon, .ann-fade-in, .ann-skeleton, .ann-flash, .ann-empty-icon, .ann-card, .ann-icon-wrap {
            animation: none !important; transition: none !important;
          }
        }
      `}</style>

      <div className="flex items-center gap-3">
        <div className="ann-header-icon w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-primary-500 flex items-center justify-center flex-shrink-0 shadow-soft">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Announcements</h2>
          <p className="text-sm text-muted">Updates from your teachers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted transition-colors group-focus-within:text-primary-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10 transition-shadow duration-200 focus:shadow-soft" placeholder="Search announcements…" />
        </div>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }}
          className="input-field sm:w-44 transition-shadow duration-200 focus:shadow-soft">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Announcements */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card">
              <div className="flex items-start gap-4">
                <div className="ann-skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="ann-skeleton h-4 w-1/3 rounded-md" />
                  <div className="ann-skeleton h-3 w-full rounded-md" />
                  <div className="ann-skeleton h-3 w-4/5 rounded-md" />
                  <div className="ann-skeleton h-3 w-20 rounded-md mt-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="card text-center py-16">
          <Megaphone className="ann-empty-icon w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No announcements</p>
          <p className="text-sm text-muted">Your teachers haven't posted anything yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a, i) => (
            <div key={a.id} ref={el => { itemRefs.current[a.id] = el; }}
              className={`ann-card ann-fade-in card hover:shadow-soft ${flashId === a.id ? 'ann-flash' : ''}`}
              style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}>
              <div className="flex items-start gap-4">
                <div className="ann-icon-wrap w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                  <Megaphone className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
                    {flashId === a.id && <Sparkles className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{a.content}</p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {a.teacher_name && (
                      <span className="text-xs text-muted">By {a.teacher_name}</span>
                    )}
                    {a.class_name ? (
                      <span className="flex items-center gap-1 text-xs badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                        <BookOpen className="w-3 h-3" /> {a.class_name}
                      </span>
                    ) : (
                      <span className="text-xs badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        All Students
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted ml-auto">
                      <Calendar className="w-3 h-3" />
                      {new Date(a.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 10 && (
        <Pagination page={page} totalPages={Math.ceil(total / 10)} onPageChange={setPage} />
      )}
    </div>
  );
}