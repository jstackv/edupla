import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from './AuthContext';
import { showChatToast, isConversationActive, hasSeenMessage, markMessageSeen } from '../utils/chatNotify';

const ChatNotifyContext = createContext(null);
export const useChatNotify = () => useContext(ChatNotifyContext);

const POLL_INTERVAL = 10000; // 10s — background poll, independent of any open chat screen

function truncate(str, n = 60) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

export function ChatNotifyProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // conversationKey -> ISO timestamp (or message id) of the last message we've
  // already accounted for. Empty on mount, so the very first poll only SEEDS
  // this map (no toasts for pre-existing history) — only messages that show
  // up on later polls are genuinely "new" and worth interrupting the user for.
  const seenAtRef = useRef(new Map());
  const seededRef = useRef(new Set());
  const busyRef = useRef(false);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const goToGroups = useCallback(() => {
    if (!user) return;
    navigateRef.current(user.role === 'teacher' ? '/teacher/groups' : '/student/groups');
  }, [user]);

  const maybeToastPeerDm = useCallback((classId, convo) => {
    const key = `dm:${classId}:${convo.peer_id}`;
    const firstTime = !seededRef.current.has(key);
    seededRef.current.add(key);
    const prevAt = seenAtRef.current.get(key);
    seenAtRef.current.set(key, convo.last_at);

    if (firstTime) return;
    if (!convo.last_at || convo.last_at === prevAt) return;
    if (!convo.unread_count) return; // last message wasn't sent by the peer
    if (isConversationActive(key) || isConversationActive(`dmlist:${classId}`)) return; // user is already looking at this chat or its list

    showChatToast({
      name: convo.peer_name,
      preview: truncate(convo.last_message),
      isVoice: convo.last_message === '🎤 Voice note',
      onClick: goToGroups,
    });
  }, [goToGroups]);

  const maybeToastGroupMessage = useCallback((group, myId) => {
    const key = `group:${group.id}`;
    const lm = group.last_message;
    const firstTime = !seededRef.current.has(key);
    seededRef.current.add(key);
    const lmId = lm ? String(lm.id || lm._id) : null;
    const prevId = seenAtRef.current.get(key);
    if (lmId) seenAtRef.current.set(key, lmId);

    if (!lm || !lmId) return;
    if (firstTime) { markMessageSeen(lmId); return; }
    if (lmId === prevId) return;
    if (String(lm.author_id) === String(myId)) return;
    if (hasSeenMessage(lmId)) return; // already toasted by the open chat screen itself
    if (isConversationActive(key)) return;

    markMessageSeen(lmId);
    showChatToast({
      name: `${lm.author_name} · ${group.name}`,
      preview: truncate(lm.content),
      isVoice: lm.message_type === 'voice',
      onClick: goToGroups,
    });
  }, [goToGroups]);

  const maybeToastLeaderDm = useCallback(async (groupId, groupName, myId) => {
    const key = `leaderdm:${groupId}`;
    const firstTime = !seededRef.current.has(key);
    try {
      const since = seenAtRef.current.get(key);
      const res = await api.get(`/group-discussions/${groupId}/leader-dm`, {
        params: since ? { since } : {},
      });
      const msgs = res.data.messages || [];
      seededRef.current.add(key);
      if (msgs.length === 0) return;
      seenAtRef.current.set(key, msgs[msgs.length - 1].created_at);

      if (firstTime) { msgs.forEach(m => markMessageSeen(m.id)); return; }
      if (isConversationActive(key)) { msgs.forEach(m => markMessageSeen(m.id)); return; }

      const fromOther = msgs.filter(m => String(m.sender_id) !== String(myId) && !hasSeenMessage(m.id));
      fromOther.forEach(m => markMessageSeen(m.id));
      if (fromOther.length === 0) return;

      const last = fromOther[fromOther.length - 1];
      showChatToast({
        name: `${last.sender_name} · ${groupName}`,
        preview: truncate(last.content),
        onClick: goToGroups,
        accent: '#f59e0b', accent2: '#d97706',
      });
    } catch { /* silent — background poll */ }
  }, [goToGroups]);

  const pollStudent = useCallback(async (myId) => {
    try {
      const { data } = await api.get('/collaborations/my-class-status');
      const activeClasses = (data.classes || []).filter(c => c.collaboration_active);
      for (const cls of activeClasses) {
        try {
          const r = await api.get(`/collaborations/class/${cls.id}/conversations`);
          (r.data.conversations || []).forEach(convo => maybeToastPeerDm(cls.id, convo));
        } catch { /* class-level failure shouldn't block the rest */ }
      }
    } catch { /* no active collaboration classes / request failed — skip DMs this round */ }

    try {
      const { data } = await api.get('/group-discussions/my/groups');
      const groups = data.groups || [];
      for (const g of groups) {
        maybeToastGroupMessage(g, myId);
        if (g.is_team_leader) await maybeToastLeaderDm(g.id, g.name, myId);
      }
    } catch { /* silent */ }
  }, [maybeToastPeerDm, maybeToastGroupMessage, maybeToastLeaderDm]);

  const pollTeacher = useCallback(async (myId) => {
    try {
      const { data } = await api.get('/group-discussions');
      const groups = data.groups || [];
      for (const g of groups) {
        maybeToastGroupMessage(g, myId);
        if (g.is_owner) await maybeToastLeaderDm(g.id, g.name, myId);
      }
    } catch { /* silent */ }
  }, [maybeToastGroupMessage, maybeToastLeaderDm]);

  useEffect(() => {
    if (!user || (user.role !== 'student' && user.role !== 'teacher')) return undefined;

    const tick = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        if (user.role === 'student') await pollStudent(user.id);
        else await pollTeacher(user.id);
      } finally {
        busyRef.current = false;
      }
    };

    tick();
    const id = setInterval(tick, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [user, pollStudent, pollTeacher]);

  return (
    <ChatNotifyContext.Provider value={{ markMessageSeen }}>
      {children}
    </ChatNotifyContext.Provider>
  );
}