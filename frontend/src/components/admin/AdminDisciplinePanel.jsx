import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../common/ConfirmModal';
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, RefreshCw, Users,
  School, ChevronRight, X, MessageSquare, TrendingUp, ClipboardCheck, FileDown,
} from 'lucide-react';

const STATUS_FILTERS = [
  { key: 'submitted', label: 'Pending Review', color: '#f59e0b' },
  { key: 'approved',  label: 'Approved',       color: '#10b981' },
  { key: 'rejected',  label: 'Rejected',       color: '#ef4444' },
  { key: '',          label: 'All',            color: '#ea580c' },
];

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function pctColor(pct) {
  if (pct == null) return '#9ca3af';
  if (pct >= 70) return '#059669';
  if (pct >= 50) return '#b45309';
  return '#dc2626';
}

export default function AdminDisciplinePanel() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [studentSort, setStudentSort] = useState('marks'); // 'marks' | 'name' — how the roster inside a submission is ordered
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    api.get('/discipline/admin/submissions', { params: status ? { status } : {} })
      .then(r => setRecords(r.data.records || []))
      .catch(() => toast.error('Failed to load discipline submissions'))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { fetchList(); }, [fetchList]);

  function openDetail(id) {
    // Instant header, no spinner-flash: the list row already has everything
    // needed for the modal's header/stat area, so show that immediately
    // and only skeleton-load the actual student table underneath while the
    // full fetch resolves in the background.
    const row = records.find(r => r.id === id);
    setStudentSort('marks');
    setDetail({
      id,
      record: row ? {
        id: row.id, class_name: row.class_name, class_id: row.class_id,
        teacher_name: row.teacher_name, teacher_email: row.teacher_email,
        term: row.term, academic_year: row.academic_year, max_marks: row.max_marks,
        status: row.status, submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at, review_note: row.review_note,
      } : null,
      students: null,
    });
    setDetailLoading(true);
    api.get(`/discipline/admin/submissions/${id}`)
      .then(r => setDetail(r.data))
      .catch(() => { toast.error('Failed to load details'); setDetail(null); })
      .finally(() => setDetailLoading(false));
  }

  async function handleApprove() {
    setActing(true);
    try {
      await api.post(`/discipline/admin/submissions/${detail.record.id}/approve`);
      toast.success('Discipline marks approved');
      setDetail(null);
      fetchList();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to approve'); }
    finally { setActing(false); }
  }

  async function handleReject() {
    setActing(true);
    try {
      await api.post(`/discipline/admin/submissions/${detail.record.id}/reject`, { note: rejectNote });
      toast.success('Discipline marks rejected');
      setShowRejectModal(false);
      setRejectNote('');
      setDetail(null);
      fetchList();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reject'); }
    finally { setActing(false); }
  }

  // Follows this app's existing "export to PDF" convention (see the TVET
  // report cards): a print-only view, printed via the browser's own
  // print-to-PDF, rather than pulling in a client-side PDF library. A
  // dedicated `.discipline-print-only` block is rendered off-screen and
  // becomes the only visible thing on the page for the duration of the
  // print — robust regardless of the modal's own fixed positioning.
  function handleExportPdf() {
    window.print();
  }



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div className="aop-hero-icon" style={{ width: 42, height: 42, background: 'linear-gradient(135deg,#ea580c,#9a3412)', border: 'none', boxShadow: '0 6px 16px color-mix(in srgb, #ea580c 40%, transparent)' }}>
          <ShieldCheck size={20} color="#fff" />
        </div>
        <div>
          <h3 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Discipline Marks Review</h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Behavior marks recorded by each class's own class teacher, awaiting your approval before they count on reports.</p>
        </div>
        <button onClick={fetchList} className="aop-action-btn aop-action-btn--ghost" style={{ marginLeft: 'auto', padding: '8px 14px', fontSize: 12.5 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key || 'all'}
            onClick={() => setStatus(f.key)}
            className="aop-filter-pill"
            data-active={status === f.key}
            style={{ '--pill-color': f.color }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="aop-skel" style={{ height: 74 }} />)}
        </div>
      ) : records.length === 0 ? (
        <div className="aop-empty">
          <div className="aop-empty-icon"><ClipboardCheck size={24} /></div>
          <p style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text-primary)' }}>Nothing here</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No discipline submissions match this filter yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {records.map((r, i) => (
            <button key={r.id} onClick={() => openDetail(r.id)} className="aop-assess-row" style={{ '--i': i }}>
              <div style={{ minWidth: 180, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#ea580c,#9a3412)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <School size={16} color="#fff" />
                </div>
                <div>
                  <p className="aop-assess-title">{r.class_name}</p>
                  <p className="aop-assess-sub">{r.teacher_name} • {r.term} {r.academic_year}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div className="aop-assess-metric">
                  <div className="aop-assess-metric-num" style={{ color: 'var(--text-primary)' }}>{r.marked_count}/{r.total_students}</div>
                  <div className="aop-assess-metric-label">Marked</div>
                </div>
                <div className="aop-assess-metric">
                  <div className="aop-assess-metric-num" style={{ color: pctColor(r.average_percentage) }}>{r.average_percentage != null ? `${r.average_percentage}%` : '—'}</div>
                  <div className="aop-assess-metric-label">Avg score</div>
                </div>
                <StatusBadge status={r.status} />
                <div className="aop-assess-arrow"><ChevronRight size={15} /></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Detail modal ── */}
      {detail && (() => {
        const sortedStudents = [...(detail.students || [])].sort((a, b) => {
          if (studentSort === 'name') return (a.name || '').localeCompare(b.name || '');
          if (a.marks == null && b.marks == null) return 0;
          if (a.marks == null) return 1;
          if (b.marks == null) return -1;
          return b.marks - a.marks;
        });
        return (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, animation: 'aopRise 0.2s ease' }}
          onClick={() => setDetail(null)}
        >
          <div style={{ borderRadius: 20, border: '1px solid var(--card-border)', background: 'var(--card-bg)', width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 12, background: 'color-mix(in srgb, #ea580c 5%, var(--card-bg))' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#ea580c,#9a3412)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={17} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15.5, color: 'var(--text-primary)' }}>{detail.record?.class_name || 'Loading…'}</p>
                {detail.record && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{detail.record.teacher_name} • {detail.record.term} {detail.record.academic_year}</p>}
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, borderRadius: 8, display: 'flex' }}><X size={18} /></button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {!detail.record ? (
                <div className="aop-skel" style={{ height: 200, margin: 18 }} />
              ) : detail.students == null ? (
                <>
                  <div className="aop-skel" style={{ height: 90, margin: '16px 20px 0' }} />
                  <div className="aop-skel" style={{ height: 160, margin: '12px 20px 20px' }} />
                </>
              ) : (
                <>
                  {detail.record.review_note && (
                    <div className="aop-alert aop-alert--red" style={{ margin: '16px 20px 0' }}>
                      <MessageSquare size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>{detail.record.review_note}</p>
                    </div>
                  )}
                  <div style={{ padding: '16px 20px 4px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                    {(() => {
                      const rows = detail.students || [];
                      const marked = rows.filter(s => s.marks != null);
                      const avg = marked.length ? Math.round(marked.reduce((s, x) => s + x.marks, 0) / marked.length / detail.record.max_marks * 100) : null;
                      const stats = [
                        { label: 'Students', value: rows.length, icon: Users, color: '#ea580c' },
                        { label: 'Marked', value: marked.length, icon: ClipboardCheck, color: '#0ea5e9' },
                        { label: 'Avg score', value: avg != null ? `${avg}%` : '—', icon: TrendingUp, color: pctColor(avg) },
                      ];
                      return stats.map(st => (
                        <div key={st.label} className="aop-stat-chip">
                          <div className="aop-stat-chip-icon" style={{ background: st.color + '18' }}><st.icon size={16} style={{ color: st.color }} /></div>
                          <div><div className="aop-stat-chip-num">{st.value}</div><div className="aop-stat-chip-label">{st.label}</div></div>
                        </div>
                      ));
                    })()}
                  </div>

                  <div style={{ margin: '4px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="aop-segment">
                      <button type="button" className="aop-segment-btn" data-active={studentSort === 'marks'} onClick={() => setStudentSort('marks')}>
                        <TrendingUp size={11} style={{ marginRight: 4, verticalAlign: -1 }} /> By marks
                      </button>
                      <button type="button" className="aop-segment-btn" data-active={studentSort === 'name'} onClick={() => setStudentSort('name')}>
                        A–Z
                      </button>
                    </div>
                  </div>

                  <div className="aop-table-wrap" style={{ margin: '10px 20px 20px', border: 'none', borderRadius: 0 }}>
                    <table className="aop-table">
                      <thead>
                        <tr><th>Student</th><th>Marks (/{detail.record.max_marks})</th><th>%</th></tr>
                      </thead>
                      <tbody>
                        {sortedStudents.map(s => {
                          const pct = s.marks != null ? Math.round((s.marks / detail.record.max_marks) * 100) : null;
                          return (
                            <tr key={s.student_id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                  <div className="aop-row-avatar">{initials(s.name)}</div>
                                  <div>
                                    <p style={{ margin: 0, fontWeight: 700 }}>{s.name}</p>
                                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{s.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontWeight: 700 }}>{s.marks ?? '—'}</td>
                              <td style={{ fontWeight: 800, color: pctColor(pct) }}>{pct != null ? `${pct}%` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {detail.record && (
              <div style={{ padding: 18, borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  onClick={handleExportPdf}
                  disabled={detail.students == null}
                  className="aop-action-btn aop-action-btn--ghost"
                  style={{ marginRight: 'auto' }}
                >
                  <FileDown size={14} /> Export PDF
                </button>
                {detail.record.status === 'submitted' && (
                  <button onClick={handleApprove} disabled={acting || detail.students == null} className="aop-action-btn aop-action-btn--success">
                    {acting ? <RefreshCw size={14} style={{ animation: 'spin 0.6s linear infinite' }} /> : <CheckCircle2 size={14} />} Approve
                  </button>
                )}
                {(detail.record.status === 'submitted' || detail.record.status === 'approved') ? (
                  <button onClick={() => setShowRejectModal(true)} disabled={acting || detail.students == null} className="aop-action-btn aop-action-btn--danger">
                    <XCircle size={14} /> {detail.record.status === 'approved' ? 'Reject (reopen for editing)' : 'Reject'}
                  </button>
                ) : (
                  <StatusBadge status={detail.record.status} />
                )}
              </div>
            )}
          </div>

          {/* Print-only export target — invisible on screen, becomes the
              only visible content on the page for the duration of print
              (see the @media print rules below), regardless of this
              modal's own fixed positioning. */}
          {detail.record && detail.students != null && (
            <div className="discipline-print-only">
              <h1>{detail.record.class_name} — Discipline Marks</h1>
              <p>
                Class teacher: {detail.record.teacher_name} &nbsp;•&nbsp; {detail.record.term} {detail.record.academic_year}
                &nbsp;•&nbsp; Status: {detail.record.status.charAt(0).toUpperCase() + detail.record.status.slice(1)}
              </p>
              <table>
                <thead>
                  <tr><th>#</th><th>Student</th><th>Email</th><th>Marks (/{detail.record.max_marks})</th><th>%</th></tr>
                </thead>
                <tbody>
                  {sortedStudents.map((s, i) => {
                    const pct = s.marks != null ? Math.round((s.marks / detail.record.max_marks) * 100) : null;
                    return (
                      <tr key={s.student_id}>
                        <td>{i + 1}</td>
                        <td>{s.name}</td>
                        <td>{s.email}</td>
                        <td>{s.marks ?? '—'}</td>
                        <td>{pct != null ? `${pct}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="discipline-print-footer">Generated {new Date().toLocaleDateString()} · {sortedStudents.length} students</p>
            </div>
          )}
        </div>
      );
      })()}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .discipline-print-only, .discipline-print-only * { visibility: visible; }
          .discipline-print-only {
            display: block !important;
            position: absolute; top: 0; left: 0; width: 100%;
            padding: 12mm; color: #0f172a; background: #fff;
          }
          .discipline-print-only h1 { font-size: 16px; margin: 0 0 4px; }
          .discipline-print-only p { font-size: 11px; color: #475569; margin: 0 0 12px; }
          .discipline-print-only table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          .discipline-print-only th, .discipline-print-only td {
            border: 1px solid #94a3b8; padding: 5px 8px; text-align: left;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .discipline-print-only th { background: #e2e8f0 !important; font-weight: 700; }
          .discipline-print-footer { margin-top: 10px !important; font-size: 9.5px !important; color: #94a3b8 !important; }
          @page { margin: 10mm; size: A4 portrait; }
        }
        .discipline-print-only { display: none; }
      `}</style>

      <ConfirmModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Reject Discipline Marks"
        message="Explain why these discipline marks are being rejected — the class teacher will see this note and can edit and resubmit."
        confirmText="Reject"
        variant="danger"
        loading={acting}
      >
        <textarea
          value={rejectNote} onChange={e => setRejectNote(e.target.value)}
          rows={3} placeholder="Reason for rejection…"
          className="aop-sheet-select"
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontWeight: 400 }}
        />
      </ConfirmModal>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = {
    draft:     { label: 'Draft', color: '#9ca3af', icon: Clock },
    submitted: { label: 'Pending', color: '#f59e0b', icon: Clock },
    approved:  { label: 'Approved', color: '#10b981', icon: CheckCircle2 },
    rejected:  { label: 'Rejected', color: '#ef4444', icon: XCircle },
  }[status] || { label: status, color: '#9ca3af', icon: Clock };
  const Icon = meta.icon;
  return (
    <span className="aop-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: meta.color + '18', color: meta.color, border: `1px solid ${meta.color}38` }}>
      <Icon size={10} /> {meta.label}
    </span>
  );
}
