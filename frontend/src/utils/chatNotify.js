import toast from 'react-hot-toast';
import { MessageCircle, Mic, Image as ImageIcon, Paperclip } from 'lucide-react';
import { createElement } from 'react';

/* ══════════════════════════════════════════════════════════════════════
   Presence registry — which conversation (if any) is currently open on
   screen. The global background poller (ChatNotifyContext) checks this
   before toasting, so a user actively reading a chat never gets a
   redundant popup for a message they can already see on their screen.
   Deliberately a plain module-level value (not React state/context) so
   any component can register/clear it with zero extra re-renders.
══════════════════════════════════════════════════════════════════════ */
let activeConversationKey = null;

export function setActiveConversation(key) { activeConversationKey = key; }
export function clearActiveConversation(key) {
  if (activeConversationKey === key) activeConversationKey = null;
}
export function isConversationActive(key) {
  return activeConversationKey !== null && activeConversationKey === key;
}

/* ══════════════════════════════════════════════════════════════════════
   Seen-message registry — every place in the app that already toasted
   (or displayed) a message id registers it here, so the global poller
   never fires a second toast for the exact same message.
══════════════════════════════════════════════════════════════════════ */
const seenMessageIds = new Set();
const MAX_TRACKED = 400;

export function markMessageSeen(id) {
  if (id === undefined || id === null) return;
  seenMessageIds.add(String(id));
  if (seenMessageIds.size > MAX_TRACKED) {
    const arr = [...seenMessageIds];
    seenMessageIds.clear();
    arr.slice(-MAX_TRACKED / 2).forEach(x => seenMessageIds.add(x));
  }
}
export function hasSeenMessage(id) {
  return id !== undefined && id !== null && seenMessageIds.has(String(id));
}

/* ══════════════════════════════════════════════════════════════════════
   Deep-link target — set right before navigating away from a toast click,
   so whichever page mounts next (Student/Teacher Groups) knows exactly
   which group or DM conversation to open, instead of just landing on the
   generic list. A window CustomEvent covers the case where the target
   page is already mounted (no route change happens); the module-level
   value covers the case where it mounts fresh after navigation.
   Shapes:
     { type: 'group',     groupId }
     { type: 'leaderdm',  groupId }
     { type: 'dm', classId, peerId, peerName }
     { type: 'teacherdm', teacherId, teacherName }
══════════════════════════════════════════════════════════════════════ */
const CHAT_TARGET_EVENT = 'edupla:chat-target';
let pendingChatTarget = null;

export function setPendingChatTarget(target) {
  pendingChatTarget = target;
  window.dispatchEvent(new CustomEvent(CHAT_TARGET_EVENT, { detail: target }));
}

export function consumePendingChatTarget() {
  const t = pendingChatTarget;
  pendingChatTarget = null;
  return t;
}

/** Subscribe to future targets (already-mounted pages). Returns an unsubscribe fn. */
export function onPendingChatTarget(callback) {
  const handler = (e) => callback(e.detail);
  window.addEventListener(CHAT_TARGET_EVENT, handler);
  return () => window.removeEventListener(CHAT_TARGET_EVENT, handler);
}

/* ══════════════════════════════════════════════════════════════════════
   The toast itself — a nicer, on-brand replacement for the plain
   `toast.success('X sent you a message!')` calls scattered around the
   messaging screens. Works from ANY page since it only needs the
   react-hot-toast <Toaster/> mounted once in App.jsx.
══════════════════════════════════════════════════════════════════════ */
export function showChatToast({ name = 'Someone', preview = '', isVoice = false, kind = null, accent = '#6366f1', accent2 = '#4f46e5', onClick }) {
  // `kind` supersedes the legacy `isVoice` boolean once callers pass it —
  // 'voice' | 'image' | 'file' | null (plain text).
  const effectiveKind = kind || (isVoice ? 'voice' : null);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  toast.custom((t) => createElement('div', {
    onClick: () => { if (onClick) onClick(); toast.dismiss(t.id); },
    style: {
      display: 'flex', alignItems: 'flex-start', gap: 12,
      width: 340, maxWidth: 'calc(100vw - 32px)',
      padding: '14px 16px',
      borderRadius: 18,
      background: 'var(--card-bg, #ffffff)',
      border: '1px solid rgba(99,102,241,0.18)',
      boxShadow: '0 18px 46px rgba(15,17,23,0.22), 0 0 0 1px rgba(99,102,241,0.05)',
      cursor: onClick ? 'pointer' : 'default',
      opacity: t.visible ? 1 : 0,
      transform: t.visible ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.96)',
      transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      position: 'relative',
      overflow: 'hidden',
    },
  }, [
    // Left accent bar
    createElement('div', {
      key: 'accent',
      style: {
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(180deg, ${accent}, ${accent2})`,
      },
    }),
    // Avatar
    createElement('div', {
      key: 'avatar',
      style: {
        width: 40, height: 40, borderRadius: 13, flexShrink: 0,
        background: `linear-gradient(135deg, ${accent}, ${accent2})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: 15,
        fontFamily: "'Sora', sans-serif",
        boxShadow: `0 4px 14px ${accent}55`,
        marginLeft: 4,
      },
    }, initial),
    // Text block
    createElement('div', { key: 'text', style: { flex: 1, minWidth: 0 } }, [
      createElement('div', {
        key: 'row1',
        style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
      }, [
        createElement(MessageCircle, { key: 'icon', size: 12, color: accent }),
        createElement('span', {
          key: 'name',
          style: {
            fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13,
            color: 'var(--text-primary, #111827)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          },
        }, name),
      ]),
      createElement('div', {
        key: 'preview',
        style: {
          fontSize: 12.5, color: 'var(--text-secondary, #6b7280)',
          display: 'flex', alignItems: 'center', gap: 5,
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', lineHeight: 1.4,
        },
      }, effectiveKind === 'voice'
        ? [createElement(Mic, { key: 'mic', size: 11 }), 'Sent a voice note']
        : effectiveKind === 'image'
        ? [createElement(ImageIcon, { key: 'img', size: 11 }), 'Sent a photo']
        : effectiveKind === 'file'
        ? [createElement(Paperclip, { key: 'file', size: 11 }), 'Sent a file']
        : (preview || 'Sent you a new message')),
    ]),
  ]), { duration: 4200, position: 'top-right' });
}