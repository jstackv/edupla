import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  BookMarked, ClipboardList, FileText, Megaphone,
  Clock, CheckCircle2, AlertTriangle, ChevronRight,
  TrendingUp, Award, Calendar
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, color, iconBg, to }) {
  return (
    <Link to={to} className="stat-card group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center shadow-sm`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary-500 transition-colors" />
      </div>
      <p className="text-2xl font-display font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </Link>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [classesRes, assignmentsRes, announcementsRes, docsRes] = await Promise.all([
          api.get('/classes/my').catch(() => ({ data: { classes: [] } })),
          api.get('/assignments?limit=5').catch(() => ({ data: { assignments: [], total: 0 } })),
          api.get('/announcements?limit=3').catch(() => ({ data: { announcements: [] } })),
          api.get('/documents?limit=5').catch(() => ({ data: { documents: [] } })),
        ]);
        setData({
          classes: classesRes.data.classes || [],
          assignments: assignmentsRes.data.assignments || [],
          totalAssignments: assignmentsRes.data.total || 0,
          announcements: announcementsRes.data.announcements || [],
          documents: docsRes.data.documents || [],
        });
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  const pending = data?.assignments?.filter(a => !a.submission_id) || [];
  const submitted = data?.assignments?.filter(a => a.submission_id) || [];
  const graded = data?.assignments?.filter(a => a.score !== null && a.score !== undefined) || [];

  const statCards = [
    { icon: BookMarked, label: 'Enrolled Class', value: data?.classes?.length || 0, to: '/student/classes', color: 'text-primary-600', iconBg: 'bg-primary-100 dark:bg-primary-900/30' },
    { icon: ClipboardList, label: 'Total Assignments', value: data?.totalAssignments || 0, to: '/student/assignments', color: 'text-amber-600', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
    { icon: CheckCircle2, label: 'Submitted', value: submitted.length, to: '/student/assignments', color: 'text-emerald-600', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { icon: FileText, label: 'Study Materials', value: data?.documents?.length || 0, to: '/student/documents', color: 'text-violet-600', iconBg: 'bg-violet-100 dark:bg-violet-900/30' },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="card p-5 bg-gradient-to-r from-emerald-600 to-emerald-700 border-0 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-emerald-100 text-sm font-medium">{greeting},</p>
            <h2 className="font-display font-bold text-xl mt-0.5">{user?.name} 👋</h2>
            <p className="text-emerald-100 text-sm mt-1">
              You have {pending.length} pending assignment{pending.length !== 1 ? 's' : ''} to complete.
            </p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => <StatCard key={s.to} {...s} />)}
      </div>

      {/* Two-Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Assignments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Pending Assignments
            </h3>
            <Link to="/student/assignments" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {pending.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="text-sm text-muted">All caught up! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.slice(0, 4).map(a => {
                const diff = Math.ceil((new Date(a.deadline) - new Date()) / 86400000);
                const overdue = diff < 0;
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      overdue ? 'bg-red-100 dark:bg-red-900/30' : diff <= 2 ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                    }`}>
                      {overdue ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <Clock className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                      <p className="text-xs text-muted">{a.class_name}</p>
                    </div>
                    <span className={`badge text-xs flex-shrink-0 ${
                      overdue ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                      : diff <= 2 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {overdue ? 'Overdue' : diff === 0 ? 'Today' : `${diff}d`}
                    </span>
                  </div>
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
            <div className="text-center py-6">
              <Megaphone className="w-8 h-8 mx-auto mb-2 text-muted opacity-30" />
              <p className="text-sm text-muted">No announcements yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.announcements || []).map(a => (
                <div key={a.id} className="flex gap-3">
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

      {/* My Classes */}
      {(data?.classes || []).length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>My Class</h3>
            <Link to="/student/classes" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.classes || []).slice(0, 6).map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                style={{ background: 'var(--card-border)' }}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                  <BookMarked className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                  <p className="text-xs text-muted truncate">{c.teacher_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
