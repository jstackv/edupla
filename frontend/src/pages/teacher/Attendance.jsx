import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  UserCheck, Calendar, CheckCircle2, XCircle, Clock, ShieldCheck,
  Users, History, BarChart3, Trash2, Save, FileBarChart2, Download,
  Printer, AlertTriangle, Trophy, Frown,
} from 'lucide-react';

const STATUS_META = {
  present: { label: 'Present', letter: 'P', color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle2 },
  absent:  { label: 'Absent',  letter: 'A', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  Icon: XCircle },
  late:    { label: 'Late',    letter: 'L', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', Icon: Clock },
  excused: { label: 'Excused', letter: 'E', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', Icon: ShieldCheck },
};
const STATUSES = ['present', 'absent', 'late', 'excused'];
const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function fmtShort(d) {
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
function fmtLong(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function periodLabel(period, start, end) {
  if (!start) return '';
  if (period === 'daily') return fmtLong(start);
  if (period === 'monthly') return new Date(start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return `${fmtShort(start)} – ${fmtShort(end)}, ${new Date(end).getFullYear()}`;
}
function rateColor(rate) {
  if (rate == null) return 'var(--text-secondary)';
  if (rate >= 90) return '#10b981';
  if (rate >= 75) return '#f59e0b';
  return '#ef4444';
}
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(cell => {
    const v = cell == null ? '' : String(cell);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Small radial progress ring built with conic-gradient — no chart library needed */
function RateRing({ rate, size = 84 }) {
  const pct = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const color = rateColor(rate);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(148,163,184,0.18) 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <div style={{
        width: size - 14, height: size - 14, borderRadius: '50%', background: 'var(--card-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      }}>
        <span className="font-display font-bold" style={{ fontSize: size * 0.22, color }}>
          {rate == null ? '—' : `${Math.round(rate)}%`}
        </span>
      </div>
    </div>
  );
}

export default function TeacherAttendance() {
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(searchParams.get('classId') || '');
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState('take'); // 'take' | 'history' | 'summary' | 'report'
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [reportPeriod, setReportPeriod] = useState('weekly');
  const [reportDate, setReportDate] = useState(todayStr());
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    api.get('/classes?limit=100').then(r => {
      const list = r.data.classes || [];
      setClasses(list);
      if (!classId && list.length) setClassId(list[0].id);
    }).catch(() => toast.error('Failed to load classes'));
  }, []);

  const fetchSession = useCallback(async () => {
    if (!classId || !date) return;
    setLoading(true);
    try {
      const res = await api.get('/attendance/session', { params: { classId, date } });
      setRecords(res.data.records || []);
      setAlreadyTaken(res.data.already_taken);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load roster'); }
    finally { setLoading(false); }
  }, [classId, date]);

  const fetchHistory = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await api.get(`/attendance/class/${classId}`, { params: { limit: 20 } });
      setHistory(res.data.sessions || []);
    } catch { toast.error('Failed to load attendance history'); }
  }, [classId]);

  const fetchSummary = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await api.get(`/attendance/class/${classId}/summary`);
      setSummary(res.data.summary || []);
    } catch { toast.error('Failed to load attendance summary'); }
  }, [classId]);

  const fetchReport = useCallback(async () => {
    if (!classId) return;
    setReportLoading(true);
    try {
      const res = await api.get(`/attendance/class/${classId}/report`, { params: { period: reportPeriod, date: reportDate } });
      setReport(res.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load report'); }
    finally { setReportLoading(false); }
  }, [classId, reportPeriod, reportDate]);

  useEffect(() => { if (tab === 'take') fetchSession(); }, [tab, fetchSession]);
  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, fetchHistory]);
  useEffect(() => { if (tab === 'summary') fetchSummary(); }, [tab, fetchSummary]);
  useEffect(() => { if (tab === 'report') fetchReport(); }, [tab, fetchReport]);

  const setStatus = (studentId, status) => {
    setRecords(rs => rs.map(r => r.student_id === studentId ? { ...r, status } : r));
  };
  const markAll = (status) => setRecords(rs => rs.map(r => ({ ...r, status })));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/attendance/session', {
        classId, date,
        records: records.map(r => ({ student_id: r.student_id, status: r.status, remarks: r.remarks || null })),
      });
      toast.success(alreadyTaken ? 'Attendance updated' : 'Attendance recorded');
      fetchSession();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save attendance'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/attendance/session/${deleteTarget.id}`);
      toast.success('Attendance session deleted');
      setDeleteTarget(null);
      fetchHistory();
    } catch { toast.error('Failed to delete session'); }
    finally { setDeleting(false); }
  };

  const handleExportCSV = () => {
    if (!report) return;
    const header = ['Student', 'Email', ...report.session_dates.map(d => fmtShort(d)), 'Rate (%)'];
    const rows = report.students.map(s => [
      s.name, s.email,
      ...report.session_dates.map(d => {
        const st = s.by_date[d];
        return st ? STATUS_META[st].label : '—';
      }),
      s.rate == null ? '—' : s.rate,
    ]);
    downloadCSV(`attendance-${report.class_name || 'class'}-${reportPeriod}-${reportDate}.csv`, [header, ...rows]);
  };

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = records.filter(r => r.status === s).length;
    return acc;
  }, {});

  const className = useMemo(() => classes.find(c => c.id === classId)?.name || '', [classes, classId]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 no-print">
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Attendance</h2>
          <p className="text-sm text-muted">Take daily attendance and track class records</p>
        </div>
        <select value={classId} onChange={e => setClassId(e.target.value)} className="input-field sm:w-56">
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto no-print" style={{ borderColor: 'var(--border-color)' }}>
        {[
          { key: 'take', label: 'Take Attendance', Icon: UserCheck },
          { key: 'history', label: 'History', Icon: History },
          { key: 'summary', label: 'Summary', Icon: BarChart3 },
          { key: 'report', label: 'Reports', Icon: FileBarChart2 },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition-colors flex-shrink-0"
            style={{
              borderColor: tab === key ? 'var(--primary-500, #6366f1)' : 'transparent',
              color: tab === key ? 'var(--text-primary)' : 'var(--text-muted, #888)',
            }}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'take' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)}
                className="input-field pl-10" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {STATUSES.map(s => (
                <button key={s} onClick={() => markAll(s)} className="btn-secondary text-xs px-2.5 py-1.5">
                  Mark all {STATUS_META[s].label}
                </button>
              ))}
            </div>
            {alreadyTaken && (
              <span className="text-xs badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                Already taken — editing will update it
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : records.length === 0 ? (
            <div className="card text-center py-16">
              <Users className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No students enrolled</p>
              <p className="text-sm text-muted">Add students to this class before taking attendance.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap">
                {STATUSES.map(s => (
                  <span key={s} className="text-xs badge" style={{ background: STATUS_META[s].bg, color: STATUS_META[s].color }}>
                    {STATUS_META[s].label}: {counts[s]}
                  </span>
                ))}
              </div>
              {/* Sorted A→Z by the backend */}
              <div className="card divide-y" style={{ borderColor: 'var(--border-color)' }}>
                {records.map(r => (
                  <div key={r.student_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                      <p className="text-xs text-muted truncate">{r.email}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {STATUSES.map(s => {
                        const { Icon, color, bg, label } = STATUS_META[s];
                        const active = r.status === s;
                        return (
                          <button key={s} title={label} onClick={() => setStatus(r.student_id, s)}
                            className="p-2 rounded-lg transition-all"
                            style={active ? { background: bg, color } : { background: 'transparent', color: 'var(--text-muted, #999)' }}>
                            <Icon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  {alreadyTaken ? 'Update Attendance' : 'Save Attendance'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="card text-center py-16">
              <History className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No attendance taken yet</p>
              <p className="text-sm text-muted">Sessions you record will show up here.</p>
            </div>
          ) : (
            history.map(s => (
              <div key={s.id} className="card flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{fmtLong(s.date)}</p>
                  <div className="flex gap-2 flex-wrap mt-1.5">
                    {STATUSES.map(st => (
                      <span key={st} className="text-xs badge" style={{ background: STATUS_META[st].bg, color: STATUS_META[st].color }}>
                        {STATUS_META[st].label}: {s.counts[st] || 0}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => setDeleteTarget(s)}
                  className="p-2 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0" title="Delete session">
                  <Trash2 className="w-4 h-4 text-muted" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'summary' && (
        <div className="card overflow-x-auto">
          {summary.length === 0 ? (
            <div className="text-center py-16">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No data yet</p>
              <p className="text-sm text-muted">Take attendance a few times to see per-student rates.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted uppercase border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="py-2 pr-3">Student (A→Z)</th>
                  <th className="py-2 px-3">Present</th>
                  <th className="py-2 px-3">Absent</th>
                  <th className="py-2 px-3">Late</th>
                  <th className="py-2 px-3">Excused</th>
                  <th className="py-2 pl-3">Rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(s => (
                  <tr key={s.student_id} className="border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.student_name}</p>
                          <p className="text-xs text-muted">{s.student_email}</p>
                        </div>
                        {s.at_risk && (
                          <span title="At risk: low attendance rate or 3+ consecutive absences"
                            className="text-xs badge flex-shrink-0" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                            <AlertTriangle className="w-3 h-3" /> At risk
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">{s.present}</td>
                    <td className="py-2.5 px-3">{s.absent}</td>
                    <td className="py-2.5 px-3">{s.late}</td>
                    <td className="py-2.5 px-3">{s.excused}</td>
                    <td className="py-2.5 pl-3 font-semibold" style={{ color: rateColor(s.attendance_rate) }}>
                      {s.attendance_rate == null ? '—' : `${s.attendance_rate}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'report' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 no-print">
            <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--surface-100)' }}>
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setReportPeriod(p.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={reportPeriod === p.key
                    ? { background: 'var(--card-bg)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                    : { color: 'var(--text-secondary)' }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="input-field pl-10" />
            </div>
            <div className="flex-1" />
            <button onClick={handleExportCSV} disabled={!report} className="btn-secondary text-sm">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={() => window.print()} disabled={!report} className="btn-secondary text-sm">
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>

          {reportLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : !report || report.session_dates.length === 0 ? (
            <div className="card text-center py-16">
              <FileBarChart2 className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No sessions in this period</p>
              <p className="text-sm text-muted">Try a different date or period.</p>
            </div>
          ) : (
            <>
              {/* Print header — only meaningful on the printed page */}
              <div className="hidden print:block text-center mb-4">
                <h1 className="font-display font-bold text-xl">{report.class_name} — Attendance Register</h1>
                <p className="text-sm text-muted">{periodLabel(reportPeriod, report.start, report.end)}</p>
              </div>
              <div className="flex items-center justify-between no-print">
                <div>
                  <h3 className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>{className}</h3>
                  <p className="text-sm text-muted">{periodLabel(reportPeriod, report.start, report.end)}</p>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card flex items-center gap-3">
                  <RateRing rate={report.class_stats.average_rate} size={64} />
                  <div>
                    <p className="text-xs text-muted">Average Rate</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{report.class_stats.total_sessions} session(s)</p>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                    <p className="text-xs text-muted">At-Risk Students</p>
                  </div>
                  <p className="text-2xl font-display font-bold" style={{ color: report.class_stats.at_risk.length ? '#ef4444' : 'var(--text-primary)' }}>
                    {report.class_stats.at_risk.length}
                  </p>
                  {!!report.class_stats.at_risk.length && (
                    <p className="text-xs text-muted mt-1 truncate">
                      {report.class_stats.at_risk.slice(0, 2).map(a => a.name).join(', ')}
                      {report.class_stats.at_risk.length > 2 ? ` +${report.class_stats.at_risk.length - 2} more` : ''}
                    </p>
                  )}
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4" style={{ color: '#10b981' }} />
                    <p className="text-xs text-muted">Best Day</p>
                  </div>
                  {report.class_stats.best_day ? (
                    <>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtShort(report.class_stats.best_day.date)}</p>
                      <p className="text-xs font-semibold" style={{ color: '#10b981' }}>{report.class_stats.best_day.rate}% present</p>
                    </>
                  ) : <p className="text-sm text-muted">—</p>}
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 mb-1">
                    <Frown className="w-4 h-4" style={{ color: '#ef4444' }} />
                    <p className="text-xs text-muted">Toughest Day</p>
                  </div>
                  {report.class_stats.worst_day ? (
                    <>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtShort(report.class_stats.worst_day.date)}</p>
                      <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>{report.class_stats.worst_day.rate}% present</p>
                    </>
                  ) : <p className="text-sm text-muted">—</p>}
                </div>
              </div>

              {/* Register grid — students (A→Z) × session dates */}
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 text-left px-3 py-2.5 font-bold uppercase tracking-wide text-xs"
                        style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)', minWidth: 160 }}>
                        Student (A→Z)
                      </th>
                      {report.session_dates.map(d => (
                        <th key={d} className="px-2 py-2.5 text-center font-bold whitespace-nowrap"
                          style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                          {fmtShort(d)}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center font-bold" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.students.map(s => (
                      <tr key={s.student_id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="sticky left-0 px-3 py-2 font-semibold" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>
                          {s.name}
                        </td>
                        {report.session_dates.map(d => {
                          const st = s.by_date[d];
                          const meta = st ? STATUS_META[st] : null;
                          return (
                            <td key={d} className="px-2 py-2 text-center">
                              {meta ? (
                                <span title={meta.label} className="inline-flex items-center justify-center w-5 h-5 rounded-full font-bold"
                                  style={{ background: meta.bg, color: meta.color }}>{meta.letter}</span>
                              ) : <span className="text-muted">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold" style={{ color: rateColor(s.rate) }}>
                          {s.rate == null ? '—' : `${s.rate}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted no-print">P = Present · A = Absent · L = Late · E = Excused</p>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Attendance Session"
        message={`Delete attendance for ${deleteTarget ? fmtLong(deleteTarget.date) : ''}? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
