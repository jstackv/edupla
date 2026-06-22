import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  BookMarked, ClipboardList, FileText, Megaphone,
  Clock, CheckCircle2, AlertTriangle, ChevronRight,
  Award, Calendar, Flame, Sparkles, GraduationCap, Mail
} from 'lucide-react';

const LEVEL_CLASSES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
];
const getCategoryClass = (val) => LEVEL_CLASSES[(val?.charCodeAt(0) || 0) % LEVEL_CLASSES.length];
const initials = (name) => name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';

function StatCard({ icon: Icon, label, value, color, iconBg, to, sublabel }) {
  return (
    <Link to={to} className="stat-card group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center shadow-sm`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-2xl font-display font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {sublabel && <p className="text-xs text-muted/70 flex-shrink-0">{sublabel}</p>}
      </div>
    </Link>
  );
}

/* Circular completion ring — the dashboard's one signature visual.
   Shows assignment completion at a glance instead of just a count. */
function ProgressRing({ percent, size = 88, stroke = 8 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="white" strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </svg>
  );
}

function urgencyMeta(diff, overdue) {
  if (overdue) return { badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: AlertTriangle, iconColor: 'text-red-600', iconBg: 'bg-red-100 dark:bg-red-900/30', label: 'Overdue' };
  if (diff === 0) return { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', icon: AlertTriangle, iconColor: 'text-orange-600', iconBg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Due today' };
  if (diff <= 2) return { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: Clock, iconColor: 'text-amber-600', iconBg: 'bg-amber-100 dark:bg-amber-900/30', label: `${diff}d left` };
  return { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: Clock, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', label: `${diff}d left` };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ringFilled, setRingFilled] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [classesRes, assignmentsRes, announcementsRes, docsRes, coursesRes] = await Promise.all([
          api.get('/classes/my').catch(() => ({ data: { classes: [] } })),
          api.get('/assignments?limit=5').catch(() => ({ data: { assignments: [], total: 0 } })),
          api.get('/announcements?limit=3').catch(() => ({ data: { announcements: [] } })),
          api.get('/documents?limit=5').catch(() => ({ data: { documents: [] } })),
          api.get('/assessment/student/courses').catch(() => ({ data: { courses: [] } })),
        ]);
        setData({
          classes: classesRes.data.classes || [],
          assignments: assignmentsRes.data.assignments || [],
          totalAssignments: assignmentsRes.data.total || 0,
          announcements: announcementsRes.data.announcements || [],
          documents: docsRes.data.documents || [],
          courses: coursesRes.data.courses || [],
        });
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  // Trigger the ring fill animation a tick after first paint
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setRingFilled(true), 80);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const pending = data?.assignments?.filter(a => !a.submission_id) || [];
  const submitted = data?.assignments?.filter(a => a.submission_id) || [];
  const graded = data?.assignments?.filter(a => a.score !== null && a.score !== undefined && a.max_score) || [];

  const completionPercent = useMemo(() => {
    const total = data?.totalAssignments || 0;
    if (!total) return 0;
    return Math.round((submitted.length / total) * 100);
  }, [data, submitted.length]);

  const averageScore = useMemo(() => {
    if (!graded.length) return null;
    const pct = graded.reduce((sum, a) => sum + (a.score / a.max_score) * 100, 0) / graded.length;
    return Math.round(pct);
  }, [graded]);

  // Roster of every teacher touching this student: the class teacher plus
  // each module's own teacher (a module can be taught by someone other than
  // the class teacher), deduped by email/name.
  const teachers = useMemo(() => {
    const map = new Map();
    (data?.classes || []).forEach(c => {
      if (!c.teacher_name) return;
      const key = c.teacher_id?._id || c.teacher_id || c.teacher_name;
      if (!map.has(key)) {
        map.set(key, { name: c.teacher_name, email: c.teacher_id?.email, role: 'Class teacher', subjects: new Set([c.name]) });
      } else {
        map.get(key).subjects.add(c.name);
      }
    });
    (data?.courses || []).forEach(course => {
      const t = course.teacher_id;
      if (!t?.name) return;
      const key = t._id || t.name;
      if (!map.has(key)) {
        map.set(key, { name: t.name, email: t.email, role: 'Module teacher', subjects: new Set([course.name]) });
      } else {
        map.get(key).subjects.add(course.name);
      }
    });
    return Array.from(map.values()).map(t => ({ ...t, subjects: Array.from(t.subjects) }));
  }, [data]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  const statCards = [
    { icon: BookMarked, label: 'Enrolled classes', value: data?.classes?.length || 0, to: '/student/classes', color: 'text-primary-600', iconBg: 'bg-primary-100 dark:bg-primary-900/30' },
    { icon: GraduationCap, label: 'Modules', value: data?.courses?.length || 0, to: '/student/classes', color: 'text-cyan-600', iconBg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    { icon: ClipboardList, label: 'Pending work', value: pending.length, to: '/student/assignments', color: 'text-amber-600', iconBg: 'bg-amber-100 dark:bg-amber-900/30', sublabel: pending.length ? 'needs attention' : 'all clear' },
    { icon: Award, label: 'Average score', value: averageScore !== null ? `${averageScore}%` : '—', to: '/student/assignments', color: 'text-emerald-600', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', sublabel: graded.length ? `${graded.length} graded` : 'no grades yet' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero — greeting + completion ring (signature element) */}
      <div className="card p-6 bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 border-0 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-16 bottom-0 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-emerald-100 text-sm font-medium">{greeting},</p>
            <h2 className="font-display font-bold text-2xl mt-0.5 truncate">{user?.name}</h2>
            <p className="text-emerald-100 text-sm mt-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {todayLabel}
            </p>

            <div className="flex items-center gap-4 mt-4">
              {pending.length === 0 ? (
                <div className="flex items-center gap-2 bg-white/15 rounded-full pl-2 pr-3 py-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">All caught up — nice work</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/15 rounded-full pl-2 pr-3 py-1.5">
                  <Flame className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {pending.length} assignment{pending.length !== 1 ? 's' : ''} waiting on you
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="relative flex-shrink-0 flex items-center justify-center">
            <ProgressRing percent={ringFilled ? completionPercent : 0} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-bold text-xl leading-none">{completionPercent}%</span>
              <span className="text-[10px] text-emerald-100 leading-none mt-1">done</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Two-Column Row: Pending + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Assignments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Pending assignments
            </h3>
            <Link to="/student/assignments" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {pending.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Nothing pending</p>
              <p className="text-xs text-muted mt-0.5">New assignments will show up here</p>
            </div>
          ) : (
            <div className="space-y-1">
              {pending.slice(0, 4).map((a, i) => {
                const diff = Math.ceil((new Date(a.deadline) - new Date()) / 86400000);
                const overdue = diff < 0;
                const meta = urgencyMeta(diff, overdue);
                const Icon = meta.icon;
                return (
                  <Link
                    key={a.id}
                    to={`/student/assignments/${a.id}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                    style={{ animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
                      <Icon className={`w-4 h-4 ${meta.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                      <p className="text-xs text-muted">{a.class_name}</p>
                    </div>
                    <span className={`badge text-xs flex-shrink-0 ${meta.badge}`}>
                      {meta.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Announcements */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Announcements</h3>
            <Link to="/student/announcements" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {(data?.announcements || []).length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-violet-400" />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No announcements yet</p>
              <p className="text-xs text-muted mt-0.5">Your teachers haven't posted anything</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.announcements || []).map((a, i) => (
                <div key={a.id} className="flex gap-3" style={{ animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-1">{a.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted">{a.teacher_name}</span>
                      {a.class_name && (
                        <span className="badge text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                          {a.class_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My Modules — Course documents assigned to the student's class */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <GraduationCap className="w-4 h-4 text-cyan-500" />
            My modules
          </h3>
          {data?.courses?.length > 0 && (
            <span className="text-xs text-muted">{data.courses.length} module{data.courses.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {(data?.courses || []).length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-cyan-500" />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No modules assigned yet</p>
            <p className="text-xs text-muted mt-0.5">Modules will appear once your class is assigned a curriculum</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.courses.map((course, i) => (
              <div
                key={course.id}
                className="p-3.5 rounded-xl flex flex-col gap-2"
                style={{ background: 'var(--card-border)', animation: `fadeIn 0.3s ease ${i * 0.04}s both` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{course.name}</p>
                  {course.code && <span className="text-xs text-muted flex-shrink-0">{course.code}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`badge text-xs ${getCategoryClass(course.category)}`}>{course.category || 'Module'}</span>
                  <span className="text-xs text-muted flex-shrink-0">{course.total_marks || 100} marks</span>
                </div>
                {course.teacher_id?.name && (
                  <div className="flex items-center gap-1.5 pt-2 mt-1 text-xs text-muted" style={{ borderTop: '1px solid var(--card-border)' }}>
                    <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                      {initials(course.teacher_id.name)}
                    </div>
                    <span className="truncate">{course.teacher_id.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Teachers — consolidated roster across class + modules */}
      {teachers.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>My teachers</h3>
            <span className="text-xs text-muted">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teachers.map((t, i) => (
              <div
                key={t.email || t.name}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'var(--card-border)', animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold">
                  {initials(t.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                  <p className="text-xs text-muted">{t.role}</p>
                  <p className="text-xs text-muted truncate mt-0.5">{t.subjects.join(', ')}</p>
                  {t.email && (
                    <a href={`mailto:${t.email}`} className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{t.email}</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Classes */}
      {(data?.classes || []).length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>My classes</h3>
            <Link to="/student/classes" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.classes || []).slice(0, 6).map(c => (
              <Link
                key={c.id}
                to="/student/classes"
                className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:opacity-90"
                style={{ background: 'var(--card-border)' }}
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                  <BookMarked className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                  <p className="text-xs text-muted truncate">{c.teacher_name}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}