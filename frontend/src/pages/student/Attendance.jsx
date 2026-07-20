import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, UserCheck, BookOpen,
  Flame, TrendingUp, TrendingDown, Minus, Printer, FileBarChart2, History, User,
} from 'lucide-react';

const STATUS_META = {
  present: { label: 'Present', color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle2 },
  absent:  { label: 'Absent',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  Icon: XCircle },
  late:    { label: 'Late',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', Icon: Clock },
  excused: { label: 'Excused', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', Icon: ShieldCheck },
};
const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtLong(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function periodLabel(period, start, end) {
  if (!start) return '';
  if (period === 'daily') return fmtLong(start);
  if (period === 'monthly') return new Date(start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}, ${new Date(end).getFullYear()}`;
}
function rateColor(rate) {
  if (rate == null) return 'var(--text-secondary)';
  if (rate >= 90) return '#10b981';
  if (rate >= 75) return '#f59e0b';
  return '#ef4444';
}

/* Big personal gauge — same conic-gradient trick, tuned larger for a "report card" hero feel */
function HeroGauge({ rate, size = 140 }) {
  const pct = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const color = rateColor(rate);
  return (
    <div className="transition-transform duration-500 ease-out animate-scale-in" style={{
      width: size, height: size, borderRadius: '50%',
      background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(148,163,184,0.18) 0deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <div style={{
        width: size - 22, height: size - 22, borderRadius: '50%', background: 'var(--card-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      }}>
        <span className="font-display font-bold" style={{ fontSize: size * 0.2, color, lineHeight: 1 }}>
          {rate == null ? '—' : `${Math.round(rate)}%`}
        </span>
        <span className="text-xs text-muted mt-1">attendance</span>
      </div>
    </div>
  );
}

function TrendBadge({ trend }) {
  if (trend == null) return <span className="text-xs text-muted">No prior period to compare</span>;
  if (trend === 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold badge" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)' }}>
      <Minus className="w-3 h-3" /> Same as last period
    </span>
  );
  const up = trend > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const color = up ? '#10b981' : '#ef4444';
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold badge transition-transform duration-150 hover:scale-105" style={{ background: up ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color }}>
      <Icon className="w-3 h-3" /> {up ? '+' : ''}{trend}% vs last period
    </span>
  );
}

export default function StudentAttendance() {
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(searchParams.get('classId') || '');

  const [tab, setTab] = useState('report'); // 'report' | 'history'

  const [counts, setCounts] = useState({ present: 0, absent: 0, late: 0, excused: 0 });
  const [rate, setRate] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [reportPeriod, setReportPeriod] = useState('weekly');
  const [reportDate, setReportDate] = useState(todayStr());
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    api.get('/classes/my').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (classId) params.classId = classId;
      const res = await api.get('/attendance/my', { params });
      setCounts(res.data.counts || { present: 0, absent: 0, late: 0, excused: 0 });
      setRate(res.data.attendance_rate);
      setHistory(res.data.history || []);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }, [classId]);

  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params = { period: reportPeriod, date: reportDate };
      if (classId) params.classId = classId;
      const res = await api.get('/attendance/my/report', { params });
      setReport(res.data);
    } catch { toast.error('Failed to load report'); }
    finally { setReportLoading(false); }
  }, [classId, reportPeriod, reportDate]);

  useEffect(() => { if (tab === 'history') fetchAttendance(); }, [tab, fetchAttendance]);
  useEffect(() => { if (tab === 'report') fetchReport(); }, [tab, fetchReport]);

  const total = counts.present + counts.absent + counts.late + counts.excused;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 no-print animate-fade-in">
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>My Attendance</h2>
          <p className="text-sm text-muted">Your personal attendance report card</p>
        </div>
        <select value={classId} onChange={e => setClassId(e.target.value)} className="input-field sm:w-56 cursor-pointer">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto no-print" style={{ borderColor: 'var(--card-border)' }}>
        {[
          { key: 'report', label: 'Report', Icon: FileBarChart2 },
          { key: 'history', label: 'Full History', Icon: History },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="relative flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors duration-200 flex-shrink-0 group"
            style={{ color: tab === key ? 'var(--text-primary)' : 'var(--text-muted, #888)' }}>
            <Icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" /> {label}
            <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full transition-all duration-300 ease-out"
              style={{
                background: tab === key ? 'var(--primary-500, #6366f1)' : 'transparent',
                transform: tab === key ? 'scaleX(1)' : 'scaleX(0)',
              }} />
          </button>
        ))}
      </div>

      {tab === 'report' && (
        <div className="space-y-5 animate-fade-in">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 no-print">
            <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--surface-100)' }}>
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setReportPeriod(p.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                  style={reportPeriod === p.key
                    ? { background: 'var(--card-bg)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                    : { color: 'var(--text-secondary)' }}>
                  {p.label}
                </button>
              ))}
            </div>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="input-field sm:w-44" />
            <div className="flex-1" />
            <button onClick={() => window.print()} disabled={!report}
              className="btn-secondary text-sm hover:scale-[1.03] active:scale-[0.97] transition-transform duration-150">
              <Printer className="w-4 h-4" /> Print my report
            </button>
          </div>

          {reportLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : !report ? null : (
            <>
              {/* Print header */}
              <div className="hidden print:block text-center mb-4">
                <h1 className="font-display font-bold text-xl">Attendance Report Card</h1>
                <p className="text-sm text-muted">{periodLabel(reportPeriod, report.start, report.end)}</p>
              </div>

              {/* Hero card */}
              <div className="card transition-all duration-200 hover:shadow-soft">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <HeroGauge rate={report.current.rate} />
                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <p className="text-sm text-muted">{periodLabel(reportPeriod, report.start, report.end)}</p>
                    <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                      <TrendBadge trend={report.trend} />
                      {report.current_streak > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold badge transition-transform duration-150 hover:scale-105" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}>
                          <Flame className="w-3 h-3" /> {report.current_streak}-session present streak
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 justify-center sm:justify-start flex-wrap pt-1">
                      {Object.entries(STATUS_META).map(([key, meta]) => (
                        <span key={key} className="text-xs badge transition-transform duration-150 hover:scale-105" style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}: {report.current.counts[key]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline — ascending (oldest → newest) within the period */}
              <div>
                <h3 className="font-display font-bold mb-3 text-sm" style={{ color: 'var(--text-primary)' }}>Day by day</h3>
                {report.current.days.length === 0 ? (
                  <div className="card text-center py-14">
                    <UserCheck className="w-10 h-10 mx-auto mb-2 text-muted opacity-30" />
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>No sessions in this period</p>
                    <p className="text-xs text-muted mt-1">Try a different date or period.</p>
                  </div>
                ) : (
                  <div className="relative pl-6">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: 'var(--card-border)' }} />
                    <div className="space-y-4">
                      {report.current.days.map((d, i) => {
                        const meta = STATUS_META[d.status];
                        const Icon = meta.Icon;
                        return (
                          <div key={i} className="relative animate-slide-up" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
                            <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full border-2 transition-transform duration-200 hover:scale-125"
                              style={{ background: meta.color, borderColor: 'var(--card-bg)' }} />
                            <div className="card py-3 transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{fmtLong(d.date)}</p>
                                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                    {!classId && d.class_name && (
                                      <p className="text-xs text-muted flex items-center gap-1">
                                        <BookOpen className="w-3 h-3" /> {d.class_name}
                                      </p>
                                    )}
                                    {d.teacher_name && (
                                      <p className="text-xs text-muted flex items-center gap-1">
                                        <User className="w-3 h-3" /> {d.teacher_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="flex items-center gap-1.5 text-xs badge flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>
                                  <Icon className="w-3.5 h-3.5" /> {meta.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : total === 0 ? (
          <div className="card text-center py-16 animate-fade-in">
            <UserCheck className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No attendance recorded yet</p>
            <p className="text-sm text-muted">Your teacher hasn't taken attendance for this class yet.</p>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="card text-center py-4 transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5">
                <p className="text-2xl font-display font-bold" style={{ color: rateColor(rate) }}>
                  {rate == null ? '—' : `${rate}%`}
                </p>
                <p className="text-xs text-muted mt-1">Attendance Rate</p>
              </div>
              {Object.entries(STATUS_META).map(([key, { label, color, bg, Icon }]) => (
                <div key={key} className="card text-center py-4 transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5">
                  <Icon className="w-5 h-5 mx-auto mb-1" style={{ color }} />
                  <p className="text-lg font-display font-bold" style={{ color: 'var(--text-primary)' }}>{counts[key]}</p>
                  <p className="text-xs text-muted mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* History — chronological (oldest → newest) */}
            <div className="card p-0 overflow-hidden">
              {history.map((h, i) => {
                const meta = STATUS_META[h.status];
                const Icon = meta.Icon;
                return (
                  <div key={i}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-[var(--surface-100)]"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--card-border)' }}>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{fmtLong(h.date)}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {!classId && h.class_name && (
                          <p className="text-xs text-muted flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> {h.class_name}
                          </p>
                        )}
                        {h.teacher_name && (
                          <p className="text-xs text-muted flex items-center gap-1">
                            <User className="w-3 h-3" /> {h.teacher_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs badge flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>
                      <Icon className="w-3.5 h-3.5" /> {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
