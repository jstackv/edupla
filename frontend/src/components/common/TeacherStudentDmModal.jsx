import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { MessageCircle, Send, Trash2, X, Lock, Unlock, PauseCircle, PlayCircle } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

/* ══════════════════════════════════════════════════════════════════════
   TeacherStudentDmModal
   Private one-to-one chat between a teacher and a student they teach.
   Opened from the teacher's Students list via the "Message" action.
   Only the teacher can start this conversation — sending the first
   message here is what makes it visible to the student at all.
══════════════════════════════════════════════════════════════════════ */
export default function TeacherStudentDmModal({ studentId, studentName, onClose }) {
  const [messages, setMessages]   = useState([]);
  const [peer, setPeer]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [text, setText]           = useState('');
  const [posting, setPosting]     = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing]   = useState(false);
  const [disabled, setDisabled]   = useState(false);
  const [statusConfirm, setStatusConfirm] = useState(false); // confirm before pausing
  const [statusLoading, setStatusLoading] = useState(false);

  const pollRef = useRef(null);
  const lastMsgTimeRef = useRef(null);
  const messagesEndRef = useRef(null);

  const fetchThread = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const params = lastMsgTimeRef.current ? { since: lastMsgTimeRef.current } : {};
      const res = await api.get(`/teacher-messages/student/${studentId}`, { params });
      setPeer(res.data.peer);
      setDisabled(!!res.data.disabled);
      const fresh = res.data.messages || [];
      if (fresh.length) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m.id)));
          const toAdd = fresh.filter(m => !existingIds.has(String(m.id)));
          if (!toAdd.length) return prev;
          lastMsgTimeRef.current = toAdd[toAdd.length - 1].created_at;
          return [...prev, ...toAdd];
        });
      }
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.message || 'Failed to load conversation');
    } finally { if (!silent) setLoading(false); }
  }, [studentId]);

  useEffect(() => {
    fetchThread(false);
    pollRef.current = setInterval(() => fetchThread(true), 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchThread]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSend = async () => {
    if (!text.trim() || posting || disabled) return;
    const content = text.trim(); setText('');
    setPosting(true);
    try {
      const res = await api.post(`/teacher-messages/student/${studentId}`, { content });
      setMessages(prev => [...prev, res.data.msg]);
      lastMsgTimeRef.current = res.data.msg.created_at;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); setText(content); }
    finally { setPosting(false); }
  };

  const handleDelete = async (messageId) => {
    setDeletingId(messageId);
    try {
      await api.delete(`/teacher-messages/student/${studentId}/messages/${messageId}`);
      setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
    finally { setDeletingId(null); }
  };

  const handleToggleStatus = async (nextDisabled) => {
    setStatusLoading(true);
    try {
      const res = await api.patch(`/teacher-messages/student/${studentId}/status`, { disabled: nextDisabled });
      setDisabled(!!res.data.disabled);
      setStatusConfirm(false);
      toast.success(nextDisabled ? 'Conversation paused' : 'Conversation restored');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update conversation'); }
    finally { setStatusLoading(false); }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const res = await api.delete(`/teacher-messages/student/${studentId}/messages`);
      setMessages(prev => prev.filter(m => m.sender_role !== 'teacher'));
      setClearConfirm(false);
      toast.success(res.data.message || 'Your messages were cleared');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to clear'); }
    finally { setClearing(false); }
  };

  const displayName = peer?.name || studentName || 'Student';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden shadow-2xl" style={{ maxWidth: 440, height: '70vh', background: 'var(--card-bg)' }}>
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #9333ea, #7e22ce)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
            {displayName[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm truncate">{displayName}</div>
            <div className="text-white/60 text-[10px] flex items-center gap-1">
              {disabled ? (<><Lock className="w-2.5 h-2.5" /> Conversation paused</>) : 'Private message · only the two of you can see this'}
            </div>
          </div>
          <button
            onClick={() => (disabled ? handleToggleStatus(false) : setStatusConfirm(true))}
            disabled={statusLoading}
            title={disabled ? 'Restore conversation' : 'Pause conversation'}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/85 transition-all flex-shrink-0 disabled:opacity-50"
            style={{ transform: statusLoading ? 'scale(0.9)' : 'scale(1)' }}>
            {disabled ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {disabled && (
          <div className="dm-paused-banner flex items-center gap-2 px-3.5 py-2 flex-shrink-0">
            <Lock className="w-3.5 h-3.5" style={{ color: '#dc2626', flexShrink: 0 }} />
            <span className="text-[11px] font-medium flex-1" style={{ color: '#b91c1c' }}>
              You paused this conversation. Neither of you can send messages until you restore it.
            </span>
            <button onClick={() => handleToggleStatus(false)} disabled={statusLoading}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 transition-all hover:opacity-85 active:scale-95 disabled:opacity-50"
              style={{ background: '#dc2626', color: '#fff' }}>
              <Unlock className="w-2.5 h-2.5" /> Restore
            </button>
          </div>
        )}

        <div className="flex items-center justify-end px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <button onClick={() => setClearConfirm(true)}
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full transition-all hover:opacity-80"
            style={{ color: '#dc2626' }}>
            <Trash2 className="w-2.5 h-2.5" /> Clear my messages
          </button>
        </div>

        <div className="chat-wallpaper tg-scroll flex-1 overflow-y-auto" style={{ padding: '14px 12px' }}>
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : messages.length === 0 ? (
            <div className="tg-empty-state flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="w-8 h-8 mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Send the first message to start this private conversation.</p>
            </div>
          ) : messages.map(m => {
            const isMine = m.sender_role === 'teacher';
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
                    background: isMine ? 'linear-gradient(135deg, #9333ea, #7e22ce)' : 'var(--surface-100)',
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
            placeholder={disabled ? 'Restore the conversation to send messages…' : `Message ${displayName}…`}
            disabled={disabled}
            className="flex-1 px-3.5 py-2 rounded-full text-sm outline-none disabled:opacity-60"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' }} />
          <button onClick={handleSend} disabled={!text.trim() || posting || disabled}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #9333ea, #7e22ce)' }}>
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <ConfirmDialog isOpen={clearConfirm} onClose={() => setClearConfirm(false)} onConfirm={handleClear} loading={clearing}
        title="Clear My Messages" message="This deletes every message you've sent in this private DM. The student's replies stay visible to them." confirmText="Clear My Messages" variant="danger" />

      <ConfirmDialog isOpen={statusConfirm} onClose={() => setStatusConfirm(false)} onConfirm={() => handleToggleStatus(true)} loading={statusLoading}
        title="Pause This Conversation" message={`${displayName} won't be able to message you, and you won't be able to message them, until you restore this conversation. Your message history stays intact.`}
        confirmText="Pause Conversation" variant="danger" />

      <style>{`
        @keyframes dmPausedSlideDown {
          from { opacity: 0; transform: translateY(-6px); max-height: 0; }
          to   { opacity: 1; transform: translateY(0); max-height: 60px; }
        }
        .dm-paused-banner {
          background: rgba(220,38,38,0.08);
          border-bottom: 1px solid rgba(220,38,38,0.18);
          animation: dmPausedSlideDown 220ms ease both;
        }
      `}</style>
    </div>
  );
}
