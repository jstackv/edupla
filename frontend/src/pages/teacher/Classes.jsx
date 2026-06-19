import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Search, BookOpen, Users, GraduationCap, Mail, ChevronDown, ChevronUp,
  LayoutGrid, List, ArrowUpDown, Sparkles,
} from 'lucide-react';

/* ── Deterministic "folder tab" palette — keyed off class name ──
   Each class gets a stable color across sessions so teachers learn
   to recognize their classes by color, like tabs in a real register. */
const TAB_PALETTE = [
  { tab: '#2D6A4F', soft: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-500/20' },
  { tab: '#1D4ED8', soft: 'bg-blue-50 dark:bg-blue-900/20',       text: 'text-blue-700 dark:text-blue-300',       ring: 'ring-blue-500/20' },
  { tab: '#7C3AED', soft: 'bg-violet-50 dark:bg-violet-900/20',   text: 'text-violet-700 dark:text-violet-300',   ring: 'ring-violet-500/20' },
  { tab: '#B45309', soft: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-700 dark:text-amber-300',     ring: 'ring-amber-500/20' },
  { tab: '#BE123C', soft: 'bg-rose-50 dark:bg-rose-900/20',       text: 'text-rose-700 dark:text-rose-300',       ring: 'ring-rose-500/20' },
  { tab: '#0E7490', soft: 'bg-cyan-50 dark:bg-cyan-900/20',       text: 'text-cyan-700 dark:text-cyan-300',       ring: 'ring-cyan-500/20' },
];
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function paletteFor(name) { return TAB_PALETTE[hashStr(name) % TAB_PALETTE.length]; }

const LEVEL_CLASSES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
];
const getLevelClass = (val) => LEVEL_CLASSES[hashStr(val) % LEVEL_CLASSES.length];
const AVATAR_BG = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-indigo-500'];
function getColor(name) { return AVATAR_BG[hashStr(name) % AVATAR_BG.length]; }

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'modules', label: 'Modules taught' },
  { key: 'students', label: 'Students' },
];

export default function Classes() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid'); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState('name');
  const [expandedClass, setExpandedClass] = useState(null);
  const [classStudents, setClassStudents] = useState({});
  const [loadingStudents, setLoadingStudents] = useState({});

  // Load the teacher's assigned modules — each module carries its class_id.
  // Same source of truth Documents.jsx uses, so both pages always agree
  // on which classes are actually assigned to this teacher.
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/assessment/teacher/courses');
      setCourses(res.data.courses || []);
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  // Derive unique classes from the teacher's courses — every class with
  // at least one module assigned to this teacher will appear here.
  const teacherClasses = useMemo(() => {
    const map = new Map();
    courses.forEach(c => {
      const cls = c.class_id;
      if (!cls) return;
      const id = String(cls._id || cls);
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: cls.name || 'Class',
          description: cls.description || '',
          level: cls.level || '',
          moduleCount: 0,
        });
      }
      map.get(id).moduleCount += 1;
    });
    return Array.from(map.values());
  }, [courses]);

  const toggleStudents = useCallback(async (cls) => {
    if (expandedClass === cls.id) {
      setExpandedClass(null);
      return;
    }
    setExpandedClass(cls.id);
    if (classStudents[cls.id]) return;
    setLoadingStudents(s => ({ ...s, [cls.id]: true }));
    try {
      const res = await api.get(`/classes/${cls.id}/students`);
      setClassStudents(s => ({ ...s, [cls.id]: res.data.students || [] }));
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(s => ({ ...s, [cls.id]: false }));
    }
  }, [expandedClass, classStudents]);

  // Pre-fetch roster sizes quietly so sort-by-students and the stats
  // strip have real numbers instead of "—" before anything is expanded.
  useEffect(() => {
    if (loading || teacherClasses.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const cls of teacherClasses) {
        if (classStudents[cls.id] || cancelled) continue;
        try {
          const res = await api.get(`/classes/${cls.id}/students`);
          if (!cancelled) setClassStudents(s => (s[cls.id] ? s : { ...s, [cls.id]: res.data.students || [] }));
        } catch {
          /* silent — roster count is a nice-to-have, not critical */
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, teacherClasses]);

  const filteredClasses = useMemo(() => {
    let list = teacherClasses;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(cls => cls.name.toLowerCase().includes(q));
    }
    const withCounts = list.map(cls => ({ ...cls, studentCount: classStudents[cls.id]?.length ?? null }));
    const sorted = [...withCounts].sort((a, b) => {
      if (sortBy === 'modules') return b.moduleCount - a.moduleCount;
      if (sortBy === 'students') return (b.studentCount ?? -1) - (a.studentCount ?? -1);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [teacherClasses, search, sortBy, classStudents]);

  const totals = useMemo(() => ({
    classes: teacherClasses.length,
    modules: teacherClasses.reduce((s, c) => s + c.moduleCount, 0),
    students: Object.values(classStudents).reduce((s, arr) => s + (arr?.length || 0), 0),
  }), [teacherClasses, classStudents]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>My Classes</h2>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-sm text-muted mt-0.5">Your register of assigned classes and the students in them</p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-2">
          {[
            { label: 'Classes', value: totals.classes },
            { label: 'Modules', value: totals.modules },
            { label: 'Students', value: totals.students },
          ].map(stat => (
            <div key={stat.label} className="px-3.5 py-2 rounded-xl text-center min-w-[72px]"
              style={{ background: 'var(--surface-100)' }}>
              <p className="font-display font-bold text-base leading-none" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar: search, sort, view toggle ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Search your classes…"
          />
        </div>

        <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: 'var(--surface-100)' }}>
            <button
              onClick={() => setView('grid')}
              aria-label="Grid view"
              className="p-2 rounded-lg transition-colors"
              style={{ background: view === 'grid' ? 'var(--card-bg)' : 'transparent', color: view === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              aria-label="List view"
              className="p-2 rounded-lg transition-colors"
              style={{ background: view === 'list' ? 'var(--card-bg)' : 'transparent', color: view === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : teacherClasses.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No classes assigned</p>
          <p className="text-sm text-muted">The admin will assign modules to you to get started.</p>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="card text-center py-16">
          <Search className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No matches</p>
          <p className="text-sm text-muted">Try a different search term.</p>
        </div>
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-3'}>
          {filteredClasses.map(cls => {
            const palette = paletteFor(cls.name);
            const isOpen = expandedClass === cls.id;
            const roster = classStudents[cls.id];
            return (
              <div
                key={cls.id}
                className="relative rounded-2xl overflow-hidden transition-shadow duration-200"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                {/* Folder tab */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: palette.tab }} />

                <div className="pl-5 pr-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl ${palette.soft} flex items-center justify-center flex-shrink-0 ring-1 ${palette.ring}`}>
                      <BookOpen className="w-5 h-5" style={{ color: palette.tab }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>{cls.name}</h3>
                        {cls.level && <span className={`badge text-[11px] ${getLevelClass(cls.level)}`}>{cls.level}</span>}
                      </div>
                      {cls.description && (
                        <p className="text-xs text-muted line-clamp-1 mt-0.5">{cls.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5" />
                          {cls.moduleCount} module{cls.moduleCount !== 1 ? 's' : ''} taught
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {roster ? `${roster.length} student${roster.length !== 1 ? 's' : ''}` : '…'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleStudents(cls)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}
                    >
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isOpen ? 'Hide' : 'Roster'}
                    </button>
                  </div>

                  {/* Expandable roster */}
                  {isOpen && (
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
                      {loadingStudents[cls.id] ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                        </div>
                      ) : !roster || roster.length === 0 ? (
                        <div className="text-center py-4">
                          <GraduationCap className="w-8 h-8 mx-auto mb-2 text-muted opacity-30" />
                          <p className="text-sm text-muted">No students enrolled in this class yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                            Enrolled students ({roster.length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {roster.map(student => (
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
                                {student.level && <span className={`badge text-[11px] flex-shrink-0 ${getLevelClass(student.level)}`}>{student.level}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}