import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { Avatar, LevelBadge, TradeBadge, StatusBadge, getAvatarColors } from './classUI';
import {
  LayoutDashboard, Users, ArrowRightLeft, ShieldAlert, UserPlus, Edit2,
  Trash2, ToggleLeft, ToggleRight, Search, ArrowRight, CheckSquare, Square,
  AlertTriangle, GraduationCap, BookOpen, Award, Eraser, Calendar, Mail,
} from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'move', label: 'Move Students', icon: ArrowRightLeft },
  { key: 'danger', label: 'Danger Zone', icon: ShieldAlert },
];

function Spinner({ size = 32, color = '#0ea5e9' }) {
  return <div style={{ width: size, height: size, border: '3px solid var(--surface-100)', borderTopColor: color, borderRadius: '50%', animation: 'mcmSpin 0.8s linear infinite' }} />;
}

export default function ManageClassModal({
  cls, isOpen, onClose, levels = [], trades = [],
  onEdit, onEnroll, onToggle, onDelete, onChanged,
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

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Manage — ${cls.name}`} size="xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 420 }}>

          {/* ── Class strip ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
            borderRadius: 14, background: 'var(--surface-50)', border: '1px solid var(--card-border)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${avatarFrom}22, ${avatarFrom}44)`,
              border: `1.5px solid ${avatarFrom}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={18} style={{ color: avatarFrom }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.name}</p>
                <StatusBadge is_active={cls.is_active} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                {cls.teacher_name || '⚠ Unassigned teacher'} · {cls.student_count || 0} student{cls.student_count !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {cls.level && <LevelBadge level={cls.level} levels={levels} />}
              {cls.trade && <TradeBadge trade={cls.trade} trades={trades} />}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--card-border)', overflowX: 'auto' }}>
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button key={key} onClick={() => setTab(key)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  color: active ? (key === 'danger' ? '#ef4444' : '#0ea5e9') : 'var(--text-secondary)',
                  borderBottom: active ? `2px solid ${key === 'danger' ? '#ef4444' : '#0ea5e9'}` : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s',
                }}>
                  <Icon size={13} /> {label}
                  {key === 'students' && selected.size > 0 && (
                    <span style={{ background: '#6366f1', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 99, padding: '1px 6px' }}>{selected.size}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Overview tab ── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cls.description && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{cls.description}</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {[
                  { icon: GraduationCap, label: 'Students', value: cls.student_count || 0, color: '#10b981', bg: '#ecfdf5' },
                  { icon: Award, label: 'RTQF Level', value: cls.level || '—', color: '#8b5cf6', bg: '#ede9fe' },
                  { icon: BookOpen, label: 'Trade', value: cls.trade || '—', color: '#f59e0b', bg: '#fffbeb' },
                  { icon: Calendar, label: 'Created', value: cls.created_at ? new Date(cls.created_at).toLocaleDateString() : '—', color: '#0ea5e9', bg: '#f0f9ff' },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--surface-50)' }}>
                <Avatar name={cls.teacher_name || '?'} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Class Teacher</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: cls.teacher_name ? 'var(--text-primary)' : '#f59e0b' }}>
                    {cls.teacher_name || 'Unassigned'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                <button onClick={() => onEdit(cls)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Edit2 size={13} /> Edit Class Info
                </button>
                <button onClick={() => onEnroll(cls)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserPlus size={13} /> Enroll Student
                </button>
                <button onClick={() => onToggle(cls)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {cls.is_active !== false ? <ToggleRight size={13} style={{ color: '#d97706' }} /> : <ToggleLeft size={13} style={{ color: '#10b981' }} />}
                  {cls.is_active !== false ? 'Deactivate Class' : 'Activate Class'}
                </button>
              </div>
            </div>
          )}

          {/* ── Students tab ── */}
          {tab === 'students' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} className="input-field" style={{ paddingLeft: 30 }} placeholder="Search enrolled students…" />
                </div>
                <button onClick={() => onEnroll(cls)} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  <UserPlus size={13} /> Enroll
                </button>
              </div>

              {filteredStudents.length > 0 && (
                <button onClick={toggleAllFiltered} style={{
                  display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                  fontSize: 11, fontWeight: 600, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  {allFilteredSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  {allFilteredSelected ? 'Unselect all' : 'Select all'} ({filteredStudents.length})
                </button>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                {loadingStudents ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spinner /></div>
                ) : filteredStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <GraduationCap size={22} style={{ color: '#0ea5e9' }} />
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {search ? 'No students match your search' : 'No students enrolled yet'}
                    </p>
                  </div>
                ) : filteredStudents.map((s, i) => {
                  const isSel = selected.has(s.id);
                  return (
                    <div key={s.id} onClick={() => toggleOne(s.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                      borderRadius: 12, background: isSel ? '#eef2ff' : 'var(--surface-50)',
                      border: isSel ? '1px solid #c7d2fe' : '1px solid transparent',
                      cursor: 'pointer', animation: 'mcmSlideUp 0.25s ease both', animationDelay: `${Math.min(i, 10) * 25}ms`,
                    }}>
                      {isSel ? <CheckSquare size={16} style={{ color: '#6366f1', flexShrink: 0 }} /> : <Square size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                      <Avatar name={s.name} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</p>
                        <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {s.level && <LevelBadge level={s.level} levels={levels} />}
                        {s.trade && <TradeBadge trade={s.trade} trades={trades} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selected.size > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 12, background: '#eef2ff', border: '1px solid #c7d2fe',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#4338ca' }}>{selected.size} selected</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setTab('move')} style={{ fontSize: 11, fontWeight: 700, color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ArrowRightLeft size={12} /> Move
                    </button>
                    <button onClick={() => setEraseConfirm('selected')} style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Eraser size={12} /> Erase
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Move Students tab ── */}
          {tab === 'move' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--surface-50)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{cls.name}</span>
                    <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{targetClass?.name}</span>
                  </div>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Students in {cls.name} ({students.length})</span>
                  {filteredStudents.length > 0 && (
                    <button onClick={toggleAllFiltered} style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {allFilteredSelected ? 'Unselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {loadingStudents ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}><Spinner /></div>
                  ) : students.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>No students enrolled in this class.</p>
                  ) : students.map(s => {
                    const isSel = selected.has(s.id);
                    return (
                      <div key={s.id} onClick={() => toggleOne(s.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                        borderRadius: 10, background: isSel ? '#eef2ff' : 'var(--surface-50)',
                        border: isSel ? '1px solid #c7d2fe' : '1px solid transparent', cursor: 'pointer',
                      }}>
                        {isSel ? <CheckSquare size={15} style={{ color: '#6366f1' }} /> : <Square size={15} style={{ color: 'var(--text-secondary)' }} />}
                        <Avatar name={s.name} size={26} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{s.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button disabled={!targetClassId || selected.size === 0} onClick={() => setMoveConfirm('selected')}
                  className="btn-secondary" style={{ opacity: (!targetClassId || selected.size === 0) ? 0.5 : 1 }}>
                  Move Selected ({selected.size})
                </button>
                <button disabled={!targetClassId || students.length === 0} onClick={() => setMoveConfirm('all')}
                  className="btn-primary" style={{ opacity: (!targetClassId || students.length === 0) ? 0.5 : 1 }}>
                  <ArrowRightLeft size={13} /> Move All Students
                </button>
              </div>
            </div>
          )}

          {/* ── Danger Zone tab ── */}
          {tab === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ borderRadius: 14, border: '1px solid #fde68a', background: '#fffbeb', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
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
                <button onClick={() => onToggle(cls)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                  color: '#92400e', background: '#fef3c7', border: 'none', cursor: 'pointer',
                  padding: '8px 14px', borderRadius: 10, whiteSpace: 'nowrap',
                }}>
                  {cls.is_active !== false ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {cls.is_active !== false ? 'Deactivate' : 'Activate'}
                </button>
              </div>

              <div style={{ borderRadius: 14, border: '1px solid #fecaca', background: '#fef2f2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 3 }}>Erase students</p>
                  <p style={{ fontSize: 11.5, color: '#991b1b', lineHeight: 1.5 }}>
                    Permanently deletes {selected.size > 0 ? `the ${selected.size} selected` : 'all'} student account{selected.size === 1 ? '' : 's'} enrolled here — including submissions and messages. This cannot be undone.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selected.size > 0 && (
                    <button onClick={() => setEraseConfirm('selected')} style={{
                      fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: 'none',
                      cursor: 'pointer', padding: '7px 14px', borderRadius: 10, whiteSpace: 'nowrap',
                    }}>
                      Erase Selected ({selected.size})
                    </button>
                  )}
                  <button disabled={students.length === 0} onClick={() => setEraseConfirm('all')} style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#fff',
                    background: '#ef4444', border: 'none', cursor: students.length === 0 ? 'default' : 'pointer',
                    padding: '8px 14px', borderRadius: 10, whiteSpace: 'nowrap', opacity: students.length === 0 ? 0.5 : 1,
                  }}>
                    <Eraser size={13} /> Erase All ({students.length})
                  </button>
                </div>
              </div>

              <div style={{ borderRadius: 14, border: '1px solid #fecaca', background: '#fef2f2', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 3 }}>Delete this class</p>
                  <p style={{ fontSize: 11.5, color: '#991b1b', lineHeight: 1.5 }}>
                    Permanently removes the class along with all its assignments and documents. Enrolled student accounts are not deleted.
                  </p>
                </div>
                <button onClick={() => onDelete(cls)} style={{
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
        @keyframes mcmSlideUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
