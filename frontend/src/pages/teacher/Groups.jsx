import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { showChatToast, markMessageSeen, setActiveConversation, clearActiveConversation, onPendingChatTarget, consumePendingChatTarget } from '../../utils/chatNotify';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { ChatImageBubble, ChatFileBubble, fmtFileSize, AttachmentTypeIcon, AttachMenu, EmojiPicker } from '../../components/common/ChatMediaBubble';
import {
  Plus, Search, Users, Trash2, X, Send,
  Crown, Check, Eye,
  StopCircle, WifiOff, RotateCcw,
  Mic, Square, Play, Pause,
  Zap, ZapOff, Radio, MessageCircle,
  UserPlus, UserMinus, ArrowLeftRight,
  Smile,
} from 'lucide-react';

/* Max size for a shared photo/file (matches backend chatMediaUpload limit) */
const MAX_CHAT_FILE_MB = 25;

/* ── Exclusive audio playback context ───────────────────────────────────
   Only one voice note may play at a time within a conversation.
   TeacherVoiceBubble registers its audioRef here; when it starts playing
   it calls stopOthers() which pauses every other registered element. */
const AudioPlaybackContext = createContext(null);

function AudioPlaybackProvider({ children }) {
  const registry = useRef(new Set());

  const register   = (el) => { registry.current.add(el); };
  const unregister = (el) => { registry.current.delete(el); };
  const stopOthers = (exceptEl) => {
    registry.current.forEach(el => {
      if (el !== exceptEl && !el.paused) {
        el.pause();
        el.dispatchEvent(new Event('externalpause'));
      }
    });
  };

  return (
    <AudioPlaybackContext.Provider value={{ register, unregister, stopOthers }}>
      {children}
    </AudioPlaybackContext.Provider>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────── */
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const COLORS = [
  ['#6366f1','#4f46e5'], ['#059669','#0d9488'], ['#d97706','#b45309'],
  ['#dc2626','#b91c1c'], ['#7c3aed','#6d28d9'], ['#0284c7','#0369a1'],
];
function groupColor(id) {
  const idx = id ? parseInt(String(id).slice(-2), 16) % COLORS.length : 0;
  return COLORS[idx];
}

function OwnerBadge({ isOwner }) {
  if (!isOwner) return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(5,150,105,0.12)', color: '#059669' }}>
      <Check className="w-2.5 h-2.5" /> Full access
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
      <Crown className="w-2.5 h-2.5" /> Your group
    </span>
  );
}

/* ── Skeleton placeholder row (shown while the group list is loading) ─── */
function GroupCardSkeleton({ delay = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', animation: 'fastModalBackdropIn 0.3s ease both', animationDelay: `${delay}ms` }}>
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="skeleton" style={{ width: '55%', height: 12, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '35%', height: 10 }} />
      </div>
    </div>
  );
}

/* ── Group card ────────────────────────────────────────────────────────── */
function GroupCard({ g, onOpen, onDelete, active }) {
  const [a, b] = groupColor(g.id);
  const initials = (g.name || 'G').slice(0, 2).toUpperCase();
  return (
    <div
      className="tg-group-card group relative flex items-center gap-3 px-4 py-3.5 cursor-pointer"
      style={{
        borderBottom: '1px solid var(--card-border)',
        background: active
          ? `linear-gradient(135deg, ${a}12, ${b}08)`
          : 'transparent',
        borderLeft: active ? `3px solid ${a}` : '3px solid transparent',
      }}
      onClick={() => onOpen(g)}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
          style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
          {initials}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 bg-green-500"
          style={{ borderColor: 'var(--card-bg)' }} title="You have full access" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
            {timeAgo(g.updated_at || g.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: `${a}18`, color: a }}>
            {g.class_name}
          </span>
          {g.team_leader && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
              <Crown className="w-2.5 h-2.5" /> {g.team_leader.name}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Users className="w-3 h-3" /> {g.member_count} members
          </span>
          <OwnerBadge isOwner={g.is_owner} />
        </div>
      </div>

      {g.is_owner && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(g); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full items-center justify-center hidden group-hover:flex transition-all hover:bg-red-50"
          title="Delete group">
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      )}
    </div>
  );
}

/* ── Create group panel ─────────────────────────────────────────────────── */
function CreateGroupPanel({ onClose, onCreated }) {
  const [classes, setClasses]   = useState([]);
  const [students, setStudents] = useState([]);
  const [existingGroups, setExistingGroups] = useState([]); // this teacher's other groups in the selected class
  const [form, setForm]         = useState({ name: '', classId: '' });
  const [selected, setSelected] = useState(new Set());
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    api.get('/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.classId) { setStudents([]); setSelected(new Set()); setTeamLeaderId(''); setExistingGroups([]); return; }
    setLoadingStudents(true);
    Promise.all([
      api.get(`/classes/${form.classId}/students`),
      api.get('/group-discussions', { params: { classId: form.classId } }),
    ])
      .then(([studentsRes, groupsRes]) => {
        setStudents((studentsRes.data.students || []).map(s => ({ id: s._id || s.id, name: s.name })));
        setExistingGroups(groupsRes.data.groups || []);
      })
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoadingStudents(false));
  }, [form.classId]);

  // studentId -> the group of yours (in this class) they already belong to
  const busyElsewhere = new Map();
  existingGroups.forEach(g => (g.members || []).forEach(m => busyElsewhere.set(String(m.id), g)));

  const toggleStudent = (id) => setSelected(prev => {
    if (busyElsewhere.has(id)) return prev;
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); if (teamLeaderId === id) setTeamLeaderId(''); }
    else next.add(id);
    return next;
  });

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()));
  const selectableStudents = students.filter(s => !busyElsewhere.has(s.id));
  const selectedStudents = students.filter(s => selected.has(s.id));

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Group name is required');
    if (!form.classId)     return toast.error('Please select a class');
    if (selected.size === 0) return toast.error('Select at least one student');
    if (!teamLeaderId)     return toast.error('Please choose a team leader');
    setSaving(true);
    try {
      await api.post('/group-discussions', { name: form.name.trim(), classId: form.classId, memberIds: [...selected], teamLeaderId });
      toast.success('Group created! 🎉');
      onCreated();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create group'); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">New Group</h3>
            <p className="text-white/60 text-[10px]">Set up a student collaboration space</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto tg-scroll p-5 space-y-5">
        <div>
          <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Group Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Research Team Alpha"
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Class *</label>
          <select value={form.classId} onChange={e => { setForm(f => ({ ...f, classId: e.target.value })); setSelected(new Set()); setTeamLeaderId(''); }}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' }}>
            <option value="">Select a class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {form.classId && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Students *</label>
              {students.length > 0 && (
                <button onClick={() => { if (selected.size === selectableStudents.length) { setSelected(new Set()); setTeamLeaderId(''); } else setSelected(new Set(selectableStudents.map(s => s.id))); }}
                  className="text-xs font-semibold" style={{ color: '#6366f1' }}>
                  {selected.size === selectableStudents.length && selectableStudents.length > 0 ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
              <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Search students…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }} />
            </div>
            {loadingStudents ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredStudents.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>{students.length === 0 ? 'No students enrolled.' : 'No matches.'}</p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)', maxHeight: 220, overflowY: 'auto' }}>
                {filteredStudents.map(s => {
                  const elsewhere = busyElsewhere.get(s.id);
                  return (
                    <label key={s.id} className={`flex items-center gap-3 px-3 py-2.5 transition-all ${elsewhere ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:opacity-80'}`}
                      style={{ borderBottom: '1px solid var(--card-border)', background: selected.has(s.id) ? 'rgba(99,102,241,0.07)' : undefined }}>
                      <div className="relative flex-shrink-0">
                        <input type="checkbox" checked={selected.has(s.id)} disabled={!!elsewhere} onChange={() => toggleStudent(s.id)} className="sr-only" />
                        <div className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center transition-all"
                          style={{ background: selected.has(s.id) ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent', border: selected.has(s.id) ? 'none' : '1.5px solid var(--card-border)' }}>
                          {selected.has(s.id) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                      </div>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
                        {s.name[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                      {elsewhere && (
                        <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                          in {elsewhere.name}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {selected.size > 0 && <p className="text-xs mt-2 font-semibold" style={{ color: '#6366f1' }}>{selected.size} selected</p>}
          </div>
        )}

        {selectedStudents.length > 0 && (
          <div>
            <label className="block text-[11px] font-bold mb-1 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Team Leader *</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.75 }}>The team leader gets a private DM channel directly to you (the teacher).</p>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)', maxHeight: 200, overflowY: 'auto' }}>
              {selectedStudents.map(s => (
                <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all"
                  style={{ borderBottom: '1px solid var(--card-border)', background: teamLeaderId === s.id ? 'rgba(245,158,11,0.08)' : undefined }}>
                  <input type="radio" name="teamLeader" checked={teamLeaderId === s.id} onChange={() => setTeamLeaderId(s.id)} className="w-4 h-4 accent-amber-500" />
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}>{s.name[0].toUpperCase()}</div>
                  <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  {teamLeaderId === s.id && <Crown className="w-4 h-4" style={{ color: '#d97706' }} />}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--card-border)' }}>
        <button onClick={handleSubmit}
          disabled={saving || !form.name || !form.classId || selected.size === 0 || !teamLeaderId}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Create Group
        </button>
      </div>
    </div>
  );
}

/* ── Voice note playback bubble (teacher view) ───────────────────────── */
function TeacherVoiceBubble({ url, duration, isMine }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const totalDuration = duration || 0;
  const ctx = useContext(AudioPlaybackContext);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    ctx?.register(el);
    const handleExternalPause = () => { setPlaying(false); };
    el.addEventListener('externalpause', handleExternalPause);
    return () => {
      ctx?.unregister(el);
      el.removeEventListener('externalpause', handleExternalPause);
    };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      ctx?.stopOthers(el);
      el.play();
      setPlaying(true);
    }
  };

  const fmtDur = (s) => {
    const t = Math.round(s || 0);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        style={{ display: 'none' }}
      />
      <button onClick={toggle} style={{
        width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        background: isMine ? 'rgba(255,255,255,0.3)' : 'rgba(99,102,241,0.7)',
      }}>
        {playing ? <Pause style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14 }} />}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ height: 3, borderRadius: 2, background: isMine ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: isMine ? 'rgba(255,255,255,0.7)' : '#6366f1', borderRadius: 2, transition: 'width 0.1s linear' }} />
        </div>
        <span style={{ fontSize: 10, opacity: 0.7 }}>
          {playing ? fmtDur(currentTime) : fmtDur(totalDuration)}
        </span>
      </div>
      <Mic style={{ width: 13, height: 13, opacity: 0.5, flexShrink: 0 }} />
    </div>
  );
}

/* ── Group members modal (teacher view) ──────────────────────────────
   Fast by design: pure CSS entrance animation, no JS-driven visibility
   toggling — see .fast-modal-backdrop / .fast-modal-sheet in index.css. */
function MembersModal({ group, onClose }) {
  const [a, b] = groupColor(group.id);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const members = group.members || [];

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fast-modal-backdrop"
    >
      <div onClick={e => e.stopPropagation()} className="fast-modal-sheet" style={{ maxWidth: 400 }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${a}, ${b})`, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 13 }}>
                {(group.name || 'G').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{group.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{members.length} member{members.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Members list */}
        <div style={{ padding: '14px 16px', maxHeight: '60vh', overflowY: 'auto' }}>
          {members.map((m, i) => {
            const isLeader = group.team_leader?.id === m.id;
            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 14, marginBottom: 6,
                background: 'var(--surface-100)',
                border: isLeader ? `1.5px solid ${a}40` : '1.5px solid transparent',
                animation: 'teacherMemberSlideIn 260ms ease both',
                animationDelay: `${i * 40}ms`,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: isLeader ? `linear-gradient(135deg, ${a}, ${b})` : 'linear-gradient(135deg, #059669, #0d9488)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 15,
                  boxShadow: isLeader ? `0 4px 14px ${a}50` : 'none',
                }}>
                  {m.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                  {isLeader && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Crown style={{ width: 11, height: 11, color: '#d97706' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>Team Leader</span>
                    </div>
                  )}
                </div>
                {isLeader && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${a}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Crown style={{ width: 13, height: 13, color: a }} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Owning teacher */}
          {group.teacher_name && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 14, marginBottom: 6,
              background: 'rgba(99,102,241,0.06)',
              border: '1.5px solid rgba(99,102,241,0.2)',
              animation: 'teacherMemberSlideIn 260ms ease both',
              animationDelay: `${members.length * 40}ms`,
            }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                {group.teacher_name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{group.teacher_name}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginTop: 2 }}>{group.is_owner ? 'You · Teacher' : 'Teacher (owner)'}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>T</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes teacherMemberSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Manage members modal (teacher) ───────────────────────────────────
   Lets any teacher assigned to the group's class add students who are
   enrolled in the class but not yet members, or remove existing members
   (the team leader can't be removed this way). Each add/remove sends the
   affected student an in-app notification, wherever they are in the app. */
function ManageMembersModal({ group, onClose, onChanged }) {
  const [a, b] = groupColor(group.id);
  const [roster, setRoster] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [siblingGroups, setSiblingGroups] = useState([]); // this teacher's other groups in the same class
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [movePickerFor, setMovePickerFor] = useState(null); // member id whose "move to…" dropdown is open
  const [confirmMove, setConfirmMove] = useState(null); // { member, toGroup }
  const [movingId, setMovingId] = useState(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  useEffect(() => {
    api.get(`/classes/${group.class_id}/students`)
      .then(r => setRoster((r.data.students || []).map(s => ({ id: s._id || s.id, name: s.name }))))
      .catch(() => toast.error('Failed to load class roster'))
      .finally(() => setLoadingRoster(false));
  }, [group.class_id]);

  useEffect(() => {
    api.get('/group-discussions', { params: { classId: group.class_id } })
      .then(r => setSiblingGroups((r.data.groups || []).filter(g => g.id !== group.id)))
      .catch(() => {});
  }, [group.class_id, group.id]);

  const memberIds = new Set((group.members || []).map(m => String(m.id)));
  // studentId -> the OTHER group of yours (same class) they already belong to, if any
  const busyElsewhere = new Map();
  siblingGroups.forEach(g => (g.members || []).forEach(m => busyElsewhere.set(String(m.id), g)));

  const nonMembers = roster.filter(s => !memberIds.has(String(s.id)));
  const filteredNonMembers = nonMembers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      const res = await api.post(`/group-discussions/${group.id}/members`, { studentIds: [...selected] });
      toast.success(res.data.message || 'Students added to the group');
      setSelected(new Set());
      onChanged();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add students'); }
    finally { setAdding(false); }
  };

  const handleRemove = async (studentId) => {
    setRemovingId(studentId);
    try {
      await api.delete(`/group-discussions/${group.id}/members/${studentId}`);
      toast.success('Student removed from the group');
      setConfirmRemove(null);
      onChanged();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to remove student'); }
    finally { setRemovingId(null); }
  };

  const handleMove = async (studentId, toGroupId) => {
    setMovingId(studentId);
    try {
      const res = await api.post(`/group-discussions/${group.id}/members/${studentId}/move`, { toGroupId });
      toast.success(res.data.message || 'Student moved');
      setConfirmMove(null);
      setMovePickerFor(null);
      onChanged();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to move student'); }
    finally { setMovingId(null); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} className="fast-modal-backdrop">
      <div onClick={e => e.stopPropagation()} className="fast-modal-sheet" style={{ maxWidth: 460, maxHeight: 'min(88vh, calc(100vh - 64px))' }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${a}, ${b})`, flexShrink: 0 }} />
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${a}, ${b})`, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus style={{ width: 16, height: 16, color: '#fff' }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Manage Members</div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{group.name}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        <div className="tg-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {/* Current members */}
          <div style={{ marginBottom: 20 }}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
              Current members ({(group.members || []).length})
            </p>
            <div className="space-y-1.5">
              {(group.members || []).map(m => {
                const isLeader = group.team_leader?.id === m.id;
                const isMoveOpen = movePickerFor === m.id;
                return (
                  <div key={m.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-100)' }}>
                    <div className="flex items-center gap-2.5 px-3 py-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ background: isLeader ? `linear-gradient(135deg, ${a}, ${b})` : 'linear-gradient(135deg, #059669, #0d9488)' }}>
                        {m.name[0].toUpperCase()}
                      </div>
                      <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                      {isLeader ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                          <Crown className="w-2.5 h-2.5" /> Leader
                        </span>
                      ) : (
                        <>
                          {siblingGroups.length > 0 && (
                            <button
                              onClick={() => setMovePickerFor(isMoveOpen ? null : m.id)}
                              disabled={movingId === m.id}
                              title="Move to another group"
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-indigo-50"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" style={{ color: a }} />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmRemove(m)}
                            disabled={removingId === m.id}
                            title="Remove from group"
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-red-50"
                          >
                            <UserMinus className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </>
                      )}
                    </div>
                    {isMoveOpen && (
                      <div className="flex items-center gap-2 px-3 pb-2.5">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const toGroup = siblingGroups.find(g => g.id === e.target.value);
                            if (toGroup) setConfirmMove({ member: m, toGroup });
                          }}
                          className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none"
                          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
                        >
                          <option value="" disabled>Move to…</option>
                          {siblingGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add students */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Add students</p>
              {selected.size > 0 && <span className="text-[11px] font-bold" style={{ color: a }}>{selected.size} selected</span>}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classmates not yet in this group…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }} />
            </div>
            {loadingRoster ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredNonMembers.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                {nonMembers.length === 0 ? 'Every enrolled student is already in this group.' : 'No matches.'}
              </p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)', maxHeight: 200, overflowY: 'auto' }}>
                {filteredNonMembers.map(s => {
                  const elsewhere = busyElsewhere.get(String(s.id));
                  return (
                    <label key={s.id} className={`flex items-center gap-3 px-3 py-2.5 transition-all ${elsewhere ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:opacity-80'}`}
                      style={{ borderBottom: '1px solid var(--card-border)', background: selected.has(s.id) ? `${a}12` : undefined }}>
                      <input type="checkbox" checked={selected.has(s.id)} disabled={!!elsewhere} onChange={() => toggleSelect(s.id)}
                        className="w-4 h-4 rounded flex-shrink-0" style={{ accentColor: a }} />
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                        {s.name[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                      {elsewhere && (
                        <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                          in {elsewhere.name}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--card-border)', flexShrink: 0 }}>
          <button
            onClick={handleAdd}
            disabled={selected.size === 0 || adding}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: selected.size === 0 ? 'var(--surface-200)' : `linear-gradient(135deg, ${a}, ${b})`, opacity: selected.size === 0 ? 0.6 : 1, cursor: selected.size === 0 ? 'default' : 'pointer' }}
          >
            {adding ? 'Adding…' : selected.size > 0 ? `Add ${selected.size} student${selected.size !== 1 ? 's' : ''}` : 'Select students to add'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => handleRemove(confirmRemove.id)}
        loading={removingId === confirmRemove?.id}
        title="Remove member"
        message={confirmRemove ? `Remove ${confirmRemove.name} from "${group.name}"? They'll be notified and lose access to this group's chat.` : ''}
        confirmText="Remove"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!confirmMove}
        onClose={() => { setConfirmMove(null); setMovePickerFor(null); }}
        onConfirm={() => handleMove(confirmMove.member.id, confirmMove.toGroup.id)}
        loading={movingId === confirmMove?.member?.id}
        title="Move member"
        message={confirmMove ? `Move ${confirmMove.member.name} from "${group.name}" to "${confirmMove.toGroup.name}"? They'll be notified of the change.` : ''}
        confirmText="Move"
        variant="default"
      />
    </div>
  );
}

function GroupViewer({ group, myId, onClose, onMessageSent, onEnded, onMembersChanged, autoOpenDm, onAutoOpenHandled }) {
  const [a, b] = groupColor(group.id);
  const [messages, setMessages] = useState(group.messages || []);
  const [text, setText]         = useState('');
  const [posting, setPosting]   = useState(false);
  const [isEnded, setIsEnded]   = useState(group.is_ended || false);
  const [liveStatus, setLiveStatus] = useState('idle');
  const [endConfirm, setEndConfirm]     = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [dmOpen, setDmOpen] = useState(false);

  // Deep-link support: a toast for a leader-DM message can ask this view to
  // auto-open the team-leader DM panel — on first mount, or again later if
  // another such toast is clicked while this same group is already open.
  useEffect(() => {
    if (autoOpenDm) {
      setDmOpen(true);
      onAutoOpenHandled && onAutoOpenHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenDm]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [recording, setRecording]         = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob]         = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying]   = useState(false);
  const [selectedFile, setSelectedFile]   = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const recordTimerRef   = useRef(null);
  const audioPreviewRef  = useRef(null);
  const inputRef       = useRef(null);
  const fileInputRef   = useRef(null);
  const imageInputRef  = useRef(null);
  const messagesEndRef = useRef(null);
  const pollRef        = useRef(null);
  const lastMsgTimeRef = useRef(null);

  useEffect(() => { setMessages(group.messages || []); setIsEnded(group.is_ended || false); }, [group.id]);

  useEffect(() => {
    const sorted = [...(group.messages || [])];
    if (sorted.length > 0) lastMsgTimeRef.current = sorted[sorted.length - 1].created_at;
    else lastMsgTimeRef.current = null;
  }, [group.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  useEffect(() => {
    if (!audioBlob && !recording) return;
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (recording) { stopAndSend(); }
        else if (audioBlob) { sendVoiceNote(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [audioBlob, recording, posting]);

  useEffect(() => {
    const key = `group:${group.id}`;
    setActiveConversation(key);
    return () => clearActiveConversation(key);
  }, [group.id]);

  useEffect(() => {
    const poll = async () => {
      try {
        setLiveStatus('polling');
        const params = lastMsgTimeRef.current ? { since: lastMsgTimeRef.current } : {};
        const res = await api.get(`/group-discussions/${group.id}/messages`, { params });
        const newMsgs = res.data.messages || [];
        if (newMsgs.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => String(m.id || m._id)));
            const fresh = newMsgs.filter(m => !existingIds.has(String(m.id || m._id)));
            if (fresh.length === 0) return prev;
            fresh.forEach(m => markMessageSeen(m.id || m._id));
            const fromOthers = fresh.filter(m => String(m.author_id) !== String(myId));
            if (fromOthers.length) {
              const last = fromOthers[fromOthers.length - 1];
              showChatToast({ name: `${last.author_name} · ${group.name}`, preview: last.content, kind: last.message_type !== 'text' ? last.message_type : null });
            }
            lastMsgTimeRef.current = fresh[fresh.length - 1].created_at;
            return [...prev, ...fresh];
          });
        }
        // Keep local ended-state in sync in both directions, so a restore
        // (by this owner, from another tab/device) is picked up live too.
        setIsEnded(!!res.data.is_ended);
        setLiveStatus('idle');
      } catch { setLiveStatus('error'); }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [group.id]);

  function fmtDateSep(ts) {
    const d = new Date(ts); const today = new Date(); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  const enriched = [];
  let lastDate = null;
  messages.forEach((m, i) => {
    const dateLabel = fmtDateSep(m.created_at || Date.now());
    if (dateLabel !== lastDate) { enriched.push({ type: 'date', label: dateLabel, key: `d${i}` }); lastDate = dateLabel; }
    const prev = messages[i - 1]; const next = messages[i + 1];
    const isMine = String(m.author_id) === String(myId);
    enriched.push({ type: 'msg', ...m, isMine, isFirst: !prev || prev.author_name !== m.author_name, isLast: !next || next.author_name !== m.author_name, key: m.id || `m${i}` });
  });

  const handleTyping = (e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; };
  const handleSend = async () => {
    if (!text.trim() || posting || !group.can_post || isEnded) return;
    const content = text.trim(); setText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setPosting(true);
    try {
      const res = await api.post(`/group-discussions/${group.id}/messages`, { content });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, newMsg]);
      lastMsgTimeRef.current = newMsg.created_at;
      onMessageSent && onMessageSent(newMsg);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); setText(content); }
    finally { setPosting(false); }
  };
  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (recording) { stopAndSend(); }
      else if (audioBlob) { sendVoiceNote(); }
      else if (selectedFile) { sendFile(); }
      else { handleSend(); }
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    setDeletingId(messageId);
    try {
      await api.delete(`/group-discussions/${group.id}/messages/${messageId}`);
      setMessages(prev => prev.filter(m => String(m.id || m._id) !== String(messageId)));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete message'); }
    finally { setDeletingId(null); }
  };

  const handleClearMyMessages = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/group-discussions/${group.id}/messages`);
      setMessages(prev => prev.filter(m => String(m.author_id) !== String(myId)));
      toast.success('Your messages were cleared');
      setClearConfirm(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to clear messages'); }
    finally { setActionLoading(false); }
  };

  const startRecording = async () => {
    if (isEnded || !group.can_post) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioDuration(recordingTime);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast.error('Microphone access denied. Please allow mic permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      clearInterval(recordTimerRef.current);
      setRecording(false);
    }
  };

  const stopAndSend = () => {
    if (!mediaRecorderRef.current || !recording) return;
    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const duration = recordingTime;
      clearInterval(recordTimerRef.current);
      setRecording(false);
      setAudioBlob(null);
      (async () => {
        setPosting(true);
        try {
          const formData = new FormData();
          const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
          formData.append('audio', blob, `voice-note-${Date.now()}.${ext}`);
          formData.append('duration', String(duration));
          const res = await api.post(`/group-discussions/${group.id}/voice-notes`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const newMsg = res.data.msg;
          setMessages(prev => [...prev, newMsg]);
          lastMsgTimeRef.current = newMsg.created_at;
          onMessageSent && onMessageSent(newMsg);
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to send voice note');
        } finally { setPosting(false); }
      })();
    };
    mediaRecorderRef.current.stop();
  };

  const cancelVoiceNote = () => {
    if (recording) stopRecording();
    setAudioBlob(null);
    setRecordingTime(0);
    setAudioPlaying(false);
  };

  const toggleAudioPreview = () => {
    if (!audioPreviewRef.current) return;
    if (audioPlaying) { audioPreviewRef.current.pause(); setAudioPlaying(false); }
    else { audioPreviewRef.current.play(); setAudioPlaying(true); audioPreviewRef.current.onended = () => setAudioPlaying(false); }
  };

  const sendVoiceNote = async () => {
    if (!audioBlob || posting || isEnded) return;
    setPosting(true);
    try {
      const formData = new FormData();
      const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
      formData.append('audio', audioBlob, `voice-note-${Date.now()}.${ext}`);
      formData.append('duration', String(audioDuration));
      const res = await api.post(`/group-discussions/${group.id}/voice-notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, newMsg]);
      lastMsgTimeRef.current = newMsg.created_at;
      onMessageSent && onMessageSent(newMsg);
      setAudioBlob(null); setRecordingTime(0); setAudioPlaying(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send voice note');
    } finally { setPosting(false); }
  };

  const fmtDuration = (secs) => {
    const s = Math.round(secs || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isEnded || !group.can_post) return;
    if (file.size > MAX_CHAT_FILE_MB * 1024 * 1024) {
      toast.error(`File is too large — max ${MAX_CHAT_FILE_MB}MB.`);
      return;
    }
    setSelectedFile(file);
    setFilePreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };

  const cancelFile = () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setSelectedFile(null);
    setFilePreviewUrl(null);
  };

  const sendFile = async () => {
    if (!selectedFile || uploadingFile || isEnded) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await api.post(`/group-discussions/${group.id}/media`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, newMsg]);
      lastMsgTimeRef.current = newMsg.created_at;
      onMessageSent && onMessageSent(newMsg);
      cancelFile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send file');
    } finally { setUploadingFile(false); }
  };

  const handleEnd = async () => {
    setActionLoading(true);
    try {
      await api.post(`/group-discussions/${group.id}/end`);
      toast.success('Conversation ended. No one can post anymore.');
      setIsEnded(true);
      setEndConfirm(false);
      onEnded && onEnded();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to end conversation'); }
    finally { setActionLoading(false); }
  };

  const handleRestore = async () => {
    setActionLoading(true);
    try {
      await api.post(`/group-discussions/${group.id}/restore`);
      toast.success('Conversation restored. Everyone can post again.');
      setIsEnded(false);
      setRestoreConfirm(false);
      onEnded && onEnded();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to restore conversation'); }
    finally { setActionLoading(false); }
  };

  const canPost = group.can_post && !isEnded;

  return (
    <AudioPlaybackProvider>
    <div className="flex flex-col h-full">
      {/* Hidden file pickers for shared photos/files */}
      <input ref={fileInputRef} type="file" onChange={handleFilePick} style={{ display: 'none' }} />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleFilePick} style={{ display: 'none' }} />
      <div className="tg-viewer-header" style={{ background: `linear-gradient(135deg, ${a}, ${b})`, borderRadius: '16px 16px 0 0', padding: '12px 16px', flexShrink: 0 }}>
        <div className="tg-header-row" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 14, flexShrink: 0 }}>
            {(group.name || 'G').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>{group.class_name} · {(group.members || []).length} members</div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {liveStatus === 'error'
              ? <WifiOff className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
              : <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Live</span>
                </div>
            }
          </div>
          <div className="tg-header-actions flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setMembersOpen(true)}
              className="tg-header-btn flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.28)' }}>
              <Users className="w-3.5 h-3.5" /> {(group.members || []).length} <Eye className="w-3 h-3 opacity-80" />
            </button>
            <button onClick={() => setManageOpen(true)}
              className="tg-header-btn flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.28)' }}
              title="Add or remove members">
              <UserPlus className="w-3.5 h-3.5" /> <span className="tg-btn-label">Manage</span>
            </button>
            {group.is_owner && (
              <button onClick={() => setDmOpen(true)}
                className="tg-header-btn flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                title="Private DM with the team leader">
                <MessageCircle className="w-3.5 h-3.5" /> <span className="tg-btn-label">Team leader DM</span>
              </button>
            )}
            <button onClick={onClose} className="tg-icon-btn" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>

      {isEnded ? (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 flex-shrink-0 flex-wrap"
          style={{ background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <StopCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#dc2626' }} />
            <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>Conversation ended — no one can post anymore</span>
          </div>
          {group.is_owner && (
            <button onClick={() => setRestoreConfirm(true)}
              className="tg-pill-btn flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full flex-shrink-0"
              style={{ background: 'rgba(5,150,105,0.1)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}>
              <RotateCcw className="w-3 h-3" /> Restore Conversation
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-4 py-2 flex-shrink-0 flex-wrap"
          style={{ background: 'rgba(5,150,105,0.07)', borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5" style={{ color: '#059669' }} />
            <span className="text-xs font-semibold" style={{ color: '#059669' }}>You're in — read and post freely</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setClearConfirm(true)}
              className="tg-pill-btn flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full flex-shrink-0"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.15)' }}
              title="Delete every message you've sent in this group">
              <Trash2 className="w-3 h-3" /> Clear my messages
            </button>
            {group.is_owner && (
            <button onClick={() => setEndConfirm(true)}
              className="tg-pill-btn flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full flex-shrink-0"
              style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}>
              <StopCircle className="w-3 h-3" /> End Conversation
            </button>
            )}
          </div>
        </div>
      )}

      <div className="chat-wallpaper tg-scroll flex-1 overflow-y-auto" style={{ padding: '16px 14px 8px' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <div style={{ fontSize: 36, marginBottom: 10 }}>🤝</div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Start the conversation</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Messages appear here in real time</p>
          </div>
        ) : enriched.map(item => {
          if (item.type === 'date') return (
            <div key={item.key} className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
              <span className="text-[10px] font-semibold px-2" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
              <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
            </div>
          );
          const isTeacherMsg = item.author_role === 'teacher';
          const bubbleBg = item.isMine
            ? `linear-gradient(135deg, ${a}, ${b})`
            : isTeacherMsg ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
            : 'var(--surface-100)';
          const bubbleColor = item.isMine || isTeacherMsg ? '#fff' : 'var(--text-primary)';
          return (
            <div key={item.key} className={`group flex mb-1 items-center gap-1.5 ${item.isMine ? 'justify-end' : 'justify-start'}`}>
              {item.isMine && (
                <button onClick={() => handleDeleteMessage(item.id || item._id)}
                  disabled={deletingId === (item.id || item._id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                  title="Delete this message">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <div style={{ maxWidth: '72%' }}>
                {item.isFirst && !item.isMine && (
                  <div className="flex items-center gap-1.5 mb-1 ml-1">
                    <span className="text-[11px] font-bold" style={{ color: isTeacherMsg ? '#7c3aed' : 'var(--text-secondary)' }}>{item.author_name}</span>
                    {isTeacherMsg && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>Teacher</span>}
                  </div>
                )}
                <div style={{
                  background: item.message_type === 'image' || item.message_type === 'file' ? 'transparent' : bubbleBg,
                  color: bubbleColor, padding: item.message_type === 'image' || item.message_type === 'file' ? 0 : '8px 12px',
                  borderRadius: item.isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  fontSize: 13.5, lineHeight: 1.45, wordBreak: 'break-word',
                  boxShadow: item.message_type === 'image' || item.message_type === 'file' ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
                }}>
                  {item.message_type === 'voice'
                    ? <TeacherVoiceBubble url={item.voice_url} duration={item.voice_duration} isMine={item.isMine} />
                    : item.message_type === 'image'
                    ? <ChatImageBubble url={item.file_url} name={item.file_name} mimeType={item.mime_type} />
                    : item.message_type === 'file'
                    ? <ChatFileBubble url={item.file_url} name={item.file_name} size={item.file_size} mimeType={item.mime_type} />
                    : item.content}
                </div>
                {item.isLast && (
                  <div className={`text-[10px] mt-0.5 ${item.isMine ? 'text-right mr-1' : 'ml-1'}`} style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {canPost ? (
        selectedFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--card-border)', padding: '10px 14px', background: 'var(--card-bg)', flexShrink: 0 }}>
            <button onClick={cancelFile} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X style={{ width: 16, height: 16 }} /></button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-100)', borderRadius: 14, padding: '6px 10px', border: `1.5px solid ${a}40`, minWidth: 0 }}>
              {filePreviewUrl ? (
                <img src={filePreviewUrl} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${a}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AttachmentTypeIcon mimeType={selectedFile.type} style={{ width: 15, height: 15, color: a }} />
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{fmtFileSize(selectedFile.size)}</div>
              </div>
            </div>
            <button onClick={sendFile} disabled={uploadingFile} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${a}, ${b})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: uploadingFile ? 0.6 : 1 }}>
              {uploadingFile ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        ) :
        recording ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--card-border)', padding: '10px 14px', background: 'var(--card-bg)', flexShrink: 0 }}>
            <button onClick={cancelVoiceNote} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X style={{ width: 16, height: 16 }} /></button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-100)', borderRadius: 20, padding: '8px 14px', border: '1.5px solid #dc262630' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>Recording… {fmtDuration(recordingTime)}</span>
            </div>
            <button onClick={stopAndSend} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${a}, ${b})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Send style={{ width: 16, height: 16 }} /></button>
          </div>
        ) : audioBlob ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--card-border)', padding: '10px 14px', background: 'var(--card-bg)', flexShrink: 0 }}>
            <button onClick={cancelVoiceNote} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Trash2 style={{ width: 16, height: 16 }} /></button>
            {audioBlob && <audio ref={audioPreviewRef} src={URL.createObjectURL(audioBlob)} style={{ display: 'none' }} />}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-100)', borderRadius: 20, padding: '8px 14px', border: `1.5px solid ${a}40` }}>
              <button onClick={toggleAudioPreview} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: `${a}20`, color: a, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                {audioPlaying ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}
              </button>
              <Mic style={{ width: 13, height: 13, color: a, opacity: 0.7 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Voice note · {fmtDuration(audioDuration)}</span>
            </div>
            <button onClick={sendVoiceNote} disabled={posting} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${a}, ${b})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: posting ? 0.6 : 1 }}>
              {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--card-border)', padding: '10px 14px', background: 'var(--card-bg)', flexShrink: 0 }}>
            <div className="wa-input-pill" style={{ '--wa-accent': a, '--wa-accent-2': b, '--wa-accent-soft': `${a}22` }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="wa-icon-btn" onClick={() => { setAttachMenuOpen(o => !o); setEmojiOpen(false); }} title="Attach">
                  <Plus style={{ width: 20, height: 20 }} />
                </button>
                <AttachMenu
                  open={attachMenuOpen}
                  onClose={() => setAttachMenuOpen(false)}
                  onPickImage={() => imageInputRef.current?.click()}
                  onPickFile={() => fileInputRef.current?.click()}
                />
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="wa-icon-btn" onClick={() => { setEmojiOpen(o => !o); setAttachMenuOpen(false); }} title="Emoji">
                  <Smile style={{ width: 20, height: 20 }} />
                </button>
                <EmojiPicker
                  open={emojiOpen}
                  onClose={() => setEmojiOpen(false)}
                  onPick={(e) => { setText(t => t + e); inputRef.current?.focus(); }}
                />
              </div>
              <textarea ref={inputRef} value={text} onChange={handleTyping} onKeyDown={handleKey} rows={1}
                placeholder="Type a reply"
                className="wa-input-textarea" />
              {text.trim() ? (
                <button key="send" onClick={handleSend} disabled={posting} className="wa-icon-btn wa-icon-send wa-icon-swap">
                  {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 17, height: 17 }} />}
                </button>
              ) : (
                <button key="mic" onClick={startRecording} className="wa-icon-btn wa-icon-swap" title="Record a voice note">
                  <Mic style={{ width: 20, height: 20 }} />
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--surface-100)', padding: '10px 16px', flexShrink: 0 }}>
          <p className="text-xs text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {isEnded ? '🔒 This conversation has ended' : 'You cannot post in this conversation'}
          </p>
        </div>
      )}

      <ConfirmDialog isOpen={clearConfirm} onClose={() => setClearConfirm(false)} onConfirm={handleClearMyMessages} loading={actionLoading}
        title="Clear My Messages" message="This deletes every message you've sent in this group. Other members' messages stay." confirmText="Clear My Messages" variant="danger" />
      <ConfirmDialog isOpen={endConfirm} onClose={() => setEndConfirm(false)} onConfirm={handleEnd} loading={actionLoading}
        title="End Conversation" message="Everyone will lose typing access. You can restore it later from this same panel." confirmText="End Conversation" variant="danger" />
      <ConfirmDialog isOpen={restoreConfirm} onClose={() => setRestoreConfirm(false)} onConfirm={handleRestore} loading={actionLoading}
        title="Restore Conversation" message="Everyone in this group will regain the ability to post again." confirmText="Restore Conversation" variant="default" />
      {dmOpen && (
        <LeaderDmPanel groupId={group.id} myId={myId} peerName={group.team_leader?.name} onClose={() => setDmOpen(false)} />
      )}
      {membersOpen && (
        <MembersModal group={group} onClose={() => setMembersOpen(false)} />
      )}
      {manageOpen && (
        <ManageMembersModal
          group={group}
          onClose={() => setManageOpen(false)}
          onChanged={() => { setManageOpen(false); onMembersChanged && onMembersChanged(); }}
        />
      )}
    </div>
    </AudioPlaybackProvider>
  );
}

/* ── Private team-leader <-> teacher DM panel ────────────────────────────
   Used on BOTH sides: the teacher opens it from GroupViewer (peer = team
   leader), and the student/team-leader opens it from their group view
   (peer = teacher). Identical thread, different vantage point. */
function LeaderDmPanel({ groupId, myId, peerName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [peer, setPeer] = useState(null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const lastMsgTimeRef = useRef(null);

  useEffect(() => {
    const key = `leaderdm:${groupId}`;
    setActiveConversation(key);
    return () => clearActiveConversation(key);
  }, [groupId]);

  const fetchThread = useCallback(async (silent) => {
    try {
      const params = silent && lastMsgTimeRef.current ? { since: lastMsgTimeRef.current } : {};
      const res = await api.get(`/group-discussions/${groupId}/leader-dm`, { params });
      if (res.data.peer) setPeer(res.data.peer);
      const fresh = res.data.messages || [];
      if (fresh.length > 0) {
        setMessages(prev => {
          if (!silent) return fresh;
          const existingIds = new Set(prev.map(m => String(m.id)));
          const toAdd = fresh.filter(m => !existingIds.has(String(m.id)));
          if (toAdd.length) {
            toAdd.forEach(m => markMessageSeen(m.id));
            const fromPeer = toAdd.filter(m => String(m.sender_id) !== String(myId));
            if (fromPeer.length) {
              const last = fromPeer[fromPeer.length - 1];
              const senderName = last.sender_name || 'Someone';
              showChatToast({ name: senderName, preview: last.content, accent: '#f59e0b', accent2: '#d97706' });
            }
          }
          return toAdd.length ? [...prev, ...toAdd] : prev;
        });
        lastMsgTimeRef.current = fresh[fresh.length - 1].created_at;
      }
    } catch (err) { if (!silent) toast.error(err.response?.data?.message || 'Failed to load DM'); }
    finally { setLoading(false); }
  }, [groupId, myId]);

  useEffect(() => {
    fetchThread(false);
    pollRef.current = setInterval(() => fetchThread(true), 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchThread]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || posting) return;
    const content = text.trim(); setText('');
    setPosting(true);
    try {
      const res = await api.post(`/group-discussions/${groupId}/leader-dm`, { content });
      setMessages(prev => [...prev, res.data.msg]);
      lastMsgTimeRef.current = res.data.msg.created_at;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); setText(content); }
    finally { setPosting(false); }
  };

  const handleDelete = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    setDeletingId(messageId);
    try {
      await api.delete(`/group-discussions/${groupId}/leader-dm/${messageId}`);
      setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
    finally { setDeletingId(null); }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await api.delete(`/group-discussions/${groupId}/leader-dm`);
      setMessages(prev => prev.filter(m => String(m.sender_id) !== String(myId)));
      setClearConfirm(false);
      toast.success('Your messages were cleared');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to clear'); }
    finally { setClearing(false); }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const displayName = peer?.name || peerName || 'DM';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', animation: 'fastModalBackdropIn 0.12s ease both' }}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden shadow-2xl" style={{ maxWidth: 440, height: '70vh', background: 'var(--card-bg)', animation: 'fastModalSheetIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
            {displayName[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm truncate">{displayName}</div>
            <div className="text-white/60 text-[10px]">Private team leader DM</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <button onClick={() => setClearConfirm(true)}
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full transition-all hover:opacity-80"
            style={{ color: '#dc2626' }}>
            <Trash2 className="w-2.5 h-2.5" /> Clear my messages
          </button>
        </div>

        <div className="chat-wallpaper tg-scroll flex-1 overflow-y-auto" style={{ padding: '14px 12px' }}>
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : messages.length === 0 ? (
            <div className="tg-empty-state flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="w-8 h-8 mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>This DM is private to the two of you.</p>
            </div>
          ) : messages.map(m => {
            const isMine = String(m.sender_id) === String(myId);
            return (
              <div key={m.id} className={`group flex mb-1.5 items-center gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {isMine && (
                  <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <div style={{ maxWidth: '78%' }}>
                  <div style={{
                    background: isMine ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'var(--surface-100)',
                    color: isMine ? '#fff' : 'var(--text-primary)', padding: '8px 12px',
                    borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    fontSize: 13.5, lineHeight: 1.45, wordBreak: 'break-word',
                  }}>
                    {m.content}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${isMine ? 'text-right mr-1' : 'ml-1'}`} style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{ borderTop: '1px solid var(--card-border)' }}>
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${displayName}…`}
            className="flex-1 px-3.5 py-2 rounded-full text-sm outline-none"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' }} />
          <button onClick={handleSend} disabled={!text.trim() || posting}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <ConfirmDialog isOpen={clearConfirm} onClose={() => setClearConfirm(false)} onConfirm={handleClear} loading={clearing}
        title="Clear My Messages" message="This deletes every message you've sent in this private DM." confirmText="Clear My Messages" variant="danger" />
    </div>
  );
}

/* ══════════════════════════════════════════════
   Open Collaboration Panel
══════════════════════════════════════════════ */
function OpenCollaborationPanel() {
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState(null); // classId being toggled

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/collaborations/my-classes');
      setClasses(res.data.classes || []);
    } catch { toast.error('Failed to load classes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const handleToggle = async (cls) => {
    setToggling(cls.id);
    try {
      if (cls.collaboration_active) {
        await api.post(`/collaborations/${cls.id}/close`);
        toast.success(`Collaboration closed for ${cls.name}`);
      } else {
        await api.post(`/collaborations/${cls.id}/open`);
        toast.success(`🟢 Collaboration is now live for ${cls.name}!`);
      }
      fetchClasses();
    } catch (err) { toast.error(err.response?.data?.message || 'Action failed'); }
    finally { setToggling(null); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-5" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Open Collaboration</h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Allow students to send private one-to-one messages within a class
            </p>
          </div>
        </div>
        <div className="mt-3 px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.15)', color: '#059669' }}>
          <strong>How it works:</strong> When collaboration is live, every student in that class can search for and privately message any classmate. Only the two participants see their own conversation — no one else (not even the teacher) can read their private messages.
        </div>
      </div>

      {/* Class list */}
      <div className="flex-1 overflow-y-auto tg-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-7 h-7 rounded-full" style={{ border: '3px solid var(--card-border)', borderTopColor: '#059669' }} />
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.08)' }}>
              <Users className="w-8 h-8" style={{ color: '#059669', opacity: 0.5 }} />
            </div>
            <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No classes found</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Classes you are assigned to will appear here.</p>
          </div>
        ) : classes.map(cls => (
          <CollaborationClassRow
            key={cls.id}
            cls={cls}
            onToggle={handleToggle}
            toggling={toggling === cls.id}
          />
        ))}
      </div>
    </div>
  );
}

function CollaborationClassRow({ cls, onToggle, toggling }) {
  const isActive = cls.collaboration_active;
  return (
    <div className="tg-collab-row flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.15s ease' }}>
      {/* Class avatar */}
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
        style={{ background: isActive ? 'linear-gradient(135deg, #059669, #0d9488)' : 'var(--surface-100)', color: isActive ? '#fff' : 'var(--text-secondary)', border: isActive ? 'none' : '1.5px solid var(--card-border)' }}>
        {(cls.name || 'C').slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{cls.name}</div>
        {/* Status badge */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {isActive ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(5,150,105,0.12)', color: '#059669' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Collaboration is live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
              Collaboration is off
            </span>
          )}
        </div>
        {isActive && cls.opened_at && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
            Opened {timeAgo(cls.opened_at)}
          </p>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => onToggle(cls)}
        disabled={toggling}
        className="tg-pill-btn flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50 flex-shrink-0"
        style={isActive
          ? { background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }
          : { background: 'linear-gradient(135deg, #059669, #0d9488)', color: '#fff' }
        }>
        {toggling
          ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          : isActive
            ? <><ZapOff className="w-3.5 h-3.5" /> Close</>
            : <><Zap className="w-3.5 h-3.5" /> Open</>
        }
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main page
══════════════════════════════════════════════ */
export default function TeacherGroups() {
  const { user } = useAuth();
  const myId = user?.id;
  const [tab, setTab] = useState('groups');
  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [classes, setClasses]         = useState([]);
  const [createMode, setCreateMode]   = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleting, setDeleting]           = useState(false);

  // Deep-link target consumed from a toast click (see ChatNotifyContext) —
  // auto-opens the exact group, and its leader-DM panel if that's what the
  // notification was about, instead of just landing on the groups list.
  const [pendingLeaderDmGroupId, setPendingLeaderDmGroupId] = useState(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const params = {}; if (filterClass) params.classId = filterClass;
      const res = await api.get('/group-discussions', { params });
      setGroups(res.data.groups || []);
    } catch { toast.error('Failed to load groups'); }
    finally { setLoading(false); }
  }, [filterClass]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => { api.get('/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {}); }, []);

  const openGroup = async (g) => {
    setCreateMode(false); setActiveGroup(g);
    setDetailLoading(true);
    try { const res = await api.get(`/group-discussions/${g.id}`); setGroupDetail(res.data.group); }
    catch { toast.error('Failed to load group'); setGroupDetail(null); }
    finally { setDetailLoading(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/group-discussions/${deleteTarget.id}`);
      toast.success('Group deleted');
      setDeleteTarget(null);
      if (activeGroup?.id === deleteTarget.id) { setActiveGroup(null); setGroupDetail(null); }
      fetchGroups();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const handleEnded = () => { fetchGroups(); };

  // Deep-link handling: react to a toast click, whether it arrives while
  // this page is already mounted (event) or right after navigating here
  // fresh (consumePendingChatTarget on mount).
  useEffect(() => {
    const applyTarget = (t) => {
      if (!t) return;
      if (t.type === 'group') {
        setTab('groups');
        openGroup({ id: t.groupId });
      } else if (t.type === 'leaderdm') {
        setTab('groups');
        setPendingLeaderDmGroupId(t.groupId);
        openGroup({ id: t.groupId });
      }
    };
    applyTarget(consumePendingChatTarget());
    return onPendingChatTarget(applyTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Right panel: only for groups tab
  let rightPanel = null;
  if (tab === 'groups') {
    if (createMode) {
      rightPanel = <CreateGroupPanel onClose={() => setCreateMode(false)} onCreated={() => { setCreateMode(false); fetchGroups(); }} />;
    } else if (activeGroup) {
      rightPanel = detailLoading || !groupDetail
        ? <div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" /><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p></div></div>
        : <GroupViewer
            key={groupDetail.id}
            group={groupDetail}
            myId={myId}
            onClose={() => { setActiveGroup(null); setGroupDetail(null); }}
            onMessageSent={fetchGroups}
            onEnded={handleEnded}
            onMembersChanged={() => { openGroup(activeGroup); fetchGroups(); }}
            autoOpenDm={pendingLeaderDmGroupId != null && String(pendingLeaderDmGroupId) === String(groupDetail.id)}
            onAutoOpenHandled={() => setPendingLeaderDmGroupId(null)}
          />;
    }
  }

  // For collaboration tab: full-width panel in right side
  const showCollabPanel = tab === 'collaboration';

  return (
    <div className="tg-page flex h-full" style={{ minHeight: 'calc(100vh - 120px)', gap: 12 }}>
      <style>{`
        /* ── Scrollbars ───────────────────────────────────────────── */
        .tg-page .tg-scroll::-webkit-scrollbar,
        .tg-page .tg-sidebar-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
        .tg-page .tg-scroll::-webkit-scrollbar-track,
        .tg-page .tg-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .tg-page .tg-scroll::-webkit-scrollbar-thumb,
        .tg-page .tg-sidebar-scroll::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--text-secondary) 30%, transparent);
          border-radius: 20px;
        }
        .tg-page .tg-scroll:hover::-webkit-scrollbar-thumb,
        .tg-page .tg-sidebar-scroll:hover::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--text-secondary) 45%, transparent);
        }

        /* ── Group cards ──────────────────────────────────────────── */
        .tg-page .tg-group-card {
          transition: background 0.2s ease, transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .tg-page .tg-group-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px -10px rgba(15,23,42,0.18);
        }
        .tg-page .tg-group-card:active { transform: translateY(0) scale(0.995); }

        /* ── Generic pill / header buttons ───────────────────────── */
        .tg-page .tg-pill-btn,
        .tg-page .tg-header-btn,
        .tg-page .tg-icon-btn {
          transition: transform 0.15s cubic-bezier(0.22,1,0.36,1), background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
        }
        .tg-page .tg-pill-btn:hover { filter: brightness(0.97); transform: translateY(-1px); box-shadow: 0 4px 10px -4px rgba(0,0,0,0.15); }
        .tg-page .tg-pill-btn:active { transform: translateY(0) scale(0.97); }
        .tg-page .tg-header-btn:hover { background: rgba(255,255,255,0.3) !important; transform: translateY(-1px); box-shadow: 0 4px 12px -4px rgba(0,0,0,0.25); }
        .tg-page .tg-header-btn:active { transform: translateY(0) scale(0.96); }
        .tg-page .tg-icon-btn:hover { background: rgba(255,255,255,0.28) !important; transform: rotate(90deg); }
        .tg-page .tg-icon-btn:active { transform: rotate(90deg) scale(0.9); }

        /* ── Tabs / filter chips ──────────────────────────────────── */
        .tg-page .tg-tab-btn { transition: all 0.2s cubic-bezier(0.22,1,0.36,1); }
        .tg-page .tg-tab-btn:hover:not([data-active="true"]) { background: rgba(255,255,255,0.08); color: white; }
        .tg-page .tg-filter-chip { transition: all 0.18s cubic-bezier(0.22,1,0.36,1); }
        .tg-page .tg-filter-chip:hover:not([data-active="true"]) { filter: brightness(0.96); transform: translateY(-1px); }
        .tg-page .tg-filter-chip:active { transform: translateY(0) scale(0.96); }

        /* ── Inputs: refined focus ring ───────────────────────────── */
        .tg-page input:not([type="checkbox"]):not([type="radio"]),
        .tg-page select,
        .tg-page textarea {
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .tg-page input:not([type="checkbox"]):not([type="radio"]):focus,
        .tg-page select:focus,
        .tg-page textarea:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3.5px rgba(99,102,241,0.15);
        }

        /* Keyboard accessibility: visible focus-ring on interactive elements */
        .tg-page button:focus-visible,
        .tg-page a:focus-visible {
          outline: 2px solid #6366f1;
          outline-offset: 2px;
          border-radius: 6px;
        }

        /* ── Send button micro-interaction ───────────────────────── */
        .tg-page .send-btn {
          transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s ease, opacity 0.15s ease;
          box-shadow: 0 3px 10px -3px rgba(99,102,241,0.5);
        }
        .tg-page .send-btn:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 5px 16px -4px rgba(99,102,241,0.6); }
        .tg-page .send-btn:active:not(:disabled) { transform: scale(0.94); }

        /* ── Collaboration rows ───────────────────────────────────── */
        .tg-page .tg-collab-row:hover { background: color-mix(in srgb, var(--surface-100) 100%, transparent); }

        /* ── Empty state entrance ─────────────────────────────────── */
        .tg-empty-state { animation: tgFadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes tgFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Responsive: group viewer header ─────────────────────── */
        @media (max-width: 900px) {
          .tg-header-actions .tg-btn-label { display: none; }
          .tg-header-actions .tg-header-btn { padding-left: 10px; padding-right: 10px; }
        }
        @media (max-width: 640px) {
          .tg-viewer-header { border-radius: 0 !important; }
        }
      `}</style>
      {/* ── Left sidebar ── */}
      <div className={`flex flex-col ${(rightPanel || showCollabPanel) ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex-1'}`}
        style={{ background: 'var(--card-bg)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--card-border)' }}>

        {/* Header */}
        <div className="flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', padding: '18px 16px 0' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Users className="w-4 h-4" /></div>
              Groups
            </h2>
            {tab === 'groups' && (
              <button onClick={() => { setCreateMode(true); setActiveGroup(null); setGroupDetail(null); }}
                className="tg-header-btn flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            )}
          </div>
          <p className="text-white/55 text-xs mb-4">Manage student collaboration groups</p>

          {/* 2-tab bar */}
          <div className="flex gap-1 p-1 rounded-xl mb-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
            {/* My Groups */}
            <button
              onClick={() => { setTab('groups'); setCreateMode(false); }}
              data-active={tab === 'groups'}
              className="tg-tab-btn flex-1 text-xs font-bold px-2 py-1.5 rounded-lg"
              style={tab === 'groups'
                ? { background: 'white', color: '#4f46e5', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: 'rgba(255,255,255,0.75)' }}>
              My Groups
            </button>

            {/* Open Collaboration */}
            <button
              onClick={() => { setTab('collaboration'); setActiveGroup(null); setGroupDetail(null); setCreateMode(false); }}
              data-active={tab === 'collaboration'}
              className="tg-tab-btn flex-1 text-xs font-bold px-2 py-1.5 rounded-lg flex items-center justify-center gap-1"
              style={tab === 'collaboration'
                ? { background: 'white', color: '#059669', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: 'rgba(255,255,255,0.75)' }}>
              <Radio className="w-3 h-3" /> Collab
            </button>
          </div>
        </div>

        {/* Tab bodies */}
        {tab === 'groups' ? (
          <>
            <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto flex-shrink-0 tg-scroll" style={{ borderBottom: '1px solid var(--card-border)' }}>
              {[{ id: '', name: 'All' }, ...classes].map(c => (
                <button key={c.id} onClick={() => setFilterClass(c.id)}
                  data-active={filterClass === c.id}
                  className="tg-filter-chip flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold whitespace-nowrap"
                  style={filterClass === c.id ? { background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white' } : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto tg-sidebar-scroll">
              {loading ? (
                <div>
                  {[0, 1, 2, 3].map(i => <GroupCardSkeleton key={i} delay={i * 60} />)}
                </div>
              ) : groups.length === 0 ? (
                <div className="tg-empty-state flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <Users className="w-8 h-8" style={{ color: '#6366f1', opacity: 0.5 }} />
                  </div>
                  <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No groups yet</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Create a group to let students collaborate.</p>
                  <button onClick={() => setCreateMode(true)}
                    className="tg-pill-btn flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                    <Plus className="w-4 h-4" /> New Group
                  </button>
                </div>
              ) : groups.map(g => (
                <GroupCard key={g.id} g={g} onOpen={openGroup} onDelete={setDeleteTarget} active={activeGroup?.id === g.id} />
              ))}
            </div>
          </>
        ) : (
          /* Collapsed summary in sidebar when collab tab is selected on mobile */
          <div className="flex-1 flex items-center justify-center p-6 text-center lg:hidden">
            <div>
              <Radio className="w-10 h-10 mx-auto mb-3" style={{ color: '#059669' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Open Collaboration</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Manage class-wide peer messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      {showCollabPanel ? (
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
          <OpenCollaborationPanel />
        </div>
      ) : rightPanel ? (
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
          {rightPanel}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center rounded-2xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="tg-empty-state text-center px-8">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
              <Users className="w-10 h-10" style={{ color: '#6366f1', opacity: 0.6 }} />
            </div>
            <h3 className="font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>Group Discussions</h3>
            <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {tab === 'groups' ? 'Create groups, assign a team leader, and you get full access to every conversation automatically.'
               : 'Enable peer-to-peer messaging for a class — students chat privately with any classmate.'}
            </p>
            {tab === 'groups' && (
              <button onClick={() => setCreateMode(true)}
                className="tg-pill-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                <Plus className="w-4 h-4" /> Create First Group
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Group" message={`Delete "${deleteTarget?.name}"? All messages will be permanently lost.`} confirmText="Delete" variant="danger" />
    </div>
  );
}