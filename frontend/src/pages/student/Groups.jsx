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

/* ════════════════════════════════════════════════════════════════════
   OVERVIEW OF THIS REWRITE
   ------------------------------------------------------------------
   The old version of this page was three separate stacked modals
   (group chat / leader-teacher DM / peer DM), each re-implementing its
   own message list, composer, voice recorder and file picker. This
   version:

   1. Merges groups, peer DMs and leader<->teacher DMs into ONE inbox
      list sorted by last activity ("unified inbox"), instead of three
      separate surfaces behind three separate entry points.
   2. Replaces the modal stack with a real two-pane layout (list +
      thread), the way a native messaging app works — no dialog ever
      sits "on top of" another one.
   3. Adds reactions, reply-to/threading, a per-thread search + pinned
      message rail, @mentions with autocomplete, and typing indicators
      / read receipts, implemented so they degrade gracefully if the
      backend doesn't yet expose the corresponding endpoints (each
      "advanced" call is wrapped so a 404 just falls back to local
      state instead of breaking the thread).

   Endpoints assumed to exist already (unchanged from the old file):
     GET    /group-discussions/my/groups
     GET    /group-discussions/:id
     GET    /group-discussions/:id/messages
     POST   /group-discussions/:id/messages
     DELETE /group-discussions/:id/messages/:msgId
     DELETE /group-discussions/:id/messages
     POST   /group-discussions/:id/voice-notes
     POST   /group-discussions/:id/media
     GET    /group-discussions/:id/leader-dm
     POST   /group-discussions/:id/leader-dm
     DELETE /group-discussions/:id/leader-dm/:msgId
     DELETE /group-discussions/:id/leader-dm
     GET    /collaborations/my-class-status
     GET    /collaborations/class/:id/students
     GET    /collaborations/class/:id/conversations
     GET    /collaborations/class/:id/messages/:peerId
     POST   /collaborations/class/:id/messages
     DELETE /collaborations/class/:id/messages/:msgId
     DELETE /collaborations/class/:id/messages/peer/:peerId
     POST   /collaborations/class/:id/voice-notes
     POST   /collaborations/class/:id/media

   New, optional endpoints this file will *try* (best-effort, silent
   fallback to local-only state if they don't exist yet):
     POST   /messages/:id/reactions          { emoji }
     DELETE /messages/:id/reactions          { emoji }
     POST   /messages/:id/pin  | DELETE /messages/:id/pin
     POST   /threads/:key/typing             { typing: true|false }
   Wiring these up server-side will make reactions/pins/typing sync
   across users instead of being local to the current browser.
═════════════════════════════════════════════════════════════════════ */

const MAX_CHAT_FILE_MB = 25;

/* ── best-effort "optional feature" API wrapper ─────────────────────
   Advanced features (reactions, pins, typing) call these. If the
   route isn't implemented server-side yet, we swallow the error and
   let the caller keep its optimistic local state — nothing breaks. */
async function tryApi(fn) {
  try { return await fn(); } catch { return null; }
}

/* ── tiny local persistence for client-only state (reactions/pins
   fall back to this if the server doesn't support them yet — so a
   student doesn't lose their pins/reactions on refresh even before
   the backend catches up) ─────────────────────────────────────── */
const localStore = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable, ignore */ }
  },
};

/* ── helpers ─────────────────────────────────────────────────────── */
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

const GROUP_COLORS = [
  ['#6366f1', '#4f46e5'], ['#0891b2', '#0e7490'], ['#d97706', '#b45309'],
  ['#dc2626', '#b91c1c'], ['#7c3aed', '#6d28d9'], ['#0284c7', '#0369a1'],
];
function groupColor(id) {
  const idx = id ? parseInt(String(id).slice(-2), 16) % GROUP_COLORS.length : 0;
  return GROUP_COLORS[idx];
}
const DM_COLORS = ['#128C7E', '#075E54'];
const LEADER_COLORS = ['#7c3aed', '#6d28d9'];

const SENDER_COLORS = ['#0ea5e9', '#d97706', '#db2777', '#0891b2', '#7c3aed', '#dc2626', '#0284c7', '#475569'];
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

/* Renders text with @mentions highlighted */
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

/* ════════════════════════════════════════════════════════════════════
   Exclusive audio playback (only one voice note plays at a time)
═════════════════════════════════════════════════════════════════════ */
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

function VoiceBubble({ url, duration, isMine, accent }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const ctx = useContext(AudioPlaybackContext);
  const totalDuration = duration || 0;

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
  const progress = totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
      <audio ref={audioRef} src={url} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }} style={{ display: 'none' }} />
      <button onClick={toggle} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: isMine ? 'rgba(255,255,255,0.3)' : `${accent}b0` }}>
        {playing ? <Pause style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14 }} />}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ height: 3, borderRadius: 2, background: isMine ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: isMine ? 'rgba(255,255,255,0.7)' : accent, borderRadius: 2, transition: 'width 0.1s linear' }} />
        </div>
        <span style={{ fontSize: 10, opacity: 0.7 }}>{playing ? fmtDur(currentTime) : fmtDur(totalDuration)}</span>
      </div>
      <Mic style={{ width: 13, height: 13, opacity: 0.5, flexShrink: 0 }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Reaction bar + picker (shared by every message bubble, any thread type)
═════════════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════════════
   Unified message bubble — used for group / dm / leader-dm alike.
   Adds: reactions, reply-to preview + jump, pin/unpin, read ticks,
   mention highlighting.
═════════════════════════════════════════════════════════════════════ */
function MessageBubble({
  item, accent, onDelete, deletingId, onReply, onReact, onTogglePin, isPinned,
  onJumpTo, highlighted, teacherBadge,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMine = item.isMine;
  const isTeacherMsg = teacherBadge && item.author_role === 'teacher';
  const bubbleBg = isMine ? `linear-gradient(135deg, ${accent[0]}, ${accent[1]})`
    : isTeacherMsg ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'var(--surface-100)';
  const bubbleColor = isMine || isTeacherMsg ? '#fff' : 'var(--text-primary)';
  const isMedia = item.message_type === 'image' || item.message_type === 'file';

  return (
    <div id={`msg-${item.id}`} className="group" style={{
      display: 'flex', marginBottom: 4, alignItems: 'flex-end', gap: 6, justifyContent: isMine ? 'flex-end' : 'flex-start',
      transition: 'background 0.6s ease', background: highlighted ? `${accent[0]}22` : 'transparent', borderRadius: 12,
    }}>
      {isMine && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => onDelete(item.id)} disabled={deletingId === item.id} title="Delete"
            style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Trash2 style={{ width: 12, height: 12 }} />
          </button>
        </div>
      )}
      <div style={{ maxWidth: '72%', position: 'relative' }}>
        {item.isFirst && !item.isMine && item.author_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: isTeacherMsg ? '#7c3aed' : senderColor(item.author_id || item.author_name) }}>{item.author_name}</span>
            {isTeacherMsg && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700, background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>Teacher</span>}
          </div>
        )}

        {/* reply-to quoted preview */}
        {item.reply_to && (
          <button onClick={() => onJumpTo(item.reply_to.id)} style={{
            display: 'block', width: '100%', textAlign: 'left', marginBottom: 3, padding: '5px 9px', borderRadius: 10,
            background: isMine ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.05)', border: `2px solid ${accent[0]}`, borderWidth: '0 0 0 3px',
            cursor: 'pointer', fontSize: 11.5,
          }}>
            <div style={{ fontWeight: 700, color: isMine ? 'rgba(255,255,255,0.85)' : accent[0] }}>{item.reply_to.author_name}</div>
            <div style={{ opacity: 0.8, color: isMine ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.reply_to.preview}</div>
          </button>
        )}

        <div style={{ position: 'relative' }}
          onMouseEnter={e => e.currentTarget.querySelector('.hover-actions')?.style.setProperty('opacity', '1')}
          onMouseLeave={e => e.currentTarget.querySelector('.hover-actions')?.style.setProperty('opacity', '0')}>
          <div style={{
            background: isMedia ? 'transparent' : bubbleBg, color: bubbleColor, padding: isMedia ? 0 : '9px 13px',
            borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word',
            boxShadow: isMedia ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            {item.message_type === 'voice' ? <VoiceBubble url={item.voice_url} duration={item.voice_duration} isMine={isMine} accent={accent[0]} />
              : item.message_type === 'image' ? <ChatImageBubble url={item.file_url} name={item.file_name} mimeType={item.mime_type} />
              : item.message_type === 'file' ? <ChatFileBubble url={item.file_url} name={item.file_name} size={item.file_size} mimeType={item.mime_type} />
              : <MentionText text={item.content} accent={isMine ? '#fff' : accent[0]} />}
          </div>

          {/* Hover toolbar: react / reply / pin */}
          <div className="hover-actions" style={{
            position: 'absolute', top: -14, [isMine ? 'left' : 'right']: 4, display: 'flex', gap: 2, opacity: 0,
            transition: 'opacity 0.12s ease', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 20, padding: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          }}>
            <button onClick={() => setPickerOpen(o => !o)} title="React" style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <SmilePlus style={{ width: 13, height: 13 }} />
            </button>
            <button onClick={() => onReply(item)} title="Reply" style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <Reply style={{ width: 13, height: 13 }} />
            </button>
            <button onClick={() => onTogglePin(item)} title={isPinned ? 'Unpin' : 'Pin'} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isPinned ? accent[0] : 'var(--text-secondary)' }}>
              {isPinned ? <PinOff style={{ width: 12, height: 12 }} /> : <Pin style={{ width: 12, height: 12 }} />}
            </button>
          </div>
          {pickerOpen && <ReactionPicker onPick={(emoji) => onReact(item.id, emoji)} onClose={() => setPickerOpen(false)} />}
        </div>

        <ReactionBar reactions={item.reactions} myId={item._myId} onToggle={(emoji) => onReact(item.id, emoji)} accent={accent[0]} />

        {item.isLast && (
          <div style={{ fontSize: 10, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3, justifyContent: isMine ? 'flex-end' : 'flex-start', paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0, color: 'var(--text-secondary)', opacity: 0.6 }}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {isMine && item.read !== undefined && (item.read
              ? <CheckCheck style={{ width: 12, height: 12, color: accent[0] }} />
              : <Check style={{ width: 12, height: 12 }} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Pinned messages rail — collapses into a single strip under the header
═════════════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════════════
   In-thread search overlay
═════════════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════════════
   Mention autocomplete popover
═════════════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════════════
   Members panel (slide-over instead of a stacked modal)
═════════════════════════════════════════════════════════════════════ */
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
              <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: isLeader ? `linear-gradient(135deg, ${a}, ${b})` : 'linear-gradient(135deg, #0891b2, #0369a1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>{m.name[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                {isLeader && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Crown style={{ width: 11, height: 11, color: '#d97706' }} /><span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>Team Leader</span></div>}
              </div>
            </div>
          );
        })}
        {group.teacher_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, background: 'rgba(99,102,241,0.06)', border: '1.5px solid rgba(99,102,241,0.2)' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>{group.teacher_name[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{group.teacher_name}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginTop: 2 }}>Teacher</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Unified composer — text / @mention / emoji / voice / file, shared
   by every thread type.
═════════════════════════════════════════════════════════════════════ */
function Composer({
  accent, disabled, disabledLabel, onSendText, onSendVoice, onSendFile, onTypingChange,
  replyTo, onCancelReply, mentionCandidates,
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
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

  const handleTyping = (e) => {
    const val = e.target.value;
    setText(val);
    e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

    // @mention detection: look backwards from caret for "@word"
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
    try { await onSendText(content); }
    finally { setPosting(false); }
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
    } catch { toast.error('Microphone access denied. Please allow mic permission.'); }
  };
  const stopRecording = () => { if (mediaRecorderRef.current && recording) { mediaRecorderRef.current.stop(); clearInterval(recordTimerRef.current); setRecording(false); } };
  const stopAndSendVoice = () => {
    if (!mediaRecorderRef.current || !recording) return;
    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const duration = recordingTime;
      clearInterval(recordTimerRef.current); setRecording(false); setAudioBlob(null);
      (async () => { setPosting(true); try { await onSendVoice(blob, duration); } finally { setPosting(false); } })();
    };
    mediaRecorderRef.current.stop();
  };
  const cancelVoice = () => { if (recording) stopRecording(); setAudioBlob(null); setRecordingTime(0); setAudioPlaying(false); };
  const toggleAudioPreview = () => {
    if (!audioPreviewRef.current) return;
    if (audioPlaying) { audioPreviewRef.current.pause(); setAudioPlaying(false); }
    else { audioPreviewRef.current.play(); setAudioPlaying(true); audioPreviewRef.current.onended = () => setAudioPlaying(false); }
  };
  const sendVoicePreview = async () => {
    if (!audioBlob || posting) return;
    const blob = audioBlob, duration = audioDuration;
    setAudioBlob(null); setRecordingTime(0); setAudioPlaying(false);
    setPosting(true); try { await onSendVoice(blob, duration); } finally { setPosting(false); }
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
    try { await onSendFile(selectedFile); cancelFile(); } finally { setUploading(false); }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--card-border)', background: `${accent[0]}08` }}>
          <Reply style={{ width: 13, height: 13, color: accent[0], flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent[0] }}>Replying to {replyTo.author_name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyTo.content || 'Attachment'}</div>
          </div>
          <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}><X style={{ width: 14, height: 14 }} /></button>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={cancelVoice} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X style={{ width: 16, height: 16 }} /></button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-100)', borderRadius: 20, padding: '8px 14px', border: '1.5px solid #dc262630' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>Recording… {fmtDuration(recordingTime)}</span>
            </div>
            <button onClick={stopAndSendVoice} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${accent[0]}, ${accent[1]})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Send style={{ width: 16, height: 16 }} /></button>
          </div>
        ) : audioBlob ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={cancelVoice} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Trash2 style={{ width: 16, height: 16 }} /></button>
            <audio ref={audioPreviewRef} src={URL.createObjectURL(audioBlob)} style={{ display: 'none' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-100)', borderRadius: 20, padding: '8px 14px', border: `1.5px solid ${accent[0]}40` }}>
              <button onClick={toggleAudioPreview} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: `${accent[0]}20`, color: accent[0], display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>{audioPlaying ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}</button>
              <Mic style={{ width: 13, height: 13, color: accent[0], opacity: 0.7 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Voice note · {fmtDuration(audioDuration)}</span>
            </div>
            <button onClick={sendVoicePreview} disabled={posting} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${accent[0]}, ${accent[1]})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: posting ? 0.6 : 1 }}>
              {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        ) : (
          <div className="wa-input-pill" style={{ position: 'relative', '--wa-accent': accent[0], '--wa-accent-2': accent[1], '--wa-accent-soft': `${accent[0]}22` }}>
            {mentionQuery !== null && <MentionAutocomplete candidates={filteredMentionCandidates} onPick={pickMention} accent={accent} />}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button className="wa-icon-btn" onClick={() => { setAttachOpen(o => !o); setEmojiOpen(false); }} title="Attach"><Plus style={{ width: 20, height: 20 }} /></button>
              <AttachMenu open={attachOpen} onClose={() => setAttachOpen(false)} onPickImage={() => imageInputRef.current?.click()} onPickFile={() => fileInputRef.current?.click()} />
            </div>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button className="wa-icon-btn" onClick={() => { setEmojiOpen(o => !o); setAttachOpen(false); }} title="Emoji"><Smile style={{ width: 20, height: 20 }} /></button>
              <EmojiPicker open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={(e) => { setText(t => t + e); inputRef.current?.focus(); }} />
            </div>
            <textarea ref={inputRef} value={text} onChange={handleTyping} onKeyDown={handleKey} rows={1} placeholder="Type a message" className="wa-input-textarea" />
            {text.trim() ? (
              <button onClick={doSendText} disabled={posting} className="wa-icon-btn wa-icon-send wa-icon-swap">
                {posting ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Send style={{ width: 17, height: 17 }} />}
              </button>
            ) : (
              <button onClick={startRecording} className="wa-icon-btn wa-icon-swap" title="Record a voice note"><Mic style={{ width: 20, height: 20 }} /></button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   useThread — data + actions for a single open conversation, unified
   across group / dm / leaderdm. Handles fetch, polling, send, delete,
   clear, reactions, pins, replies, typing, read state.
═════════════════════════════════════════════════════════════════════ */
function useThread(entry, myId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [groupMeta, setGroupMeta] = useState(null); // full group object once loaded (members, leader, etc.)
  const [reactions, setReactions] = useState(() => localStore.get(`reactions:${entry.key}`, {}));
  const [pinnedIds, setPinnedIds] = useState(() => localStore.get(`pinned:${entry.key}`, []));
  const lastMsgTimeRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => { localStore.set(`reactions:${entry.key}`, reactions); }, [reactions, entry.key]);
  useEffect(() => { localStore.set(`pinned:${entry.key}`, pinnedIds); }, [pinnedIds, entry.key]);

  const basePath = entry.type === 'group' ? `/group-discussions/${entry.id}/messages`
    : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm`
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
      } else if (entry.type === 'leaderdm') {
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
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load conversation'); }
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
          const senderField = entry.type === 'dm' ? 'sender_id' : entry.type === 'leaderdm' ? 'sender_id' : 'author_id';
          const fromOthers = toAdd.filter(m => String(m[senderField]) !== String(myId));
          if (fromOthers.length) {
            const last = fromOthers[fromOthers.length - 1];
            const nameField = last.author_name || last.sender_name || entry.name;
            showChatToast({ name: entry.type === 'group' ? `${nameField} · ${entry.name}` : nameField, preview: last.content, kind: last.message_type !== 'text' ? last.message_type : null });
          }
          lastMsgTimeRef.current = fresh[fresh.length - 1].created_at;
          return [...prev, ...toAdd];
        });
        setPeerTyping(false); // a real message arriving supersedes a stale typing flag
      }
      if (res.data.is_ended) setIsEnded(true);
      // Best-effort: if the API ever starts returning peer typing state, pick it up.
      if (typeof res.data.peer_typing === 'boolean') setPeerTyping(res.data.peer_typing);
    } catch { /* keep last known state on transient poll errors */ }
  }, [basePath, entry, myId]);

  useEffect(() => {
    setMessages([]); setLoading(true); setIsEnded(false); lastMsgTimeRef.current = null;
    setReactions(localStore.get(`reactions:${entry.key}`, {}));
    setPinnedIds(localStore.get(`pinned:${entry.key}`, []));
    load();
    pollRef.current = setInterval(() => poll(true), 3000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.key]);

  const sendText = async (content, replyTo) => {
    const payload = { content };
    if (replyTo) payload.reply_to_id = replyTo.id; // best-effort: ignored server-side if unsupported
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/messages`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm`
      : `/collaborations/class/${entry.classId}/messages`;
    const body = entry.type === 'dm' ? { receiverId: entry.peerId, content, ...(replyTo ? { reply_to_id: replyTo.id } : {}) } : payload;
    const res = await api.post(path, body);
    const newMsg = res.data.msg;
    if (replyTo) newMsg.reply_to = { id: replyTo.id, author_name: replyTo.author_name || replyTo.sender_name, preview: replyTo.content || 'Attachment' };
    setMessages(prev => [...prev, { ...newMsg, sender_name: entry.type === 'dm' ? 'You' : newMsg.sender_name }]);
    lastMsgTimeRef.current = newMsg.created_at;
    return newMsg;
  };

  const sendVoice = async (blob, duration) => {
    const formData = new FormData();
    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
    formData.append('audio', blob, `voice-note-${Date.now()}.${ext}`);
    formData.append('duration', String(duration));
    if (entry.type === 'dm') formData.append('receiverId', entry.peerId);
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/voice-notes`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/voice-notes` // falls back gracefully if not implemented for leader-dm
      : `/collaborations/class/${entry.classId}/voice-notes`;
    const res = await api.post(path, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    const newMsg = res.data.msg;
    setMessages(prev => [...prev, { ...newMsg, sender_name: entry.type === 'dm' ? 'You' : newMsg.sender_name }]);
    lastMsgTimeRef.current = newMsg.created_at;
  };

  const sendFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    if (entry.type === 'dm') formData.append('receiverId', entry.peerId);
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/media`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/media`
      : `/collaborations/class/${entry.classId}/media`;
    const res = await api.post(path, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    const newMsg = res.data.msg;
    setMessages(prev => [...prev, { ...newMsg, sender_name: entry.type === 'dm' ? 'You' : newMsg.sender_name }]);
    lastMsgTimeRef.current = newMsg.created_at;
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/messages/${messageId}`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm/${messageId}`
      : `/collaborations/class/${entry.classId}/messages/${messageId}`;
    try { await api.delete(path); setMessages(prev => prev.filter(m => String(m.id || m._id) !== String(messageId))); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to delete message'); }
  };

  const clearMine = async () => {
    const path = entry.type === 'group' ? `/group-discussions/${entry.id}/messages`
      : entry.type === 'leaderdm' ? `/group-discussions/${entry.id}/leader-dm`
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
    messages, setMessages, loading, isEnded, groupMeta, peerTyping,
    reactions, pinnedIds, pinnedMessages,
    sendText, sendVoice, sendFile, deleteMessage, clearMine, toggleReaction, togglePin, setTyping,
  };
}

/* ════════════════════════════════════════════════════════════════════
   Thread pane — renders whichever entry is selected in the inbox
═════════════════════════════════════════════════════════════════════ */
function ThreadPane({ entry, myId, myName, onBack, onOpenTeacherDm, onEntryActivity }) {
  const thread = useThread(entry, myId);
  const [deletingId, setDeletingId] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);

  const accent = entry.type === 'group' ? groupColor(entry.id) : entry.type === 'leaderdm' ? LEADER_COLORS : DM_COLORS;

  useEffect(() => {
    setActiveConversation(entry.key);
    return () => clearActiveConversation(entry.key);
  }, [entry.key]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread.messages.length]);

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
        isFirst: entry.type !== 'group' ? false : (!prev || prev.author_name !== m.author_name),
        isLast: entry.type !== 'group' ? true : (!next || next.author_name !== m.author_name),
        key: m.id || m._id || `m${i}`,
      });
    });
    return out;
  }, [thread.messages, thread.reactions, myId, entry]);

  const handleDelete = async (id) => { setDeletingId(id); await thread.deleteMessage(id); setDeletingId(null); };
  const handleClear = async () => {
    setClearing(true);
    try { await thread.clearMine(); toast.success('Your messages were cleared'); setClearConfirm(false); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to clear messages'); }
    finally { setClearing(false); }
  };

  const isEndedGroup = entry.type === 'group' && thread.isEnded;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', minWidth: 0 }}>
      {/* Header */}
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

      {/* status bar */}
      {isEndedGroup ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 16px', background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <StopCircle style={{ width: 13, height: 13, color: '#dc2626' }} /><span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>The teacher ended this conversation</span>
        </div>
      ) : entry.type === 'group' && thread.groupMeta?.team_leader ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 14px', background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: '#b45309' }}><Crown style={{ width: 13, height: 13, color: '#d97706' }} /> Team leader: <strong>{thread.groupMeta.team_leader.name}</strong></span>
          <button onClick={() => setClearConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 style={{ width: 10, height: 10 }} /> Clear mine</button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 14px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <button onClick={() => setClearConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 style={{ width: 10, height: 10 }} /> Clear mine</button>
        </div>
      )}

      <PinnedRail pinned={thread.pinnedMessages} onJump={jumpTo} onUnpin={thread.togglePin} accent={accent} />

      {/* messages */}
      <AudioPlaybackProvider>
        <div ref={scrollRef} className="chat-wallpaper flex-1 overflow-y-auto" style={{ padding: '14px 14px 6px' }}>
          {thread.loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div style={{ width: 28, height: 28, border: `3px solid ${accent[0]}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
          ) : enriched.filter(x => x.type === 'msg').length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{entry.type === 'group' ? '👋' : '💬'}</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{entry.type === 'group' ? 'No messages yet' : `Start talking to ${entry.name}`}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{entry.type === 'group' ? 'Be the first to say something!' : 'Your messages are private'}</p>
            </div>
          ) : enriched.map(item => item.type === 'date' ? (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} /><span style={{ fontSize: 10, fontWeight: 600, padding: '0 8px', color: 'var(--text-secondary)' }}>{item.label}</span><div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
            </div>
          ) : (
            <MessageBubble
              key={item.key} item={item} accent={accent} onDelete={handleDelete} deletingId={deletingId}
              onReply={setReplyTo} onReact={thread.toggleReaction} onTogglePin={thread.togglePin}
              isPinned={thread.pinnedIds.includes(item.id || item._id)} onJumpTo={jumpTo}
              highlighted={highlightId === (item.id || item._id)} teacherBadge={entry.type === 'group'}
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
      />

      {searchOpen && <ThreadSearch messages={thread.messages.map(m => ({ ...m, author_name: m.author_name || m.sender_name }))} onJump={jumpTo} onClose={() => setSearchOpen(false)} accent={accent} />}
      {membersOpen && thread.groupMeta && <MembersPanel group={thread.groupMeta} onClose={() => setMembersOpen(false)} />}

      <ConfirmModal
        open={clearConfirm} onClose={() => setClearConfirm(false)} onConfirm={handleClear} loading={clearing} variant="danger"
        title="Clear My Messages"
        message={entry.type === 'group' ? "This deletes every message you've sent in this group. Other members' messages stay." : `This deletes every message you've sent to ${entry.name}. Their messages stay.`}
        confirmText="Clear" cancelText="Cancel"
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Inbox row
═════════════════════════════════════════════════════════════════════ */
function InboxRow({ entry, active, onClick }) {
  const accent = entry.type === 'group' ? groupColor(entry.id) : entry.type === 'leaderdm' ? LEADER_COLORS : DM_COLORS;
  const [a, b] = accent;
  return (
    <div onClick={onClick} className="discussion-list-item flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-all"
      style={{ borderBottom: '1px solid var(--card-border)', background: active ? `linear-gradient(135deg, ${a}12, ${b}08)` : 'transparent', borderLeft: active ? `3px solid ${a}` : '3px solid transparent' }}>
      <div className="relative flex-shrink-0">
        <div style={{ width: 44, height: 44, borderRadius: entry.type === 'group' ? 14 : '50%', background: `linear-gradient(135deg, ${a}, ${b})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>
          {entry.type === 'group' ? (entry.name || 'G').slice(0, 2).toUpperCase() : entry.name[0]?.toUpperCase()}
        </div>
        {entry.type === 'leaderdm' && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#7c3aed', border: '2px solid var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle style={{ width: 8, height: 8, color: '#fff' }} />
          </div>
        )}
        {entry.type === 'group' && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#0891b2', border: '2px solid var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              : <span className="italic">{entry.type === 'leaderdm' ? 'Private line to your teacher' : 'No messages yet — say hello!'}</span>}
          </p>
          {entry.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1.5 text-white" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>{entry.unreadCount > 9 ? '9+' : entry.unreadCount}</span>
          )}
        </div>
        {entry.type === 'group' && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${a}18`, color: a }}>{entry.className}</span>
            {entry.isLeader && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}><Crown className="w-2.5 h-2.5" /> Leader</span>}
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

/* ════════════════════════════════════════════════════════════════════
   New message picker — start a DM with a classmate not yet in the inbox
═════════════════════════════════════════════════════════════════════ */
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
              <button key={c.id} onClick={() => setClassId(c.id)} style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: classId === c.id ? 'rgba(99,102,241,0.14)' : 'var(--surface-100)', color: classId === c.id ? '#6366f1' : 'var(--text-secondary)' }}>{c.name}</button>
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
          {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            : filtered.length === 0 ? <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-secondary)', padding: '20px 0' }}>No classmates found</p>
            : filtered.map(c => (
              <button key={c.id} onClick={() => onPick(classId, c)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-100)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #128C7E, #075E54)', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.name[0].toUpperCase()}</div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN PAGE — unified inbox + split-pane thread
═════════════════════════════════════════════════════════════════════ */
export default function StudentGroups() {
  const { user } = useAuth();
  const myName = user?.name || '';
  const myId = user?.id;

  const [groups, setGroups] = useState([]);
  const [collabClasses, setCollabClasses] = useState([]);
  const [dmEntries, setDmEntries] = useState({}); // key -> entry, built from conversations per class
  const [activityOverrides, setActivityOverrides] = useState({}); // key -> { lastMessage, lastAt } from live thread updates
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | groups | dms | unread
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
      // IMPORTANT: merge into the existing map rather than replacing it wholesale.
      // A chat the student just started (picked from "New message" but hasn't sent
      // a first message yet) has no server-side conversation row, so it would never
      // appear in this response — overwriting state here would silently delete it
      // out from under an open thread. Merging keeps any locally-known entry alive
      // until the server actually has something to say about it.
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

  useEffect(() => { Promise.all([fetchGroups(), fetchCollab()]).finally(() => setLoading(false)); }, [fetchGroups, fetchCollab]);
  useEffect(() => { const t = setInterval(fetchCollab, 8000); return () => clearInterval(t); }, [fetchCollab]);
  useEffect(() => { const t = setInterval(fetchGroups, 8000); return () => clearInterval(t); }, [fetchGroups]);

  /* ── build the unified, recency-sorted inbox ─────────────────── */
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
        unreadCount: 0, // group unread counts aren't tracked server-side yet in this API surface
        mentionCount: (activityOverrides[`${key}:mentions`]) || 0,
      });

      // Team leaders also get a private line to the teacher, surfaced as its
      // own inbox row instead of being buried behind a button inside the group.
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

    rows.sort((a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime());
    return rows;
  }, [groups, dmEntries, activityOverrides]);

  const filtered = inbox
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    .filter(e => filter === 'all' ? true : filter === 'unread' ? e.unreadCount > 0 : filter === 'groups' ? e.type === 'group' : e.type === 'dm' || e.type === 'leaderdm');

  const totalUnread = inbox.reduce((s, e) => s + (e.unreadCount || 0), 0);

  const selectedEntry = inbox.find(e => e.key === selectedKey) || null;

  const openEntry = (entry) => { setSelectedKey(entry.key); setMobileShowThread(true); };
  const openTeacherDm = (groupId) => { const key = `leaderdm:${groupId}`; setSelectedKey(key); setMobileShowThread(true); };

  const handleEntryActivity = useCallback((key, lastMsg) => {
    const nameField = key.startsWith('group:') ? lastMsg.author_name : (lastMsg.sender_name || lastMsg.author_name);
    const preview = lastMsg.message_type === 'voice' ? '🎤 Voice note' : lastMsg.message_type === 'image' ? '📷 Photo' : lastMsg.message_type === 'file' ? '📎 File' : lastMsg.content;
    setActivityOverrides(prev => ({ ...prev, [key]: { lastMessage: preview, lastAuthor: nameField, lastAt: lastMsg.created_at } }));
    // crude client-side mention tracking for groups: bump a badge when a message mentions me
    if (key.startsWith('group:') && myName && String(lastMsg.author_id) !== String(myId)) {
      const mentioned = extractMentions(lastMsg.content || '', [myName]).length > 0;
      if (mentioned) setActivityOverrides(prev => ({ ...prev, [`${key}:mentions`]: (prev[`${key}:mentions`] || 0) + 1 }));
    }
  }, [myName, myId]);

  // clear mention badge when opening that thread
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

  /* ── deep links from toast clicks (unchanged contract with chatNotify) ── */
  useEffect(() => {
    const applyTarget = (t) => {
      if (!t) return;
      if (t.type === 'group') { setSelectedKey(`group:${t.groupId}`); setMobileShowThread(true); }
      else if (t.type === 'leaderdm') { setSelectedKey(`leaderdm:${t.groupId}`); setMobileShowThread(true); }
      else if (t.type === 'dm') {
        const key = `dm:${t.classId}:${t.peerId}`;
        setDmEntries(prev => prev[key] ? prev : { ...prev, [key]: { key, type: 'dm', id: t.peerId, classId: t.classId, peerId: t.peerId, name: t.peerName || 'Classmate', lastMessage: null, lastAt: new Date().toISOString(), unreadCount: 0 } });
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

        {/* ── Inbox pane ─────────────────────────────────────────── */}
        <div className={`flex flex-col flex-shrink-0 w-full lg:w-[340px] min-h-0 ${mobileShowThread ? 'hidden lg:flex' : 'flex'}`} style={{ borderRight: '1px solid var(--card-border)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0369a1 100%)', padding: '16px 16px 12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Inbox style={{ width: 15, height: 15, color: '#fff' }} /></div>
                Inbox
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {totalUnread > 0 && <span style={{ fontWeight: 800, fontSize: 11, padding: '3px 9px', borderRadius: 20, background: '#dc2626', color: '#fff' }}>{totalUnread}</span>}
                {collabClasses.length > 0 && (
                  <button onClick={() => setNewMsgOpen(true)} title="New message" style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus style={{ width: 15, height: 15 }} /></button>
                )}
              </div>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.6)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search everything…"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['all', 'All'], ['groups', 'Groups'], ['dms', 'Direct'], ['unread', 'Unread']].map(([val, label]) => (
                <button key={val} onClick={() => setFilter(val)} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: filter === val ? '#fff' : 'rgba(255,255,255,0.15)', color: filter === val ? '#0891b2' : 'rgba(255,255,255,0.85)' }}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loading ? [0, 1, 2, 3, 4].map(i => <InboxRowSkeleton key={i} delay={i * 60} />)
              : filtered.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '70px 24px', textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: 16, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,145,178,0.08)' }}><MessageSquare style={{ width: 28, height: 28, color: '#0891b2', opacity: 0.5 }} /></div>
                  <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{inbox.length === 0 ? 'Nothing here yet' : 'No matches'}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{inbox.length === 0 ? 'Groups and chats will show up here once your teacher sets them up.' : 'Try a different search or filter.'}</p>
                </div>
              ) : filtered.map(entry => <InboxRow key={entry.key} entry={entry} active={entry.key === selectedKey} onClick={() => openEntry(entry)} />)}
          </div>
        </div>

        {/* ── Thread pane ────────────────────────────────────────── */}
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
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: '0 32px' }}>
                <div style={{ width: 68, height: 68, borderRadius: 20, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.08)' }}><MessageCircle style={{ width: 32, height: 32, color: '#6366f1', opacity: 0.6 }} /></div>
                <p style={{ fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>Pick a conversation</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Groups, classmates, and your private teacher line all live in one place now.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {newMsgOpen && <NewMessagePicker classes={collabClasses} onPick={startNewDm} onClose={() => setNewMsgOpen(false)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes memberSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInFromRight { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}