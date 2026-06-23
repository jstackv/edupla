import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  Users, MessageSquare, Send, Smile, Paperclip,
  CheckCheck, X
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
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
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
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all"
      style={{
        borderBottom: '1px solid var(--card-border)',
        background: active ? 'rgba(99,102,241,0.06)' : undefined,
      }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm text-white font-bold text-sm"
        style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
            {timeAgo(g.updated_at || g.created_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            {lastMsg
              ? <><span className="font-medium">{lastMsg.author_name}:</span> {lastMsg.content}</>
              : <span className="italic">No messages yet — start the conversation!</span>
            }
          </p>
          {g.message_count > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1.5"
              style={{ background: 'linear-gradient(135deg, #059669, #0d9488)', color: 'white' }}>
              {g.message_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
            {g.class_name}
          </span>
          <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Users className="w-2.5 h-2.5" /> {g.member_count} members
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Group chat ──────────────────────────────────────────────────────── */
function GroupChat({ group, myName, onClose, onMessageSent }) {
  const [text, setText]       = useState('');
  const [posting, setPosting] = useState(false);
  const [messages, setMessages] = useState(group.messages || []);
  const inputRef       = useRef(null);
  const messagesEndRef = useRef(null);
  const [a, b] = groupColor(group.id);

  // Sync when group prop changes (re-fetch)
  useEffect(() => { setMessages(group.messages || []); }, [group.id, group.messages?.length]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Enrich messages with grouping + date separators
  const enriched = [];
  let lastDate = null;
  messages.forEach((m, i) => {
    const dateLabel = fmtDateSep(m.created_at || Date.now());
    if (dateLabel !== lastDate) { enriched.push({ type: 'date', label: dateLabel, key: `d${i}` }); lastDate = dateLabel; }
    const prev = messages[i - 1]; const next = messages[i + 1];
    const isMine = m.author_name === myName;
    enriched.push({
      type: 'msg', ...m, isMine,
      isFirst: !prev || prev.author_name !== m.author_name,
      isLast:  !next || next.author_name !== m.author_name,
      key: m.id || `m${i}`,
    });
  });

  const handleTyping = (e) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSend = async () => {
    if (!text.trim() || posting) return;
    const content = text.trim();
    setText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setPosting(true);
    try {
      const res = await api.post(`/group-discussions/${group.id}/messages`, { content });
      const newMsg = res.data.msg;
      setMessages(prev => [...prev, newMsg]);
      onMessageSent && onMessageSent(newMsg);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
      setText(content); // restore
    } finally { setPosting(false); }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${a}, ${b})`, borderRadius: '16px 16px 0 0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 14 }}>
          {(group.name || 'G').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>
            {group.class_name} · {(group.members || []).length} members
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Members bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid var(--card-border)' }}>
        {(group.members || []).map(m => (
          <div key={m.id} className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: m.name === myName ? 'rgba(99,102,241,0.12)' : 'rgba(5,150,105,0.1)',
              color: m.name === myName ? '#6366f1' : '#059669',
            }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: m.name === myName ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #059669, #0d9488)' }}>
              {m.name[0].toUpperCase()}
            </div>
            {m.name}{m.name === myName ? ' (you)' : ''}
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-wallpaper flex-1 overflow-y-auto" style={{ padding: '16px 14px 8px' }}>
        {/* Welcome chip */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <span className="chat-date-chip">🤝 Your group workspace — collaborate freely!</span>
        </div>

        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Say hello and get started!</p>
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
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                  {(item.author_name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: item.isMine ? 'flex-end' : 'flex-start', maxWidth: '68%' }}>
              {!item.isMine && item.isFirst && (
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, marginLeft: 4, color: '#059669' }}>{item.author_name}</div>
              )}
              <div className={item.isMine ? 'chat-bubble-mine' : 'chat-bubble-other'}
                style={{ padding: '9px 13px', borderRadius: item.isMine ? (item.isFirst ? '18px 4px 18px 18px' : '18px 4px 4px 18px') : (item.isFirst ? '4px 18px 18px 18px' : '4px 18px 18px 4px') }}>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word', margin: 0 }}>{item.content}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.65 }}>
                    {new Date(item.created_at || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {item.isMine && <CheckCheck style={{ width: 12, height: 12, opacity: 0.7 }} />}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '10px 12px', display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
        <button className="chat-toolbar-btn"><Smile style={{ width: 20, height: 20 }} /></button>
        <button className="chat-toolbar-btn"><Paperclip style={{ width: 20, height: 20 }} /></button>
        <textarea
          ref={inputRef}
          value={text}
          onChange={handleTyping}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Share with your group…"
          style={{ flex: 1, resize: 'none', border: '1.5px solid var(--card-border)', borderRadius: 20, padding: '9px 14px', fontSize: 13.5, lineHeight: 1.5, outline: 'none', background: 'var(--surface-100)', color: 'var(--text-primary)', minHeight: 40, maxHeight: 120, overflowY: 'auto', transition: 'border-color 0.15s, box-shadow 0.15s' }}
          onFocus={e => { e.target.style.borderColor = a; e.target.style.boxShadow = `0 0 0 3px ${a}22`; }}
          onBlur={e => { e.target.style.borderColor = 'var(--card-border)'; e.target.style.boxShadow = 'none'; }}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={posting || !text.trim()}
          style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
          {posting
            ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            : <Send style={{ width: 16, height: 16 }} />
          }
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main page
══════════════════════════════════════════════ */
export default function StudentGroups() {
  const { user } = useAuth();
  const myName = user?.name || '';

  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/group-discussions/my/groups');
      setGroups(res.data.groups || []);
    } catch { toast.error('Failed to load groups'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openGroup = async (g) => {
    setActiveGroup(g);
    setDetailLoading(true);
    try {
      const res = await api.get(`/group-discussions/${g.id}`);
      setGroupDetail(res.data.group);
    } catch { toast.error('Failed to load group'); setGroupDetail(null); }
    finally { setDetailLoading(false); }
  };

  const handleMessageSent = (newMsg) => {
    // Update the sidebar list with new last_message and incremented count
    setGroups(prev => prev.map(g =>
      g.id === activeGroup?.id
        ? { ...g, last_message: newMsg, message_count: g.message_count + 1, updated_at: new Date().toISOString() }
        : g
    ));
  };

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* ── Left sidebar ── */}
      <div className={`flex flex-col ${groupDetail ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex-1'}`}
        style={{ background: 'var(--card-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>

        {/* Header */}
        <div className="px-4 py-4 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5" /> My Groups
            </h2>
            <span className="text-white/70 text-xs">{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-white/60 text-xs">Collaborate with your classmates independently</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-7 h-7 rounded-full" style={{ border: '3px solid var(--card-border)', borderTopColor: '#059669' }} />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <Users className="w-14 h-14 mb-3 opacity-20" style={{ color: 'var(--text-secondary)' }} />
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No groups yet</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your teacher will add you to a group when collaboration begins.</p>
            </div>
          ) : (
            groups.map(g => (
              <GroupCard key={g.id} g={g} onClick={() => openGroup(g)} active={activeGroup?.id === g.id} />
            ))
          )}
        </div>
      </div>

      {/* ── Right: chat panel ── */}
      {groupDetail ? (
        <div className="flex-1 lg:ml-3 flex flex-col rounded-2xl overflow-hidden"
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
              myName={myName}
              onClose={() => { setActiveGroup(null); setGroupDetail(null); }}
              onMessageSent={handleMessageSent}
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
        <div className="hidden lg:flex flex-1 ml-3 items-center justify-center rounded-2xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(5,150,105,0.1)' }}>
              <MessageSquare className="w-10 h-10" style={{ color: '#059669' }} />
            </div>
            <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Select a group</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pick a group to start collaborating with your classmates</p>
          </div>
        </div>
      )}
    </div>
  );
}
