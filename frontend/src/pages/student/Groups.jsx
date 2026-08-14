import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { showChatToast, markMessageSeen, setActiveConversation, clearActiveConversation, onPendingChatTarget, consumePendingChatTarget } from '../../utils/chatNotify';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import { ChatImageBubble, ChatFileBubble, fmtFileSize, AttachmentTypeIcon, AttachMenu, EmojiPicker } from '../../components/common/ChatMediaBubble';
import {
  Users, MessageSquare, Send, CheckCheck, Check, X, Crown,
  StopCircle, WifiOff, Mic, Play, Pause, Trash2, Radio, Search,
  MessageCircle, ArrowLeft, ChevronRight, Eye, Plus, Smile, Pin,
  PinOff, Reply, SmilePlus, AtSign, ChevronDown, Menu, Inbox,
} from 'lucide-react';

const MAX_CHAT_FILE_MB = 25;

async function tryApi(fn) {
  try { return await fn(); } catch { return null; }
}

const localStore = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable, ignore */ }
  },
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function fmtDateSep(ts) {
  const d = new Date(ts || Date.now()); const today = new Date(); const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

const NEUTRAL_HEADER = 'linear-gradient(135deg, #0a0b0f 0%, #14161d 45%, #1c2029 100%)';
const CHAT_NEUTRAL = ['#2f3543', '#1a1d24'];
const UNREAD_COLORS = ['#ef4444', '#dc2626'];
const GOLD = '#eab308';

const GROUP_COLORS = [
  ['#7c3aed', '#6d28d9'],
  ['#9d174d', '#831843'],
  ['#dc2626', '#b91c1c'],
  ['#db2777', '#be185d'],
  ['#57534e', '#3f3d38'],
  ['#a855f7', '#9333ea'],
  ['#c026d3', '#a21caf'],
  ['#475569', '#334155'],
];
function groupColor(id) {
  const idx = id ? parseInt(String(id).slice(-2), 16) % GROUP_COLORS.length : 0;
  return GROUP_COLORS[idx];
}
const DM_COLORS = ['#4b5563', '#33383f'];
const LEADER_COLORS = ['#7c3aed', '#6d28d9'];
const TEACHER_DM_COLORS = ['#9333ea', '#7e22ce'];
// "Mine" bubble color across all of the student's chat — a polished
// neutral gray, consistent everywhere (group chat, leader DM, teacher DM,
// peer DM) rather than switching with the thread's own accent color.
const MINE_ACCENT = ['#52525b', '#3f3f46'];

const SENDER_COLORS = ['#a855f7', '#9d174d', '#db2777', '#c026d3', '#7c3aed', '#dc2626', '#78716c', '#e11d48'];
function senderColor(seed) {
  const s = String(seed || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[hash % SENDER_COLORS.length];
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function extractMentions(text, memberNames) {
  if (!text) return [];
  const found = [];
  memberNames.forEach(name => {
    const first = name.split(' ')[0];
    const re = new RegExp(`@${first}\\b`, 'i');
    if (re.test(text)) found.push(name);
  });
  return found;
}

function MentionText({ text, accent }) {
  const parts = String(text || '').split(/(@[A-Za-z][\w'-]*)/g);
  return (
    <>
      {parts.map((p, i) => p.startsWith('@') ? (
        <span key={i} style={{ color: accent, fontWeight: 700, background: `${accent}18`, borderRadius: 4, padding: '0 3px' }}>{p}</span>
      ) : <span key={i}>{p}</span>)}
    </>
  );
}

function seededBars(seed, count = 32) {
  let h = 0;
  const s = String(seed || 'voice');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  let x = h || 7;
  const bars = [];
  for (let i = 0; i < count; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    bars.push(0.22 + ((x % 1000) / 1000) * 0.78);
  }
  return bars;
}

function Waveform({ bars, progress = 0, color, mutedColor, playing, onSeek }) {
  const activeIndex = Math.floor(progress * bars.length);
  return (
    <div className="wa-voice-wave" onClick={onSeek} style={{ cursor: onSeek ? 'pointer' : 'default' }}>
      {bars.map((h, i) => {
        const isPast = i <= activeIndex;
        const isLive = playing && isPast && i === activeIndex;
        return (
          <span key={i} className={`wa-voice-bar${isLive ? ' wa-voice-bar-live' : ''}`}
            style={{ height: `${7 + h * 17}px`, background: isPast ? color : mutedColor }} />
        );
      })}
    </div>
  );
}

const AudioPlaybackContext = createContext(null);
function AudioPlaybackProvider({ children }) {
  const registry = useRef(new Set());
  const register = (el) => { registry.current.add(el); };
  const unregister = (el) => { registry.current.delete(el); };
  const stopOthers = (exceptEl) => {
    registry.current.forEach(el => { if (el !== exceptEl && !el.paused) { el.pause(); el.dispatchEvent(new Event('externalpause')); } });
  };
  return <AudioPlaybackContext.Provider value={{ register, unregister, stopOthers }}>{children}</AudioPlaybackContext.Provider>;
}

function VoiceBubble({ url, duration, isMine, otherAccent }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const audioRef = useRef(null);
  const ctx = useContext(AudioPlaybackContext);
  const totalDuration = duration || 0;
  const bars = useMemo(() => seededBars(url || duration, 30), [url, duration]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    ctx?.register(el);
    const onExternalPause = () => setPlaying(false);
    el.addEventListener('externalpause', onExternalPause);
    return () => { ctx?.unregister(el); el.removeEventListener('externalpause', onExternalPause); };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { ctx?.stopOthers(el); el.play(); setPlaying(true); }
  };
  const fmtDur = (s) => { const t = Math.round(s || 0); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const progress = totalDuration > 0 ? Math.min(currentTime / totalDuration, 1) : 0;

  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    el.currentTime = ratio * totalDuration;
    setCurrentTime(ratio * totalDuration);
    if (!playing) { ctx?.stopOthers(el); el.play(); setPlaying(true); }
  };

  // "Mine" always renders as a polished neutral gray, consistent everywhere.
  // Received notes get the sender's own identity color in group threads
  // (so each classmate's voice notes are visually distinct, matching the
  // teacher's group-chat design); outside group threads they fall back to
  // the single amber "received" tone.
  const barColor = isMine ? 'rgba(255,255,255,0.95)' : (otherAccent || 'var(--wa-voice-accent)');
  const barMuted = isMine ? 'rgba(255,255,255,0.32)' : (otherAccent ? `${otherAccent}38` : 'rgba(245,158,11,0.22)');
  const glowColor = isMine ? `${MINE_ACCENT[1]}66` : (otherAccent ? `${otherAccent}66` : 'rgba(245,158,11,0.45)');

  return (
    <div
      className={`wa-voice-capsule${playing ? ' wa-voice-capsule-playing' : ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, minWidth: 224,
        padding: '7px 15px 7px 7px',
        borderRadius: 999,
        background: isMine
          ? `linear-gradient(135deg, ${MINE_ACCENT[0]}, ${MINE_ACCENT[1]})`
          : otherAccent
            ? `linear-gradient(135deg, ${otherAccent}26, ${otherAccent}14)`
            : 'linear-gradient(135deg, rgba(24,17,10,0.72), rgba(12,9,6,0.82))',
        border: isMine ? 'none' : otherAccent ? `1.5px solid ${otherAccent}55` : '1.5px solid var(--wa-bubble-received-border)',
        boxShadow: isMine
          ? `0 3px 12px -3px ${MINE_ACCENT[1]}99`
          : otherAccent ? `0 3px 14px -3px ${otherAccent}55` : '0 3px 14px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(245,158,11,0.06)',
        '--voice-glow-color': glowColor,
      }}
    >
      <audio ref={audioRef} src={url} preload="metadata"
        onLoadedMetadata={() => setLoaded(true)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }} style={{ display: 'none' }} />

      <button onClick={toggle} title={playing ? 'Pause' : 'Play'}
        className={`wa-voice-play-btn${playing ? ' wa-voice-play-btn-active' : ''}`}
        style={{ background: isMine ? 'rgba(255,255,255,0.24)' : otherAccent ? `${otherAccent}22` : 'rgba(245,158,11,0.16)', color: isMine ? '#fff' : (otherAccent || 'var(--wa-voice-accent)'), '--voice-glow-color': glowColor }}>
        {playing ? <Pause style={{ width: 15, height: 15 }} fill="currentColor" />
          : <Play style={{ width: 15, height: 15, marginLeft: 1.5 }} fill="currentColor" />}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <Waveform bars={bars} progress={progress} color={barColor} mutedColor={barMuted} playing={playing} onSeek={seek} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10, opacity: 0.85, fontVariantNumeric: 'tabular-nums', color: isMine ? '#fff' : (otherAccent || 'var(--wa-voice-accent)'), fontWeight: isMine ? 500 : 600 }}>
            {fmtDur(playing || currentTime > 0 ? currentTime : totalDuration)}
          </span>
          {playing && <span className="wa-voice-live-dot" style={{ background: isMine ? '#fff' : (otherAccent || 'var(--wa-voice-accent)') }} />}
        </div>
      </div>
    </div>
  );
}

function ReactionBar({ reactions, myId, onToggle, accent }) {
  const entries = Object.entries(reactions || {}).filter(([, uids]) => uids.length > 0);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {entries.map(([emoji, uids]) => {
        const mine = uids.map(String).includes(String(myId));
        return (
          <button key={emoji} onClick={() => onToggle(emoji)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, padding: '1px 7px', borderRadius: 20, cursor: 'pointer',
              border: mine ? `1.5px solid ${accent}` : '1.5px solid var(--card-border)',
              background: mine ? `${accent}18` : 'var(--card-bg)', color: mine ? accent : 'var(--text-secondary)', fontWeight: 700,
            }}>
            <span>{emoji}</span><span>{uids.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function ReactionPicker({ onPick, onClose }) {
  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'absolute', bottom: '100%', marginBottom: 4, display: 'flex', gap: 2, padding: '5px 6px',
      borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 20,
    }}>
      {QUICK_REACTIONS.map(e => (
        <button key={e} onClick={() => { onPick(e); onClose(); }}
          style={{ fontSize: 17, background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 8, lineHeight: 1 }}
          onMouseEnter={ev => ev.currentTarget.style.background = 'var(--surface-100)'}
          onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>
          {e}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({
  item, accent, onDelete, deletingId, onReply, onReact, onTogglePin, isPinned,
  onJumpTo, highlighted, teacherBadge, leaderId, isGroupThread,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMine = item.isMine;
  const isTeacherMsg = item.author_role === 'teacher';
  const isLeaderMsg = !isMine && !isTeacherMsg && leaderId != null && String(item.author_id) === String(leaderId);
  // Per-sender identity color — every group member gets their own distinct
  // tint (mirrors the teacher's own group-chat bubble design), while the
  // teacher always reads as violet. Used for both the name label and,
  // in group threads, the bubble itself.
  const senderTint = !isMine && !isTeacherMsg ? senderColor(item.author_id || item.author_name) : null;
  const nameColor = isTeacherMsg ? '#7c3aed' : isLeaderMsg ? GOLD : senderTint;

  let bubbleBg, bubbleColor, bubbleShadow, bubbleBorder, bubbleBorderLeft;
  if (isMine) {
    bubbleBg = `linear-gradient(135deg, ${MINE_ACCENT[0]}, ${MINE_ACCENT[1]})`;
    bubbleColor = '#fff';
    bubbleShadow = `0 3px 12px -3px ${MINE_ACCENT[1]}99`;
    bubbleBorder = 'none';
    bubbleBorderLeft = undefined;
  } else if (isGroupThread) {
    bubbleBg = isTeacherMsg ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : `linear-gradient(135deg, ${senderTint}17, ${senderTint}0a)`;
    bubbleColor = isTeacherMsg ? '#fff' : 'var(--text-primary)';
    bubbleShadow = isTeacherMsg ? '0 3px 12px -3px rgba(124,58,237,0.4)' : `0 1px 6px -2px ${senderTint}30`;
    bubbleBorder = isTeacherMsg ? 'none' : `1px solid ${senderTint}2a`;
    bubbleBorderLeft = !isTeacherMsg && item.message_type !== 'image' ? `3px solid ${senderTint}` : undefined;
  } else {
    bubbleBg = 'var(--wa-bubble-received-bg)';
    bubbleColor = 'var(--wa-bubble-received-text)';
    bubbleShadow = '0 3px 14px rgba(0,0,0,0.32), 0 0 0 1px rgba(245,158,11,0.05)';
    bubbleBorder = '1.5px solid var(--wa-bubble-received-border)';
    bubbleBorderLeft = undefined;
  }
  const isMedia = item.message_type === 'image' || item.message_type === 'file' || item.message_type === 'voice';

  return (
    <div id={`msg-${item.id}`} className="group" style={{
      display: 'flex', marginBottom: 4, alignItems: 'flex-end', gap: 6, justifyContent: isMine ? 'flex-end' : 'flex-start',
      transition: 'background 0.6s ease', background: highlighted ? `${accent[0]}22` : 'transparent', borderRadius: 12,
      animation: 'msgBubbleIn 0.22s cubic-bezier(0.2,0.8,0.2,1) both',
    }}>
      <div style={{ maxWidth: '72%' }}>
        {item.isFirst && !item.isMine && item.author_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: nameColor }}>{item.author_name}</span>
            {isTeacherMsg && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700, background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>Teacher</span>}
            {isLeaderMsg && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700, background: 'rgba(234,179,8,0.14)', color: GOLD, display: 'inline-flex', alignItems: 'center', gap: 2 }}><Crown style={{ width: 8, height: 8 }} /> Leader</span>}
          </div>
        )}

        {item.reply_to && (
          <button onClick={() => onJumpTo(item.reply_to.id)} className="wa-reply-quote" style={{
            width: '100%', textAlign: 'left', marginBottom: 3, borderRadius: '10px 10px 4px 4px',
            background: isMine ? 'rgba(255,255,255,0.16)' : `${accent[0]}0f`, borderLeft: `3px solid ${isMine ? 'rgba(255,255,255,0.7)' : accent[0]}`,
          }}>
            <Reply style={{ width: 11, height: 11, flexShrink: 0, marginTop: 2, opacity: 0.75, color: isMine ? '#fff' : accent[0] }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: isMine ? 'rgba(255,255,255,0.9)' : accent[0] }}>{item.reply_to.author_name}</div>
              <div style={{ opacity: 0.85, fontSize: 11.5, color: isMine ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.reply_to.preview}</div>
            </div>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
          {isMine && (
            <button onClick={() => onDelete(item.id)} disabled={deletingId === item.id} title="Delete message"
              className="wa-msg-delete-btn opacity-0 group-hover:opacity-100 transition-opacity">
              {deletingId === item.id
                ? <div style={{ width: 12, height: 12, border: '2px solid rgba(220,38,38,0.3)', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                : <Trash2 style={{ width: 13, height: 13 }} />}
            </button>
          )}

          {isMine && (
            <button onClick={() => onReply(item)} title="Reply" className="wa-reply-side-btn opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: `${accent[0]}18`, color: accent[0] }}>
              <Reply style={{ width: 14, height: 14 }} />
            </button>
          )}

          <div style={{ position: 'relative', minWidth: 0 }}>
            <div style={{
              background: isMedia ? 'transparent' : bubbleBg, color: bubbleColor, padding: isMedia ? 0 : '9px 14px',
              borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word',
              boxShadow: isMedia ? 'none' : bubbleShadow,
              border: isMedia ? 'none' : bubbleBorder,
              borderLeft: isMedia ? undefined : bubbleBorderLeft,
            }}>
              {item.message_type === 'voice'
                ? <VoiceBubble url={item.voice_url} duration={item.voice_duration} isMine={isMine}
                    otherAccent={isGroupThread ? (isTeacherMsg ? '#7c3aed' : senderTint) : null} />
                : item.message_type === 'image' ? <ChatImageBubble url={item.file_url} name={item.file_name} mimeType={item.mime_type} />
                : item.message_type === 'file' ? <ChatFileBubble url={item.file_url} name={item.file_name} size={item.file_size} mimeType={item.mime_type} />
                : <MentionText text={item.content} accent={isMine ? '#fff' : accent[0]} />}
            </div>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{
              position: 'absolute', top: -14, [isMine ? 'left' : 'right']: 4, display: 'flex', gap: 2,
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 20, padding: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            }}>
              <button onClick={() => setPickerOpen(o => !o)} title="React" style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <SmilePlus style={{ width: 13, height: 13 }} />
              </button>
              <button onClick={() => onTogglePin(item)} title={isPinned ? 'Unpin' : 'Pin'} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isPinned ? accent[0] : 'var(--text-secondary)' }}>
                {isPinned ? <PinOff style={{ width: 12, height: 12 }} /> : <Pin style={{ width: 12, height: 12 }} />}
              </button>
            </div>
            {pickerOpen && <ReactionPicker onPick={(emoji) => onReact(item.id, emoji)} onClose={() => setPickerOpen(false)} />}
          </div>

          {!isMine && (
            <button onClick={() => onReply(item)} title="Reply" className="wa-reply-side-btn opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: `${accent[0]}18`, color: accent[0] }}>
              <Reply style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        <ReactionBar reactions={item.reactions} myId={item._myId} onToggle={(emoji) => onReact(item.id, emoji)} accent={accent[0]} />

        {item.isLast && (
          <div style={{ fontSize: 10, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3, justifyContent: isMine ? 'flex-end' : 'flex-start', paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0, color: 'var(--text-secondary)', opacity: 0.6 }}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {isMine && item.read !== undefined && (item.read
              ? <CheckCheck style={{ width: 12, height: 12, color: '#53bdeb' }} />
              : <Check style={{ width: 12, height: 12 }} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function PinnedRail({ pinned, onJump, onUnpin, accent }) {
  const [open, setOpen] = useState(false);
  if (!pinned || pinned.length === 0) return null;
  return (
    <div style={{ borderBottom: '1px solid var(--card-border)', background: `${accent[0]}08`, flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <Pin style={{ width: 12, height: 12, color: accent[0] }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: accent[0] }}>{pinned.length} pinned message{pinned.length !== 1 ? 's' : ''}</span>
        <ChevronDown style={{ width: 12, height: 12, color: accent[0], marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ maxHeight: 160, overflowY: 'auto', padding: '0 10px 8px' }}>
          {pinned.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, background: 'var(--card-bg)', marginBottom: 4 }}>
              <button onClick={() => onJump(p.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{p.author_name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.content || (p.message_type === 'voice' ? '🎤 Voice note' : p.message_type === 'image' ? '📷 Photo' : p.message_type === 'file' ? '📎 File' : '')}</div>
              </button>
              <button onClick={() => onUnpin(p)} title="Unpin" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}>
                <PinOff style={{ width: 13, height: 13 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadSearch({ messages, onJump, onClose, accent }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    return messages.filter(m => (m.content || '').toLowerCase().includes(needle)).slice(-40).reverse();
  }, [q, messages]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--card-bg)', zIndex: 30, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
        <Search style={{ width: 15, height: 15, color: 'var(--text-secondary)', flexShrink: 0 }} />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search this conversation…"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 13.5, color: 'var(--text-primary)' }} />
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X style={{ width: 16, height: 16 }} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {q.trim() && results.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 30 }}>No messages match "{q}"</p>
        )}
        {results.map(m => (
          <button key={m.id} onClick={() => { onJump(m.id); onClose(); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: accent[0] }}>{m.author_name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{timeAgo(m.created_at)}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{m.content}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MentionAutocomplete({ candidates, onPick, accent }) {
  if (!candidates.length) return null;
  return (
    <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, width: 220, maxHeight: 180, overflowY: 'auto', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 25 }}>
      {candidates.map(name => (
        <button key={name} onClick={() => onPick(name)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-100)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: accent[0], color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{name[0].toUpperCase()}</div>
          <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{name}</span>
        </button>
      ))}
    </div>
  );
}

function MembersPanel({ group, onClose }) {
  const [a, b] = groupColor(group.id);
  const members = group.members || [];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--card-bg)', zIndex: 40, display: 'flex', flexDirection: 'column', animation: 'slideInFromRight 0.18s ease both' }}>
      <div style={{ background: `linear-gradient(135deg, ${a}, ${b})`, padding: '14px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ArrowLeft style={{ width: 14, height: 14 }} /></button>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{group.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{members.length} member{members.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {members.map((m, i) => {
          const isLeader = group.team_leader?.id === m.id;
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, marginBottom: 6, background: 'var(--surface-100)', border: isLeader ? `1.5px solid ${a}40` : '1.5px solid transparent', animation: 'memberSlideIn 260ms ease both', animationDelay: `${i * 40}ms` }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: isLeader ? `linear-gradient(135deg, ${a}, ${b})` : 'linear-gradient(135deg, #4b5563, #33383f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>{m.name[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                {isLeader && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Crown style={{ width: 11, height: 11, color: GOLD }} /><span style={{ fontSize: 11, fontWeight: 600, color: '#a16207' }}>Team Leader</span></div>}
              </div>
            </div>
          );
        })}
        {group.teacher_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, background: 'rgba(124,58,237,0.06)', border: '1.5px solid rgba(124,58,237,0.2)' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>{group.teacher_name[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{group.teacher_name}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', marginTop: 2 }}>Teacher</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  accent, disabled, disabledLabel, onSendText, onSendVoice, onSendFile, onTypingChange,
  replyTo, onCancelReply, mentionCandidates, textOnly,
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveLevels, setLiveLevels] = useState(() => new Array(28).fill(0.15));
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const levelRafRef = useRef(null);
  const previewBars = useMemo(() => seededBars(audioBlob ? `${audioDuration}-preview` : 'preview', 26), [audioBlob, audioDuration]);

  const startLevelMeter = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const barCount = 28;
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(data.length / barCount));
        const next = new Array(barCount);
        for (let i = 0; i < barCount; i++) {
          const slice = data.slice(i * step, i * step + step);
          const avg = slice.reduce((a, b) => a + b, 0) / (slice.length || 1);
          next[i] = Math.min(1, 0.12 + (avg / 255) * 1.4);
        }
        setLiveLevels(next);
        levelRafRef.current = requestAnimationFrame(tick);
      };
      levelRafRef.current = requestAnimationFrame(tick);
    } catch { /* AnalyserNode unsupported — recording still works, just no live bars */ }
  };
  const stopLevelMeter = () => {
    if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
    levelRafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLiveLevels(new Array(28).fill(0.15));
  };
  useEffect(() => () => stopLevelMeter(), []);

  const handleTyping = (e) => {
    const val = e.target.value;
    setText(val);
    e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

    const caret = e.target.selectionStart;
    const upToCaret = val.slice(0, caret);
    const match = upToCaret.match(/@([A-Za-z]*)$/);
    setMentionQuery(match ? match[1].toLowerCase() : null);

    onTypingChange && onTypingChange(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTypingChange && onTypingChange(false), 2000);
  };

  const pickMention = (name) => {
    const first = name.split(' ')[0];
    setText(t => t.replace(/@([A-Za-z]*)$/, `@${first} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const filteredMentionCandidates = (mentionCandidates || []).filter(n => !mentionQuery || n.toLowerCase().startsWith(mentionQuery));

  const doSendText = async () => {
    if (!text.trim() || posting || disabled) return;
    const content = text.trim();
    setText(''); setMentionQuery(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setPosting(true);
    onTypingChange && onTypingChange(false);
    try {
      await onSendText(content);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Message failed to send. Please try again.');
      setText(content);
    } finally {
      setPosting(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      if (recording) stopAndSendVoice();
      else if (audioBlob) sendVoicePreview();
      else if (selectedFile) sendFilePreview();
      else doSendText();
    }
    if (e.key === 'Escape') onCancelReply && onCancelReply();
  };

  const startRecording = async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => { setAudioBlob(new Blob(audioChunksRef.current, { type: mimeType })); setAudioDuration(recordingTime); stream.getTracks().forEach(t => t.stop()); };
      recorder.start(); mediaRecorderRef.current = recorder; setRecording(true); setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      startLevelMeter(stream);
    } catch { toast.error('Microphone access denied. Please allow mic permission.'); }
  };
  const stopRecording = () => { if (mediaRecorderRef.current && recording) { mediaRecorderRef.current.stop(); clearInterval(recordTimerRef.current); stopLevelMeter(); setRecording(false); } };
  const stopAndSendVoice = () => {
    if (!mediaRecorderRef.current || !recording) return;
    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const duration = recordingTime;
      clearInterval(recordTimerRef.current); stopLevelMeter(); setRecording(false); setAudioBlob(null);
      (async () => {
        setPosting(true);
        try {
          await onSendVoice(blob, duration);
        } catch (err) {
          toast.error(err.response?.data?.message || 'Voice note failed to send. Tap send to try again.');
          setAudioBlob(blob); setAudioDuration(duration);
        } finally {
          setPosting(false);
        }
      })();
    };
    mediaRecorderRef.current.stop();
  };
  const cancelVoice = () => { if (recording) stopRecording(); setAudioBlob(null); setRecordingTime(0); setAudioPlaying(false); setPreviewTime(0); };
  const toggleAudioPreview = () => {
    if (!audioPreviewRef.current) return;
    if (audioPlaying) { audioPreviewRef.current.pause(); setAudioPlaying(false); }
    else { audioPreviewRef.current.play(); setAudioPlaying(true); audioPreviewRef.current.onended = () => { setAudioPlaying(false); setPreviewTime(0); }; }
  };
  const sendVoicePreview = async () => {
    if (!audioBlob || posting) return;
    const blob = audioBlob, duration = audioDuration;
    setAudioPlaying(false);
    setPosting(true);
    try {
      await onSendVoice(blob, duration);
      setAudioBlob(null); setRecordingTime(0); setPreviewTime(0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Voice note failed to send. Tap send to try again.');
    } finally {
      setPosting(false);
    }
  };
  const fmtDuration = (s) => { const t = Math.round(s || 0); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || disabled) return;
    if (file.size > MAX_CHAT_FILE_MB * 1024 * 1024) { toast.error(`File is too large — max ${MAX_CHAT_FILE_MB}MB.`); return; }
    setSelectedFile(file);
    setFilePreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };
  const cancelFile = () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl); setSelectedFile(null); setFilePreviewUrl(null); };
  const sendFilePreview = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    try {
      await onSendFile(selectedFile);
      cancelFile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'File failed to send. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => () => clearTimeout(typingTimeoutRef.current), []);

  if (disabled) {
    return (
      <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--surface-100)', padding: '10px 16px', flexShrink: 0 }}>
        <p style={{ fontSize: 12, textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>🔒 {disabledLabel || 'This conversation has ended'}</p>
      </div>
    );
  }

  return (
    <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)', flexShrink: 0 }}>
      <input ref={fileInputRef} type="file" onChange={handleFilePick} style={{ display: 'none' }} />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleFilePick} style={{ display: 'none' }} />

      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--card-border)', background: `${accent[0]}0a`, animation: 'replyBarIn 0.16s ease both' }}>
          <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: accent[0], flexShrink: 0 }} />
          <Reply style={{ width: 15, height: 15, color: accent[0], flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: accent[0] }}>Replying to {replyTo.author_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyTo.content || 'Attachment'}</div>
          </div>
          <button onClick={onCancelReply} title="Cancel reply" style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--surface-100)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X style={{ width: 13, height: 13 }} /></button>
        </div>
      )}

      <div style={{ padding: '10px 14px' }}>
        {selectedFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={cancelFile} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X style={{ width: 16, height: 16 }} /></button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-100)', borderRadius: 14, padding: '6px 10px', border: `1.5px solid ${accent[0]}40`, minWidth: 0 }}>
              {filePreviewUrl ? <img src={filePreviewUrl} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accent[0]}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AttachmentTypeIcon mimeType={selectedFile.type} style={{ width: 15, height: 15, color: accent[0] }} /></div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{fmtFileSize(selectedFile.size)}</div>
              </div>
            </div>
            <button onClick={sendFilePreview} disabled={uploading} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${accent[0]}, ${accent[1]})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: uploading ? 0.6 : 1 }}>
              {uploading ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        ) : recording ? (
          <div className="wa-recording-pill" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={cancelVoice} title="Cancel" className="wa-voice-cancel-btn"><X style={{ width: 16, height: 16 }} /></button>
            <div className="wa-recording-panel wa-recording-panel-live">
              <span className="wa-rec-dot" />
              <span className="wa-recording-time">{fmtDuration(recordingTime)}</span>
              <div className="wa-live-wave">
                {liveLevels.map((v, i) => (
                  <span key={i} className="wa-live-bar" style={{ height: `${6 + v * 22}px` }} />
                ))}
              </div>
            </div>
            <button onClick={stopAndSendVoice} title="Send" className="wa-voice-send-btn wa-voice-send-btn-amber">
              <Send style={{ width: 16, height: 16 }} />
            </button>
          </div>
        ) : audioBlob ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={cancelVoice} title="Discard" className="wa-voice-cancel-btn"><Trash2 style={{ width: 16, height: 16 }} /></button>
            <audio ref={audioPreviewRef} src={URL.createObjectURL(audioBlob)}
              onTimeUpdate={() => setPreviewTime(audioPreviewRef.current?.currentTime || 0)}
              style={{ display: 'none' }} />
            <div className="wa-recording-panel">
              <button onClick={toggleAudioPreview} title={audioPlaying ? 'Pause' : 'Play'}
                className={`wa-voice-play-btn${audioPlaying ? ' wa-voice-play-btn-active' : ''}`}
                style={{ width: 28, height: 28, background: 'rgba(245,158,11,0.16)', color: 'var(--wa-voice-accent)', flexShrink: 0 }}>
                {audioPlaying ? <Pause style={{ width: 12, height: 12 }} fill="currentColor" /> : <Play style={{ width: 12, height: 12, marginLeft: 1 }} fill="currentColor" />}
              </button>
              <Waveform bars={previewBars} progress={audioDuration ? Math.min(previewTime / audioDuration, 1) : 0}
                color="var(--wa-voice-accent)" mutedColor="rgba(245,158,11,0.22)" playing={audioPlaying} />
              <span className="wa-recording-time" style={{ color: 'var(--wa-voice-accent)' }}>{fmtDuration(audioPlaying ? previewTime : audioDuration)}</span>
            </div>
            <button onClick={sendVoicePreview} disabled={posting} title="Send" className="wa-voice-send-btn wa-voice-send-btn-amber"
              style={{ opacity: posting ? 0.6 : 1 }}>
              {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        ) : (
          <div className="wa-input-pill" style={{ position: 'relative', '--wa-accent': accent[0], '--wa-accent-2': accent[1], '--wa-accent-soft': `${accent[0]}22` }}>
            {mentionQuery !== null && <MentionAutocomplete candidates={filteredMentionCandidates} onPick={pickMention} accent={accent} />}
            {!textOnly && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="wa-icon-btn" onClick={() => { setAttachOpen(o => !o); setEmojiOpen(false); }} title="Attach"><Plus style={{ width: 20, height: 20 }} /></button>
                <AttachMenu open={attachOpen} onClose={() => setAttachOpen(false)} onPickImage={() => imageInputRef.current?.click()} onPickFile={() => fileInputRef.current?.click()} />
              </div>
            )}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button className="wa-icon-btn" onClick={() => { setEmojiOpen(o => !o); setAttachOpen(false); }} title="Emoji"><Smile style={{ width: 20, height: 20 }} /></button>
              <EmojiPicker open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={(e) => { setText(t => t + e); inputRef.current?.focus(); }} />
            </div>
            <textarea ref={inputRef} value={text} onChange={handleTyping} onKeyDown={handleKey} rows={1} placeholder="Type a message" className="wa-input-textarea" />
            {text.trim() ? (
              <button onClick={doSendText} disabled={posting} className="wa-icon-btn wa-icon-send wa-icon-swap">
                {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 17, height: 17 }} />}
              </button>
            ) : textOnly ? (
              <button disabled className="wa-icon-btn wa-icon-swap" style={{ opacity: 0.3, cursor: 'default' }}><Send style={{ width: 17, height: 17 }} /></button>
            ) : (
              <button onClick={startRecording} className="wa-icon-btn wa-icon-swap" title="Record a voice note"><Mic style={{ width: 20, height: 20 }} /></button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function useThread(entry, myId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [groupMeta, setGroupMeta] = useState(null);
  const [reactions, setReactions] = useState(() => localStore.get(`reactions:${entry.key}`, {}));
  const [pinnedIds, setPinnedIds] = useState(() => localStore.get(`pinned:${entry.key}`, []));
  const [replyMeta, setReplyMeta] = useState(() => localStore.get(`replies:${entry.key}`, {}));
  const lastMsgTimeRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => { localStore.set(`reactions:${entry.key}`, reactions); }, [reactions, entry.key]);
  useEffect(() => { localStore.set(`pinned:${entry.key}`, pinnedIds); }, [pinnedIds, entry.key]);
  useEffect(() => { localStore.set(`replies:${entry.key}`, replyMeta); }, [replyMeta, entry.key]);

  const basePath = entry.type === 'group' ? `/group-discussions/${entry.id}/messages`
    : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm`
    : entry.type === 'teacherdm' ? `/teacher-messages/teacher/${entry.id}`
    : `/collaborations/class/${entry.classId}/messages/${entry.peerId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (entry.type === 'group') {
        const res = await api.get(`/group-discussions/${entry.id}`);
        setGroupMeta(res.data.group);
        const msgs = res.data.group.messages || [];
        setMessages(msgs);
        setIsEnded(!!res.data.group.is_ended);
        lastMsgTimeRef.current = msgs.length ? msgs[msgs.length - 1].created_at : null;
      } else if (entry.type === 'leaderdm' || entry.type === 'teacherdm') {
        const res = await api.get(basePath);
        setGroupMeta({ peer: res.data.peer });
        const msgs = res.data.messages || [];
        setMessages(msgs);
        lastMsgTimeRef.current = msgs.length ? msgs[msgs.length - 1].created_at : null;
      } else {
        const res = await api.get(basePath);
        const msgs = res.data.messages || [];
        setMessages(msgs);
        lastMsgTimeRef.current = msgs.length ? msgs[msgs.length - 1].created_at : null;
      }
    } catch (err) {
      if (entry.type === 'teacherdm' && err.response?.status === 403) { setHidden(true); }
      else { toast.error(err.response?.data?.message || 'Failed to load conversation'); }
    }
    finally { setLoading(false); }
  }, [entry.key]);

  const poll = useCallback(async (silent) => {
    try {
      const params = silent && lastMsgTimeRef.current ? { since: lastMsgTimeRef.current } : {};
      const res = await api.get(basePath, { params });
      const fresh = (entry.type === 'leaderdm' ? res.data.messages : res.data.messages) || [];
      if (fresh.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m.id || m._id)));
          const toAdd = fresh.filter(m => !existingIds.has(String(m.id || m._id)));
          if (toAdd.length === 0) return prev;
          toAdd.forEach(m => markMessageSeen(m.id || m._id));
          const senderField = entry.type === 'dm' ? 'sender_id' : (entry.type === 'leaderdm' || entry.type === 'teacherdm') ? 'sender_id' : 'author_id';
          const fromOthers = toAdd.filter(m => String(m[senderField]) !== String(myId));
          if (fromOthers.length) {
            const last = fromOthers[fromOthers.length - 1];
            const nameField = last.author_name || last.sender_name || entry.name;
            showChatToast({ name: entry.type === 'group' ? `${nameField} · ${entry.name}` : nameField, preview: last.content, kind: last.message_type !== 'text' ? last.message_type : null });
          }
          lastMsgTimeRef.current = fresh[fresh.length - 1].created_at;
          return [...prev, ...toAdd];
        });
        setPeerTyping(false);
      }
      if (typeof res.data.is_ended === 'boolean') setIsEnded(res.data.is_ended);
      if (typeof res.data.peer_typing === 'boolean') setPeerTyping(res.data.peer_typing);
    } catch (err) {
      if (entry.type === 'teacherdm' && err.response?.status === 403) { setHidden(true); }
    }
  }, [basePath, entry, myId]);

  useEffect(() => {
    setMessages([]); setLoading(true); setIsEnded(false); setHidden(false); lastMsgTimeRef.current = null;
    setReactions(localStore.get(`reactions:${entry.key}`, {}));
    setPinnedIds(localStore.get(`pinned:${entry.key}`, []));
    setReplyMeta(localStore.get(`replies:${entry.key}`, {}));
    load();
    pollRef.current = setInterval(() => poll(true), 3000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.key]);

  const sendText = async (content, replyTo) => {
    const payload = { content };
    if (replyTo) payload.reply_to_id = replyTo.id;
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/messages`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm`
      : entry.type === 'teacherdm' ? `/teacher-messages/teacher/${entry.id}`
      : `/collaborations/class/${entry.classId}/messages`;
    const body = entry.type === 'dm' ? { receiverId: entry.peerId, content, ...(replyTo ? { reply_to_id: replyTo.id } : {}) } : payload;
    try {
      const res = await api.post(path, body);
      const newMsg = res.data.msg;
      if (replyTo) {
        const quote = { id: replyTo.id, author_name: replyTo.author_name || replyTo.sender_name, preview: replyTo.content || 'Attachment' };
        newMsg.reply_to = quote;
        setReplyMeta(prev => ({ ...prev, [newMsg.id]: quote }));
      }
      setMessages(prev => [...prev, { ...newMsg, sender_name: entry.type === 'dm' ? 'You' : newMsg.sender_name }]);
      lastMsgTimeRef.current = newMsg.created_at;
      return newMsg;
    } catch (err) {
      if (entry.type === 'teacherdm' && err.response?.status === 403) { setHidden(true); return; }
      throw err;
    }
  };

  const sendVoice = async (blob, duration) => {
    if (entry.type === 'teacherdm') { toast.error('Voice notes are not supported in this conversation.'); return; }
    const formData = new FormData();
    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
    formData.append('audio', blob, `voice-note-${Date.now()}.${ext}`);
    formData.append('duration', String(duration));
    if (entry.type === 'dm') formData.append('receiverId', entry.peerId);
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/voice-notes`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm/voice-notes`
      : `/collaborations/class/${entry.classId}/voice-notes`;
    try {
      const res = await api.post(path, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, { ...newMsg, sender_name: entry.type === 'dm' ? 'You' : newMsg.sender_name }]);
      lastMsgTimeRef.current = newMsg.created_at;
    } catch (err) {
      if (entry.type === 'leaderdm' && err.response?.status === 404) {
        toast.error("Voice notes aren't available in your private teacher line yet.");
        return;
      }
      throw err;
    }
  };

  const sendFile = async (file) => {
    if (entry.type === 'teacherdm') { toast.error('File sharing is not supported in this conversation.'); return; }
    const formData = new FormData();
    formData.append('file', file);
    if (entry.type === 'dm') formData.append('receiverId', entry.peerId);
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/media`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm/media`
      : `/collaborations/class/${entry.classId}/media`;
    try {
      const res = await api.post(path, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, { ...newMsg, sender_name: entry.type === 'dm' ? 'You' : newMsg.sender_name }]);
      lastMsgTimeRef.current = newMsg.created_at;
    } catch (err) {
      if (entry.type === 'leaderdm' && err.response?.status === 404) {
        toast.error("File sharing isn't available in your private teacher line yet.");
        return;
      }
      throw err;
    }
  };

  const deleteMessage = async (messageId) => {
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/messages/${messageId}`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm/${messageId}`
      : entry.type === 'teacherdm' ? `/teacher-messages/teacher/${entry.id}/messages/${messageId}`
      : `/collaborations/class/${entry.classId}/messages/${messageId}`;
    try { await api.delete(path); setMessages(prev => prev.filter(m => String(m.id || m._id) !== String(messageId))); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to delete message'); }
  };

  const clearMine = async () => {
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/messages`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm`
      : entry.type === 'teacherdm' ? `/teacher-messages/teacher/${entry.id}/messages`
      : `/collaborations/class/${entry.classId}/messages/peer/${entry.peerId}`;
    await api.delete(path);
    setMessages(prev => prev.filter(m => String(m.author_id || m.sender_id) !== String(myId)));
  };

  const toggleReaction = (messageId, emoji) => {
    setReactions(prev => {
      const forMsg = { ...(prev[messageId] || {}) };
      const uids = new Set((forMsg[emoji] || []).map(String));
      if (uids.has(String(myId))) uids.delete(String(myId)); else uids.add(String(myId));
      forMsg[emoji] = Array.from(uids);
      return { ...prev, [messageId]: forMsg };
    });
    tryApi(() => api.post(`/messages/${messageId}/reactions`, { emoji }));
  };

  const togglePin = (message) => {
    setPinnedIds(prev => prev.includes(message.id) ? prev.filter(id => id !== message.id) : [...prev, message.id]);
    tryApi(() => api.post(`/messages/${message.id}/pin`));
  };

  const setTyping = (isTyping) => {
    tryApi(() => api.post(`/threads/${encodeURIComponent(entry.key)}/typing`, { typing: isTyping }));
  };

  const pinnedMessages = messages.filter(m => pinnedIds.includes(m.id || m._id));

  return {
    messages, setMessages, loading, isEnded, hidden, groupMeta, peerTyping,
    reactions, pinnedIds, pinnedMessages, replyMeta,
    sendText, sendVoice, sendFile, deleteMessage, clearMine, toggleReaction, togglePin, setTyping,
  };
}

function ThreadPane({ entry, myId, myName, onBack, onOpenTeacherDm, onEntryActivity, onThreadHidden }) {
  const thread = useThread(entry, myId);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);

  const accent = entry.type === 'group' ? groupColor(entry.id) : entry.type === 'leaderdm' ? LEADER_COLORS : entry.type === 'teacherdm' ? TEACHER_DM_COLORS : DM_COLORS;

  useEffect(() => {
    setActiveConversation(entry.key);
    return () => clearActiveConversation(entry.key);
  }, [entry.key]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread.messages.length]);

  useEffect(() => {
    if (thread.hidden) { onThreadHidden && onThreadHidden(entry.key); onBack(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.hidden]);

  useEffect(() => {
    if (thread.messages.length > 0) onEntryActivity && onEntryActivity(entry.key, thread.messages[thread.messages.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.messages.length]);

  const jumpTo = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setHighlightId(messageId); setTimeout(() => setHighlightId(null), 1500); }
  };

  const memberNames = (thread.groupMeta?.members || []).map(m => m.name).concat(entry.type === 'group' && thread.groupMeta?.teacher_name ? [thread.groupMeta.teacher_name] : []);

  const enriched = useMemo(() => {
    const out = [];
    let lastDate = null;
    thread.messages.forEach((m, i) => {
      const dateLabel = fmtDateSep(m.created_at || Date.now());
      if (dateLabel !== lastDate) { out.push({ type: 'date', label: dateLabel, key: `d${i}` }); lastDate = dateLabel; }
      const prev = thread.messages[i - 1]; const next = thread.messages[i + 1];
      const senderField = entry.type === 'group' ? 'author_id' : 'sender_id';
      const nameField = entry.type === 'group' ? 'author_name' : 'sender_name';
      const isMine = String(m[senderField]) === String(myId);
      out.push({
        type: 'msg', ...m, isMine, _myId: myId,
        author_name: m[nameField] || (isMine ? 'You' : entry.name),
        author_id: m[senderField],
        reactions: thread.reactions[m.id || m._id],
        reply_to: m.reply_to || thread.replyMeta[m.id || m._id],
        isFirst: entry.type !== 'group' ? false : (!prev || prev.author_name !== m.author_name),
        isLast: entry.type !== 'group' ? true : (!next || next.author_name !== m.author_name),
        key: m.id || m._id || `m${i}`,
      });
    });
    return out;
  }, [thread.messages, thread.reactions, thread.replyMeta, myId, entry]);

  const requestDelete = (id) => {
    const msg = thread.messages.find(m => String(m.id || m._id) === String(id));
    setDeleteTarget({ id, preview: msg?.content || (msg?.message_type === 'voice' ? '🎤 Voice note' : msg?.message_type === 'image' ? '📷 Photo' : msg?.message_type === 'file' ? '📎 File' : '') });
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await thread.deleteMessage(deleteTarget.id); setDeleteTarget(null); }
    finally { setDeleting(false); }
  };
  const handleClear = async () => {
    setClearing(true);
    try { await thread.clearMine(); toast.success('Your messages were cleared'); setClearConfirm(false); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to clear messages'); }
    finally { setClearing(false); }
  };

  const isEndedGroup = entry.type === 'group' && thread.isEnded;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', minWidth: 0 }}>
      <div style={{ background: `linear-gradient(135deg, ${accent[0]}, ${accent[1]})`, padding: '12px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} className="lg:hidden" style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ArrowLeft style={{ width: 14, height: 14 }} /></button>
          <div style={{ width: 38, height: 38, borderRadius: entry.type === 'group' ? 10 : '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14, flexShrink: 0 }}>
            {entry.type === 'group' ? (entry.name || 'G').slice(0, 2).toUpperCase() : entry.name[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              {thread.peerTyping ? <span style={{ fontStyle: 'italic' }}>typing…</span>
                : entry.type === 'group' ? entry.subtitle
                : entry.type === 'leaderdm' ? 'Private · only you and your teacher'
                : entry.type === 'teacherdm' ? 'Private · only you and this teacher'
                : 'Private · only you two can see this'}
            </div>
          </div>
          <button onClick={() => setSearchOpen(true)} title="Search in conversation" style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Search style={{ width: 14, height: 14 }} /></button>
          {entry.type === 'group' && (
            <button onClick={() => setMembersOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff', borderRadius: 20, padding: '5px 11px', cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              <Users style={{ width: 13, height: 13 }} />{(thread.groupMeta?.members || []).length}<Eye style={{ width: 11, height: 11, opacity: 0.8 }} />
            </button>
          )}
          {entry.type === 'group' && thread.groupMeta?.is_team_leader && (
            <button onClick={() => onOpenTeacherDm(entry.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: 20, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              <MessageCircle style={{ width: 13, height: 13 }} /> Teacher
            </button>
          )}
        </div>
      </div>

      {isEndedGroup ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 16px', background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <StopCircle style={{ width: 13, height: 13, color: '#dc2626' }} /><span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>The teacher ended this conversation</span>
        </div>
      ) : entry.type === 'group' && thread.groupMeta?.team_leader ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 14px', background: 'var(--surface-100)', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: 'var(--text-secondary)' }}><Crown style={{ width: 13, height: 13, color: GOLD }} /> Team leader: <strong style={{ color: 'var(--text-primary)' }}>{thread.groupMeta.team_leader.name}</strong></span>
          <button onClick={() => setClearConfirm(true)} className="wa-clear-mine-btn"><Trash2 style={{ width: 10, height: 10 }} /> Clear mine</button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 14px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <button onClick={() => setClearConfirm(true)} className="wa-clear-mine-btn"><Trash2 style={{ width: 10, height: 10 }} /> Clear mine</button>
        </div>
      )}

      <PinnedRail pinned={thread.pinnedMessages} onJump={jumpTo} onUnpin={thread.togglePin} accent={accent} />

      <AudioPlaybackProvider>
        <div ref={scrollRef} className="chat-wallpaper flex-1 overflow-y-auto" style={{ padding: '14px 14px 6px' }}>
          {thread.loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div style={{ width: 28, height: 28, border: `3px solid ${accent[0]}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
          ) : enriched.filter(x => x.type === 'msg').length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{entry.type === 'group' ? '👋' : entry.type === 'teacherdm' ? '🔒' : '💬'}</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{entry.type === 'group' ? 'No messages yet' : entry.type === 'teacherdm' ? `Message from ${entry.name}` : `Start talking to ${entry.name}`}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{entry.type === 'group' ? 'Be the first to say something!' : 'Your messages are private'}</p>
            </div>
          ) : enriched.map(item => item.type === 'date' ? (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} /><span style={{ fontSize: 10, fontWeight: 600, padding: '0 8px', color: 'var(--text-secondary)' }}>{item.label}</span><div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
            </div>
          ) : (
            <MessageBubble
              key={item.key} item={item} accent={accent} onDelete={requestDelete} deletingId={deleting ? deleteTarget?.id : null}
              onReply={setReplyTo} onReact={thread.toggleReaction} onTogglePin={thread.togglePin}
              isPinned={thread.pinnedIds.includes(item.id || item._id)} onJumpTo={jumpTo}
              highlighted={highlightId === (item.id || item._id)} teacherBadge={entry.type === 'group'}
              leaderId={entry.type === 'group' ? thread.groupMeta?.team_leader?.id : null}
              isGroupThread={entry.type === 'group'}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </AudioPlaybackProvider>

      <Composer
        accent={accent}
        disabled={isEndedGroup}
        onSendText={(content) => thread.sendText(content, replyTo).then(() => setReplyTo(null))}
        onSendVoice={thread.sendVoice}
        onSendFile={thread.sendFile}
        onTypingChange={thread.setTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        mentionCandidates={entry.type === 'group' ? memberNames.filter(n => n !== myName) : []}
        textOnly={entry.type === 'teacherdm'}
      />

      {searchOpen && <ThreadSearch messages={thread.messages.map(m => ({ ...m, author_name: m.author_name || m.sender_name }))} onJump={jumpTo} onClose={() => setSearchOpen(false)} accent={accent} />}
      {membersOpen && thread.groupMeta && <MembersPanel group={thread.groupMeta} onClose={() => setMembersOpen(false)} />}

      <ConfirmModal
        open={clearConfirm} onClose={() => setClearConfirm(false)} onConfirm={handleClear} loading={clearing} variant="danger"
        title="Clear My Messages"
        message={entry.type === 'group' ? "This deletes every message you've sent in this group. Other members' messages stay." : `This deletes every message you've sent to ${entry.name}. Their messages stay.`}
        confirmText="Clear" cancelText="Cancel"
      />

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} loading={deleting} variant="danger"
        title="Delete Message"
        message={deleteTarget?.preview ? `Delete "${deleteTarget.preview.length > 60 ? deleteTarget.preview.slice(0, 60) + '…' : deleteTarget.preview}"? This can't be undone.` : "This can't be undone."}
        confirmText="Delete" cancelText="Cancel"
      />
    </div>
  );
}

function InboxRow({ entry, active, onClick, index }) {
  const accent = entry.type === 'group' ? groupColor(entry.id) : entry.type === 'leaderdm' ? LEADER_COLORS : entry.type === 'teacherdm' ? TEACHER_DM_COLORS : DM_COLORS;
  const [a, b] = accent;
  return (
    <div
      onClick={onClick}
      className="discussion-list-item flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-all"
      style={{
        borderBottom: '1px solid var(--card-border)',
        background: active ? `linear-gradient(135deg, ${a}14, ${b}09)` : 'transparent',
        borderLeft: active ? `3px solid ${a}` : '3px solid transparent',
        animation: 'ibxRowIn 320ms cubic-bezier(0.16,1,0.3,1) both',
        animationDelay: `${Math.min(index, 14) * 35}ms`,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-100)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateX(0)'; }}
    >
      <div className="relative flex-shrink-0">
        <div style={{ width: 44, height: 44, borderRadius: entry.type === 'group' ? 14 : '50%', background: `linear-gradient(135deg, ${a}, ${b})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, boxShadow: active ? `0 4px 14px ${a}45` : 'none', transition: 'box-shadow 0.2s ease' }}>
          {entry.type === 'group' ? (entry.name || 'G').slice(0, 2).toUpperCase() : entry.name[0]?.toUpperCase()}
        </div>
        {entry.type === 'leaderdm' && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#7c3aed', border: '2px solid var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle style={{ width: 8, height: 8, color: '#fff' }} />
          </div>
        )}
        {entry.type === 'teacherdm' && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#9333ea', border: '2px solid var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle style={{ width: 8, height: 8, color: '#fff' }} />
          </div>
        )}
        {entry.type === 'group' && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg, #64748b, #334155)', border: '2px solid var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users style={{ width: 8, height: 8, color: '#fff' }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{entry.name}</span>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>{timeAgo(entry.lastAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            {entry.lastMessage
              ? <>{entry.lastAuthor && <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{entry.lastAuthor}: </span>}{entry.lastMessage}</>
              : <span className="italic">{entry.type === 'leaderdm' ? 'Private line to your teacher' : entry.type === 'teacherdm' ? 'Private message from your teacher' : 'No messages yet — say hello!'}</span>}
          </p>
          {entry.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1.5 text-white" style={{ background: `linear-gradient(135deg, ${a}, ${b})`, animation: 'ibxBadgePulse 1.8s ease-in-out infinite' }}>{entry.unreadCount > 9 ? '9+' : entry.unreadCount}</span>
          )}
        </div>
        {entry.type === 'group' && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${a}18`, color: a }}>{entry.className}</span>
            {entry.isLeader && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: 'rgba(234,179,8,0.14)', color: '#a16207' }}><Crown className="w-2.5 h-2.5" /> Leader</span>}
            {entry.mentionCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}><AtSign className="w-2.5 h-2.5" /> {entry.mentionCount}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function InboxRowSkeleton({ delay = 0 }) {
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

function NewMessagePicker({ classes, onPick, onClose }) {
  const [classId, setClassId] = useState(classes[0]?.id || null);
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    api.get(`/collaborations/class/${classId}/students`).then(res => setClassmates(res.data.classmates || [])).catch(() => setClassmates([])).finally(() => setLoading(false));
  }, [classId]);

  const filtered = classmates.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} className="fast-modal-backdrop">
      <div onClick={e => e.stopPropagation()} className="fast-modal-sheet" style={{ maxWidth: 420 }}>
        <div style={{ padding: '16px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>New message</h3>
          <button onClick={onClose} style={{ background: 'var(--surface-100)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X style={{ width: 14, height: 14 }} /></button>
        </div>
        {classes.length > 1 && (
          <div style={{ padding: '0 18px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {classes.map(c => (
              <button key={c.id} onClick={() => setClassId(c.id)} style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: classId === c.id ? 'rgba(124,58,237,0.14)' : 'var(--surface-100)', color: classId === c.id ? '#7c3aed' : 'var(--text-secondary)' }}>{c.name}</button>
            ))}
          </div>
        )}
        <div style={{ padding: '0 18px 10px' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search classmates…" className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '0 10px 12px' }}>
          {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
            : filtered.length === 0 ? <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-secondary)', padding: '20px 0' }}>No classmates found</p>
            : filtered.map(c => (
              <button key={c.id} onClick={() => onPick(classId, c)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-100)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${senderColor(c.id || c.name)}, color-mix(in srgb, ${senderColor(c.id || c.name)} 65%, #000))`, color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.name[0].toUpperCase()}</div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function StudentGroups() {
  const { user } = useAuth();
  const myName = user?.name || '';
  const myId = user?.id;

  const [groups, setGroups] = useState([]);
  const [collabClasses, setCollabClasses] = useState([]);
  const [dmEntries, setDmEntries] = useState({});
  const [teacherDmEntries, setTeacherDmEntries] = useState({});
  const [activityOverrides, setActivityOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedKey, setSelectedKey] = useState(null);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const fetchGroups = useCallback(async () => {
    try { const res = await api.get('/group-discussions/my/groups'); setGroups(res.data.groups || []); }
    catch { toast.error('Failed to load groups'); }
  }, []);

  const fetchCollab = useCallback(async () => {
    try {
      const res = await api.get('/collaborations/my-class-status');
      const active = (res.data.classes || []).filter(c => c.collaboration_active);
      setCollabClasses(active);
      const perClass = await Promise.all(active.map(cls => api.get(`/collaborations/class/${cls.id}/conversations`).then(r => ({ cls, conversations: r.data.conversations || [] })).catch(() => ({ cls, conversations: [] }))));
      setDmEntries(prev => {
        const next = { ...prev };
        perClass.forEach(({ cls, conversations }) => {
          conversations.forEach(conv => {
            const key = `dm:${cls.id}:${conv.peer_id}`;
            next[key] = {
              key, type: 'dm', id: conv.peer_id, classId: cls.id, peerId: conv.peer_id,
              name: conv.peer_name || next[key]?.name || 'Classmate',
              lastMessage: conv.last_message, lastAuthor: null, lastAt: conv.last_at, unreadCount: conv.unread_count || 0,
            };
          });
        });
        return next;
      });
    } catch { /* collaboration may simply be inactive for this student */ }
  }, []);

  const fetchTeacherDms = useCallback(async () => {
    try {
      const res = await api.get('/teacher-messages/my');
      const convos = res.data.conversations || [];
      setTeacherDmEntries(prev => {
        const next = {};
        convos.forEach(conv => {
          const key = `teacherdm:${conv.teacher_id}`;
          next[key] = {
            key, type: 'teacherdm', id: conv.teacher_id, peerId: conv.teacher_id,
            name: conv.teacher_name || prev[key]?.name || 'Teacher',
            lastMessage: conv.last_message, lastAuthor: null, lastAt: conv.last_at, unreadCount: conv.unread_count || 0,
          };
        });
        return next;
      });
    } catch { /* no teacher has messaged this student yet */ }
  }, []);

  useEffect(() => { Promise.all([fetchGroups(), fetchCollab(), fetchTeacherDms()]).finally(() => setLoading(false)); }, [fetchGroups, fetchCollab, fetchTeacherDms]);
  useEffect(() => { const t = setInterval(fetchTeacherDms, 8000); return () => clearInterval(t); }, [fetchTeacherDms]);
  useEffect(() => { const t = setInterval(fetchCollab, 8000); return () => clearInterval(t); }, [fetchCollab]);
  useEffect(() => { const t = setInterval(fetchGroups, 8000); return () => clearInterval(t); }, [fetchGroups]);

  const inbox = useMemo(() => {
    const rows = [];

    groups.forEach(g => {
      const key = `group:${g.id}`;
      const override = activityOverrides[key];
      rows.push({
        key, type: 'group', id: g.id, name: g.name, className: g.class_name, subtitle: g.class_name,
        isLeader: g.is_team_leader,
        lastMessage: override?.lastMessage ?? (g.last_message
          ? (g.last_message.message_type === 'voice' ? '🎤 Voice note' : g.last_message.message_type === 'image' ? '📷 Photo' : g.last_message.message_type === 'file' ? '📎 File' : g.last_message.content)
          : null),
        lastAuthor: override?.lastAuthor ?? g.last_message?.author_name,
        lastAt: override?.lastAt ?? (g.updated_at || g.created_at),
        unreadCount: 0,
        mentionCount: (activityOverrides[`${key}:mentions`]) || 0,
      });

      if (g.is_team_leader) {
        const ldKey = `leaderdm:${g.id}`;
        const ov = activityOverrides[ldKey];
        rows.push({
          key: ldKey, type: 'leaderdm', id: g.id, name: g.teacher_name ? `${g.teacher_name} (${g.name})` : `Teacher (${g.name})`,
          lastMessage: ov?.lastMessage ?? null, lastAuthor: null, lastAt: ov?.lastAt ?? null, unreadCount: 0,
        });
      }
    });

    Object.values(dmEntries).forEach(d => {
      const ov = activityOverrides[d.key];
      rows.push({ ...d, lastMessage: ov?.lastMessage ?? d.lastMessage, lastAt: ov?.lastAt ?? d.lastAt, unreadCount: ov ? 0 : d.unreadCount });
    });

    Object.values(teacherDmEntries).forEach(d => {
      const ov = activityOverrides[d.key];
      rows.push({ ...d, lastMessage: ov?.lastMessage ?? d.lastMessage, lastAt: ov?.lastAt ?? d.lastAt, unreadCount: ov ? 0 : d.unreadCount });
    });

    rows.sort((a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime());
    return rows;
  }, [groups, dmEntries, teacherDmEntries, activityOverrides]);

  const filtered = inbox
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    .filter(e => filter === 'all' ? true : filter === 'unread' ? e.unreadCount > 0 : filter === 'groups' ? e.type === 'group' : e.type === 'dm' || e.type === 'leaderdm' || e.type === 'teacherdm');

  const totalUnread = inbox.reduce((s, e) => s + (e.unreadCount || 0), 0);

  const selectedEntry = inbox.find(e => e.key === selectedKey) || null;

  const openEntry = (entry) => { setSelectedKey(entry.key); setMobileShowThread(true); };
  const openTeacherDm = (groupId) => { const key = `leaderdm:${groupId}`; setSelectedKey(key); setMobileShowThread(true); };

  const handleThreadHidden = useCallback((key) => {
    setTeacherDmEntries(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSelectedKey(sel => (sel === key ? null : sel));
  }, []);

  const handleEntryActivity = useCallback((key, lastMsg) => {
    const nameField = key.startsWith('group:') ? lastMsg.author_name : (lastMsg.sender_name || lastMsg.author_name);
    const preview = lastMsg.message_type === 'voice' ? '🎤 Voice note' : lastMsg.message_type === 'image' ? '📷 Photo' : lastMsg.message_type === 'file' ? '📎 File' : lastMsg.content;
    setActivityOverrides(prev => ({ ...prev, [key]: { lastMessage: preview, lastAuthor: nameField, lastAt: lastMsg.created_at } }));
    if (key.startsWith('group:') && myName && String(lastMsg.author_id) !== String(myId)) {
      const mentioned = extractMentions(lastMsg.content || '', [myName]).length > 0;
      if (mentioned) setActivityOverrides(prev => ({ ...prev, [`${key}:mentions`]: (prev[`${key}:mentions`] || 0) + 1 }));
    }
  }, [myName, myId]);

  useEffect(() => {
    if (selectedKey) setActivityOverrides(prev => ({ ...prev, [`${selectedKey}:mentions`]: 0 }));
  }, [selectedKey]);

  const startNewDm = (classId, classmate) => {
    const key = `dm:${classId}:${classmate.id}`;
    setDmEntries(prev => ({ ...prev, [key]: { key, type: 'dm', id: classmate.id, classId, peerId: classmate.id, name: classmate.name, lastMessage: null, lastAt: new Date().toISOString(), unreadCount: 0 } }));
    setNewMsgOpen(false);
    setSelectedKey(key);
    setMobileShowThread(true);
  };

  useEffect(() => {
    const applyTarget = (t) => {
      if (!t) return;
      if (t.type === 'group') { setSelectedKey(`group:${t.groupId}`); setMobileShowThread(true); }
      else if (t.type === 'leaderdm') { setSelectedKey(`leaderdm:${t.groupId}`); setMobileShowThread(true); }
      else if (t.type === 'dm') {
        const key = `dm:${t.classId}:${t.peerId}`;
        setDmEntries(prev => prev[key] ? prev : { ...prev, [key]: { key, type: 'dm', id: t.peerId, classId: t.classId, peerId: t.peerId, name: t.peerName || 'Classmate', lastMessage: null, lastAt: new Date().toISOString(), unreadCount: 0 } });
        setSelectedKey(key); setMobileShowThread(true);
      } else if (t.type === 'teacherdm') {
        const key = `teacherdm:${t.teacherId}`;
        setTeacherDmEntries(prev => prev[key] ? prev : { ...prev, [key]: { key, type: 'teacherdm', id: t.teacherId, peerId: t.teacherId, name: t.teacherName || 'Teacher', lastMessage: null, lastAt: new Date().toISOString(), unreadCount: 0 } });
        setSelectedKey(key); setMobileShowThread(true);
      }
    };
    applyTarget(consumePendingChatTarget());
    return onPendingChatTarget(applyTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', padding: '16px' }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--card-border)', width: '100%', height: 'calc(100vh - 152px)', minHeight: 520, display: 'flex' }}>

        <div className={`flex flex-col flex-shrink-0 w-full lg:w-[340px] min-h-0 ${mobileShowThread ? 'hidden lg:flex' : 'flex'}`} style={{ borderRight: '1px solid var(--card-border)' }}>
          <div className="ibx-header-chrome" style={{ position: 'relative', overflow: 'hidden', padding: '16px 16px 12px', flexShrink: 0, isolation: 'isolate' }}>
            <div style={{ position: 'absolute', top: '-30%', right: '-10%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.4), transparent 70%)', filter: 'blur(6px)', pointerEvents: 'none', zIndex: 0, animation: 'ibxGlowDrift 8s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', bottom: '-40%', left: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(219,39,119,0.22), transparent 72%)', filter: 'blur(6px)', pointerEvents: 'none', zIndex: 0, animation: 'ibxGlowDrift 10s ease-in-out infinite reverse' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Inbox style={{ width: 15, height: 15, color: '#fff' }} /></div>
                  Inbox
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {totalUnread > 0 && <span style={{ fontWeight: 800, fontSize: 11, padding: '3px 9px', borderRadius: 20, background: '#dc2626', color: '#fff', animation: 'ibxBadgePulse 1.8s ease-in-out infinite' }}>{totalUnread}</span>}
                  {collabClasses.length > 0 && (
                    <button
                      onClick={() => setNewMsgOpen(true)} title="New message"
                      style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.24)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), background 0.18s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1) rotate(90deg)'; e.currentTarget.style.background = 'rgba(255,255,255,0.26)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) rotate(0deg)'; e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; }}
                    ><Plus style={{ width: 15, height: 15 }} /></button>
                  )}
                </div>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.6)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search everything…"
                  className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none" style={{ background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['all', 'All'], ['groups', 'Groups'], ['dms', 'Direct'], ['unread', 'Unread']].map(([val, label]) => (
                  <button key={val} onClick={() => setFilter(val)} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: filter === val ? '#fff' : 'rgba(255,255,255,0.14)', color: filter === val ? '#5b21b6' : 'rgba(255,255,255,0.85)', transition: 'background 0.15s ease, color 0.15s ease, transform 0.15s ease', transform: filter === val ? 'scale(1.04)' : 'scale(1)' }}>{label}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loading ? [0, 1, 2, 3, 4].map(i => <InboxRowSkeleton key={i} delay={i * 60} />)
              : filtered.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '70px 24px', textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: 16, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,58,237,0.1)' }}><MessageSquare style={{ width: 28, height: 28, color: '#7c3aed', opacity: 0.6 }} /></div>
                  <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{inbox.length === 0 ? 'Nothing here yet' : 'No matches'}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{inbox.length === 0 ? 'Groups and chats will show up here once your teacher sets them up.' : 'Try a different search or filter.'}</p>
                </div>
              ) : filtered.map((entry, idx) => <InboxRow key={entry.key} entry={entry} active={entry.key === selectedKey} onClick={() => openEntry(entry)} index={idx} />)}
          </div>
        </div>

        <div className={`flex-1 min-w-0 min-h-0 ${mobileShowThread ? 'flex' : 'hidden lg:flex'}`} style={{ flexDirection: 'column' }}>
          {selectedEntry ? (
            <ThreadPane
              key={selectedEntry.key}
              entry={selectedEntry}
              myId={myId}
              myName={myName}
              onBack={() => setMobileShowThread(false)}
              onOpenTeacherDm={openTeacherDm}
              onEntryActivity={handleEntryActivity}
              onThreadHidden={handleThreadHidden}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: '0 32px' }}>
                <div style={{ width: 68, height: 68, borderRadius: 20, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(219,39,119,0.1))', animation: 'ibxIconFloat 4s ease-in-out infinite' }}><MessageCircle style={{ width: 32, height: 32, color: '#7c3aed', opacity: 0.85 }} /></div>
                <p style={{ fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>Pick a conversation</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Groups, classmates, and your private teacher line all live in one place now.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {newMsgOpen && <NewMessagePicker classes={collabClasses} onPick={startNewDm} onClose={() => setNewMsgOpen(false)} />}

      <style>{`
        .ibx-header-chrome {
          background: linear-gradient(120deg, #08090c 0%, #101319 35%, #171b24 65%, #0d0f14 100%);
          background-size: 200% 200%;
          animation: ibxChromeShimmer 14s ease-in-out infinite;
        }

        /* ── Sent vs received bubble colors. Sent now matches the teacher's
           own "mine" bubble exactly (indigo gradient, white text) instead of
           WhatsApp green. Received uses a dark, glassy panel with a warm
           amber border to match the teacher's "other" bubble — same look
           for text AND voice notes, on both sides of the conversation. ── */
        :root {
          --wa-bubble-sent-bg: linear-gradient(135deg, #52525b 0%, #3f3f46 100%);
          --wa-bubble-sent-text: #ffffff;
          --wa-bubble-received-bg: linear-gradient(135deg, rgba(24,17,10,0.7), rgba(12,9,6,0.8));
          --wa-bubble-received-text: #fbf1e3;
          --wa-bubble-received-border: rgba(217,119,6,0.55);
          --wa-voice-accent: #f5a623;
          --wa-voice-accent-2: #d97706;
        }
        [data-theme='dark'], .dark {
          --wa-bubble-sent-bg: linear-gradient(135deg, #52525b 0%, #3f3f46 100%);
          --wa-bubble-sent-text: #ffffff;
          --wa-bubble-received-bg: linear-gradient(135deg, rgba(24,17,10,0.7), rgba(12,9,6,0.8));
          --wa-bubble-received-text: #fbf1e3;
          --wa-bubble-received-border: rgba(217,119,6,0.55);
          --wa-voice-accent: #f5a623;
          --wa-voice-accent-2: #d97706;
        }

        /* ── Wallpaper: WhatsApp's own dark chat backdrop — a near-black
           base with a faint doodle motif, no color blobs. ── */
        .chat-wallpaper {
          position: relative;
          background-color: #e5ddd5;
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg fill='none' stroke='%23000000' stroke-width='1.4' opacity='0.045'%3E%3Ccircle cx='30' cy='30' r='11'/%3E%3Cpath d='M85 20 l10 18 l-20 0 z'/%3E%3Crect x='140' y='15' width='22' height='16' rx='3'/%3E%3Cpath d='M20 95 q10 -14 20 0 q10 14 20 0' /%3E%3Cpath d='M105 90 h26 M118 78 v24'/%3E%3Ccircle cx='185' cy='95' r='9'/%3E%3Cpath d='M40 150 l16 -16 l16 16 l-16 16 z'/%3E%3Cpath d='M100 160 q0 -18 18 -18 q18 0 18 18 q0 10 -9 14 l-9 6 l-9 -6 q-9 -4 -9 -14z'/%3E%3Crect x='160' y='150' width='18' height='24' rx='3'/%3E%3Cpath d='M15 195 h30 M15 202 h20'/%3E%3Ccircle cx='120' cy='200' r='7'/%3E%3Cpath d='M175 190 l8 14 h-16 z'/%3E%3C/g%3E%3C/svg%3E");
          background-size: 220px 220px;
          background-repeat: repeat;
          background-attachment: fixed;
        }
        [data-theme='dark'] .chat-wallpaper, .dark .chat-wallpaper {
          background-color: #0b141a;
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.4' opacity='0.045'%3E%3Ccircle cx='30' cy='30' r='11'/%3E%3Cpath d='M85 20 l10 18 l-20 0 z'/%3E%3Crect x='140' y='15' width='22' height='16' rx='3'/%3E%3Cpath d='M20 95 q10 -14 20 0 q10 14 20 0' /%3E%3Cpath d='M105 90 h26 M118 78 v24'/%3E%3Ccircle cx='185' cy='95' r='9'/%3E%3Cpath d='M40 150 l16 -16 l16 16 l-16 16 z'/%3E%3Cpath d='M100 160 q0 -18 18 -18 q18 0 18 18 q0 10 -9 14 l-9 6 l-9 -6 q-9 -4 -9 -14z'/%3E%3Crect x='160' y='150' width='18' height='24' rx='3'/%3E%3Cpath d='M15 195 h30 M15 202 h20'/%3E%3Ccircle cx='120' cy='200' r='7'/%3E%3Cpath d='M175 190 l8 14 h-16 z'/%3E%3C/g%3E%3C/svg%3E");
          background-size: 220px 220px;
          background-repeat: repeat;
          background-attachment: fixed;
        }

        /* ── Single-message delete: a real circular control, not a bare icon.
           Quiet by default, warms to red chrome on hover, spins while busy. ── */
        .wa-msg-delete-btn {
          width: 26px; height: 26px; border-radius: 50%; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          color: #dc2626; background: rgba(220,38,38,0.08);
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .wa-msg-delete-btn:hover:not(:disabled) {
          background: rgba(220,38,38,0.16);
          transform: scale(1.08);
          box-shadow: 0 2px 10px rgba(220,38,38,0.25);
        }
        .wa-msg-delete-btn:active:not(:disabled) { transform: scale(0.94); }
        .wa-msg-delete-btn:disabled { opacity: 0.6; cursor: default; }

        .wa-reply-side-btn {
          width: 28px; height: 28px; border-radius: 50%; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }
        .wa-reply-side-btn:hover {
          transform: scale(1.12);
          box-shadow: 0 2px 10px rgba(0,0,0,0.18);
          filter: brightness(1.1);
        }
        .wa-reply-side-btn:active { transform: scale(0.96); }

        .wa-clear-mine-btn {
          display: flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700;
          color: #dc2626; background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.18);
          border-radius: 20px; padding: 4px 10px; cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .wa-clear-mine-btn:hover { background: rgba(220,38,38,0.16); transform: translateY(-1px); }
        .wa-clear-mine-btn:active { transform: translateY(0); }

        .wa-reply-quote {
          display: flex; align-items: flex-start; gap: 6px;
          padding: 6px 9px; cursor: pointer; font-size: 11.5px;
          transition: filter 0.15s ease;
        }
        .wa-reply-quote:hover { filter: brightness(1.08); }

        /* ── Voice note capsule — the pill-shaped, amber-bordered bubble that
           matches the target design for received notes, with a subtle
           breathing glow around the whole capsule while it's playing. ── */
        .wa-voice-capsule {
          transition: box-shadow 0.3s ease, transform 0.2s ease;
        }
        .wa-voice-capsule-playing {
          animation: voiceCapsuleGlow 1.9s ease-in-out infinite;
        }
        @keyframes voiceCapsuleGlow {
          0%, 100% { box-shadow: 0 0 0 0 var(--voice-glow-color, rgba(245,158,11,0.4)), 0 3px 14px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 0 0 9px rgba(245,158,11,0), 0 3px 14px rgba(0,0,0,0.4); }
        }

        .wa-voice-play-btn {
          width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .wa-voice-play-btn:hover { transform: scale(1.08); }
        .wa-voice-play-btn:active { transform: scale(0.94); }
        .wa-voice-play-btn-active { animation: voicePlayPulse 1.6s ease-in-out infinite; }
        @keyframes voicePlayPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--voice-glow-color, rgba(245,158,11,0.4)); }
          50% { box-shadow: 0 0 0 7px rgba(245,158,11,0); }
        }

        .wa-voice-wave {
          display: flex; align-items: center; gap: 2.5px; height: 26px; padding: 1px 0;
        }
        .wa-voice-bar {
          width: 3px; border-radius: 3px; flex-shrink: 0;
          transition: height 0.18s ease, background 0.18s ease, transform 0.15s ease;
        }
        .wa-voice-bar-live { animation: voiceBarPulse 0.55s ease-in-out infinite alternate; transform-origin: center; }
        @keyframes voiceBarPulse { from { transform: scaleY(0.8); } to { transform: scaleY(1.25); } }

        .wa-voice-live-dot {
          width: 5px; height: 5px; border-radius: 50%; display: inline-block;
          animation: pulse 1s infinite;
        }

        /* ── Composer: recording pill + pre-send preview, now in the same
           warm amber family as the received voice-note capsules instead
           of red, with a soft glowing ring while actively recording. ── */
        .wa-recording-panel {
          flex: 1; display: flex; align-items: center; gap: 9px;
          background: var(--surface-100); border-radius: 22px; padding: 7px 14px;
          border: 1.5px solid rgba(245,158,11,0.35);
          animation: recordingPanelIn 0.18s ease both;
        }
        .wa-recording-panel-live {
          animation: recordingPanelIn 0.18s ease both, recordingPanelGlow 1.8s ease-in-out infinite;
        }
        @keyframes recordingPanelIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes recordingPanelGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.28); border-color: rgba(245,158,11,0.35); }
          50% { box-shadow: 0 0 0 7px rgba(245,158,11,0); border-color: rgba(245,158,11,0.6); }
        }
        .wa-rec-dot {
          width: 9px; height: 9px; border-radius: 50%; background: #f5a623; flex-shrink: 0;
          animation: recDotPulse 1.1s ease-in-out infinite;
        }
        @keyframes recDotPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); transform: scale(1); }
          50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); transform: scale(1.15); }
        }
        .wa-recording-time { font-size: 13px; font-weight: 700; color: #f5a623; font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .wa-live-wave { flex: 1; display: flex; align-items: center; gap: 2.5px; height: 26px; min-width: 0; overflow: hidden; }
        .wa-live-bar {
          width: 3px; min-width: 3px; border-radius: 3px; flex-shrink: 0;
          background: linear-gradient(180deg, #fbbf24, #d97706);
          transition: height 0.08s ease-out;
        }
        .wa-voice-cancel-btn, .wa-voice-send-btn {
          width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; color: #fff;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .wa-voice-cancel-btn { background: rgba(120,113,108,0.16); color: #a8a29e; }
        .wa-voice-cancel-btn:hover { background: rgba(120,113,108,0.26); transform: scale(1.06); }
        .wa-voice-send-btn-amber { background: linear-gradient(135deg, #f5a623, #d97706); }
        .wa-voice-send-btn:hover { transform: scale(1.08); box-shadow: 0 4px 14px rgba(217,119,6,0.35); }
        .wa-voice-send-btn:active, .wa-voice-cancel-btn:active { transform: scale(0.92); }

        @keyframes ibxChromeShimmer { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes msgBubbleIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes replyBarIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes avatarGlowPulse { 0%, 100% { box-shadow: 0 0 0 0 var(--glow-color, rgba(124,58,237,0.45)); } 50% { box-shadow: 0 0 0 6px rgba(124,58,237,0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes memberSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInFromRight { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes ibxRowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ibxBadgePulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.35); } 50% { box-shadow: 0 0 0 5px rgba(220,38,38,0); } }
        @keyframes ibxGlowDrift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-8px, 6px) scale(1.08); } }
        @keyframes ibxIconFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @media (prefers-reduced-motion: reduce) {
          .discussion-list-item, .discussion-list-item *,
          .wa-msg-delete-btn, .wa-clear-mine-btn, .wa-reply-quote, .wa-reply-side-btn,
          .wa-voice-play-btn-active, .wa-voice-bar-live, .wa-voice-live-dot,
          .wa-rec-dot, .wa-recording-panel, .wa-voice-capsule-playing { animation: none !important; }
        }
      `}</style>
    </div>
  );
}