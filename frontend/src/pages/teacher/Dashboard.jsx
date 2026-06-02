import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, Users, FileText, ClipboardList, Megaphone,
  TrendingUp, Award, ChevronRight, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

function MiniBarChart({ data = [], color = '#6366f1' }) {
  if (!data.length) return <div className="text-muted text-xs text-center py-4">No data yet</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-sm transition-all duration-700"
            style={{ height: `${(d.count / max) * 72}px`, background: color, opacity: 0.8 + (i / data.length) * 0.2 }} />
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data = {} }) {
  const items = [
    { label: 'Excellent (90+)', value: data.excellent || 0, color: '#10b981' },
    { label: 'Good (70–89)', value: data.good || 0, color: '#6366f1' },
    { label: 'Average (50–69)', value: data.average || 0, color: '#f59e0b' },
    { label: 'Below (<50)', value: data.poor || 0, color: '#ef4444' },
  ];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <div className="text-muted text-xs text-center py-8">No graded work yet</div>;

  let cumulativeAngle = -90;
  const radius = 45, cx = 60, cy = 60;
  const segments = items.filter(i => i.value > 0).map(item => {
    const pct = item.value / total;
    const angle = pct * 360;
    const startAngle = cumulativeAngle * (Math.PI / 180);
    const endAngle = (cumulativeAngle + angle) * (Math.PI / 180);
    const x1 = cx + radius * Math.cos(startAngle), y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle), y2 = cy + radius * Math.sin(endAngle);
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
    cumulativeAngle += angle;
    return { ...item, path, pct };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-28 h-28 flex-shrink-0">
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="var(--card-bg)" strokeWidth="2" />
        ))}
        <circle cx={cx} cy={cy} r={22} fill="var(--card-bg)" />
        <text x={cx} y={cy - 5} textAnchor="middle" fill="var(--text-primary)" style={{ fontSize: '12px', fontWeight: 700 }}>{total}</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill="var(--text-secondary)" style={{ fontSize: '8px' }}>graded</text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {items.filter(i => i.value > 0).map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, to, iconBg }) {
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

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ classes: 0, students: 0, documents: 0, assignments: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState(0);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [analyticsRes, announcementsRes] = await Promise.all([
          api.get('/analytics').catch(() => ({ data: null })),
          api.get('/announcements?limit=3').catch(() => ({ data: { announcements: [] } })),
        ]);
        if (analyticsRes.data) {
          setStats(analyticsRes.data.counts || {});
          setAnalytics(analyticsRes.data);
          setTopStudents(analyticsRes.data.topStudents || []);
        }
        setRecentAnnouncements(announcementsRes.data.announcements || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const statCards = [
    { icon: BookOpen, label: 'Active Classes', value: stats.classes || 0, to: '/teacher/classes', color: 'text-primary-600', iconBg: 'bg-primary-100 dark:bg-primary-900/30' },
    { icon: Users, label: 'Total Students', value: stats.students || 0, to: '/teacher/students', color: 'text-emerald-600', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { icon: ClipboardList, label: 'Assignments', value: stats.assignments || 0, to: '/teacher/assignments', color: 'text-amber-600', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
    { icon: FileText, label: 'Documents', value: stats.documents || 0, to: '/teacher/documents', color: 'text-violet-600', iconBg: 'bg-violet-100 dark:bg-violet-900/30' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="card p-5 bg-gradient-to-r from-primary-600 to-primary-700 border-0 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary-100 text-sm font-medium">{greeting},</p>
            <h2 className="font-display font-bold text-xl mt-0.5">{user?.name} 👋</h2>
            <p className="text-primary-100 text-sm mt-1">
              You have {stats.classes} classes and {stats.students} students enrolled.
            </p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => <StatCard key={s.to} {...s} />)}
      </div>

      {/* Charts Row */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Submission Trend */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Submissions (30 days)</h3>
                <p className="text-xs text-muted mt-0.5">Daily submission activity</p>
              </div>
              <TrendingUp className="w-4 h-4 text-muted" />
            </div>
            <MiniBarChart data={analytics.submissionTrend || []} color="#6366f1" />
          </div>

          {/* Grade Distribution */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Grade Distribution</h3>
                <p className="text-xs text-muted mt-0.5">Across all assignments</p>
              </div>
              <Award className="w-4 h-4 text-muted" />
            </div>
            <DonutChart data={analytics.gradeDistribution || {}} />
          </div>
        </div>
      )}

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Students */}
        {topStudents.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Top Performers</h3>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="space-y-3">
              {topStudents.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
                    style={{ background: ['#f59e0b','#94a3b8','#b45309','#6366f1','#10b981'][i] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                    <p className="text-xs text-muted">{s.submissions} submissions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{Math.round(s.avg_score)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Announcements */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Recent Announcements</h3>
            <Link to="/teacher/announcements" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {recentAnnouncements.length === 0 ? (
            <div className="text-center py-6">
              <Megaphone className="w-8 h-8 mx-auto mb-2 text-muted opacity-40" />
              <p className="text-sm text-muted">No announcements yet</p>
              <Link to="/teacher/announcements" className="text-xs text-primary-600 hover:underline mt-1 inline-block">
                Create one →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAnnouncements.map(a => (
                <div key={a.id} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-1">{a.content}</p>
                    {a.class_name && (
                      <span className="text-xs mt-1 inline-block px-1.5 py-0.5 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                        {a.class_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Class', to: '/teacher/classes', icon: BookOpen, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
            { label: 'Add Student', to: '/teacher/students', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'New Assignment', to: '/teacher/assignments', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'Announce', to: '/teacher/announcements', icon: Megaphone, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
          ].map(a => (
            <Link key={a.to} to={a.to}
              className={`flex items-center gap-2.5 p-3 rounded-xl ${a.bg} transition-all hover:scale-105 active:scale-95`}>
              <a.icon className={`w-4 h-4 ${a.color} flex-shrink-0`} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
