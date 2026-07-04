import toast from 'react-hot-toast';
import { MessageCircle, Mic } from 'lucide-react';
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
   The toast itself — a nicer, on-brand replacement for the plain
   `toast.success('X sent you a message!')` calls scattered around the
   messaging screens. Works from ANY page since it only needs the
   react-hot-toast <Toaster/> mounted once in App.jsx.
══════════════════════════════════════════════════════════════════════ */
export function showChatToast({ name = 'Someone', preview = '', isVoice = false, accent = '#6366f1', accent2 = '#4f46e5', onClick }) {
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
      }, isVoice
        ? [createElement(Mic, { key: 'mic', size: 11 }), 'Sent a voice note']
        : (preview || 'Sent you a new message')),
    ]),
  ]), { duration: 4200, position: 'top-right' });
}