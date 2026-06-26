import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  Plus, Search, Users, Trash2, X, Send,
  Crown, Lock, Mail, Clock, Check, XCircle, Inbox,
  LogOut, StopCircle, Wifi, WifiOff,
  Mic, Square, Play, Pause,
} from 'lucide-react';

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

function AccessBadge({ status }) {
  if (status === 'accepted') return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(5,150,105,0.12)', color: '#059669' }}>
      <Check className="w-2.5 h-2.5" /> Joined
    </span>
  );
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(217,119,6,0.12)', color: '#d97706' }}>
      <Clock className="w-2.5 h-2.5" /> Pending
    </span>
  );
  if (status === 'denied') return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
      <XCircle className="w-2.5 h-2.5" /> Declined
    </span>
  );
  if (status === 'left') return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(107,114,128,0.12)', color: '#6b7280' }}>
      <LogOut className="w-2.5 h-2.5" /> Left
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
      <Lock className="w-2.5 h-2.5" /> No access
    </span>
  );
}

/* ── Group card ────────────────────────────────────────────────────────── */
function GroupCard({ g, onOpen, onDelete, active }) {
  const [a, b] = groupColor(g.id);
  const initials = (g.name || 'G').slice(0, 2).toUpperCase();
  return (
    <div
      className="group relative flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all"
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
        {g.my_invitation_status === 'accepted' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 bg-green-500"
            style={{ borderColor: 'var(--card-bg)' }} />
        )}
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
          <AccessBadge status={g.my_invitation_status} />
        </div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(g); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full items-center justify-center hidden group-hover:flex transition-all hover:bg-red-50"
        title="Delete group">
        <Trash2 className="w-3.5 h-3.5 text-red-400" />
      </button>
    </div>
  );
}

/* ── Create group panel ─────────────────────────────────────────────────── */
function CreateGroupPanel({ onClose, onCreated }) {
  const [classes, setClasses]   = useState([]);
  const [students, setStudents] = useState([]);
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
    if (!form.classId) { setStudents([]); setSelected(new Set()); setTeamLeaderId(''); return; }
    setLoadingStudents(true);
    api.get(`/classes/${form.classId}/students`)
      .then(r => setStudents((r.data.students || []).map(s => ({ id: s._id || s.id, name: s.name }))))
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoadingStudents(false));
  }, [form.classId]);

  const toggleStudent = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); if (teamLeaderId === id) setTeamLeaderId(''); }
    else next.add(id);
    return next;
  });

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()));
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

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
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
                <button onClick={() => { if (selected.size === students.length) { setSelected(new Set()); setTeamLeaderId(''); } else setSelected(new Set(students.map(s => s.id))); }}
                  className="text-xs font-semibold" style={{ color: '#6366f1' }}>
                  {selected.size === students.length ? 'Deselect all' : 'Select all'}
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
                {filteredStudents.map(s => (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all hover:opacity-80"
                    style={{ borderBottom: '1px solid var(--card-border)', background: selected.has(s.id) ? 'rgba(99,102,241,0.07)' : undefined }}>
                    <div className="relative flex-shrink-0">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleStudent(s.id)} className="sr-only" />
                      <div className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center transition-all"
                        style={{ background: selected.has(s.id) ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent', border: selected.has(s.id) ? 'none' : '1.5px solid var(--card-border)' }}>
                        {selected.has(s.id) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
                      {s.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  </label>
                ))}
              </div>
            )}
            {selected.size > 0 && <p className="text-xs mt-2 font-semibold" style={{ color: '#6366f1' }}>{selected.size} selected</p>}
          </div>
        )}

        {selectedStudents.length > 0 && (
          <div>
            <label className="block text-[11px] font-bold mb-1 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Team Leader *</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.75 }}>The team leader can invite teachers into this group's conversation.</p>
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

/* ── Locked panel ───────────────────────────────────────────────────────── */
function LockedGroupPanel({ g, onClose }) {
  const [a, b] = groupColor(g.id);
  const status = g.my_invitation_status;
  let icon = <Lock className="w-9 h-9" style={{ color: '#6366f1' }} />;
  let title = 'No access to this conversation';
  let body = `The team leader (${g.team_leader?.name || 'a student'}) hasn't invited you yet.`;
  if (status === 'pending') { icon = <Clock className="w-9 h-9" style={{ color: '#d97706' }} />; title = 'Invitation pending'; body = 'Accept it in the Invitations tab.'; }
  else if (status === 'denied') { icon = <XCircle className="w-9 h-9" style={{ color: '#dc2626' }} />; title = 'You declined this invitation'; body = 'You previously declined the team leader\'s invitation.'; }
  else if (status === 'left') { icon = <LogOut className="w-9 h-9" style={{ color: '#6b7280' }} />; title = 'You left this conversation'; body = 'You left this group. Students can still chat.'; }
  return (
    <div className="flex flex-col h-full">
      <div style={{ background: `linear-gradient(135deg, ${a}, ${b})`, borderRadius: '16px 16px 0 0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 14 }}>{(g.name || 'G').slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{g.name}</div><div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>{g.class_name} · {g.member_count} members</div></div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X style={{ width: 14, height: 14 }} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <div>
          <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--surface-100)' }}>{icon}</div>
          <h3 className="font-bold text-lg mb-1.5" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', maxWidth: 300, margin: '0 auto' }}>{body}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Group Viewer with real-time polling + Leave + End ──────────────────── */
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

function GroupViewer({ group, myId, onClose, onMessageSent, onLeft, onEnded }) {
  const [a, b] = groupColor(group.id);
  const [messages, setMessages] = useState(group.messages || []);
  const [text, setText]         = useState('');
  const [posting, setPosting]   = useState(false);
  const [isEnded, setIsEnded]   = useState(group.is_ended || false);
  const [liveStatus, setLiveStatus] = useState('idle'); // 'idle' | 'polling' | 'error'
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [endConfirm, setEndConfirm]     = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  // Voice recording state
  const [recording, setRecording]         = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob]         = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying]   = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const recordTimerRef   = useRef(null);
  const audioPreviewRef  = useRef(null);
  const inputRef       = useRef(null);
  const messagesEndRef = useRef(null);
  const pollRef        = useRef(null);
  const lastMsgTimeRef = useRef(null);

  useEffect(() => { setMessages(group.messages || []); setIsEnded(group.is_ended || false); }, [group.id]);

  // Set lastMsgTimeRef to most recent message time
  useEffect(() => {
    const sorted = [...(group.messages || [])];
    if (sorted.length > 0) lastMsgTimeRef.current = sorted[sorted.length - 1].created_at;
    else lastMsgTimeRef.current = null;
  }, [group.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Allow Enter to send a voice note even when the textarea isn't focused
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

  // Real-time polling
  useEffect(() => {
    if (isEnded) return;
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
            lastMsgTimeRef.current = fresh[fresh.length - 1].created_at;
            return [...prev, ...fresh];
          });
        }
        if (res.data.is_ended) { setIsEnded(true); clearInterval(pollRef.current); }
        setLiveStatus('idle');
      } catch { setLiveStatus('error'); }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [group.id, isEnded]);

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
      if (recording) { stopAndSend(); }       // still recording → stop + send immediately
      else if (audioBlob) { sendVoiceNote(); } // preview ready → send
      else { handleSend(); }                   // normal text
    }
  };

  /* ── Voice recording ── */
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

  // Stops recording and sends the blob as soon as onstop fires
  const stopAndSend = () => {
    if (!mediaRecorderRef.current || !recording) return;
    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const duration = recordingTime;
      clearInterval(recordTimerRef.current);
      setRecording(false);
      setAudioBlob(null); // skip preview
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

  const handleLeave = async () => {
    setActionLoading(true);
    try {
      await api.post(`/group-discussions/${group.id}/leave`);
      toast.success('You left the group. Students can continue chatting.');
      setLeaveConfirm(false);
      onLeft && onLeft();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to leave'); }
    finally { setActionLoading(false); }
  };

  const handleEnd = async () => {
    setActionLoading(true);
    try {
      await api.post(`/group-discussions/${group.id}/end`);
      toast.success('Conversation ended. No one can post anymore.');
      setIsEnded(true);
      setEndConfirm(false);
      clearInterval(pollRef.current);
      onEnded && onEnded();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to end conversation'); }
    finally { setActionLoading(false); }
  };

  const canPost = group.can_post && !isEnded;

  return (
    <AudioPlaybackProvider>
    <div className="flex flex-col h-full">
      <div style={{ background: `linear-gradient(135deg, ${a}, ${b})`, borderRadius: '16px 16px 0 0', padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 14, flexShrink: 0 }}>
            {(group.name || 'G').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>{group.class_name} · {(group.members || []).length} members</div>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {liveStatus === 'error'
              ? <WifiOff className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
              : <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Live</span>
                </div>
            }
          </div>
          {/* Leave button */}
          <button onClick={() => setLeaveConfirm(true)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
            title="Leave this group conversation">
            <LogOut className="w-3 h-3" /> Leave
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Access banner */}
      {isEnded ? (
        <div className="flex items-center justify-center gap-2 px-4 py-2 flex-shrink-0"
          style={{ background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid var(--card-border)' }}>
          <StopCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#dc2626' }} />
          <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>Conversation ended — no one can post anymore</span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-4 py-2 flex-shrink-0"
          style={{ background: 'rgba(5,150,105,0.07)', borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5" style={{ color: '#059669' }} />
            <span className="text-xs font-semibold" style={{ color: '#059669' }}>You're in — read and post freely</span>
          </div>
          <button onClick={() => setEndConfirm(true)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full transition-all active:scale-95 flex-shrink-0"
            style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}>
            <StopCircle className="w-3 h-3" /> End Conversation
          </button>
        </div>
      )}

      {/* Members bar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid var(--card-border)' }}>
        {(group.members || []).map(m => (
          <div key={m.id} className="flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(5,150,105,0.09)', color: '#059669' }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>{m.name[0].toUpperCase()}</div>
            {m.name}{group.team_leader?.id === m.id && <Crown className="w-2.5 h-2.5 ml-0.5" style={{ color: '#d97706' }} />}
          </div>
        ))}
        {(group.invitations || []).filter(i => i.status === 'accepted').map(i => (
          <div key={i.id} className="flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(99,102,241,0.09)', color: '#6366f1' }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>{i.teacher_name[0].toUpperCase()}</div>
            {i.teacher_name} <span style={{ opacity: 0.6 }}>(teacher)</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-wallpaper flex-1 overflow-y-auto" style={{ padding: '16px 14px 8px' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <div style={{ fontSize: 36, marginBottom: 10 }}>🤝</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No messages yet</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Messages appear here in real time.</p>
          </div>
        ) : enriched.map(item => item.type === 'date' ? (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
            <span className="chat-date-chip">{item.label}</span>
          </div>
        ) : (
          <div key={item.key} style={{ display: 'flex', flexDirection: item.isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: item.isLast ? 12 : 2 }}>
            <div style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'flex-end' }}>
              {item.isLast && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: item.author_role === 'teacher' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #059669, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                  {(item.author_name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: item.isMine ? 'flex-end' : 'flex-start', maxWidth: '68%' }}>
              {item.isFirst && (
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, marginLeft: 4, color: item.author_role === 'teacher' ? '#6366f1' : '#059669' }}>
                  {item.isMine ? 'You' : item.author_name}{item.author_role === 'teacher' && !item.isMine ? ' · teacher' : ''}
                </div>
              )}
              <div className={item.isMine ? 'chat-bubble-mine' : 'chat-bubble-other'}
                style={{ padding: item.message_type === 'voice' ? '8px 12px' : '9px 13px', borderRadius: item.isFirst ? (item.isMine ? '18px 4px 18px 18px' : '4px 18px 18px 18px') : (item.isMine ? '18px 4px 4px 18px' : '4px 18px 18px 4px') }}>
                {item.message_type === 'voice' ? (
                  <TeacherVoiceBubble url={item.voice_url} duration={item.voice_duration} isMine={item.isMine} />
                ) : (
                  <p style={{ fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word', margin: 0 }}>{item.content}</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{new Date(item.created_at || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      {canPost ? (
        audioBlob ? (
          /* Voice note preview bar */
          <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <audio ref={audioPreviewRef} src={URL.createObjectURL(audioBlob)} style={{ display: 'none' }} />
            <button onClick={cancelVoiceNote} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4, borderRadius: '50%', display: 'flex' }}>
              <Trash2 style={{ width: 18, height: 18 }} />
            </button>
            <button onClick={toggleAudioPreview}
              style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${a}, ${b})`, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              {audioPlaying ? <Pause style={{ width: 16, height: 16 }} /> : <Play style={{ width: 16, height: 16 }} />}
            </button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ height: 4, borderRadius: 2, background: `${a}33`, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', background: `linear-gradient(90deg, ${a}, ${b})`, opacity: 0.7, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Voice note · {fmtDuration(audioDuration)}</span>
            </div>
            <button className="send-btn" onClick={sendVoiceNote} disabled={posting} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
              {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        ) : recording ? (
          /* Recording in progress */
          <div style={{ borderTop: '1px solid var(--card-border)', background: 'rgba(220,38,38,0.04)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={cancelVoiceNote} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, borderRadius: '50%', display: 'flex' }}>
              <Trash2 style={{ width: 18, height: 18 }} />
            </button>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, flex: 1, fontVariantNumeric: 'tabular-nums' }}>
              Recording… {fmtDuration(recordingTime)}
            </span>
            <button onClick={stopRecording}
              style={{ width: 40, height: 40, borderRadius: '50%', background: '#dc2626', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(220,38,38,0.4)' }}>
              <Square style={{ width: 16, height: 16, fill: '#fff' }} />
            </button>
          </div>
        ) : (
          /* Normal text composer */
          <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '10px 12px', display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <textarea ref={inputRef} value={text} onChange={handleTyping} onKeyDown={handleKey} rows={1}
              placeholder="Type a reply…"
              style={{ flex: 1, resize: 'none', border: '1.5px solid var(--card-border)', borderRadius: 20, padding: '9px 14px', fontSize: 13.5, lineHeight: 1.5, outline: 'none', background: 'var(--surface-100)', color: 'var(--text-primary)', minHeight: 40, maxHeight: 120, overflowY: 'auto' }} />
            {!text.trim() && (
              <button onClick={startRecording} title="Record a voice note"
                style={{ width: 40, height: 40, borderRadius: '50%', background: `${a}15`, border: `1.5px solid ${a}40`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: a, flexShrink: 0, transition: 'all 0.15s' }}>
                <Mic style={{ width: 18, height: 18 }} />
              </button>
            )}
            <button className="send-btn" onClick={handleSend} disabled={posting || !text.trim()} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
              {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        )
      ) : (
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--surface-100)', padding: '10px 16px', flexShrink: 0 }}>
          <p className="text-xs text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {isEnded ? '🔒 This conversation has ended' : 'You cannot post in this conversation'}
          </p>
        </div>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog isOpen={leaveConfirm} onClose={() => setLeaveConfirm(false)} onConfirm={handleLeave} loading={actionLoading}
        title="Leave Group" message="You'll lose access to this conversation, but students will continue chatting." confirmText="Leave Group" variant="danger" />
      <ConfirmDialog isOpen={endConfirm} onClose={() => setEndConfirm(false)} onConfirm={handleEnd} loading={actionLoading}
        title="End Conversation" message="Everyone will lose typing access. This cannot be undone." confirmText="End Conversation" variant="danger" />
    </div>
    </AudioPlaybackProvider>
  );
}

/* ── Invitation row ─────────────────────────────────────────────────────── */
function InvitationRow({ inv, onRespond, responding }) {
  const STATUS_STYLE = {
    pending:  { bg: 'rgba(217,119,6,0.1)',  color: '#d97706', label: 'Pending',  icon: Clock },
    accepted: { bg: 'rgba(5,150,105,0.1)',  color: '#059669', label: 'Accepted', icon: Check },
    denied:   { bg: 'rgba(220,38,38,0.1)',  color: '#dc2626', label: 'Declined', icon: XCircle },
  };
  const s = STATUS_STYLE[inv.status] || STATUS_STYLE.pending;
  const StatusIcon = s.icon;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
        <Mail className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{inv.group_name}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{inv.class_name} · invited by {inv.team_leader_name}</div>
      </div>
      {inv.status === 'pending' ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button disabled={responding} onClick={() => onRespond(inv, 'deny')}
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            style={{ background: 'var(--surface-100)', color: '#dc2626', border: '1px solid var(--card-border)' }}>Decline</button>
          <button disabled={responding} onClick={() => onRespond(inv, 'accept')}
            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>Accept</button>
        </div>
      ) : (
        <span className="text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 flex-shrink-0" style={{ background: s.bg, color: s.color }}>
          <StatusIcon className="w-3 h-3" /> {s.label}
        </span>
      )}
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
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const params = {}; if (filterClass) params.classId = filterClass;
      const res = await api.get('/group-discussions', { params });
      setGroups(res.data.groups || []);
    } catch { toast.error('Failed to load groups'); }
    finally { setLoading(false); }
  }, [filterClass]);

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try { const res = await api.get('/group-discussions/invitations/mine'); setInvitations(res.data.invitations || []); }
    catch { toast.error('Failed to load invitations'); }
    finally { setInvitationsLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);
  useEffect(() => { api.get('/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {}); }, []);

  const pendingInviteCount = invitations.filter(i => i.status === 'pending').length;

  const openGroup = async (g) => {
    setCreateMode(false); setActiveGroup(g);
    if (g.my_invitation_status !== 'accepted') { setGroupDetail(null); return; }
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

  const handleRespond = async (inv, action) => {
    setRespondingId(inv.invitation_id);
    try {
      await api.post(`/group-discussions/invitations/${inv.invitation_id}/respond`, { action });
      toast.success(action === 'accept' ? 'Invitation accepted 🎉' : 'Invitation declined');
      fetchInvitations(); fetchGroups();
      if (activeGroup?.id === inv.group_id) { setActiveGroup(null); setGroupDetail(null); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to respond'); }
    finally { setRespondingId(null); }
  };

  const handleLeft = () => { setActiveGroup(null); setGroupDetail(null); fetchGroups(); };
  const handleEnded = () => { fetchGroups(); };

  let rightPanel = null;
  if (createMode) {
    rightPanel = <CreateGroupPanel onClose={() => setCreateMode(false)} onCreated={() => { setCreateMode(false); fetchGroups(); }} />;
  } else if (activeGroup) {
    if (activeGroup.my_invitation_status !== 'accepted') {
      rightPanel = <LockedGroupPanel g={activeGroup} onClose={() => setActiveGroup(null)} />;
    } else {
      rightPanel = detailLoading || !groupDetail
        ? <div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" /><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p></div></div>
        : <GroupViewer group={groupDetail} myId={myId} onClose={() => { setActiveGroup(null); setGroupDetail(null); }} onMessageSent={fetchGroups} onLeft={handleLeft} onEnded={handleEnded} />;
    }
  }

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 120px)', gap: 12 }}>
      {/* ── Left sidebar ── */}
      <div className={`flex flex-col ${rightPanel ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex-1'}`}
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
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            )}
          </div>
          <p className="text-white/55 text-xs mb-4">Manage student collaboration groups</p>
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
            <button onClick={() => { setTab('groups'); setCreateMode(false); }}
              className="flex-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={tab === 'groups' ? { background: 'white', color: '#4f46e5', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: 'rgba(255,255,255,0.75)' }}>
              My Groups
            </button>
            <button onClick={() => { setTab('invitations'); setActiveGroup(null); setGroupDetail(null); setCreateMode(false); }}
              className="flex-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
              style={tab === 'invitations' ? { background: 'white', color: '#4f46e5', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: 'rgba(255,255,255,0.75)' }}>
              <Inbox className="w-3 h-3" /> Invitations
              {pendingInviteCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#f59e0b', color: 'white' }}>{pendingInviteCount}</span>
              )}
            </button>
          </div>
        </div>

        {tab === 'groups' ? (
          <>
            {/* Class filter */}
            <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
              {[{ id: '', name: 'All' }, ...classes].map(c => (
                <button key={c.id} onClick={() => setFilterClass(c.id)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all"
                  style={filterClass === c.id ? { background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white' } : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin w-7 h-7 rounded-full" style={{ border: '3px solid var(--card-border)', borderTopColor: '#6366f1' }} />
                </div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <Users className="w-8 h-8" style={{ color: '#6366f1', opacity: 0.5 }} />
                  </div>
                  <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No groups yet</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Create a group to let students collaborate.</p>
                  <button onClick={() => setCreateMode(true)}
                    className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white"
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
          <div className="flex-1 overflow-y-auto">
            {invitationsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-7 h-7 rounded-full" style={{ border: '3px solid var(--card-border)', borderTopColor: '#6366f1' }} />
              </div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                  <Inbox className="w-8 h-8" style={{ color: '#6366f1', opacity: 0.5 }} />
                </div>
                <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No invitations</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Group invitations from team leaders appear here.</p>
              </div>
            ) : invitations.map(inv => (
              <InvitationRow key={inv.invitation_id} inv={inv} onRespond={handleRespond} responding={respondingId === inv.invitation_id} />
            ))}
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      {rightPanel ? (
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
          {rightPanel}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center rounded-2xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="text-center px-8">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
              <Users className="w-10 h-10" style={{ color: '#6366f1', opacity: 0.6 }} />
            </div>
            <h3 className="font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>Group Discussions</h3>
            <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {tab === 'groups' ? 'Create groups, assign a team leader, and students bring you into the conversation.' : 'Accept an invitation to join a group conversation.'}
            </p>
            {tab === 'groups' && (
              <button onClick={() => setCreateMode(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition-all"
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