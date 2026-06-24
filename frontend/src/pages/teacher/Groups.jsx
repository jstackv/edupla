import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  Plus, Search, Users, Trash2, X, Send,
  Crown, Lock, Mail, Clock, Check, XCircle, Inbox,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────── */
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const COLORS = [
  ['#6366f1','#4f46e5'], ['#059669','#0d9488'], ['#d97706','#b45309'],
  ['#dc2626','#b91c1c'], ['#7c3aed','#6d28d9'], ['#0284c7','#0369a1'],
];
function groupColor(id) {
  const idx = id ? parseInt(String(id).slice(-2), 16) % COLORS.length : 0;
  return COLORS[idx];
}

// Small badge describing this teacher's own access state for a group.
function AccessBadge({ status }) {
  if (status === 'accepted') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"
        style={{ background: 'rgba(5,150,105,0.12)', color: '#059669' }}>
        <Check className="w-2.5 h-2.5" /> Joined
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"
        style={{ background: 'rgba(217,119,6,0.12)', color: '#d97706' }}>
        <Clock className="w-2.5 h-2.5" /> Invite pending
      </span>
    );
  }
  if (status === 'denied') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"
        style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
        <XCircle className="w-2.5 h-2.5" /> Declined
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"
      style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
      <Lock className="w-2.5 h-2.5" /> No access yet
    </span>
  );
}

/* ── Group card in sidebar list ──────────────────────────────────────── */
function GroupCard({ g, onOpen, onDelete, active }) {
  const [a, b] = groupColor(g.id);
  const initials = (g.name || 'G').slice(0, 2).toUpperCase();
  return (
    <div
      className="group flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all relative"
      style={{
        borderBottom: '1px solid var(--card-border)',
        background: active ? 'rgba(99,102,241,0.06)' : undefined,
      }}
      onClick={() => onOpen(g)}
    >
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
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
            {g.class_name}
          </span>
          {g.team_leader && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
              <Crown className="w-2.5 h-2.5" /> {g.team_leader.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Users className="w-3 h-3" /> {g.member_count}
          </span>
          <AccessBadge status={g.my_invitation_status} />
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(g); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full items-center justify-center hidden group-hover:flex transition-all hover:bg-red-50"
        title="Delete group">
        <Trash2 className="w-3.5 h-3.5 text-red-400" />
      </button>
    </div>
  );
}

/* ── Create group panel ──────────────────────────────────────────────── */
function CreateGroupPanel({ onClose, onCreated }) {
  const [classes, setClasses]     = useState([]);
  const [students, setStudents]   = useState([]);
  const [form, setForm]           = useState({ name: '', classId: '' });
  const [selected, setSelected]   = useState(new Set());
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    api.get('/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.classId) { setStudents([]); setSelected(new Set()); setTeamLeaderId(''); return; }
    setLoadingStudents(true);
    api.get(`/classes/${form.classId}/students`)
      .then(r => setStudents((r.data.students || []).map(s => ({ id: s._id || s.id, name: s.name }))))
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoadingStudents(false));
  }, [form.classId]);

  const toggleStudent = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (teamLeaderId === id) setTeamLeaderId('');
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase())
  );
  const selectedStudents = students.filter(s => selected.has(s.id));

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Group name is required');
    if (!form.classId)     return toast.error('Please select a class');
    if (selected.size === 0) return toast.error('Select at least one student');
    if (!teamLeaderId)      return toast.error('Please choose a team leader');
    setSaving(true);
    try {
      await api.post('/group-discussions', {
        name: form.name.trim(),
        classId: form.classId,
        memberIds: [...selected],
        teamLeaderId,
      });
      toast.success('Group created! 🎉');
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '16px 16px 0 0' }}>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-white" />
          <h3 className="text-white font-bold">New Group</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/80">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Group name */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Group Name *
          </label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Group A — Research Team"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Class picker */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Class *
          </label>
          <select
            value={form.classId}
            onChange={e => { setForm(f => ({ ...f, classId: e.target.value })); setSelected(new Set()); setTeamLeaderId(''); }}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' }}>
            <option value="">Select a class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Student selector */}
        {form.classId && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Students *
              </label>
              {students.length > 0 && (
                <button
                  onClick={() => {
                    if (selected.size === students.length) { setSelected(new Set()); setTeamLeaderId(''); }
                    else setSelected(new Set(students.map(s => s.id)));
                  }}
                  className="text-xs font-medium" style={{ color: '#6366f1' }}>
                  {selected.size === students.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
              <input
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="Search students…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
              />
            </div>

            {loadingStudents ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                {students.length === 0 ? 'No students enrolled in this class.' : 'No matches.'}
              </p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)', maxHeight: 240, overflowY: 'auto' }}>
                {filteredStudents.map(s => (
                  <label key={s.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-opacity-60"
                    style={{ borderBottom: '1px solid var(--card-border)', background: selected.has(s.id) ? 'rgba(99,102,241,0.06)' : undefined }}>
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="sr-only"
                      />
                      <div className="w-4.5 h-4.5 rounded-md flex items-center justify-center transition-all"
                        style={{
                          width: 18, height: 18, borderRadius: 5,
                          background: selected.has(s.id) ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent',
                          border: selected.has(s.id) ? 'none' : '1.5px solid var(--card-border)',
                        }}>
                        {selected.has(s.id) && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
                      {s.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  </label>
                ))}
              </div>
            )}

            {selected.size > 0 && (
              <p className="text-xs mt-2 font-medium" style={{ color: '#6366f1' }}>
                {selected.size} student{selected.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* Team leader picker — only from selected students */}
        {selectedStudents.length > 0 && (
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Team Leader *
            </label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.8 }}>
              The team leader is the only member who can invite a teacher into this group's conversation.
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)', maxHeight: 200, overflowY: 'auto' }}>
              {selectedStudents.map(s => (
                <label key={s.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--card-border)', background: teamLeaderId === s.id ? 'rgba(245,158,11,0.08)' : undefined }}>
                  <input
                    type="radio"
                    name="teamLeader"
                    checked={teamLeaderId === s.id}
                    onChange={() => setTeamLeaderId(s.id)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}>
                    {s.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  {teamLeaderId === s.id && <Crown className="w-4 h-4" style={{ color: '#d97706' }} />}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--card-border)' }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !form.name || !form.classId || selected.size === 0 || !teamLeaderId}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Create Group
        </button>
      </div>
    </div>
  );
}

/* ── Locked view — shown when this teacher has no accepted invitation ───── */
function LockedGroupPanel({ g, onClose }) {
  const [a, b] = groupColor(g.id);
  const status = g.my_invitation_status;

  let icon = <Lock className="w-9 h-9" style={{ color: '#6366f1' }} />;
  let title = 'No access to this conversation';
  let body = `The team leader (${g.team_leader?.name || 'a student'}) hasn't invited you yet. Once they send you an invitation, you'll be able to accept it from the Invitations tab.`;
  if (status === 'pending') {
    icon = <Clock className="w-9 h-9" style={{ color: '#d97706' }} />;
    title = 'Invitation pending';
    body = 'You\'ve been invited to this conversation. Go to the Invitations tab to accept or decline.';
  } else if (status === 'denied') {
    icon = <XCircle className="w-9 h-9" style={{ color: '#dc2626' }} />;
    title = 'You declined this invitation';
    body = 'You previously declined the team leader\'s invitation to join this conversation.';
  }

  return (
    <div className="flex flex-col h-full">
      <div style={{ background: `linear-gradient(135deg, ${a}, ${b})`, borderRadius: '16px 16px 0 0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 14 }}>
          {(g.name || 'G').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>{g.class_name} · {g.member_count} members</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <div>
          <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--surface-100)' }}>
            {icon}
          </div>
          <h3 className="font-bold text-lg mb-1.5" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', maxWidth: 320, margin: '0 auto' }}>{body}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Full conversation viewer — only reachable once invitation is accepted ── */
function GroupViewer({ group, myId, onClose, onMessageSent }) {
  const [a, b] = groupColor(group.id);
  const [messages, setMessages] = useState(group.messages || []);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { setMessages(group.messages || []); }, [group.id, group.messages?.length]);

  function fmtDateSep(ts) {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }

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

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const handleTyping = (e) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSend = async () => {
    if (!text.trim() || posting || !group.can_post) return;
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
      setText(content);
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

      {/* Access banner */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{ background: 'rgba(5,150,105,0.08)', borderBottom: '1px solid var(--card-border)' }}>
        <Check className="w-3.5 h-3.5" style={{ color: '#059669' }} />
        <span className="text-xs font-medium" style={{ color: '#059669' }}>
          The team leader invited you in — you can read and post in this conversation.
        </span>
      </div>

      {/* Members bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid var(--card-border)' }}>
        {(group.members || []).map(m => (
          <div key={m.id} className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
              {m.name[0].toUpperCase()}
            </div>
            {m.name}
            {group.team_leader?.id === m.id && <Crown className="w-3 h-3" style={{ color: '#d97706' }} />}
          </div>
        ))}
        {(group.invitations || []).filter(i => i.status === 'accepted').map(i => (
          <div key={i.id} className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              {i.teacher_name[0].toUpperCase()}
            </div>
            {i.teacher_name} <span style={{ opacity: 0.7 }}>(teacher)</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-wallpaper flex-1 overflow-y-auto" style={{ padding: '16px 14px 8px' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div style={{ fontSize: 36, marginBottom: 10 }}>🤝</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No messages yet</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Messages will appear here once the conversation starts.</p>
          </div>
        ) : enriched.map(item => item.type === 'date' ? (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
            <span className="chat-date-chip">{item.label}</span>
          </div>
        ) : (
          <div key={item.key} style={{ display: 'flex', flexDirection: item.isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: item.isLast ? 12 : 2 }}>
            <div style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'flex-end' }}>
              {item.isLast && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: item.author_role === 'teacher' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #059669, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                  {(item.author_name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: item.isMine ? 'flex-end' : 'flex-start', maxWidth: '68%' }}>
              {item.isFirst && (
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, marginLeft: 4, color: item.author_role === 'teacher' ? '#6366f1' : '#059669' }}>
                  {item.isMine ? 'You' : item.author_name}{item.author_role === 'teacher' && !item.isMine ? ' · teacher' : ''}
                </div>
              )}
              <div className={item.isMine ? 'chat-bubble-mine' : 'chat-bubble-other'} style={{ padding: '9px 13px', borderRadius: item.isFirst ? (item.isMine ? '18px 4px 18px 18px' : '4px 18px 18px 18px') : (item.isMine ? '18px 4px 4px 18px' : '4px 18px 18px 4px') }}>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word', margin: 0 }}>{item.content}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.65 }}>
                    {new Date(item.created_at || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div style={{ borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '10px 12px', display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={handleTyping}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Type a reply…"
          style={{ flex: 1, resize: 'none', border: '1.5px solid var(--card-border)', borderRadius: 20, padding: '9px 14px', fontSize: 13.5, lineHeight: 1.5, outline: 'none', background: 'var(--surface-100)', color: 'var(--text-primary)', minHeight: 40, maxHeight: 120, overflowY: 'auto' }}
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

/* ── Invitations tab ─────────────────────────────────────────────────── */
function InvitationRow({ inv, onRespond, responding }) {
  const STATUS_STYLE = {
    pending:  { bg: 'rgba(217,119,6,0.1)',  color: '#d97706', label: 'Pending', icon: Clock },
    accepted: { bg: 'rgba(5,150,105,0.1)',  color: '#059669', label: 'Accepted', icon: Check },
    denied:   { bg: 'rgba(220,38,38,0.1)',  color: '#dc2626', label: 'Declined', icon: XCircle },
  };
  const s = STATUS_STYLE[inv.status] || STATUS_STYLE.pending;
  const StatusIcon = s.icon;

  return (
    <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
        style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
        <Mail className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{inv.group_name}</div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {inv.class_name} · invited by team leader {inv.team_leader_name}
        </div>
      </div>
      {inv.status === 'pending' ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            disabled={responding}
            onClick={() => onRespond(inv, 'deny')}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            style={{ background: 'var(--surface-100)', color: '#dc2626', border: '1px solid var(--card-border)' }}>
            Decline
          </button>
          <button
            disabled={responding}
            onClick={() => onRespond(inv, 'accept')}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
            Accept
          </button>
        </div>
      ) : (
        <span className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 flex-shrink-0" style={{ background: s.bg, color: s.color }}>
          <StatusIcon className="w-3 h-3" /> {s.label}
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main page
══════════════════════════════════════════════ */
export default function TeacherGroups() {
  const { user } = useAuth();
  const myId = user?.id;

  const [tab, setTab] = useState('groups'); // 'groups' | 'invitations'

  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [classes, setClasses]         = useState([]);
  const [createMode, setCreateMode]   = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleting, setDeleting]           = useState(false);

  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterClass) params.classId = filterClass;
      const res = await api.get('/group-discussions', { params });
      setGroups(res.data.groups || []);
    } catch { toast.error('Failed to load groups'); }
    finally { setLoading(false); }
  }, [filterClass]);

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await api.get('/group-discussions/invitations/mine');
      setInvitations(res.data.invitations || []);
    } catch { toast.error('Failed to load invitations'); }
    finally { setInvitationsLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);
  useEffect(() => {
    api.get('/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  const pendingInviteCount = invitations.filter(i => i.status === 'pending').length;

  const openGroup = async (g) => {
    setCreateMode(false);
    setActiveGroup(g);
    if (g.my_invitation_status !== 'accepted') {
      // No accepted invitation yet — show the locked panel without
      // attempting to fetch the (forbidden) conversation.
      setGroupDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await api.get(`/group-discussions/${g.id}`);
      setGroupDetail(res.data.group);
    } catch { toast.error('Failed to load group'); setGroupDetail(null); }
    finally { setDetailLoading(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/group-discussions/${deleteTarget.id}`);
      toast.success('Group deleted');
      setDeleteTarget(null);
      if (activeGroup?.id === deleteTarget.id) { setActiveGroup(null); setGroupDetail(null); }
      fetchGroups();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const handleRespond = async (inv, action) => {
    setRespondingId(inv.invitation_id);
    try {
      await api.post(`/group-discussions/invitations/${inv.invitation_id}/respond`, { action });
      toast.success(action === 'accept' ? 'Invitation accepted 🎉' : 'Invitation declined');
      fetchInvitations();
      fetchGroups();
      if (activeGroup?.id === inv.group_id) { setActiveGroup(null); setGroupDetail(null); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to respond');
    } finally { setRespondingId(null); }
  };

  // Right panel
  let rightPanel = null;
  if (createMode) {
    rightPanel = (
      <CreateGroupPanel
        onClose={() => setCreateMode(false)}
        onCreated={() => { setCreateMode(false); fetchGroups(); }}
      />
    );
  } else if (activeGroup) {
    if (activeGroup.my_invitation_status !== 'accepted') {
      rightPanel = <LockedGroupPanel g={activeGroup} onClose={() => setActiveGroup(null)} />;
    } else {
      rightPanel = detailLoading || !groupDetail
        ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading group…</p>
            </div>
          </div>
        )
        : <GroupViewer group={groupDetail} myId={myId} onClose={() => { setActiveGroup(null); setGroupDetail(null); }} onMessageSent={fetchGroups} />;
    }
  }

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* ── Left sidebar ── */}
      <div className={`flex flex-col ${rightPanel ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex-1'}`}
        style={{ background: 'var(--card-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>

        {/* Header */}
        <div className="px-4 py-4 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5" /> Groups
            </h2>
            {tab === 'groups' && (
              <button
                onClick={() => { setCreateMode(true); setActiveGroup(null); setGroupDetail(null); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            )}
          </div>
          <p className="text-white/60 text-xs mb-3">Create student collaboration groups per class</p>

          {/* Tabs */}
          <div className="flex gap-1.5">
            <button onClick={() => { setTab('groups'); setCreateMode(false); }}
              className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={tab === 'groups' ? { background: 'white', color: '#4f46e5' } : { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
              My Groups
            </button>
            <button onClick={() => { setTab('invitations'); setActiveGroup(null); setGroupDetail(null); setCreateMode(false); }}
              className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center justify-center gap-1.5"
              style={tab === 'invitations' ? { background: 'white', color: '#4f46e5' } : { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
              <Inbox className="w-3 h-3" /> Invitations
              {pendingInviteCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ background: tab === 'invitations' ? '#d97706' : '#fbbf24', color: 'white' }}>
                  {pendingInviteCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {tab === 'groups' ? (
          <>
            {/* Class filter tabs */}
            <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <button onClick={() => setFilterClass('')}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${!filterClass ? 'text-white' : ''}`}
                style={!filterClass ? { background: 'linear-gradient(135deg, #6366f1, #4f46e5)' } : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                All
              </button>
              {classes.map(c => (
                <button key={c.id} onClick={() => setFilterClass(c.id)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${filterClass === c.id ? 'text-white' : ''}`}
                  style={filterClass === c.id ? { background: 'linear-gradient(135deg, #6366f1, #4f46e5)' } : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin w-7 h-7 rounded-full" style={{ border: '3px solid var(--card-border)', borderTopColor: '#6366f1' }} />
                </div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <Users className="w-14 h-14 mb-3 opacity-20" style={{ color: 'var(--text-secondary)' }} />
                  <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No groups yet</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Create a group to let students collaborate independently.</p>
                  <button onClick={() => setCreateMode(true)}
                    className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                    <Plus className="w-4 h-4" /> New Group
                  </button>
                </div>
              ) : (
                groups.map(g => (
                  <GroupCard key={g.id} g={g} onOpen={openGroup} onDelete={setDeleteTarget} active={activeGroup?.id === g.id} />
                ))
              )}
            </div>
          </>
        ) : (
          /* Invitations list */
          <div className="flex-1 overflow-y-auto">
            {invitationsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-7 h-7 rounded-full" style={{ border: '3px solid var(--card-border)', borderTopColor: '#6366f1' }} />
              </div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <Inbox className="w-14 h-14 mb-3 opacity-20" style={{ color: 'var(--text-secondary)' }} />
                <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No invitations</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>When a team leader invites you into a group's conversation, it'll show up here.</p>
              </div>
            ) : (
              invitations.map(inv => (
                <InvitationRow key={inv.invitation_id} inv={inv} onRespond={handleRespond} responding={respondingId === inv.invitation_id} />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      {rightPanel ? (
        <div className="flex-1 lg:ml-3 flex flex-col rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
          {rightPanel}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 ml-3 items-center justify-center rounded-2xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)' }}>
              <Users className="w-10 h-10" style={{ color: '#6366f1' }} />
            </div>
            <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Group Discussions</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              {tab === 'groups'
                ? "Create groups, assign a team leader, and they'll bring teachers into the conversation."
                : 'Select an invitation to respond to it.'}
            </p>
            {tab === 'groups' && (
              <button onClick={() => setCreateMode(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                <Plus className="w-4 h-4" /> Create First Group
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Group"
        message={`Delete "${deleteTarget?.name}"? All messages will be lost.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
