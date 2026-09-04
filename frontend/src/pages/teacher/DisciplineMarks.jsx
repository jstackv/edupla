import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Save, Send, Lock, Clock, CheckCircle2, XCircle,
  AlertTriangle, Users, RefreshCw, School, GraduationCap,
} from 'lucide-react';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const STATUS_META = {
  draft:     { label: 'Draft — not yet submitted', color: '#9ca3af', icon: Clock },
  submitted: { label: 'Awaiting admin review', color: '#f59e0b', icon: Clock },
  approved:  { label: 'Approved — visible on reports', color: '#10b981', icon: CheckCircle2 },
  rejected:  { label: 'Rejected — edit and resubmit', color: '#ef4444', icon: XCircle },
};

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function DisciplineMarks() {
  const [loading, setLoading] = useState(true);
  const [myClasses, setMyClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  const [activeYear, setActiveYear] = useState(null);
  const [term, setTerm] = useState(TERMS[0]);

  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [maxMarks, setMaxMarks] = useState(20);
  const [entries, setEntries] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/discipline/my-classes'),
      api.get('/academic-years/active').catch(() => null),
    ]).then(([cRes, yRes]) => {
      setMyClasses(cRes.data.classes || []);
      if (cRes.data.classes?.length) setSelectedClassId(cRes.data.classes[0].id);
      if (yRes?.data?.academicYear) setActiveYear(yRes.data.academicYear);
    }).catch(() => toast.error('Failed to load your classes'))
      .finally(() => setLoading(false));
  }, []);

  const yearName = activeYear?.name || '';
  const closedTerms = activeYear?.disabled_terms || [];
  const isTermClosed = closedTerms.includes(term);

  const loadSheet = useCallback(() => {
    if (!selectedClassId || !yearName) return;
    setSheetLoading(true);
    api.get(`/discipline/class/${selectedClassId}`, { params: { term, academic_year: yearName } })
      .then(r => {
        setMaxMarks(r.data.record.max_marks || 20);
        // Alphabetical ascending by name — a stable, predictable order for
        // the teacher to work through, independent of enrollment order.
        const sortedStudents = [...(r.data.students || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setSheet({ ...r.data, students: sortedStudents });
        const e = {};
        sortedStudents.forEach(s => { e[s.student_id] = s.marks; });
        setEntries(e);
      })
      .catch(() => toast.error('Failed to load discipline sheet'))
      .finally(() => setSheetLoading(false));
  }, [selectedClassId, term, yearName]);

  useEffect(() => { loadSheet(); }, [loadSheet]);

  const locked = sheet?.record?.status === 'submitted' || sheet?.record?.status === 'approved';
  const markedCount = Object.values(entries).filter(v => v != null && v !== '').length;
  const totalCount = sheet?.students?.length || 0;

  function setMark(studentId, value) {
    setEntries(prev => ({ ...prev, [studentId]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        term, academic_year: yearName, max_marks: maxMarks,
        entries: Object.entries(entries).map(([student_id, marks]) => ({
          student_id, marks: marks === '' || marks == null ? null : Number(marks),
        })),
      };
      await api.post(`/discipline/class/${selectedClassId}/save`, payload);
      toast.success('Discipline marks saved');
      loadSheet();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.post(`/discipline/class/${selectedClassId}/submit`, { term, academic_year: yearName });
      toast.success('Submitted for admin review');
      loadSheet();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="aop-skel" style={{ height: 110 }} />
        <div className="aop-skel" style={{ height: 70 }} />
        <div className="aop-skel" style={{ height: 320 }} />
      </div>
    );
  }

  if (myClasses.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Hero />
        <div className="aop-empty">
          <div className="aop-empty-icon"><ShieldCheck size={24} /></div>
          <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14.5 }}>You're not a class teacher</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 420, marginInline: 'auto' }}>
            Discipline marks can only be recorded by a class's own class teacher. Ask your School Manager to assign you as one if this isn't right.
          </p>
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[sheet?.record?.status || 'draft'];
  const StatusIcon = statusMeta.icon;
  const progressPct = totalCount ? Math.round((markedCount / totalCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Hero />

      {/* Controls */}
      <div style={{ borderRadius: 18, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: 18, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
        {myClasses.length > 1 && (
          <div>
            <p style={fieldLabel}>Class</p>
            <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="aop-sheet-select">
              {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <p style={fieldLabel}>Term</p>
          <div className="aop-segment">
            {TERMS.map(t => (
              <button
                key={t} type="button" className="aop-segment-btn" data-active={term === t}
                onClick={() => setTerm(t)}
              >
                {t}{closedTerms.includes(t) && ' 🔒'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p style={fieldLabel}>Academic Year</p>
          <div className="aop-sheet-select" style={{ cursor: 'default', display: 'flex', alignItems: 'center' }}>{yearName || '—'}</div>
        </div>

        <div>
          <p style={fieldLabel}>Max marks</p>
          <input
            type="number" min={1} value={maxMarks} disabled={locked}
            onChange={e => setMaxMarks(Number(e.target.value) || 1)}
            className="aop-sheet-select" style={{ width: 80 }}
          />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: statusMeta.color }}>
          <StatusIcon size={16} /> {statusMeta.label}
        </div>
      </div>

      {isTermClosed && (
        <div className="aop-alert aop-alert--amber">
          <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: 'var(--text-primary)', margin: 0 }}>{term} is closed by your School Manager — discipline marks can't be recorded or submitted for it.</p>
        </div>
      )}

      {sheet?.record?.status === 'rejected' && sheet.record.review_note && (
        <div className="aop-alert aop-alert--red">
          <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 800, color: '#ef4444', margin: 0 }}>Rejected by admin</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{sheet.record.review_note}</p>
          </div>
        </div>
      )}

      {/* Roster */}
      {sheetLoading ? (
        <div className="aop-skel" style={{ height: 320 }} />
      ) : !sheet ? null : (
        <div style={{ borderRadius: 18, border: '1px solid var(--card-border)', background: 'var(--card-bg)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#f97316,#c2410c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <School size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{sheet.class.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={13} /> {totalCount} students
            </span>

            {/* Progress ring-ish bar */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-100)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${progressPct}%`, borderRadius: 999,
                  background: progressPct === 100 ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#fb923c,#f97316)',
                  transition: 'width 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                }} />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: progressPct === 100 ? '#10b981' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {markedCount}/{totalCount} marked
              </span>
            </div>
          </div>

          <div>
            {sheet.students.map((s, i) => {
              const val = entries[s.student_id];
              const filled = val != null && val !== '';
              return (
                <div key={s.student_id} className="aop-roster-row" style={{ '--i': i }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#fb923c,#ea580c)',
                    color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {initials(s.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <input
                      type="number" min={0} max={maxMarks} disabled={locked}
                      value={val ?? ''}
                      onChange={e => setMark(s.student_id, e.target.value === '' ? '' : Number(e.target.value))}
                      className="aop-marks-input"
                      data-filled={filled}
                      placeholder="—"
                    />
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>/{maxMarks}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div style={{ padding: 18, borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {locked ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <Lock size={13} /> Locked — {sheet.record.status === 'approved' ? 'already approved' : 'awaiting admin review'}
              </span>
            ) : (
              <>
                <button onClick={handleSave} disabled={saving || isTermClosed} className="aop-action-btn aop-action-btn--ghost">
                  {saving ? <RefreshCw size={14} style={{ animation: 'spin 0.6s linear infinite' }} /> : <Save size={14} />} Save Draft
                </button>
                <button onClick={handleSubmit} disabled={submitting || isTermClosed} className="aop-action-btn aop-action-btn--primary">
                  {submitting ? <RefreshCw size={14} style={{ animation: 'spin 0.6s linear infinite' }} /> : <Send size={14} />} Submit for Review
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Hero() {
  return (
    <div className="aop-hero">
      <div className="aop-hero-orb a" />
      <div className="aop-hero-orb b" />
      <div className="aop-hero-orb c" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
        <div className="aop-hero-icon"><ShieldCheck size={22} color="#fff" /></div>
        <div className="aop-hero-title">
          <h2 style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Discipline Marks</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
            Record behavior marks for the class you're class teacher of, then submit for admin approval.
          </p>
        </div>
        <GraduationCap size={40} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.18)', position: 'relative', zIndex: 1 }} />
      </div>
    </div>
  );
}

const fieldLabel = { fontSize: 10.5, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 };
