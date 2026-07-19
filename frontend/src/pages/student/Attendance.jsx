import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, UserCheck, BookOpen,
} from 'lucide-react';

const STATUS_META = {
  present: { label: 'Present', color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle2 },
  absent:  { label: 'Absent',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  Icon: XCircle },
  late:    { label: 'Late',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', Icon: Clock },
  excused: { label: 'Excused', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', Icon: ShieldCheck },
};

export default function StudentAttendance() {
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(searchParams.get('classId') || '');
  const [counts, setCounts] = useState({ present: 0, absent: 0, late: 0, excused: 0 });
  const [rate, setRate] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const total = counts.present + counts.absent + counts.late + counts.excused;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>My Attendance</h2>
          <p className="text-sm text-muted">Your attendance record across your classes</p>
        </div>
        <select value={classId} onChange={e => setClassId(e.target.value)} className="input-field sm:w-56">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : total === 0 ? (
        <div className="card text-center py-16">
          <UserCheck className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No attendance recorded yet</p>
          <p className="text-sm text-muted">Your teacher hasn't taken attendance for this class yet.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="card text-center py-4">
              <p className="text-2xl font-display font-bold" style={{ color: rate >= 75 ? '#10b981' : '#ef4444' }}>
                {rate == null ? '—' : `${rate}%`}
              </p>
              <p className="text-xs text-muted mt-1">Attendance Rate</p>
            </div>
            {Object.entries(STATUS_META).map(([key, { label, color, bg, Icon }]) => (
              <div key={key} className="card text-center py-4">
                <Icon className="w-5 h-5 mx-auto mb-1" style={{ color }} />
                <p className="text-lg font-display font-bold" style={{ color: 'var(--text-primary)' }}>{counts[key]}</p>
                <p className="text-xs text-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* History */}
          <div className="card divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {history.map((h, i) => {
              const meta = STATUS_META[h.status];
              const Icon = meta.Icon;
              return (
                <div key={i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {new Date(h.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {!classId && h.class_name && (
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <BookOpen className="w-3 h-3" /> {h.class_name}
                      </p>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-xs badge flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>
                    <Icon className="w-3.5 h-3.5" /> {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
