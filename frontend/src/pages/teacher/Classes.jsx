import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import { Search, BookOpen, Users, GraduationCap, Mail, ChevronDown, ChevronUp } from 'lucide-react';

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
// Returns a Tailwind class string for any arbitrary level/trade value
const getLevelClass = (val) => LEVEL_CLASSES[(val?.charCodeAt(0) || 0) % LEVEL_CLASSES.length];
const getTradeClass = (val) => TRADE_CLASSES[(val?.charCodeAt(0) || 0) % TRADE_CLASSES.length];
const AVATAR_BG = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-rose-500','bg-amber-500','bg-indigo-500'];
function getColor(name) { return AVATAR_BG[(name?.charCodeAt(0) || 0) % AVATAR_BG.length]; }

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState(null);
  const [classStudents, setClassStudents] = useState({});
  const [loadingStudents, setLoadingStudents] = useState({});

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/classes', { params: { search, page, limit: 12 } });
      setClasses(res.data.classes);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load classes'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const toggleStudents = async (cls) => {
    if (expandedClass === cls.id) {
      setExpandedClass(null);
      return;
    }
    setExpandedClass(cls.id);
    if (classStudents[cls.id]) return; // already loaded
    setLoadingStudents(s => ({ ...s, [cls.id]: true }));
    try {
      const res = await api.get(`/classes/${cls.id}/students`);
      setClassStudents(s => ({ ...s, [cls.id]: res.data.students }));
    } catch { toast.error('Failed to load students'); }
    finally { setLoadingStudents(s => ({ ...s, [cls.id]: false })); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>My Classes</h2>
          <p className="text-sm text-muted">{total} class{total !== 1 ? 'es' : ''} assigned to you</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input-field pl-10"
          placeholder="Search classes…"
        />
      </div>

      {/* Classes Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : classes.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No classes assigned</p>
          <p className="text-sm text-muted">The admin will assign classes to you.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map(cls => (
            <div key={cls.id} className="card transition-all duration-200">
              {/* Class header */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>{cls.name}</h3>
                  {cls.description && (
                    <p className="text-xs text-muted line-clamp-1 mt-0.5">{cls.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {cls.level && <span className={`badge text-xs ${getLevelClass(cls.level) || ''}`}>{cls.level}</span>}
                    {cls.trade && <span className={`badge text-xs ${getTradeClass(cls.trade) || ''}`}>{cls.trade}</span>}
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Users className="w-3.5 h-3.5" /> {cls.student_count || 0} student{cls.student_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleStudents(cls)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}
                >
                  {expandedClass === cls.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expandedClass === cls.id ? 'Hide' : 'View'} Students
                </button>
              </div>

              {/* Expandable students list */}
              {expandedClass === cls.id && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
                  {loadingStudents[cls.id] ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                  ) : !classStudents[cls.id] || classStudents[cls.id].length === 0 ? (
                    <div className="text-center py-4">
                      <GraduationCap className="w-8 h-8 mx-auto mb-2 text-muted opacity-30" />
                      <p className="text-sm text-muted">No students enrolled in this class yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                        Enrolled Students ({classStudents[cls.id].length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {classStudents[cls.id].map(student => (
                          <div key={student.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                            style={{ background: 'var(--surface-100)' }}>
                            <div className={`w-8 h-8 rounded-lg ${getColor(student.name)} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-white font-bold text-xs">{student.name?.[0]?.toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{student.name}</p>
                              <p className="text-xs text-muted truncate flex items-center gap-1">
                                <Mail className="w-3 h-3" />{student.email}
                              </p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {student.level && <span className={`badge text-xs ${getLevelClass(student.level) || ''}`}>{student.level}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />}
    </div>
  );
}
