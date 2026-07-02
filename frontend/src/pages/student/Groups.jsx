import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import {
  Users, MessageSquare, Send, CheckCheck, X, Crown,
  Check, StopCircle, WifiOff,
  Mic, Play, Pause, Trash2,
  Radio, Search, MessageCircle, ArrowLeft, ChevronRight, Eye,
} from 'lucide-react';

/* ── Animated modal wrapper (IMPROVED: fixes bottom sticking, better spacing) ─────────────────────────────────────────── */
function ChatModal({ onClose, children, accentFrom = '#6366f1', accentTo = '#4f46e5' }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 280);
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        padding: '32px 20px',
        boxSizing: 'border-box',
        backdropFilter: visible && !closing ? 'blur(14px)' : 'blur(0px)',
        background: visible && !closing ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        transition: 'backdrop-filter 320ms ease, background 320ms ease',
        overflowY: 'auto',
      }}
    >
      {/* Modal sheet — top-aligned with guaranteed breathing room on every side,
          so it never gets clipped when the content is taller than the viewport
          (a plain "align-items:center" + overflow container clips its own top). */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: 'min(90vh, calc(100vh - 64px))',
          borderRadius: '24px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          background: 'var(--card-bg)',
          boxShadow: '0 20px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
          transform: visible && !closing ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(20px)',
          opacity: visible && !closing ? 1 : 0,
          transition: 'transform 280ms cubic-bezier(0.34,1.46,0.64,1), opacity 260ms ease',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--card-border)', opacity: 0.6 }} />
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Peer Chat modal (student-to-student) ──────────────────────────
   Built for speed: unlike the older ChatModal, this uses a single CSS
   keyframe animation (no JS-driven double requestAnimationFrame, no
   animated backdrop-filter, no setTimeout delay on close). This is the
   same lightweight pattern used by ConfirmModal elsewhere in the app,
   which is why that modal always felt instant while this one used to lag.
──────────────────────────────────────────────────────────────────── */
function PeerChatModal({ onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 flex justify-center items-start overflow-y-auto"
      style={{
        zIndex: 300,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: '32px 20px',
        boxSizing: 'border-box',
        animation: 'pcFadeIn 0.15s ease',
      }}
    >
      <style>{`
        @keyframes pcFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pcSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      {/* Always keeps side + top/bottom breathing room and rounded corners,
          on mobile and desktop alike — never goes edge-to-edge full-bleed. */}
      <div
        onClick={e => e.stopPropagation()}
        className="w-full flex flex-col overflow-hidden flex-shrink-0"
        style={{
          maxWidth: 760,
          maxHeight: 'min(88vh, calc(100vh - 64px))',
          borderRadius: 24,
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)',
          animation: 'pcSlideUp 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ height: 4, background: 'linear-gradient(90deg, #6366f1, #4f46e5)', flexShrink: 0 }} />
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Group members modal ─────────────────────────────────────────── */
function MembersModal({ group, onClose }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [a, b] = groupColor(group.id);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 260);
  };

  const members = group.members || [];

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        padding: '32px 20px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        backdropFilter: visible && !closing ? 'blur(16px)' : 'blur(0px)',
        background: visible && !closing ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        transition: 'backdrop-filter 280ms ease, background 280ms ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400,
          flexShrink: 0,
          borderRadius: 24,
          overflow: 'hidden',
          background: 'var(--card-bg)',
          boxShadow: '0 20px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
          transform: visible && !closing ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(20px)',
          opacity: visible && !closing ? 1 : 0,
          transition: 'transform 300ms cubic-bezier(0.34,1.46,0.64,1), opacity 260ms ease',
        }}
      >
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
            <button onClick={handleClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Members list */}
        <div style={{ padding: '14px 16px', maxHeight: '60vh', overflowY: 'auto' }}>
          {members.map((m, i) => {
            const isLeader = group.team_leader?.id === m.id;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 14, marginBottom: 6,
                  background: 'var(--surface-100)',
                  border: isLeader ? `1.5px solid ${a}40` : '1.5px solid transparent',
                  animation: `memberSlideIn 260ms ease both`,
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: isLeader ? `linear-gradient(135deg, ${a}, ${b})` : 'linear-gradient(135deg, #0891b2, #0369a1)',
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

          {/* Teacher */}
          {group.teacher_name && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 14, marginBottom: 6,
              background: 'rgba(99,102,241,0.06)',
              border: '1.5px solid rgba(99,102,241,0.2)',
              animation: `memberSlideIn 260ms ease both`,
              animationDelay: `${members.length * 40}ms`,
            }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                {group.teacher_name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{group.teacher_name}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginTop: 2 }}>Teacher</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>T</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes memberSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Exclusive audio playback context ───────────────────────────────────── */
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

const GROUP_COLORS = [
  ['#6366f1','#4f46e5'], ['#0891b2','#0e7490'], ['#d97706','#b45309'],
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

/* WhatsApp-style: every participant in a group chat gets a consistent,
   distinct name color (hashed from their id/name), so you can tell who's
   who at a glance without re-reading names. */
const SENDER_COLORS = ['#0ea5e9', '#d97706', '#db2777', '#0891b2', '#7c3aed', '#dc2626', '#0284c7', '#475569'];
function senderColor(seed) {
  const s = String(seed || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[hash % SENDER_COLORS.length];
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
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
          style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
          {initials}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border-2"
          style={{ background: '#6366f1', borderColor: 'var(--card-bg)' }} title={`Teacher: ${g.teacher_name || ''}`}>
          <span style={{ fontSize: 7, color: 'white', fontWeight: 800 }}>T</span>
        </div>
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
            ? <><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{lastMsg.author_name}:</span> {lastMsg.message_type === 'voice' ? '🎤 Voice note' : lastMsg.content}</>
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
          {g.teacher_name && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
              <Check className="w-2.5 h-2.5" /> {g.teacher_name}
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

/* ── Team leader <-> teacher private DM modal ──────────────────────────── */
function LeaderTeacherDmModal({ groupId, myId, teacherName, onClose }) {
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
          return toAdd.length ? [...prev, ...toAdd] : prev;
        });
        lastMsgTimeRef.current = fresh[fresh.length - 1].created_at;
      }
    } catch (err) { if (!silent) toast.error(err.response?.data?.message || 'Failed to load DM'); }
    finally { setLoading(false); }
  }, [groupId]);

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

  const displayName = peer?.name || teacherName || 'Teacher';

  return (
    <div className="fixed inset-0 z-[400] flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', paddingTop: '5vh', boxSizing: 'border-box' }}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden shadow-2xl" style={{ maxWidth: 440, maxHeight: 'calc(100vh - 32px)', background: 'var(--card-bg)' }}>
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
            {displayName[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm truncate">{displayName}</div>
            <div className="text-white/60 text-[10px]">Private DM · only you and your teacher can see this</div>
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

        <div className="chat-wallpaper flex-1 overflow-y-auto" style={{ padding: '14px 12px' }}>
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="w-8 h-8 mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Reach out to {displayName} privately — no one else in the group sees this.</p>
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

      {clearConfirm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setClearConfirm(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-xs rounded-2xl p-5" style={{ background: 'var(--card-bg)' }}>
            <h4 className="font-bold text-sm mb-1.5" style={{ color: 'var(--text-primary)' }}>Clear My Messages</h4>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>This deletes every message you've sent in this private DM.</p>
            <div className="flex gap-2">
              <button onClick={() => setClearConfirm(false)} className="flex-1 text-xs font-bold py-2 rounded-lg" style={{ background: 'var(--surface-100)', color: 'var(--text-primary)' }}>Cancel</button>
              <button onClick={handleClear} disabled={clearing} className="flex-1 text-xs font-bold py-2 rounded-lg text-white disabled:opacity-50" style={{ background: '#dc2626' }}>
                {clearing ? 'Clearing…' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Voice note playback bubble ─────────────────────────────────────── */
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
    if (playing) { el.pause(); setPlaying(false); }
    else { ctx?.stopOthers(el); el.play(); setPlaying(true); }
  };

  const fmtDur = (s) => {
    const t = Math.round(s || 0);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  const progress = totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
      <audio ref={audioRef} src={url}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        style={{ display: 'none' }} />
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
        <span style={{ fontSize: 10, opacity: 0.7 }}>{playing ? fmtDur(currentTime) : fmtDur(totalDuration)}</span>
      </div>
      <Mic style={{ width: 13, height: 13, opacity: 0.5, flexShrink: 0 }} />
    </div>
  );
}

/* ── Group chat content (inside modal) ───────────────────────────────── */
function GroupChatContent({ group, myId, myName, onClose, onMessageSent }) {
  const [text, setText]         = useState('');
  const [posting, setPosting]   = useState(false);
  const [messages, setMessages] = useState(group.messages || []);
  const [isEnded, setIsEnded]   = useState(group.is_ended || false);
  const [dmOpen, setDmOpen]     = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [liveStatus, setLiveStatus] = useState('idle');
  const [recording, setRecording]     = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob]     = useState(null);
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
  const [a, b] = groupColor(group.id);

  useEffect(() => { setMessages(group.messages || []); setIsEnded(group.is_ended || false); }, [group.id]);

  useEffect(() => {
    const msgs = group.messages || [];
    lastMsgTimeRef.current = msgs.length > 0 ? msgs[msgs.length - 1].created_at : null;
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

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (recording) { stopAndSend(); }
      else if (audioBlob) { sendVoiceNote(); }
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
    setClearing(true);
    try {
      await api.delete(`/group-discussions/${group.id}/messages`);
      setMessages(prev => prev.filter(m => String(m.author_id) !== String(myId)));
      toast.success('Your messages were cleared');
      setClearConfirm(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to clear messages'); }
    finally { setClearing(false); }
  };

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
        setAudioBlob(blob); setAudioDuration(recordingTime);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true); setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { toast.error('Microphone access denied. Please allow mic permission.'); }
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
      setRecording(false); setAudioBlob(null);
      (async () => {
        setPosting(true);
        try {
          const formData = new FormData();
          const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
          formData.append('audio', blob, `voice-note-${Date.now()}.${ext}`);
          formData.append('duration', String(duration));
          const res = await api.post(`/group-discussions/${group.id}/voice-notes`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          const newMsg = res.data.msg;
          setMessages(prev => [...prev, newMsg]);
          lastMsgTimeRef.current = newMsg.created_at;
          onMessageSent && onMessageSent(newMsg);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to send voice note'); }
        finally { setPosting(false); }
      })();
    };
    mediaRecorderRef.current.stop();
  };

  const cancelVoiceNote = () => {
    if (recording) stopRecording();
    setAudioBlob(null); setRecordingTime(0); setAudioPlaying(false);
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
      const res = await api.post(`/group-discussions/${group.id}/voice-notes`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, newMsg]);
      lastMsgTimeRef.current = newMsg.created_at;
      onMessageSent && onMessageSent(newMsg);
      setAudioBlob(null); setRecordingTime(0); setAudioPlaying(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send voice note'); }
    finally { setPosting(false); }
  };

  const fmtDuration = (secs) => {
    const s = Math.round(secs || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <AudioPlaybackProvider>
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${a}, ${b})`, padding: '14px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14, flexShrink: 0 }}>
              {(group.name || 'G').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>{group.class_name}</div>
            </div>
            {/* Members pill button */}
            <button
              onClick={() => setMembersOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)',
                color: '#fff', borderRadius: 20, padding: '5px 11px',
                cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}
            >
              <Users style={{ width: 13, height: 13 }} />
              {(group.members || []).length}
              <Eye style={{ width: 11, height: 11, opacity: 0.8 }} />
            </button>
            {liveStatus === 'error'
              ? <WifiOff style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
              : !isEnded && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', animation: 'pulse 1.5s infinite' }} />
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }}>Live</span>
                </div>
              )
            }
            {group.is_team_leader && (
              <button onClick={() => setDmOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: 20, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                <MessageCircle style={{ width: 13, height: 13 }} /> Teacher
              </button>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Status bar */}
        {isEnded ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 16px', background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
            <StopCircle style={{ width: 13, height: 13, color: '#dc2626' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>The teacher ended this conversation</span>
          </div>
        ) : group.team_leader ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 14px', background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
            <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: '#b45309' }}>
              <Crown style={{ width: 13, height: 13, color: '#d97706' }} /> Team leader: <strong>{group.team_leader.name}</strong>
            </span>
            {!isEnded && (
              <button onClick={() => setClearConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 20 }}>
                <Trash2 style={{ width: 10, height: 10 }} /> Clear mine
              </button>
            )}
          </div>
        ) : !isEnded ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 14px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
            <button onClick={() => setClearConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Trash2 style={{ width: 10, height: 10 }} /> Clear mine
            </button>
          </div>
        ) : null}

        {/* Messages */}
        <div className="chat-wallpaper flex-1 overflow-y-auto" style={{ padding: '16px 14px 8px' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>👋</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No messages yet</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Be the first to say something!</p>
            </div>
          ) : enriched.map(item => {
            if (item.type === 'date') return (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
                <span style={{ fontSize: 10, fontWeight: 600, padding: '0 8px', color: 'var(--text-secondary)' }}>{item.label}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
              </div>
            );
            const isTeacherMsg = item.author_role === 'teacher';
            const bubbleBg = item.isMine
              ? `linear-gradient(135deg, ${a}, ${b})`
              : isTeacherMsg ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
              : 'var(--surface-100)';
            const bubbleColor = item.isMine || isTeacherMsg ? '#fff' : 'var(--text-primary)';
            return (
              <div key={item.key} className="group" style={{ display: 'flex', marginBottom: 4, alignItems: 'center', gap: 6, justifyContent: item.isMine ? 'flex-end' : 'flex-start' }}>
                {item.isMine && (
                  <button onClick={() => handleDeleteMessage(item.id || item._id)} disabled={deletingId === (item.id || item._id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                )}
                <div style={{ maxWidth: '72%' }}>
                  {item.isFirst && !item.isMine && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isTeacherMsg ? '#7c3aed' : senderColor(item.author_id || item.author_name) }}>{item.author_name}</span>
                      {isTeacherMsg && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700, background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>Teacher</span>}
                    </div>
                  )}
                  <div style={{ background: bubbleBg, color: bubbleColor, padding: '9px 13px', borderRadius: item.isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    {item.message_type === 'voice'
                      ? <VoiceBubble url={item.voice_url} duration={item.voice_duration} isMine={item.isMine} />
                      : item.content}
                  </div>
                  {item.isLast && (
                    <div style={{ fontSize: 10, marginTop: 3, textAlign: item.isMine ? 'right' : 'left', paddingLeft: item.isMine ? 0 : 4, paddingRight: item.isMine ? 4 : 0, color: 'var(--text-secondary)', opacity: 0.6 }}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {!isEnded ? (
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
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, borderTop: '1px solid var(--card-border)', padding: '10px 14px', background: 'var(--card-bg)', flexShrink: 0 }}>
              <textarea ref={inputRef} value={text} onChange={handleTyping} onKeyDown={handleKey} rows={1}
                placeholder="Type a message…"
                style={{ flex: 1, resize: 'none', border: '1.5px solid var(--card-border)', borderRadius: 20, padding: '9px 14px', fontSize: 13.5, lineHeight: 1.5, outline: 'none', background: 'var(--surface-100)', color: 'var(--text-primary)', minHeight: 40, maxHeight: 120, overflowY: 'auto' }}
                onFocus={e => { e.target.style.borderColor = a; e.target.style.boxShadow = `0 0 0 3px ${a}22`; }}
                onBlur={e => { e.target.style.borderColor = 'var(--card-border)'; e.target.style.boxShadow = 'none'; }}
              />
              {!text.trim() && (
                <button onClick={startRecording} style={{ width: 40, height: 40, borderRadius: '50%', background: `${a}15`, border: `1.5px solid ${a}40`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: a, flexShrink: 0 }}>
                  <Mic style={{ width: 18, height: 18 }} />
                </button>
              )}
              <button onClick={handleSend} disabled={posting || !text.trim()}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: text.trim() ? `linear-gradient(135deg, ${a}, ${b})` : 'var(--surface-100)', color: text.trim() ? '#fff' : 'var(--text-secondary)', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          )
        ) : (
          <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--surface-100)', padding: '10px 16px', flexShrink: 0 }}>
            <p style={{ fontSize: 12, textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>🔒 This conversation has ended</p>
          </div>
        )}

        {dmOpen && <LeaderTeacherDmModal groupId={group.id} myId={myId} teacherName={group.teacher_name} onClose={() => setDmOpen(false)} />}
        {membersOpen && <MembersModal group={group} onClose={() => setMembersOpen(false)} />}

        {clearConfirm && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setClearConfirm(false)}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-xs rounded-2xl p-5" style={{ background: 'var(--card-bg)' }}>
              <h4 className="font-bold text-sm mb-1.5" style={{ color: 'var(--text-primary)' }}>Clear My Messages</h4>
              <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>This deletes every message you've sent in this group. Other members' messages stay.</p>
              <div className="flex gap-2">
                <button onClick={() => setClearConfirm(false)} className="flex-1 text-xs font-bold py-2 rounded-lg" style={{ background: 'var(--surface-100)', color: 'var(--text-primary)' }}>Cancel</button>
                <button onClick={handleClearMyMessages} disabled={clearing} className="flex-1 text-xs font-bold py-2 rounded-lg text-white disabled:opacity-50" style={{ background: '#dc2626' }}>
                  {clearing ? 'Clearing…' : 'Clear'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AudioPlaybackProvider>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   OPEN COLLABORATION — Peer DM feature (IMPROVED)
══════════════════════════════════════════════════════════════════════════ */

function PeerList({ classId, onSelectPeer, activePeerId }) {
  const [classmates, setClassmates] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [cm, cv] = await Promise.all([
        api.get(`/collaborations/class/${classId}/students`),
        api.get(`/collaborations/class/${classId}/conversations`),
      ]);
      setClassmates(cm.data.classmates || []);
      setConversations(cv.data.conversations || []);
    } catch { } finally { setLoading(false); }
  }, [classId]);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchData]);

  const convMap = {};
  conversations.forEach(c => { convMap[String(c.peer_id)] = c; });

  const filtered = classmates
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter(c => (filter === 'unread' ? (convMap[String(c.id)]?.unread_count || 0) > 0 : true));

  // Sort: unread conversations first, then most-recently-active conversations,
  // then classmates with no conversation yet (alphabetically).
  const sorted = [...filtered].sort((a, b) => {
    const aConv = convMap[String(a.id)];
    const bConv = convMap[String(b.id)];
    const aUnread = aConv?.unread_count || 0;
    const bUnread = bConv?.unread_count || 0;
    if (bUnread !== aUnread) return bUnread - aUnread;
    const aTime = aConv?.last_at ? new Date(aConv.last_at).getTime() : 0;
    const bTime = bConv?.last_at ? new Date(bConv.last_at).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.name.localeCompare(b.name);
  });

  // Calculate total unread messages
  const totalUnread = Object.values(convMap).reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="relative mb-2.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classmates…"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')}
            className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
            style={filter === 'all'
              ? { background: 'rgba(99,102,241,0.14)', color: '#6366f1' }
              : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
            All
          </button>
          <button onClick={() => setFilter('unread')}
            className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            style={filter === 'unread'
              ? { background: 'rgba(99,102,241,0.14)', color: '#6366f1' }
              : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
            Unread
            {totalUnread > 0 && (
              <span className="text-[10px] font-bold px-1.5 rounded-full text-white" style={{ background: '#6366f1' }}>{totalUnread}</span>
            )}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Users className="w-10 h-10 mb-3" style={{ color: '#6366f1', opacity: 0.4 }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{filter === 'unread' ? 'No unread chats' : 'No classmates found'}</p>
          </div>
        ) : sorted.map(peer => {
          const conv = convMap[String(peer.id)];
          const isActive = String(peer.id) === String(activePeerId);
          const unreadCount = conv?.unread_count || 0;
          return (
            <div key={peer.id} onClick={() => onSelectPeer(peer)}
              className="flex items-center gap-3 px-4 py-3 sm:py-3.5 cursor-pointer transition-colors active:bg-black/5"
              style={{ borderBottom: '1px solid var(--card-border)', background: isActive ? 'rgba(99,102,241,0.07)' : 'transparent', borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent' }}>
              <div className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                {peer.name[0].toUpperCase()}
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: '#dc2626' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{peer.name}</div>
                {conv && <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{conv.last_message}</div>}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {conv && <span className="text-[10px]" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>{timeAgo(conv.last_at)}</span>}
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* DM Chat content (inside modal) */
function DMChatContent({ classId, peer, myId, onBack, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [recording, setRecording]         = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob]         = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying]   = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const recordTimerRef   = useRef(null);
  const audioPreviewRef  = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);
  const lastMsgTimeRef = useRef(null);

  const fetchMessages = useCallback(async (since = null) => {
    try {
      const params = since ? { since } : {};
      const res = await api.get(`/collaborations/class/${classId}/messages/${peer.id}`, { params });
      const newMsgs = res.data.messages || [];
      if (since) {
        if (newMsgs.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => String(m.id)));
            const fresh = newMsgs.filter(m => !existingIds.has(String(m.id)));
            if (fresh.length === 0) return prev;
            lastMsgTimeRef.current = fresh[fresh.length - 1].created_at;
            return [...prev, ...fresh];
          });
        }
      } else {
        setMessages(newMsgs);
        if (newMsgs.length > 0) lastMsgTimeRef.current = newMsgs[newMsgs.length - 1].created_at;
      }
    } catch (err) { if (!since) toast.error('Failed to load messages'); }
    finally { setLoading(false); }
  }, [classId, peer.id]);

  useEffect(() => {
    setMessages([]); setLoading(true); lastMsgTimeRef.current = null;
    fetchMessages();
  }, [peer.id]);

  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(lastMsgTimeRef.current), 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  useEffect(() => {
    if (!audioBlob && !recording) return;
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (recording) stopAndSend(); else if (audioBlob) sendVoiceNote(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [audioBlob, recording, posting]);

  const handleSend = async () => {
    if (!text.trim() || posting) return;
    const content = text.trim(); setText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setPosting(true);
    try {
      const res = await api.post(`/collaborations/class/${classId}/messages`, { receiverId: peer.id, content });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, { ...newMsg, sender_name: 'You' }]);
      lastMsgTimeRef.current = newMsg.created_at;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); setText(content); }
    finally { setPosting(false); }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (recording) stopAndSend(); else if (audioBlob) sendVoiceNote(); else handleSend(); }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    setDeletingId(messageId);
    try {
      await api.delete(`/collaborations/class/${classId}/messages/${messageId}`);
      setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete message'); }
    finally { setDeletingId(null); }
  };

  const handleClearChat = async () => {
    setClearing(true);
    try {
      await api.delete(`/collaborations/class/${classId}/messages/peer/${peer.id}`);
      setMessages(prev => prev.filter(m => String(m.sender_id) !== String(myId)));
      toast.success('Your messages were cleared'); setClearConfirm(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to clear messages'); }
    finally { setClearing(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => { const blob = new Blob(audioChunksRef.current, { type: mimeType }); setAudioBlob(blob); setAudioDuration(recordingTime); stream.getTracks().forEach(t => t.stop()); };
      recorder.start(); mediaRecorderRef.current = recorder; setRecording(true); setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { toast.error('Microphone access denied.'); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && recording) { mediaRecorderRef.current.stop(); clearInterval(recordTimerRef.current); setRecording(false); } };

  const postVoiceBlob = async (blob, duration) => {
    setPosting(true);
    try {
      const formData = new FormData();
      const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
      formData.append('audio', blob, `voice-note-${Date.now()}.${ext}`);
      formData.append('duration', String(duration));
      formData.append('receiverId', peer.id);
      const res = await api.post(`/collaborations/class/${classId}/voice-notes`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, { ...newMsg, sender_name: 'You' }]);
      lastMsgTimeRef.current = newMsg.created_at;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send voice note'); }
    finally { setPosting(false); }
  };

  const stopAndSend = () => {
    if (!mediaRecorderRef.current || !recording) return;
    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const duration = recordingTime;
      clearInterval(recordTimerRef.current); setRecording(false); setAudioBlob(null);
      postVoiceBlob(blob, duration);
    };
    mediaRecorderRef.current.stop();
  };

  const cancelVoiceNote = () => { if (recording) stopRecording(); setAudioBlob(null); setRecordingTime(0); setAudioPlaying(false); };
  const toggleAudioPreview = () => {
    if (!audioPreviewRef.current) return;
    if (audioPlaying) { audioPreviewRef.current.pause(); setAudioPlaying(false); }
    else { audioPreviewRef.current.play(); setAudioPlaying(true); audioPreviewRef.current.onended = () => setAudioPlaying(false); }
  };
  const sendVoiceNote = async () => {
    if (!audioBlob || posting) return;
    const blob = audioBlob; const duration = audioDuration;
    setAudioBlob(null); setRecordingTime(0); setAudioPlaying(false);
    await postVoiceBlob(blob, duration);
  };
  const fmtDuration = (secs) => { const s = Math.round(secs || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  const enriched = [];
  let lastDate = null;
  messages.forEach((m, i) => {
    const dateLabel = fmtDateSep(m.created_at);
    if (dateLabel !== lastDate) { enriched.push({ type: 'date', label: dateLabel, key: `d${i}` }); lastDate = dateLabel; }
    const isMine = String(m.sender_id) === String(myId);
    enriched.push({ type: 'msg', ...m, isMine, key: m.id || `m${i}` });
  });

  return (
    <AudioPlaybackProvider>
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', padding: '14px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowLeft style={{ width: 14, height: 14 }} />
            </button>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
              {peer.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{peer.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10 }}>Private · only you two can see this</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a5b4fc', animation: 'pulse 1.5s infinite' }} />
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }} className="hidden sm:inline">Live</span>
              </div>
              {onClose && (
                <button onClick={onClose} title="Close" style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Privacy + clear */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 14px', background: 'rgba(99,102,241,0.05)', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          {/* <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6366f1' }}>Private chat with {peer.name}</span> */}
          <button onClick={() => setClearConfirm(true)} className="hover:opacity-70 transition-opacity" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px' }}>
            <Trash2 style={{ width: 11, height: 11 }} /> Clear my messages
          </button>
        </div>

        {/* Messages */}
        <div className="chat-wallpaper flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ padding: '16px 14px 8px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{ width: 28, height: 28, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : enriched.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Start talking to {peer.name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Your messages are private</p>
            </div>
          ) : enriched.map(item => {
            if (item.type === 'date') return (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
                <span style={{ fontSize: 10, fontWeight: 600, padding: '0 8px', color: 'var(--text-secondary)' }}>{item.label}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
              </div>
            );
            return (
              <div key={item.key} className="group" style={{ display: 'flex', marginBottom: 6, alignItems: 'center', gap: 6, justifyContent: item.isMine ? 'flex-end' : 'flex-start' }}>
                {item.isMine && (
                  <button onClick={() => handleDeleteMessage(item.id)} disabled={deletingId === item.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                )}
                <div style={{ maxWidth: '72%' }}>
                  <div style={{ background: item.isMine ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'var(--surface-100)', color: item.isMine ? '#fff' : 'var(--text-primary)', padding: '9px 13px', borderRadius: item.isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    {item.message_type === 'voice'
                      ? <VoiceBubble url={item.voice_url} duration={item.voice_duration} isMine={item.isMine} />
                      : item.content}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 3, textAlign: item.isMine ? 'right' : 'left', paddingLeft: item.isMine ? 0 : 4, paddingRight: item.isMine ? 4 : 0, color: 'var(--text-secondary)', opacity: 0.6 }}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {item.isMine && item.read && <CheckCheck style={{ display: 'inline', width: 12, height: 12, marginLeft: 4, color: '#6366f1' }} />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {recording ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--card-border)', padding: '10px 14px', background: 'var(--card-bg)', flexShrink: 0 }}>
            <button onClick={cancelVoiceNote} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X style={{ width: 16, height: 16 }} /></button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-100)', borderRadius: 20, padding: '8px 14px', border: '1.5px solid #dc262630' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>Recording… {fmtDuration(recordingTime)}</span>
            </div>
            <button onClick={stopAndSend} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Send style={{ width: 16, height: 16 }} /></button>
          </div>
        ) : audioBlob ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--card-border)', padding: '10px 14px', background: 'var(--card-bg)', flexShrink: 0 }}>
            <button onClick={cancelVoiceNote} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Trash2 style={{ width: 16, height: 16 }} /></button>
            <audio ref={audioPreviewRef} src={URL.createObjectURL(audioBlob)} style={{ display: 'none' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-100)', borderRadius: 20, padding: '8px 14px', border: '1.5px solid #6366f140' }}>
              <button onClick={toggleAudioPreview} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#6366f120', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                {audioPlaying ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}
              </button>
              <Mic style={{ width: 13, height: 13, color: '#6366f1', opacity: 0.7 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Voice note · {fmtDuration(audioDuration)}</span>
            </div>
            <button onClick={sendVoiceNote} disabled={posting} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: posting ? 0.6 : 1 }}>
              {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, borderTop: '1px solid var(--card-border)', padding: '10px 14px', background: 'var(--card-bg)', flexShrink: 0 }}>
            <textarea ref={inputRef} value={text} onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
              onKeyDown={handleKey} rows={1}
              placeholder={`Message ${peer.name}…`}
              style={{ flex: 1, resize: 'none', border: '1.5px solid var(--card-border)', borderRadius: 20, padding: '9px 14px', fontSize: 13.5, lineHeight: 1.5, outline: 'none', background: 'var(--surface-100)', color: 'var(--text-primary)', minHeight: 40, maxHeight: 120, overflowY: 'auto' }}
              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--card-border)'; e.target.style.boxShadow = 'none'; }}
            />
            {!text.trim() && (
              <button onClick={startRecording} style={{ width: 40, height: 40, borderRadius: '50%', background: '#6366f115', border: '1.5px solid #6366f140', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0 }}>
                <Mic style={{ width: 18, height: 18 }} />
              </button>
            )}
            <button onClick={handleSend} disabled={posting || !text.trim()}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: text.trim() ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'var(--surface-100)', color: text.trim() ? '#fff' : 'var(--text-secondary)', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        )}

        <ConfirmModal
          open={clearConfirm}
          onClose={() => setClearConfirm(false)}
          onConfirm={handleClearChat}
          loading={clearing}
          variant="danger"
          title="Clear my messages"
          message={`This deletes every message you've sent to ${peer.name}. Their messages stay.`}
          confirmText="Clear"
          cancelText="Cancel"
        />
      </div>
    </AudioPlaybackProvider>
  );
}

/* Collaboration panel (IMPROVED) */
function CollaborationPanel({ myId, onClose }) {
  const [myClasses, setMyClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activePeer, setActivePeer] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    api.get('/collaborations/my-class-status')
      .then(res => {
        const active = (res.data.classes || []).filter(c => c.collaboration_active);
        setMyClasses(active);
        if (active.length === 1) setSelectedClass(active[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const CloseBtn = ({ light }) => (
    <button onClick={onClose} title="Close" className="flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
      style={{
        width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: light ? 'rgba(255,255,255,0.15)' : 'var(--surface-100)',
        color: light ? '#fff' : 'var(--text-secondary)',
      }}>
      <X style={{ width: 14, height: 14 }} />
    </button>
  );

  if (loading) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-3 flex-shrink-0">
        <CloseBtn />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full" style={{ border: '3px solid var(--card-border)', borderTopColor: '#6366f1' }} />
      </div>
    </div>
  );

  if (myClasses.length === 0) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-3 flex-shrink-0">
        <CloseBtn />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-8 text-center">
        <div className="w-20 h-20 rounded-2xl mb-5 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
          <Radio className="w-10 h-10" style={{ color: '#6366f1', opacity: 0.5 }} />
        </div>
        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>No active collaboration</h3>
        <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>Your teacher will open collaboration when you can privately message classmates.</p>
      </div>
    </div>
  );

  if (!selectedClass) return (
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-5 py-4 sm:py-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Peer Chat</h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Choose a class to start chatting</p>
          </div>
          <CloseBtn />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2">
        {myClasses.map(cls => (
          <button key={cls.id} onClick={() => setSelectedClass(cls)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-colors active:bg-black/5"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              {(cls.name || 'C').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{cls.name}</div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: '#6366f1' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse inline-block" /> Collaboration is live
              </span>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col lg:flex-row min-h-0">
      {/* Peer list - hidden on mobile when chat is open */}
      <div className={`flex flex-col flex-shrink-0 w-full lg:w-80 min-h-0 ${activePeer ? 'hidden lg:flex' : 'flex'}`}
        style={{ borderRight: activePeer ? '1px solid var(--card-border)' : 'none' }}>
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          {myClasses.length > 1 && (
            <button onClick={() => { setSelectedClass(null); setActivePeer(null); }}
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <ArrowLeft style={{ width: 13, height: 13 }} />
            </button>
          )}
          <Radio className="w-4 h-4 text-white flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedClass.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse inline-block" /> Collaboration is live
            </div>
          </div>
          {totalUnread > 0 && (
            <div style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: '#dc2626', color: 'white', flexShrink: 0 }}>
              {totalUnread}
            </div>
          )}
          <CloseBtn light />
        </div>
        <PeerList classId={selectedClass.id} onSelectPeer={setActivePeer} activePeerId={activePeer?.id} />
      </div>

      {/* Chat view - shows on mobile when peer is selected */}
      {activePeer ? (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 w-full lg:w-auto">
          <DMChatContent classId={selectedClass.id} peer={activePeer} myId={myId} onBack={() => setActivePeer(null)} onClose={onClose} />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 flex-col min-h-0" style={{ background: 'var(--card-bg)' }}>
          <div className="flex items-center justify-end px-4 py-3 flex-shrink-0">
            <CloseBtn />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-8">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                <MessageCircle className="w-8 h-8" style={{ color: '#6366f1', opacity: 0.6 }} />
              </div>
              <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Select a classmate</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pick someone from the list to start a private chat</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main page (IMPROVED: space efficiency)
══════════════════════════════════════════════ */
export default function StudentGroups() {
  const { user } = useAuth();
  const myName = user?.name || '';
  const myId   = user?.id;

  const [tab, setTab] = useState('groups');
  const [groups, setGroups]           = useState([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all'); // 'all' | 'leading'
  const [loading, setLoading]         = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Collaboration modal state
  const [collabModalOpen, setCollabModalOpen] = useState(false);

  // Active collab badge
  const [activeCollabCount, setActiveCollabCount] = useState(0);

  // Group chat modal
  const [groupChatOpen, setGroupChatOpen] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/group-discussions/my/groups'); setGroups(res.data.groups || []); }
    catch { toast.error('Failed to load groups'); }
    finally { setLoading(false); }
  }, []);

  const fetchCollabStatus = useCallback(async () => {
    try {
      const res = await api.get('/collaborations/my-class-status');
      const active = (res.data.classes || []).filter(c => c.collaboration_active);
      setActiveCollabCount(active.length);
    } catch { }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => { fetchCollabStatus(); const t = setInterval(fetchCollabStatus, 15000); return () => clearInterval(t); }, [fetchCollabStatus]);

  const openGroup = async (g) => {
    setActiveGroup(g);
    setDetailLoading(true);
    try {
      const res = await api.get(`/group-discussions/${g.id}`);
      setGroupDetail(res.data.group);
      setGroupChatOpen(true);
    }
    catch { toast.error('Failed to load group'); setGroupDetail(null); }
    finally { setDetailLoading(false); }
  };

  const closeGroupChat = () => {
    setGroupChatOpen(false);
    setTimeout(() => { setActiveGroup(null); setGroupDetail(null); }, 300);
  };

  const handleMessageSent = (newMsg) => {
    setGroups(prev => prev.map(g =>
      g.id === activeGroup?.id
        ? { ...g, last_message: newMsg, message_count: g.message_count + 1, updated_at: new Date().toISOString() }
        : g
    ));
  };

  const switchTab = (t) => { setTab(t); };

  const filteredGroups = groups
    .filter(g => (groupFilter === 'leading' ? g.is_team_leader : true))
    .filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
    .sort((a, b) => {
      // Groups with unread activity (or any recent activity) float to the top.
      const aTime = new Date(a.updated_at || a.last_message?.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.last_message?.created_at || 0).getTime();
      return bTime - aTime;
    });

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', padding: '16px' }}>
      {/* ── Main card (IMPROVED: responsive width, better space usage) ── */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--card-border)', maxWidth: '100%', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0369a1 100%)', padding: '18px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users style={{ width: 16, height: 16, color: '#fff' }} />
              </div>
              Discussions
            </h2>
            <span style={{ fontWeight: 700, fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}>
              {groups.length} group{groups.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 14 }}>Collaborate with your classmates</p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'rgba(0,0,0,0.15)', marginBottom: 0 }}>
            <button onClick={() => switchTab('groups')}
              style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.15s', ...(tab === 'groups' ? { background: '#fff', color: '#0891b2', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' } : { background: 'transparent', color: 'rgba(255,255,255,0.75)' }) }}>
              My Groups
            </button>
            <button onClick={() => { switchTab('collab'); setCollabModalOpen(true); }}
              style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, ...(tab === 'collab' ? { background: '#fff', color: '#6366f1', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' } : { background: 'transparent', color: 'rgba(255,255,255,0.75)' }) }}>
              <Radio style={{ width: 12, height: 12 }} /> Peer Chat
              {activeCollabCount > 0 && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 20, background: '#6366f1', color: 'white' }}>
                  {activeCollabCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search + filter pills (WhatsApp-style) */}
        {tab === 'groups' && (
          <div className="px-3 sm:px-4 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div className="relative mb-2.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
              <input value={groupSearch} onChange={e => setGroupSearch(e.target.value)} placeholder="Search groups…"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setGroupFilter('all')}
                className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                style={groupFilter === 'all'
                  ? { background: 'rgba(8,145,178,0.14)', color: '#0891b2' }
                  : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                All
              </button>
              <button onClick={() => setGroupFilter('leading')}
                className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                style={groupFilter === 'leading'
                  ? { background: 'rgba(8,145,178,0.14)', color: '#0891b2' }
                  : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                <Crown className="w-2.5 h-2.5" /> Leading
              </button>
            </div>
          </div>
        )}

        {/* Groups list */}
        <div style={{ minHeight: 300, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--card-border)', borderTopColor: '#0891b2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : groups.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,145,178,0.08)' }}>
                <Users style={{ width: 32, height: 32, color: '#0891b2', opacity: 0.5 }} />
              </div>
              <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>No groups yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your teacher will add you to a group when collaboration begins.</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
              <Search style={{ width: 28, height: 28, color: 'var(--text-secondary)', opacity: 0.4, marginBottom: 10 }} />
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>No groups match</p>
            </div>
          ) : filteredGroups.map(g => (
            <GroupCard key={g.id} g={g} onClick={() => openGroup(g)} active={activeGroup?.id === g.id} />
          ))}
        </div>
      </div>

      {/* ── Group chat modal ── */}
      {groupChatOpen && (
        <ChatModal onClose={closeGroupChat} accentFrom={groupDetail ? groupColor(groupDetail.id)[0] : '#6366f1'} accentTo={groupDetail ? groupColor(groupDetail.id)[1] : '#4f46e5'}>
          {detailLoading || !groupDetail ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 40, height: 40, border: '4px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading group…</p>
            </div>
          ) : (
            <GroupChatContent
              group={groupDetail}
              myId={myId}
              myName={myName}
              onClose={closeGroupChat}
              onMessageSent={handleMessageSent}
            />
          )}
        </ChatModal>
      )}

      {/* ── Peer Chat (collaboration) modal — student-to-student ── */}
      {collabModalOpen && (
        <PeerChatModal onClose={() => { setCollabModalOpen(false); setTab('groups'); }}>
          <CollaborationPanel myId={myId} onClose={() => { setCollabModalOpen(false); setTab('groups'); }} />
        </PeerChatModal>
      )}

      {/* Global keyframe styles */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}