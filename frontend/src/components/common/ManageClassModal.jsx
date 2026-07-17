import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { Avatar, LevelBadge, TradeBadge, StatusBadge, getAvatarColors } from './classUI';
import {
  LayoutDashboard, Users, ArrowRightLeft, ShieldAlert, Edit2,
  Trash2, ToggleLeft, ToggleRight, Search, ArrowRight, CheckSquare, Square,
  GraduationCap, BookOpen, Award, Eraser, Calendar,
} from 'lucide-react';

// "Students" used to be its own tab here, but enrolled-student browsing already
// lives in the admin's "View" modal (which also owns the Enroll Student flow),
// so this modal only needs Overview / Move / Danger Zone.
const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, accent: '#0ea5e9' },
  { key: 'move', label: 'Move Students', icon: ArrowRightLeft, accent: '#6366f1' },
  { key: 'danger', label: 'Danger Zone', icon: ShieldAlert, accent: '#ef4444' },
];

function Spinner({ size = 32, color = '#0ea5e9' }) {
  return <div style={{ width: size, height: size, border: '3px solid var(--surface-100)', borderTopColor: color, borderRadius: '50%', animation: 'mcmSpin 0.8s linear infinite' }} />;
}

export default function ManageClassModal({
  cls, isOpen, onClose, levels = [], trades = [],
  onEdit, onToggle, onDelete, onViewStudents, onChanged,
}) {
  const [tab, setTab] = useState('overview');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  const [allClasses, setAllClasses] = useState([]);
  const [targetClassId, setTargetClassId] = useState('');

  const [moving, setMoving] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [moveConfirm, setMoveConfirm] = useState(null); // 'all' | 'selected' | null
  const [eraseConfirm, setEraseConfirm] = useState(null); // 'all' | 'selected' | null

  // Sliding active-tab indicator
  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = tabRefs.current[tab];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab, isOpen]);

  const fetchStudents = useCallback(async (classId) => {
    if (!classId) return;
    setLoadingStudents(true);
    try {
      const res = await api.get(`/admin/classes/${classId}/students`);
      setStudents(res.data.students || []);
    } catch { toast.error('Failed to load students'); }
    finally { setLoadingStudents(false); }
  }, []);

  const fetchAllClasses = useCallback(async (excludeId) => {
    try {
      const res = await api.get('/admin/classes', { params: { limit: 500 } });
      setAllClasses((res.data.classes || []).filter(c => c.id !== excludeId));
    } catch { /* silent — target dropdown will just show empty */ }
  }, []);

  useEffect(() => {
    if (!isOpen || !cls) return;
    setTab('overview');
    setSelected(new Set());
    setSearch('');
    setTargetClassId('');
    fetchStudents(cls.id);
    fetchAllClasses(cls.id);
  }, [isOpen, cls?.id, fetchStudents, fetchAllClasses]);

  const [avatarFrom] = cls ? getAvatarColors(cls.name) : ['#6366f1'];

  const filteredStudents = useMemo(() => students.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase())
  ), [students, search]);

  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every(s => selected.has(s.id));

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredStudents.forEach(s => next.delete(s.id));
      else filteredStudents.forEach(s => next.add(s.id));
      return next;
    });
  };

  const refreshAfterChange = async () => {
    await fetchStudents(cls.id);
    setSelected(new Set());
    onChanged?.();
  };

  const runMove = async () => {
    if (!targetClassId) return;
    setMoving(true);
    try {
      const studentIds = moveConfirm === 'selected' ? Array.from(selected) : [];
      const res = await api.post(`/admin/classes/${cls.id}/move-students`, { targetClassId, studentIds });
      toast.success(res.data.message || 'Students moved');
      setMoveConfirm(null);
      await refreshAfterChange();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to move students'); }
    finally { setMoving(false); }
  };

  const runErase = async () => {
    setErasing(true);
    try {
      const studentIds = eraseConfirm === 'selected' ? Array.from(selected) : [];
      const res = await api.post(`/admin/classes/${cls.id}/erase-students`, { studentIds });
      toast.success(res.data.message || 'Students erased');
      setEraseConfirm(null);
      await refreshAfterChange();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to erase students'); }
    finally { setErasing(false); }
  };

  if (!cls) return null;

  const targetClass = allClasses.find(c => c.id === targetClassId);
  const activeAccent = TABS.find(t => t.key === tab)?.accent || '#0ea5e9';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Manage — ${cls.name}`} size="xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 420 }}>

          {/* ── Class strip ── */}
          <div className="mcm-fade-up" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            borderRadius: 16, position: 'relative', overflow: 'hidden',
            background: `linear-gradient(120deg, ${avatarFrom}14, var(--surface-50) 55%)`,
            border: '1px solid var(--card-border)',
          }}>
            <div className="mcm-icon-breathe" style={{
              width: 42, height: 42, borderRadius: 13, flexShrink: 0,
              background: `linear-gradient(135deg, ${avatarFrom}30, ${avatarFrom}55)`,
              border: `1.5px solid ${avatarFrom}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={19} style={{ color: avatarFrom }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.name}</p>
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <StatusBadge is_active={cls.is_active} />
                  {cls.is_active !== false && <span className="mcm-pulse-dot" />}
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                {cls.teacher_name || '⚠ Unassigned teacher'} · {cls.student_count || 0} student{cls.student_count !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {cls.level && <LevelBadge level={cls.level} levels={levels} />}
              {cls.trade && <TradeBadge trade={cls.trade} trades={trades} />}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ position: 'relative', display: 'flex', gap: 4, borderBottom: '1px solid var(--card-border)', overflowX: 'auto' }}>
            {TABS.map(({ key, label, icon: Icon, accent }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  ref={el => { tabRefs.current[key] = el; }}
                  onClick={() => setTab(key)}
                  className="mcm-tab-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                    padding: '9px 13px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, borderRadius: '10px 10px 0 0',
                    color: active ? accent : 'var(--text-secondary)',
                    marginBottom: -1, transition: 'color 0.18s ease, background 0.18s ease',
                  }}
                >
                  <Icon size={13} style={{ transition: 'transform 0.18s ease', transform: active ? 'scale(1.08)' : 'scale(1)' }} /> {label}
                  {key === 'move' && selected.size > 0 && (
                    <span className="mcm-count-badge" style={{ background: '#6366f1' }}>{selected.size}</span>
                  )}
                </button>
              );
            })}
            <div style={{
              position: 'absolute', bottom: -1, height: 2, borderRadius: 2,
              left: indicator.left, width: indicator.width,
              background: activeAccent,
              transition: 'left 0.28s cubic-bezier(0.65,0,0.35,1), width 0.28s cubic-bezier(0.65,0,0.35,1), background 0.2s ease',
            }} />
          </div>

          {/* ── Overview tab ── */}
          {tab === 'overview' && (
            <div key="overview" className="mcm-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cls.description && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{cls.description}</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {[
                  { icon: GraduationCap, label: 'Students', value: cls.student_count || 0, color: '#10b981', bg: '#ecfdf5' },
                  { icon: Award, label: 'RTQF Level', value: cls.level || '—', color: '#8b5cf6', bg: '#ede9fe' },
                  { icon: BookOpen, label: 'Trade', value: cls.trade || '—', color: '#f59e0b', bg: '#fffbeb' },
                  { icon: Calendar, label: 'Created', value: cls.created_at ? new Date(cls.created_at).toLocaleDateString() : '—', color: '#0ea5e9', bg: '#f0f9ff' },
                ].map(({ icon: Icon, label, value, color, bg }, i) => (
                  <div key={label} className="card mcm-stat-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, animationDelay: `${i * 45}ms` }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mcm-stat-card" style={{ animationDelay: '180ms', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--surface-50)', border: '1px solid var(--card-border)' }}>
                <Avatar name={cls.teacher_name || '?'} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Class Teacher</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: cls.teacher_name ? 'var(--text-primary)' : '#f59e0b' }}>
                    {cls.teacher_name || 'Unassigned'}
                  </p>
                </div>
              </div>

              <div className="mcm-stat-card" style={{ animationDelay: '220ms', display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                <button onClick={() => onEdit(cls)} className="btn-secondary mcm-btn-lift" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Edit2 size={13} /> Edit Class Info
                </button>
                <button onClick={() => onViewStudents(cls)} className="btn-secondary mcm-btn-lift" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={13} /> View All Students
                </button>
              </div>
            </div>
          )}

          {/* ── Move Students tab ── */}
          {tab === 'move' && (
            <div key="move" className="mcm-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f0f9ff', border: '1px solid #bae6fd', display: 'flex', gap: 10 }}>
                <ArrowRightLeft size={18} style={{ color: '#0ea5e9', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#0369a1', lineHeight: 1.6 }}>
                  Move students from <strong>{cls.name}</strong> into another class — handy for promoting a whole cohort (e.g. L4 → L5) at year-end. Moved students' level and trade update to match their new class.
                </p>
              </div>

              <div>
                <label className="label">Move into class *</label>
                <select value={targetClassId} onChange={e => setTargetClassId(e.target.value)} className="input-field">
                  <option value="">Select target class…</option>
                  {allClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.level ? `· ${c.level}` : ''} {c.trade ? `· ${c.trade}` : ''} ({c.student_count || 0} students)
                    </option>
                  ))}
                </select>
                {allClasses.length === 0 && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>No other classes available yet — create another class first.</p>
                )}
              </div>

              {targetClassId && (
                <div key={targetClassId} className="mcm-flow-chip" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--surface-50)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{cls.name}</span>
                    <ArrowRight size={14} className="mcm-arrow-nudge" style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{targetClass?.name}</span>
                  </div>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Students in {cls.name} ({search ? `${filteredStudents.length} of ${students.length}` : students.length})
                  </span>
                  {filteredStudents.length > 0 && (
                    <button onClick={toggleAllFiltered} style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {allFilteredSelected ? 'Unselect all' : 'Select all'}
                    </button>
                  )}
                </div>

                {students.length > 0 && (
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} className="input-field" style={{ paddingLeft: 30 }} placeholder="Search students to move…" />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {loadingStudents ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}><Spinner /></div>
                  ) : filteredStudents.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>
                      {search ? 'No students match your search.' : 'No students enrolled in this class.'}
                    </p>
                  ) : filteredStudents.map((s, i) => {
                    const isSel = selected.has(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleOne(s.id)}
                        className="mcm-student-row"
                        data-selected={isSel}
                        style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
                      >
                        <span className="mcm-check" data-selected={isSel}>
                          {isSel ? <CheckSquare size={16} style={{ color: '#818cf8' }} /> : <Square size={16} style={{ color: 'var(--text-secondary)' }} />}
                        </span>
                        <Avatar name={s.name} size={28} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        {s.level && <LevelBadge level={s.level} levels={levels} />}
                        {s.trade && <TradeBadge trade={s.trade} trades={trades} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button disabled={!targetClassId || selected.size === 0} onClick={() => setMoveConfirm('selected')}
                  className="btn-secondary mcm-btn-lift" style={{ opacity: (!targetClassId || selected.size === 0) ? 0.5 : 1 }}>
                  Move Selected ({selected.size})
                </button>
                <button disabled={!targetClassId || students.length === 0} onClick={() => setMoveConfirm('all')}
                  className="btn-primary mcm-btn-lift" style={{ opacity: (!targetClassId || students.length === 0) ? 0.5 : 1 }}>
                  <ArrowRightLeft size={13} /> Move All Students
                </button>
              </div>
            </div>
          )}

          {/* ── Danger Zone tab ── */}
          {tab === 'danger' && (
            <div key="danger" className="mcm-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="mcm-danger-card" style={{ borderRadius: 14, border: '1px solid #fde68a', background: '#fffbeb', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>
                    {cls.is_active !== false ? 'Deactivate this class' : 'Activate this class'}
                  </p>
                  <p style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.5 }}>
                    {cls.is_active !== false
                      ? 'Students immediately lose access to assignments and documents. Data is kept — this can be reversed.'
                      : 'Students regain access to this class and its content.'}
                  </p>
                </div>
                <button onClick={() => onToggle(cls)} className="mcm-btn-lift" style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                  color: '#92400e', background: '#fef3c7', border: 'none', cursor: 'pointer',
                  padding: '8px 14px', borderRadius: 10, whiteSpace: 'nowrap',
                }}>
                  {cls.is_active !== false ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {cls.is_active !== false ? 'Deactivate' : 'Activate'}
                </button>
              </div>

              <div className="mcm-danger-card" style={{ animationDelay: '60ms', borderRadius: 14, border: '1px solid #fecaca', background: '#fef2f2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 3 }}>Erase students</p>
                  <p style={{ fontSize: 11.5, color: '#991b1b', lineHeight: 1.5 }}>
                    Permanently deletes {selected.size > 0 ? `the ${selected.size} selected` : 'all'} student account{selected.size === 1 ? '' : 's'} enrolled here — including submissions and messages. This cannot be undone.
                    {selected.size > 0 && <span style={{ display: 'block', marginTop: 3, fontStyle: 'italic' }}>Selection made in the Move Students tab.</span>}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selected.size > 0 && (
                    <button onClick={() => setEraseConfirm('selected')} className="mcm-btn-lift" style={{
                      fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: 'none',
                      cursor: 'pointer', padding: '7px 14px', borderRadius: 10, whiteSpace: 'nowrap',
                    }}>
                      Erase Selected ({selected.size})
                    </button>
                  )}
                  <button disabled={students.length === 0} onClick={() => setEraseConfirm('all')} className="mcm-btn-lift" style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#fff',
                    background: '#ef4444', border: 'none', cursor: students.length === 0 ? 'default' : 'pointer',
                    padding: '8px 14px', borderRadius: 10, whiteSpace: 'nowrap', opacity: students.length === 0 ? 0.5 : 1,
                  }}>
                    <Eraser size={13} /> Erase All ({students.length})
                  </button>
                </div>
              </div>

              <div className="mcm-danger-card" style={{ animationDelay: '120ms', borderRadius: 14, border: '1px solid #fecaca', background: '#fef2f2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 3 }}>Delete this class</p>
                  <p style={{ fontSize: 11.5, color: '#991b1b', lineHeight: 1.5 }}>
                    Permanently removes the class along with all its assignments and documents. Enrolled student accounts are not deleted.
                  </p>
                </div>
                <button onClick={() => onDelete(cls)} className="mcm-btn-lift" style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#fff',
                  background: '#ef4444', border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 10, whiteSpace: 'nowrap',
                }}>
                  <Trash2 size={13} /> Delete Class
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!moveConfirm} onClose={() => setMoveConfirm(null)}
        onConfirm={runMove} loading={moving}
        title="Move Students"
        message={moveConfirm === 'all'
          ? `Move all ${students.length} student${students.length !== 1 ? 's' : ''} from "${cls.name}" into "${targetClass?.name}"? Their level and trade will update to match.`
          : `Move ${selected.size} selected student${selected.size !== 1 ? 's' : ''} from "${cls.name}" into "${targetClass?.name}"? Their level and trade will update to match.`}
        confirmText="Move Students"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!eraseConfirm} onClose={() => setEraseConfirm(null)}
        onConfirm={runErase} loading={erasing}
        title="Erase Students"
        message={eraseConfirm === 'all'
          ? `Permanently delete all ${students.length} student account${students.length !== 1 ? 's' : ''} enrolled in "${cls.name}"? This deletes their submissions and messages too, and cannot be undone.`
          : `Permanently delete the ${selected.size} selected student account${selected.size !== 1 ? 's' : ''}? This deletes their submissions and messages too, and cannot be undone.`}
        confirmText="Erase Permanently"
        variant="danger"
      />

      <style>{`
        @keyframes mcmSpin { to { transform: rotate(360deg); } }

        @keyframes mcmFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mcm-fade-up { animation: mcmFadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both; }

        @keyframes mcmTabPanel {
          from { opacity: 0; transform: translateY(6px) scale(0.995); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mcm-tab-panel { animation: mcmTabPanel 0.24s cubic-bezier(0.16,1,0.3,1) both; }

        @keyframes mcmStatIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mcm-stat-card { animation: mcmStatIn 0.32s cubic-bezier(0.16,1,0.3,1) both; transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .mcm-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }

        .mcm-tab-btn:hover { background: var(--surface-50); }

        .mcm-count-badge {
          color: #fff; font-size: 9px; font-weight: 800; border-radius: 99px; padding: 1px 6px;
          animation: mcmPop 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes mcmPop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .mcm-icon-breathe { transition: transform 0.3s ease; }
        .mcm-fade-up:hover .mcm-icon-breathe { transform: scale(1.08) rotate(-3deg); }

        .mcm-pulse-dot {
          position: absolute; top: -2px; right: -2px; width: 6px; height: 6px; border-radius: 50%;
          background: #10b981; box-shadow: 0 0 0 rgba(16,185,129,0.6);
          animation: mcmPulse 1.8s ease-out infinite;
        }
        @keyframes mcmPulse {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          70%  { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }

        .mcm-btn-lift { transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease; }
        .mcm-btn-lift:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.03); }
        .mcm-btn-lift:active:not(:disabled) { transform: translateY(0); }

        .mcm-flow-chip { animation: mcmFlowIn 0.3s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes mcmFlowIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .mcm-arrow-nudge { animation: mcmArrow 1.4s ease-in-out infinite; }
        @keyframes mcmArrow { 0%,100% { transform: translateX(0); } 50% { transform: translateX(3px); } }

        .mcm-student-row {
          display: flex; align-items: center; gap: 10px; padding: 8px 10px;
          border-radius: 10px; cursor: pointer;
          background: var(--surface-50);
          border: 1px solid transparent;
          animation: mcmFadeUp 0.22s cubic-bezier(0.16,1,0.3,1) both;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .mcm-student-row:hover { background: rgba(99,102,241,0.08); transform: translateX(2px); }
        .mcm-student-row[data-selected="true"] {
          background: rgba(99,102,241,0.16);
          border-color: rgba(99,102,241,0.45);
        }
        .mcm-check[data-selected="true"] { animation: mcmPop 0.2s cubic-bezier(0.34,1.56,0.64,1) both; }

        .mcm-danger-card { animation: mcmFadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both; transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .mcm-danger-card:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
      `}</style>
    </>
  );
}