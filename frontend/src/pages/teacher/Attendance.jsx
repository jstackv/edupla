import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  UserCheck, Calendar, CheckCircle2, XCircle, Clock, ShieldCheck,
  Users, History, BarChart3, Trash2, Save,
} from 'lucide-react';

const STATUS_META = {
  present: { label: 'Present', color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle2 },
  absent:  { label: 'Absent',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  Icon: XCircle },
  late:    { label: 'Late',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', Icon: Clock },
  excused: { label: 'Excused', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', Icon: ShieldCheck },
};
const STATUSES = ['present', 'absent', 'late', 'excused'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherAttendance() {
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(searchParams.get('classId') || '');
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState('take'); // 'take' | 'history' | 'summary'
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      setSessionId(res.data.id);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load roster'); }
    finally { setLoading(false); }
  }, [classId, date]);

  const fetchHistory = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await api.get(`/attendance/class/${classId}`, { params: { limit: 20 } });
      setHistory(res.data.sessions || []);
      setTotalSessions(res.data.total || 0);
    } catch { toast.error('Failed to load attendance history'); }
  }, [classId]);

  const fetchSummary = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await api.get(`/attendance/class/${classId}/summary`);
      setSummary(res.data.summary || []);
    } catch { toast.error('Failed to load attendance summary'); }
  }, [classId]);

  useEffect(() => { if (tab === 'take') fetchSession(); }, [tab, fetchSession]);
  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, fetchHistory]);
  useEffect(() => { if (tab === 'summary') fetchSummary(); }, [tab, fetchSummary]);

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

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = records.filter(r => r.status === s).length;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Attendance</h2>
          <p className="text-sm text-muted">Take daily attendance and track class records</p>
        </div>
        <select value={classId} onChange={e => setClassId(e.target.value)} className="input-field sm:w-56">
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {[
          { key: 'take', label: 'Take Attendance', Icon: UserCheck },
          { key: 'history', label: 'History', Icon: History },
          { key: 'summary', label: 'Summary', Icon: BarChart3 },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition-colors"
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
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
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
                  <th className="py-2 pr-3">Student</th>
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
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.student_name}</p>
                      <p className="text-xs text-muted">{s.student_email}</p>
                    </td>
                    <td className="py-2.5 px-3">{s.present}</td>
                    <td className="py-2.5 px-3">{s.absent}</td>
                    <td className="py-2.5 px-3">{s.late}</td>
                    <td className="py-2.5 px-3">{s.excused}</td>
                    <td className="py-2.5 pl-3 font-semibold" style={{ color: s.attendance_rate == null ? 'var(--text-muted)' : s.attendance_rate >= 75 ? '#10b981' : '#ef4444' }}>
                      {s.attendance_rate == null ? '—' : `${s.attendance_rate}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Attendance Session"
        message={`Delete attendance for ${deleteTarget ? new Date(deleteTarget.date).toLocaleDateString() : ''}? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
