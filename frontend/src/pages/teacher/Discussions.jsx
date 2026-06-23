import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import ChatThread from '../../components/common/ChatThread';
import { Plus, Search, MessageSquare, Trash2, X, Sparkles, Users, PenLine } from 'lucide-react';

function DiscussionCard({ d, onOpen, onDelete }) {
  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };
  const initials = (d.title || 'D')[0].toUpperCase();

  return (
    <div
      className="group flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all hover:bg-opacity-60 relative"
      style={{ borderBottom: '1px solid var(--card-border)' }}
      onClick={() => onOpen(d)}
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm text-white font-bold text-lg">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{d.title}</span>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
            {timeAgo(d.created_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{d.content}</p>
          {d.comment_count > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1.5"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white' }}>
              {d.comment_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
            {d.class_name || 'Class'}
          </span>
        </div>
      </div>
      {/* Delete button on hover */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(d); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full items-center justify-center hidden group-hover:flex transition-all hover:bg-red-50"
        title="Delete">
        <Trash2 className="w-3.5 h-3.5 text-red-400" />
      </button>
    </div>
  );
}

// Create discussion modal — inline panel style
function CreatePanel({ classes, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', content: '', classId: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/discussions', form);
      toast.success('Discussion posted 🎉');
      onCreated();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to post discussion'); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '16px 16px 0 0' }}>
        <div className="flex items-center gap-2">
          <PenLine className="w-5 h-5 text-white" />
          <h3 className="text-white font-bold">New Discussion</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/80">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Class *</label>
          <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' }}
            required>
            <option value="">Select a class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>Only students in this class will see and reply</p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Discussion Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' }}
            placeholder="What should students discuss?" required />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Opening Message *</label>
          <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all resize-none"
            style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' }}
            rows={6} placeholder="Kick off the conversation with some context or a question…" required />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
            {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Post Discussion
          </button>
        </div>
      </form>
    </div>
  );
}

export default function TeacherDiscussions() {
  const [discussions, setDiscussions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  const [createMode, setCreateMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const threadScrollRef = useRef(null);

  const fetchDiscussions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 20 };
      if (filterClass) params.classId = filterClass;
      const res = await api.get('/discussions', { params });
      setDiscussions(res.data.discussions || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Failed to load discussions'); }
    finally { setLoading(false); }
  }, [search, page, filterClass]);

  useEffect(() => { fetchDiscussions(); }, [fetchDiscussions]);
  useEffect(() => {
    api.get('/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/discussions/${deleteTarget.id}`);
      toast.success('Discussion deleted');
      setDeleteTarget(null);
      if (thread?.id === deleteTarget.id) setThread(null);
      fetchDiscussions();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const openThread = async (d) => {
    setCreateMode(false);
    setThread({ id: d.id, title: d.title, content: d.content, teacher_name: d.teacher_name, class_name: d.class_name, created_at: d.created_at });
    setThreadLoading(true);
    try {
      const res = await api.get(`/discussions/${d.id}`);
      setThread(res.data.discussion);
    } catch { toast.error('Failed to load discussion'); setThread(null); }
    finally { setThreadLoading(false); }
  };

  const handleComment = async (text) => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const res = await api.post(`/discussions/${thread.id}/comments`, { content: text });
      setThread(t => ({ ...t, comments: [...(t.comments || []), res.data.comment] }));
      fetchDiscussions();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to post reply'); }
    finally { setPosting(false); }
  };

  const rightPanel = createMode
    ? <CreatePanel classes={classes} onClose={() => setCreateMode(false)} onCreated={() => { setCreateMode(false); fetchDiscussions(); }} />
    : thread
      ? (threadLoading || !thread.comments
        ? <div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" /><p className="text-sm text-muted">Loading conversation…</p></div></div>
        : <ChatThread thread={thread} currentUser={null} isTeacher={true} onClose={() => setThread(null)} onSendComment={handleComment} posting={posting} threadRef={threadScrollRef} />)
      : null;

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Left panel */}
      <div className={`flex flex-col ${rightPanel ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex-1'}`}
        style={{ background: 'var(--card-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>

        {/* Header */}
        <div className="px-4 py-4 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Discussions
            </h2>
            <button
              onClick={() => { setCreateMode(true); setThread(null); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none text-white placeholder-white/50"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
              placeholder="Search discussions…" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <button onClick={() => { setFilterClass(''); setPage(1); }}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${!filterClass ? 'text-white shadow-sm' : ''}`}
            style={!filterClass ? { background: 'linear-gradient(135deg, #6366f1, #4f46e5)' } : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
            All
          </button>
          {classes.map(c => (
            <button key={c.id} onClick={() => { setFilterClass(c.id); setPage(1); }}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${filterClass === c.id ? 'text-white shadow-sm' : ''}`}
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
          ) : discussions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <MessageSquare className="w-14 h-14 mb-3 opacity-20" style={{ color: 'var(--text-secondary)' }} />
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No discussions yet</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Start a conversation to hear from your class.</p>
              <button onClick={() => { setCreateMode(true); setThread(null); }}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                <Plus className="w-4 h-4" /> New Discussion
              </button>
            </div>
          ) : (
            discussions.map(d => (
              <DiscussionCard key={d.id} d={d} onOpen={openThread} onDelete={setDeleteTarget} />
            ))
          )}
        </div>

        {total > 20 && (
          <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--card-border)' }}>
            <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Right panel */}
      {rightPanel ? (
        <div className="flex-1 lg:ml-3 flex flex-col rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
          {rightPanel}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 ml-3 items-center justify-center rounded-2xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)' }}>
              <MessageSquare className="w-10 h-10" style={{ color: '#6366f1' }} />
            </div>
            <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Select a discussion</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Click a thread to read and reply, or create a new one</p>
            <button onClick={() => setCreateMode(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              <Plus className="w-4 h-4" /> Start a Discussion
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Discussion"
        message={`Delete "${deleteTarget?.title}"? This will remove all replies too.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}