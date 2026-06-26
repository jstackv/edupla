import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import {
  Users, MessageSquare, Send, CheckCheck, X, Crown,
  UserPlus, Mail, Clock, Check, XCircle, StopCircle, WifiOff,
  Mic, Square, Play, Pause, Trash2, Search, Pin, MoreVertical,
  Heart, Smile, Share2, Reply, Eye, AlertCircle, TrendingUp,
} from 'lucide-react';

/* ── Exclusive audio playback context ─────────────────────────────────── */
const AudioPlaybackContext = createContext(null);

function AudioPlaybackProvider({ children }) {
  const registry = useRef(new Set());

  const register = (audioEl) => { registry.current.add(audioEl); };
  const unregister = (audioEl) => { registry.current.delete(audioEl); };
  const stopOthers = (exceptAudioEl) => {
    registry.current.forEach(el => {
      if (el !== exceptAudioEl && !el.paused) {
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

/* ── helper utilities ─────────────────────────────────────────────────── */
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const GROUP_COLORS = [
  ['#10b981','#059669'], ['#6366f1','#4f46e5'], ['#f59e0b','#d97706'],
  ['#ef4444','#dc2626'], ['#8b5cf6','#7c3aed'], ['#06b6d4','#0891b2'],
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

function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/* ── Enhanced Group Card ──────────────────────────────────────────────── */
function GroupCard({ g, onClick, active }) {
  const [a, b] = groupColor(g.id);
  const initials = (g.name || 'G').slice(0, 2).toUpperCase();
  const lastMsg = g.last_message;

  return (
    <div onClick={onClick} 
      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-200 hover:bg-opacity-50"
      style={{
        borderBottom: '1px solid var(--card-border)',
        background: active ? `linear-gradient(135deg, ${a}14, ${b}0a)` : 'transparent',
        borderLeft: active ? `4px solid ${a}` : '4px solid transparent',
      }}>
      {/* Enhanced Avatar with online indicator */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
          style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
          {initials}
        </div>
        {g.member_count > 0 && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md"
            style={{ background: '#10b981', border: '2px solid var(--card-bg)' }}>
            {g.member_count}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
          <span className="text-[10px] flex-shrink-0 font-medium" style={{ color: 'var(--text-secondary)' }}>
            {timeAgo(g.updated_at || g.created_at)}
          </span>
        </div>
        <p className="text-xs truncate mb-2" style={{ color: 'var(--text-secondary)' }}>
          {lastMsg
            ? <><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{lastMsg.author_name}:</span> {lastMsg.message_type === 'voice' ? '🎙️ Voice note' : lastMsg.content}</>
            : <span className="italic opacity-70">No messages yet</span>
          }
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${a}18`, color: a }}>{g.class_name}</span>
          {g.is_team_leader && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
              <Crown className="w-3 h-3" /> Leader
            </span>
          )}
          {g.message_count > 0 && g.message_count > 5 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
              style={{ background: `${a}18`, color: a }}>
              <TrendingUp className="w-3 h-3" /> Active
            </span>
          )}
        </div>
      </div>

      {g.message_count > 0 && (
        <div className="flex-shrink-0 min-w-[24px] h-6 rounded-full text-[11px] font-bold flex items-center justify-center px-2"
          style={{ background: `linear-gradient(135deg, ${a}, ${b})`, color: 'white', boxShadow: `0 2px 8px ${a}40` }}>
          {g.message_count > 99 ? '99+' : g.message_count}
        </div>
      )}
    </div>
  );
}

/* ── Invite Teacher Modal ─────────────────────────────────────────────── */
function InviteTeacherModal({ groupId, onClose, onInvited }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try { 
      const res = await api.get(`/group-discussions/${groupId}/eligible-teachers`); 
      setTeachers(res.data.teachers || []); 
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Failed to load teachers'); 
    } finally { 
      setLoading(false); 
    }
  }, [groupId]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const handleInvite = async (teacherId) => {
    setInviting(teacherId);
    try {
      await api.post(`/group-discussions/${groupId}/invite`, { teacherId });
      toast.success('Invitation sent! 🎉');
      fetchTeachers();
      onInvited && onInvited();
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Failed to send invitation'); 
    } finally { 
      setInviting(null); 
    }
  };

  const STATUS = {
    pending:  { label: 'Pending',  color: '#d97706', bg: 'rgba(217,119,6,0.1)',  icon: Clock },
    accepted: { label: 'Joined',   color: '#10b981', bg: 'rgba(16,185,129,0.1)',  icon: Check },
    denied:   { label: 'Declined', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: XCircle },
    left:     { label: 'Left',     color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: X },
  };

  const filtered = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal isOpen onClose={onClose} title="Invite a Teacher" size="sm">
      <p className="text-xs mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <AlertCircle className="w-4 h-4" style={{ color: '#6366f1' }} />
        As team leader, bring a class teacher into your group's conversation.
      </p>
      
      {teachers.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search teachers…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: 'var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)' }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-secondary)' }}>
          {teachers.length === 0 ? 'No teachers assigned to this class.' : 'No teachers match your search.'}
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.map(t => {
            const s = t.invitation_status ? STATUS[t.invitation_status] : null;
            const StatusIcon = s?.icon;
            return (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-opacity-70"
                style={{ border: '1px solid var(--card-border)', background: 'var(--surface-100)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
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
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0 disabled:opacity-50 flex items-center gap-1.5 transition-all hover:shadow-lg"
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

/* ── Enhanced Voice Bubble with professional styling ──────────────────── */
function VoiceBubble({ url, duration, isMine }) {
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        style={{ display: 'none' }}
      />
      <button onClick={toggle} style={{
        width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        background: isMine ? 'rgba(255,255,255,0.25)' : 'rgba(99,102,241,0.8)',
        boxShadow: isMine ? 'none' : '0 2px 8px rgba(99,102,241,0.3)',
        transition: 'all 0.2s',
      }}>
        {playing ? <Pause style={{ width: 16, height: 16 }} /> : <Play style={{ width: 16, height: 16 }} />}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 4, borderRadius: 3, background: isMine ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: isMine ? 'rgba(255,255,255,0.8)' : '#6366f1', borderRadius: 3, transition: 'width 0.1s linear' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>
          {playing ? fmtDur(currentTime) : fmtDur(totalDuration)}
        </span>
      </div>
      <Mic style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }} />
    </div>
  );
}

/* ── Message Reaction Picker ──────────────────────────────────────────── */
function ReactionPicker({ onSelectReaction, onClose }) {
  const reactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
  return (
    <div className="flex gap-1 p-2 bg-white rounded-full shadow-lg border"
      style={{ borderColor: 'var(--card-border)' }}>
      {reactions.map(r => (
        <button
          key={r}
          onClick={() => { onSelectReaction(r); onClose(); }}
          className="text-lg p-1 rounded-full hover:bg-gray-100 transition-all w-7 h-7 flex items-center justify-center"
        >
          {r}
        </button>
      ))}
    </div>
  );
}

/* ── Message Bubble with Reactions and Context Menu ──────────────────── */
function MessageBubble({ msg, isMine, showAuthor, authorRole }) {
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reactions, setReactions] = useState(msg.reactions || {});
  const menuRef = useRef(null);

  const handleReaction = (emoji) => {
    setReactions(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1
    }));
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }} className="group">
      <div style={{
        display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row',
        alignItems: 'flex-end', gap: 8, position: 'relative',
      }}>
        {/* Avatar */}
        <div style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'flex-end' }}>
          {!isMine && (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: authorRole === 'teacher' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
              {(msg.author_name || '?')[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Message Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '68%', position: 'relative' }}>
          {showAuthor && (
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, marginLeft: isMine ? 0 : 4, color: authorRole === 'teacher' ? '#6366f1' : '#10b981' }}>
              {msg.author_name}{authorRole === 'teacher' ? ' · teacher' : ''}
            </div>
          )}
          
          <div style={{ position: 'relative' }} onMouseEnter={() => !isMine && setShowMenu(true)} onMouseLeave={() => setShowMenu(false)}>
            <div className={isMine ? 'chat-bubble-mine' : 'chat-bubble-other'}
              style={{ 
                padding: msg.message_type === 'voice' ? '8px 12px' : '10px 14px', 
                borderRadius: '16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                position: 'relative',
                transition: 'all 0.2s',
              }}>
              {msg.message_type === 'voice' ? (
                <VoiceBubble url={msg.voice_url} duration={msg.voice_duration} isMine={isMine} />
              ) : (
                <p style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word', margin: 0 }}>{msg.content}</p>
              )}
            </div>

            {/* Message Context Menu */}
            {showMenu && (
              <div ref={menuRef} className="absolute -top-10 right-0 flex gap-1 bg-white rounded-lg shadow-lg p-1 border z-10"
                style={{ borderColor: 'var(--card-border)' }}>
                <button onClick={() => setShowReactions(!showReactions)} className="p-1.5 hover:bg-gray-100 rounded transition-all" title="React">
                  <Smile className="w-4 h-4" style={{ color: '#6366f1' }} />
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded transition-all" title="Reply">
                  <Reply className="w-4 h-4" style={{ color: '#6366f1' }} />
                </button>
              </div>
            )}

            {/* Reaction Picker */}
            {showReactions && (
              <div style={{ position: 'absolute', top: '-50px', right: 0, zIndex: 20 }}>
                <ReactionPicker onSelectReaction={handleReaction} onClose={() => setShowReactions(false)} />
              </div>
            )}
          </div>

          {/* Reactions Display */}
          {Object.keys(reactions).length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              {Object.entries(reactions).map(([emoji, count]) => (
                <div key={emoji} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', fontSize: 12, fontWeight: 600, color: '#6366f1' }}>
                  <span>{emoji}</span>
                  {count > 1 && <span>{count}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Timestamp and Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>
              {formatTime(msg.created_at || Date.now())}
            </span>
            {isMine && <CheckCheck style={{ width: 13, height: 13, opacity: 0.65, color: '#10b981' }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Typing Indicator ──────────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'bounce 1.4s infinite' }} />
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'bounce 1.4s infinite 0.2s' }} />
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'bounce 1.4s infinite 0.4s' }} />
    </div>
  );
}

/* ── Enhanced Group Chat ──────────────────────────────────────────────── */
function GroupChat({ group, myId, myName, onClose, onMessageSent, onGroupChanged }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [messages, setMessages] = useState(group.messages || []);
  const [isEnded, setIsEnded] = useState(group.is_ended || false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState('idle');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typing, setTyping] = useState(false);
  
  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const lastMsgTimeRef = useRef(null);
  const [a, b] = groupColor(group.id);

  useEffect(() => {
    setMessages(group.messages || []);
    setIsEnded(group.is_ended || false);
  }, [group.id]);

  useEffect(() => {
    const msgs = group.messages || [];
    lastMsgTimeRef.current = msgs.length > 0 ? msgs[msgs.length - 1].created_at : null;
  }, [group.id]);

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages.length]);

  // Typing timeout
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setTyping(false), 3000);
    return () => clearTimeout(timer);
  }, [typing]);

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
        if (res.data.is_ended) {
          setIsEnded(true);
          clearInterval(pollRef.current);
          toast('The teacher ended this conversation.', { icon: '🔒' });
        }
        setLiveStatus('idle');
      } catch { 
        setLiveStatus('error'); 
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [group.id, isEnded]);

  const acceptedTeachers = (group.invitations || []).filter(i => i.status === 'accepted');
  const pendingTeachers = (group.invitations || []).filter(i => i.status === 'pending');

  // Build enriched message list with date separators
  const filteredMessages = messages.filter(m =>
    !searchTerm || m.content?.toLowerCase().includes(searchTerm.toLowerCase()) || m.author_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const enriched = [];
  let lastDate = null;
  filteredMessages.forEach((m, i) => {
    const dateLabel = fmtDateSep(m.created_at || Date.now());
    if (dateLabel !== lastDate) { enriched.push({ type: 'date', label: dateLabel, key: `d${i}` }); lastDate = dateLabel; }
    const prev = filteredMessages[i - 1];
    const next = filteredMessages[i + 1];
    const isMine = String(m.author_id) === String(myId);
    enriched.push({
      type: 'msg', ...m, isMine,
      isFirst: !prev || prev.author_name !== m.author_name,
      isLast: !next || next.author_name !== m.author_name,
      key: m.id || `m${i}`,
    });
  });

  const handleTyping = (e) => { 
    setText(e.target.value); 
    setTyping(true);
    e.target.style.height = 'auto'; 
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; 
  };

  const handleSend = async () => {
    if (!text.trim() || posting || isEnded) return;
    const content = text.trim(); 
    setText('');
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
    } finally { 
      setPosting(false); 
      setTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (recording) { stopAndSend(); }
      else if (audioBlob) { sendVoiceNote(); }
      else { handleSend(); }
    }
  };

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
        } finally { 
          setPosting(false); 
        }
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
    } finally { 
      setPosting(false); 
    }
  };

  const fmtDuration = (secs) => {
    const s = Math.round(secs || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <AudioPlaybackProvider>
    <div className="flex flex-col h-full" style={{ background: 'var(--card-bg)' }}>
      {/* ── Enhanced Header ── */}
      <div style={{ background: `linear-gradient(135deg, ${a}ee, ${b}ee)`, borderRadius: '16px 16px 0 0', padding: '14px 16px', flexShrink: 0, backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Group avatar */}
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 15, flexShrink: 0, letterSpacing: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            {(group.name || 'G').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {(group.members || []).length} members
              {acceptedTeachers.length > 0 && ` · ${acceptedTeachers.length} teacher`}
              {liveStatus === 'polling' && ' · syncing'}
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {liveStatus === 'error'
              ? <WifiOff className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
              : !isEnded && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600 }}>Live</span>
                </div>
              )
            }
          </div>

          {/* Action buttons */}
          <button onClick={() => setSearchOpen(!searchOpen)} className="p-2 rounded-lg transition-all hover:bg-white/20"
            style={{ color: 'white', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <Search className="w-4 h-4" />
          </button>

          {group.is_team_leader && !isEnded && (
            <button onClick={() => setInviteOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              <UserPlus className="w-3.5 h-3.5" /> Invite
            </button>
          )}

          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* ── Search Bar ── */}
      {searchOpen && (
        <div className="px-4 py-3 flex-shrink-0 border-b" style={{ borderColor: 'var(--card-border)', background: 'var(--surface-100)' }}>
          <input
            type="text"
            placeholder="Search messages…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
          />
        </div>
      )}

      {/* ── Status strip ── */}
      {isEnded ? (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 flex-shrink-0 bg-gradient-to-r"
          style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid var(--card-border)' }}>
          <StopCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#ef4444' }} />
          <span className="text-xs font-bold" style={{ color: '#ef4444' }}>Teacher ended this conversation</span>
        </div>
      ) : (group.team_leader || pendingTeachers.length > 0) && (
        <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 flex-wrap"
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
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--surface-100)' }}>
        {(group.members || []).map(m => {
          const isMe = m.name === myName;
          return (
            <div key={m.id} className="flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"
              style={{ background: isMe ? `${a}25` : 'rgba(16,185,129,0.12)', color: isMe ? a : '#10b981', border: `1px solid ${a}40 : rgba(16,185,129,0.2)` }}>
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                style={{ background: isMe ? `linear-gradient(135deg, ${a}, ${b})` : 'linear-gradient(135deg, #10b981, #059669)' }}>
                {m.name[0].toUpperCase()}
              </div>
              {m.name}{isMe ? ' (you)' : ''}
              {group.team_leader?.id === m.id && <Crown className="w-3 h-3" style={{ color: '#f59e0b' }} />}
            </div>
          );
        })}
        {acceptedTeachers.map(t => (
          <div key={t.id} className="flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              {t.teacher_name[0].toUpperCase()}
            </div>
            {t.teacher_name} (teacher)
          </div>
        ))}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '16px 14px 8px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0.3))' }}>
        <style>{`
          @keyframes msgInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes msgInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
          .chat-bubble-mine { background: linear-gradient(135deg, #10b981, #059669); color: white; }
          .chat-bubble-other { background: var(--surface-100); color: var(--text-primary); border: 1px solid var(--card-border); }
        `}</style>

        {/* Welcome chip */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <span className="text-xs font-bold px-4 py-2 rounded-full backdrop-blur-sm" 
            style={{ background: `${a}15`, color: a, border: `1px solid ${a}40` }}>
            🤝 Group collaboration space
          </span>
        </div>

        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
            <p className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>Ready to collaborate?</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Start a conversation with your group members</p>
          </div>
        ) : enriched.map(item => item.type === 'date' ? (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 12px', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
            <span className="text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm" 
              style={{ background: `${a}12`, color: a, whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
          </div>
        ) : (
          <div key={item.key} style={{
            display: 'flex', flexDirection: item.isMine ? 'row-reverse' : 'row',
            alignItems: 'flex-end', gap: 8, marginBottom: item.isLast ? 14 : 3,
            animation: `${item.isMine ? 'msgInRight' : 'msgInLeft'} 0.3s ease-out both`,
          }}>
            <MessageBubble msg={item} isMine={item.isMine} showAuthor={item.isFirst} authorRole={item.author_role} />
          </div>
        ))}

        {typing && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, flexShrink: 0 }} />
            <TypingIndicator />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Composer / Ended banner ── */}
      {isEnded ? (
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'rgba(239,68,68,0.04)', padding: '14px 16px', flexShrink: 0, textAlign: 'center' }}>
          <p className="text-xs font-bold flex items-center justify-center gap-2" style={{ color: '#ef4444' }}>
            <StopCircle className="w-3.5 h-3.5" /> This conversation has been closed
          </p>
        </div>
      ) : audioBlob ? (
        /* ── Voice note preview bar ── */
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <audio ref={audioPreviewRef} src={URL.createObjectURL(audioBlob)} style={{ display: 'none' }} />
          <button onClick={cancelVoiceNote} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 6, borderRadius: '50%', display: 'flex', transition: 'all 0.2s' }}>
            <Trash2 style={{ width: 18, height: 18 }} />
          </button>
          <button onClick={toggleAudioPreview}
            style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${a}, ${b})`, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: `0 2px 8px ${a}40` }}>
            {audioPlaying ? <Pause style={{ width: 16, height: 16 }} /> : <Play style={{ width: 16, height: 16 }} />}
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ height: 4, borderRadius: 2, background: `${a}18`, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '100%', background: `linear-gradient(90deg, ${a}, ${b})`, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Voice · {fmtDuration(audioDuration)}</span>
          </div>
          <button className="send-btn" onClick={sendVoiceNote} disabled={posting}
            style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${a}, ${b})`, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: `0 2px 8px ${a}40`, transition: 'all 0.2s' }}>
            {posting
              ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <Send style={{ width: 16, height: 16 }} />}
          </button>
        </div>
      ) : recording ? (
        /* ── Recording in progress bar ── */
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'rgba(239,68,68,0.06)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={cancelVoiceNote} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 6, borderRadius: '50%', display: 'flex' }}>
            <Trash2 style={{ width: 18, height: 18 }} />
          </button>
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 1 }}>
            Recording… {fmtDuration(recordingTime)}
          </span>
          <button onClick={stopRecording}
            style={{ width: 40, height: 40, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: '0 2px 10px rgba(239,68,68,0.4)', transition: 'all 0.2s' }}>
            <Square style={{ width: 16, height: 16, fill: '#fff' }} />
          </button>
        </div>
      ) : (
        /* ── Normal composer ── */
        <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '12px 14px', display: 'flex', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
          <textarea
            ref={inputRef} value={text} onChange={handleTyping} onKeyDown={handleKey} rows={1}
            placeholder="Type a message…"
            style={{ flex: 1, resize: 'none', border: `1.5px solid var(--card-border)`, borderRadius: 22, padding: '10px 16px', fontSize: 14, lineHeight: 1.5, outline: 'none', background: 'var(--surface-100)', color: 'var(--text-primary)', minHeight: 42, maxHeight: 120, overflowY: 'auto', transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: 'inherit' }}
            onFocus={e => { e.target.style.borderColor = a; e.target.style.boxShadow = `0 0 0 3px ${a}22`; }}
            onBlur={e => { e.target.style.borderColor = 'var(--card-border)'; e.target.style.boxShadow = 'none'; }}
          />
          {!text.trim() && (
            <button onClick={startRecording} title="Record a voice note"
              style={{ width: 40, height: 40, borderRadius: '50%', background: `${a}18`, border: `1.5px solid ${a}40`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: a, flexShrink: 0, transition: 'all 0.2s' }}>
              <Mic style={{ width: 18, height: 18 }} />
            </button>
          )}
          <button className="send-btn" onClick={handleSend} disabled={posting || !text.trim()}
            style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${a}, ${b})`, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: `0 2px 8px ${a}40`, transition: 'all 0.2s', opacity: posting || !text.trim() ? 0.6 : 1 }}>
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
    </AudioPlaybackProvider>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function StudentGroups() {
  const { user } = useAuth();
  const myName = user?.name || '';
  const myId = user?.id;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try { 
      const res = await api.get('/group-discussions/my/groups'); 
      setGroups(res.data.groups || []); 
    } catch { 
      toast.error('Failed to load groups'); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openGroup = async (g) => {
    setActiveGroup(g);
    setDetailLoading(true);
    try { 
      const res = await api.get(`/group-discussions/${g.id}`); 
      setGroupDetail(res.data.group); 
    } catch { 
      toast.error('Failed to load group'); 
      setGroupDetail(null); 
    } finally { 
      setDetailLoading(false); 
    }
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
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 120px)', gap: 14, background: 'var(--bg)' }}>
      {/* ── Left sidebar ── */}
      <div className={`flex flex-col ${groupDetail ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex-1'}`}
        style={{ background: 'var(--card-bg)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--card-border)' }}>

        {/* Header */}
        <div className="flex-shrink-0" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', padding: '20px 18px 16px' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-bold text-lg flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="w-4.5 h-4.5" />
              </div>
              My Groups
            </h2>
            <span className="font-semibold text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.95)' }}>
              {groups.length}
            </span>
          </div>
          <p className="text-white/60 text-xs mt-1">Collaborate, learn, grow together</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin w-7 h-7 rounded-full" style={{ border: '3px solid var(--card-border)', borderTopColor: '#10b981' }} />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <Users className="w-8 h-8" style={{ color: '#10b981', opacity: 0.6 }} />
              </div>
              <p className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>No groups yet</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your teacher will add you when collaboration begins</p>
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
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center rounded-2xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="text-center px-8">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <MessageSquare className="w-10 h-10" style={{ color: '#10b981', opacity: 0.7 }} />
            </div>
            <h3 className="font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>Select a group</h3>
            <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Choose a group to start collaborating with classmates in real time
            </p>
          </div>
        </div>
      )}
    </div>
  );
}