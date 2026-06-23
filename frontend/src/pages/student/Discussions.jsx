import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import ChatThread from '../../components/common/ChatThread';
import { Search, MessageSquare, BookOpen, Calendar, X, Users, ChevronRight, Sparkles } from 'lucide-react';

function DiscussionCard({ d, onClick }) {
  const initials = (d.title || 'D')[0].toUpperCase();
  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.998]"
      style={{
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--card-border)',
      }}
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm text-white font-bold text-lg">
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{d.title}</span>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
            {timeAgo(d.created_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            <span className="text-violet-500 font-medium">{d.teacher_name || 'Teacher'}:</span>{' '}
            {d.content}
          </p>
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
    </div>
  );
}

export default function StudentDiscussions() {
  const [discussions, setDiscussions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

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
    api.get('/classes/my').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  const openThread = async (d) => {
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

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Left panel — discussion list */}
      <div className={`flex flex-col ${thread ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex-1'}`}
        style={{ background: 'var(--card-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>

        {/* Header */}
        <div className="px-4 py-4 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Discussions
            </h2>
            <span className="text-white/70 text-xs">{total} threads</span>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none text-white placeholder-white/50"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
              placeholder="Search discussions…" />
          </div>
        </div>

        {/* Class filter tabs */}
        <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <button onClick={() => { setFilterClass(''); setPage(1); }}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${!filterClass ? 'text-white shadow-sm' : ''}`}
            style={!filterClass ? { background: 'linear-gradient(135deg, #6366f1, #4f46e5)' } : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
            All
          </button>
          {classes.map(c => (
            <button key={c.id} onClick={() => { setFilterClass(c.id); setPage(1); }}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${filterClass === c.id ? 'text-white shadow-sm' : ''}`}
              style={filterClass === c.id ? { background: 'linear-gradient(135deg, #6366f1, #4f46e5)' } : { background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
              {c.name}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-7 h-7 border-3 border-indigo-500 border-t-transparent rounded-full" style={{ borderWidth: '3px' }} />
            </div>
          ) : discussions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <MessageSquare className="w-14 h-14 mb-3 opacity-20" style={{ color: 'var(--text-secondary)' }} />
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No discussions yet</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your teachers haven't started a conversation yet.</p>
            </div>
          ) : (
            discussions.map(d => (
              <DiscussionCard key={d.id} d={d} onClick={() => openThread(d)} />
            ))
          )}
        </div>

        {total > 20 && (
          <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--card-border)' }}>
            <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Right panel — chat thread */}
      {thread ? (
        <div className="flex-1 lg:ml-3 flex flex-col rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--card-border)' }}>
          {threadLoading || !thread.comments ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-muted">Loading conversation…</p>
              </div>
            </div>
          ) : (
            <ChatThread
              thread={thread}
              currentUser={null}
              isTeacher={false}
              onClose={() => setThread(null)}
              onSendComment={handleComment}
              posting={posting}
              threadRef={threadScrollRef}
            />
          )}
          {/* Mobile back button overlay */}
          <button
            onClick={() => setThread(null)}
            className="lg:hidden fixed top-4 left-4 z-50 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
            <X className="w-4 h-4" />
          </button>
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
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pick a conversation to join the class chat</p>
          </div>
        </div>
      )}
    </div>
  );
}