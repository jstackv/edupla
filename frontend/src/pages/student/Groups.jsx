import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import {
  Users, MessageSquare, Send, CheckCheck, X, Crown,
  UserPlus, Mail, Clock, Check, XCircle, StopCircle, WifiOff,
  Mic, Square, Play, Pause, Trash2,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────── */
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const GROUP_COLORS = [
  ['#6366f1','#4f46e5'], ['#059669','#0d9488'], ['#d97706','#b45309'],
  ['#dc2626','#b91c1c'], ['#7c3aed','#6d28d9'], ['#0284c7','#0369a1'],
];
function groupColor(id) {
  const idx = id ? parseInt(String(id).slice(-2), 16) % GROUP_COLORS.length : 0;
  return GROUP_COLORS[idx];
}

function fmtDateSep(ts) {
  const d = new Date(ts); const today = new Date(); const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ── Group card ──────────────────────────────────────────────────────── */
function GroupCard({ g, onClick, active }) {
  const [a, b] = groupColor(g.id);
  const initials = (g.name || 'G').slice(0, 2).toUpperCase();
  const lastMsg = g.last_message;

  return (
    <div onClick={onClick} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all"
      style={{
        borderBottom: '1px solid var(--card-border)',
        background: active ? `linear-gradient(135deg, ${a}12, ${b}08)` : 'transparent',
        borderLeft: active ? `3px solid ${a}` : '3px solid transparent',
      }}>
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
          style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
          {initials}
        </div>
        {g.accepted_teacher_count > 0 && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border-2"
            style={{ background: '#6366f1', borderColor: 'var(--card-bg)' }}>
            <span style={{ fontSize: 7, color: 'white', fontWeight: 800 }}>T</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
            {timeAgo(g.updated_at || g.created_at)}
          </span>
        </div>
        <p className="text-xs truncate mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          {lastMsg
            ? <><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{lastMsg.author_name}:</span> {lastMsg.content}</>
            : <span className="italic">No messages yet — say hello!</span>
          }
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${a}18`, color: a }}>{g.class_name}</span>
          <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Users className="w-2.5 h-2.5" /> {g.member_count}
          </span>
          {g.is_team_leader && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
              <Crown className="w-2.5 h-2.5" /> Leader
            </span>
          )}
          {g.accepted_teacher_count > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
              <Check className="w-2.5 h-2.5" /> Teacher in
            </span>
          )}
        </div>
      </div>

      {g.message_count > 0 && (
        <div className="flex-shrink-0 min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1.5"
          style={{ background: `linear-gradient(135deg, ${a}, ${b})`, color: 'white' }}>
          {g.message_count}
        </div>
      )}
    </div>
  );
}

/* ── Invite teacher modal ─────────────────────────────────────────────── */
function InviteTeacherModal({ groupId, onClose, onInvited }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [inviting, setInviting] = useState(null);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get(`/group-discussions/${groupId}/eligible-teachers`); setTeachers(res.data.teachers || []); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to load teachers'); }
    finally { setLoading(false); }
  }, [groupId]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const handleInvite = async (teacherId) => {
    setInviting(teacherId);
    try {
      await api.post(`/group-discussions/${groupId}/invite`, { teacherId });
      toast.success('Invitation sent!');
      fetchTeachers();
      onInvited && onInvited();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send invitation'); }
    finally { setInviting(null); }
  };

  const STATUS = {
    pending:  { label: 'Pending',  color: '#d97706', bg: 'rgba(217,119,6,0.1)',  icon: Clock },
    accepted: { label: 'Joined',   color: '#059669', bg: 'rgba(5,150,105,0.1)',  icon: Check },
    denied:   { label: 'Declined', color: '#dc2626', bg: 'rgba(220,38,38,0.1)',  icon: XCircle },
    left:     { label: 'Left',     color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: X },
  };

  return (
    <Modal isOpen onClose={onClose} title="Invite a Teacher" size="sm">
      <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
        As team leader, you can bring a class teacher into your group's conversation.
      </p>
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : teachers.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-secondary)' }}>No teachers assigned to this class.</p>
      ) : (
        <div className="space-y-2">
          {teachers.map(t => {
            const s = t.invitation_status ? STATUS[t.invitation_status] : null;
            const StatusIcon = s?.icon;
            return (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl transition-all"
                style={{ border: '1px solid var(--card-border)', background: 'var(--surface-100)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                  {t.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{t.email}</div>
                </div>
                {s ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] px-2 py-1 rounded-full font-semibold flex items-center gap-1" style={{ background: s.bg, color: s.color }}>
                      <StatusIcon className="w-3 h-3" /> {s.label}
                    </span>
                    {(t.invitation_status === 'denied' || t.invitation_status === 'left') && (
                      <button disabled={inviting === t.id} onClick={() => handleInvite(t.id)}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 disabled:opacity-50"
                        style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>Resend</button>
                    )}
                  </div>
                ) : (
                  <button disabled={inviting === t.id} onClick={() => handleInvite(t.id)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                    <Mail className="w-3 h-3" /> Invite
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ── Voice note playback bubble ─────────────────────────────────────── */
function VoiceBubble({ url, duration, isMine }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const totalDuration = duration || 0;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
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

/* ── Group chat with real-time polling ───────────────────────────────── */
function GroupChat({ group, myId, myName, onClose, onMessageSent, onGroupChanged }) {
  const [text, setText]         = useState('');
  const [posting, setPosting]   = useState(false);
  const [messages, setMessages] = useState(group.messages || []);
  const [isEnded, setIsEnded]   = useState(group.is_ended || false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState('idle');
  // Voice recording state
  const [recording, setRecording]     = useState(false);  // currently recording
  const [recordingTime, setRecordingTime] = useState(0);  // seconds elapsed
  const [audioBlob, setAudioBlob]     = useState(null);   // recorded blob ready to preview/send
  const [audioDuration, setAudioDuration] = useState(0);  // duration of recorded clip
  const [audioPlaying, setAudioPlaying]   = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const recordTimerRef   = useRef(null);
  const audioPreviewRef  = useRef(null);
  const inputRef       = useRef(null);
  const messagesEndRef = useRef(null);
  const pollRef        = useRef(null);
  const lastMsgTimeRef = useRef(null);
  const [a, b] = groupColor(group.id);

  useEffect(() => {
    setMessages(group.messages || []);
    setIsEnded(group.is_ended || false);
  }, [group.id]);

  // Set initial poll reference time
  useEffect(() => {
    const msgs = group.messages || [];
    lastMsgTimeRef.current = msgs.length > 0 ? msgs[msgs.length - 1].created_at : null;
  }, [group.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Real-time polling every 3 seconds
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
        if (res.data.is_ended) {
          setIsEnded(true);
          clearInterval(pollRef.current);
          toast('The teacher ended this conversation.', { icon: '🔒' });
        }
        setLiveStatus('idle');
      } catch { setLiveStatus('error'); }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [group.id, isEnded]);

  const acceptedTeachers = (group.invitations || []).filter(i => i.status === 'accepted');
  const pendingTeachers  = (group.invitations || []).filter(i => i.status === 'pending');

  // Build enriched message list with date separators and grouping
  const enriched = [];
  let lastDate = null;
  messages.forEach((m, i) => {
    const dateLabel = fmtDateSep(m.created_at || Date.now());
    if (dateLabel !== lastDate) { enriched.push({ type: 'date', label: dateLabel, key: `d${i}` }); lastDate = dateLabel; }
    const prev = messages[i - 1]; const next = messages[i + 1];
    const isMine = String(m.author_id) === String(myId);
    enriched.push({
      type: 'msg', ...m, isMine,
      isFirst: !prev || prev.author_name !== m.author_name,
      isLast:  !next || next.author_name !== m.author_name,
      key: m.id || `m${i}`,
    });
  });

  const handleTyping = (e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; };

  const handleSend = async () => {
    if (!text.trim() || posting || isEnded) return;
    const content = text.trim(); setText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setPosting(true);
    try {
      const res = await api.post(`/group-discussions/${group.id}/messages`, { content });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, newMsg]);
      lastMsgTimeRef.current = newMsg.created_at;
      onMessageSent && onMessageSent(newMsg);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      setText(content);
    } finally { setPosting(false); }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  /* ── Voice recording ── */
  const startRecording = async () => {
    if (isEnded) return;
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

  const cancelVoiceNote = () => {
    if (recording) stopRecording();
    setAudioBlob(null);
    setRecordingTime(0);
    setAudioPlaying(false);
  };

  const toggleAudioPreview = () => {
    if (!audioPreviewRef.current) return;
    if (audioPlaying) {
      audioPreviewRef.current.pause();
      setAudioPlaying(false);
    } else {
      audioPreviewRef.current.play();
      setAudioPlaying(true);
      audioPreviewRef.current.onended = () => setAudioPlaying(false);
    }
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
      setAudioBlob(null);
      setRecordingTime(0);
      setAudioPlaying(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send voice note');
    } finally { setPosting(false); }
  };

  const fmtDuration = (secs) => {
    const s = Math.round(secs || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(135deg, ${a}, ${b})`, borderRadius: '16px 16px 0 0', padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Group avatar */}
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14, flexShrink: 0, letterSpacing: 1 }}>
            {(group.name || 'G').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>
              {group.class_name} · {(group.members || []).length} members
              {acceptedTeachers.length > 0 && ` · ${acceptedTeachers.length} teacher`}
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {liveStatus === 'error'
              ? <WifiOff className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
              : !isEnded && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Live</span>
                </div>
              )
            }
          </div>

          {/* Invite teacher button (team leader only) */}
          {group.is_team_leader && !isEnded && (
            <button onClick={() => setInviteOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              <UserPlus className="w-3.5 h-3.5" /> Invite teacher
            </button>
          )}

          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* ── Status strip ── */}
      {isEnded ? (
        <div className="flex items-center justify-center gap-2 px-4 py-2 flex-shrink-0"
          style={{ background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid var(--card-border)' }}>
          <StopCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#dc2626' }} />
          <span className="text-xs font-bold" style={{ color: '#dc2626' }}>The teacher ended this conversation</span>
        </div>
      ) : (group.team_leader || pendingTeachers.length > 0) && (
        <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0 flex-wrap"
          style={{ background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid var(--card-border)' }}>
          {group.team_leader && (
            <span className="text-xs flex items-center gap-1.5 font-semibold" style={{ color: '#b45309' }}>
              <Crown className="w-3.5 h-3.5" /> Team leader: <strong>{group.team_leader.name}</strong>
            </span>
          )}
          {pendingTeachers.length > 0 && (
            <span className="text-xs flex items-center gap-1.5" style={{ color: '#d97706' }}>
              <Clock className="w-3 h-3" /> Waiting on {pendingTeachers.map(t => t.teacher_name).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* ── Members bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--card-border)' }}>
        {(group.members || []).map(m => {
          const isMe = m.name === myName;
          return (
            <div key={m.id} className="flex items-center gap-1 flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: isMe ? `${a}18` : 'rgba(5,150,105,0.08)', color: isMe ? a : '#059669' }}>
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                style={{ background: isMe ? `linear-gradient(135deg, ${a}, ${b})` : 'linear-gradient(135deg, #059669, #0d9488)' }}>
                {m.name[0].toUpperCase()}
              </div>
              {m.name}{isMe ? ' (you)' : ''}
              {group.team_leader?.id === m.id && <Crown className="w-2.5 h-2.5" style={{ color: '#d97706' }} />}
            </div>
          );
        })}
        {acceptedTeachers.map(t => (
          <div key={t.id} className="flex items-center gap-1 flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(99,102,241,0.09)', color: '#6366f1' }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              {t.teacher_name[0].toUpperCase()}
            </div>
            {t.teacher_name} <span style={{ opacity: 0.6 }}>(teacher)</span>
          </div>
        ))}
      </div>

      {/* ── Messages ── */}
      <div className="chat-wallpaper flex-1 overflow-y-auto" style={{ padding: '16px 14px 8px' }}>
        {/* Welcome chip */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <span className="chat-date-chip">🤝 Your group workspace</span>
        </div>

        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Start the conversation!</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Messages appear here in real time for all group members.</p>
          </div>
        ) : enriched.map(item => item.type === 'date' ? (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
            <span className="chat-date-chip">{item.label}</span>
          </div>
        ) : (
          <div key={item.key} style={{
            display: 'flex', flexDirection: item.isMine ? 'row-reverse' : 'row',
            alignItems: 'flex-end', gap: 8, marginBottom: item.isLast ? 12 : 2,
            animation: item.isMine ? 'msgInRight 0.22s cubic-bezier(0.34,1.4,0.64,1) both' : 'msgInLeft 0.22s cubic-bezier(0.34,1.4,0.64,1) both',
          }}>
            <div style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'flex-end' }}>
              {!item.isMine && item.isLast && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: item.author_role === 'teacher' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #059669, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                  {(item.author_name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: item.isMine ? 'flex-end' : 'flex-start', maxWidth: '68%' }}>
              {!item.isMine && item.isFirst && (
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, marginLeft: 4, color: item.author_role === 'teacher' ? '#6366f1' : '#059669' }}>
                  {item.author_name}{item.author_role === 'teacher' ? ' · teacher' : ''}
                </div>
              )}
              <div className={item.isMine ? 'chat-bubble-mine' : 'chat-bubble-other'}
                style={{ padding: item.message_type === 'voice' ? '8px 12px' : '9px 13px', borderRadius: item.isMine ? (item.isFirst ? '18px 4px 18px 18px' : '18px 4px 4px 18px') : (item.isFirst ? '4px 18px 18px 18px' : '4px 18px 18px 4px') }}>
                {item.message_type === 'voice' ? (
                  <VoiceBubble url={item.voice_url} duration={item.voice_duration} isMine={item.isMine} />
                ) : (
                  <p style={{ fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word', margin: 0 }}>{item.content}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>
                    {new Date(item.created_at || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {item.isMine && <CheckCheck style={{ width: 12, height: 12, opacity: 0.65 }} />}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Composer / Ended banner ── */}
      {isEnded ? (
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'rgba(220,38,38,0.04)', padding: '12px 16px', flexShrink: 0, textAlign: 'center' }}>
          <p className="text-xs font-bold flex items-center justify-center gap-2" style={{ color: '#dc2626' }}>
            <StopCircle className="w-3.5 h-3.5" /> This conversation has been closed by the teacher
          </p>
        </div>
      ) : audioBlob ? (
        /* ── Voice note preview bar ── */
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Hidden audio element for preview playback */}
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
          <button className="send-btn" onClick={sendVoiceNote} disabled={posting}
            style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
            {posting
              ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <Send style={{ width: 16, height: 16 }} />}
          </button>
        </div>
      ) : recording ? (
        /* ── Recording in progress bar ── */
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'rgba(220,38,38,0.04)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={cancelVoiceNote} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, borderRadius: '50%', display: 'flex' }}>
            <Trash2 style={{ width: 18, height: 18 }} />
          </button>
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 1 }}>
            Recording… {fmtDuration(recordingTime)}
          </span>
          <button onClick={stopRecording}
            style={{ width: 40, height: 40, borderRadius: '50%', background: '#dc2626', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(220,38,38,0.4)' }}>
            <Square style={{ width: 16, height: 16, fill: '#fff' }} />
          </button>
        </div>
      ) : (
        /* ── Normal composer ── */
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '10px 12px', display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <textarea
            ref={inputRef} value={text} onChange={handleTyping} onKeyDown={handleKey} rows={1}
            placeholder="Share with your group…"
            style={{ flex: 1, resize: 'none', border: '1.5px solid var(--card-border)', borderRadius: 20, padding: '9px 14px', fontSize: 13.5, lineHeight: 1.5, outline: 'none', background: 'var(--surface-100)', color: 'var(--text-primary)', minHeight: 40, maxHeight: 120, overflowY: 'auto', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onFocus={e => { e.target.style.borderColor = a; e.target.style.boxShadow = `0 0 0 3px ${a}22`; }}
            onBlur={e => { e.target.style.borderColor = 'var(--card-border)'; e.target.style.boxShadow = 'none'; }}
          />
          {!text.trim() && (
            <button onClick={startRecording} title="Record a voice note"
              style={{ width: 40, height: 40, borderRadius: '50%', background: `${a}15`, border: `1.5px solid ${a}40`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: a, flexShrink: 0, transition: 'all 0.15s' }}>
              <Mic style={{ width: 18, height: 18 }} />
            </button>
          )}
          <button className="send-btn" onClick={handleSend} disabled={posting || !text.trim()}
            style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
            {posting
              ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <Send style={{ width: 16, height: 16 }} />}
          </button>
        </div>
      )}

      {inviteOpen && (
        <InviteTeacherModal
          groupId={group.id}
          onClose={() => setInviteOpen(false)}
          onInvited={() => onGroupChanged && onGroupChanged()}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main page
══════════════════════════════════════════════ */
export default function StudentGroups() {
  const { user } = useAuth();
  const myName = user?.name || '';
  const myId   = user?.id;

  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/group-discussions/my/groups'); setGroups(res.data.groups || []); }
    catch { toast.error('Failed to load groups'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openGroup = async (g) => {
    setActiveGroup(g);
    setDetailLoading(true);
    try { const res = await api.get(`/group-discussions/${g.id}`); setGroupDetail(res.data.group); }
    catch { toast.error('Failed to load group'); setGroupDetail(null); }
    finally { setDetailLoading(false); }
  };

  const refreshActiveGroup = useCallback(() => {
    if (!activeGroup) return;
    api.get(`/group-discussions/${activeGroup.id}`)
      .then(res => setGroupDetail(res.data.group))
      .catch(() => {});
  }, [activeGroup]);

  const handleMessageSent = (newMsg) => {
    setGroups(prev => prev.map(g =>
      g.id === activeGroup?.id
        ? { ...g, last_message: newMsg, message_count: g.message_count + 1, updated_at: new Date().toISOString() }
        : g
    ));
  };

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 120px)', gap: 12 }}>
      {/* ── Left sidebar ── */}
      <div className={`flex flex-col ${groupDetail ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex-1'}`}
        style={{ background: 'var(--card-bg)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--card-border)' }}>

        {/* Header */}
        <div className="flex-shrink-0" style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)', padding: '18px 16px 14px' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              My Groups
            </h2>
            <span className="font-semibold text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}>
              {groups.length} group{groups.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-white/55 text-xs mt-1">Collaborate with your classmates</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-7 h-7 rounded-full" style={{ border: '3px solid var(--card-border)', borderTopColor: '#059669' }} />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.08)' }}>
                <Users className="w-8 h-8" style={{ color: '#059669', opacity: 0.5 }} />
              </div>
              <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No groups yet</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your teacher will add you to a group when collaboration begins.</p>
            </div>
          ) : groups.map(g => (
            <GroupCard key={g.id} g={g} onClick={() => openGroup(g)} active={activeGroup?.id === g.id} />
          ))}
        </div>
      </div>

      {/* ── Right: chat panel ── */}
      {groupDetail ? (
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading group…</p>
              </div>
            </div>
          ) : (
            <GroupChat
              group={groupDetail}
              myId={myId}
              myName={myName}
              onClose={() => { setActiveGroup(null); setGroupDetail(null); }}
              onMessageSent={handleMessageSent}
              onGroupChanged={refreshActiveGroup}
            />
          )}
          {/* Mobile back */}
          <button onClick={() => { setActiveGroup(null); setGroupDetail(null); }}
            className="lg:hidden fixed top-4 left-4 z-50 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center rounded-2xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="text-center px-8">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.08)' }}>
              <MessageSquare className="w-10 h-10" style={{ color: '#059669', opacity: 0.6 }} />
            </div>
            <h3 className="font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>Select a group</h3>
            <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Pick a group to start collaborating with your classmates in real time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}