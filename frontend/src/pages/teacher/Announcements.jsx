import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import { Plus, Search, Megaphone, Edit2, Trash2, BookOpen, Calendar } from 'lucide-react';

export default function TeacherAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', classId: '' });

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 10 };
      if (filterClass) params.classId = filterClass;
      const res = await api.get('/announcements', { params });
      setAnnouncements(res.data.announcements);
      setTotal(res.data.announcements?.length || 0);
    } catch { toast.error('Failed to load announcements'); }
    finally { setLoading(false); }
  }, [search, page, filterClass]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);
  useEffect(() => {
    api.get('/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  const openModal = (a = null) => {
    setEditing(a);
    setForm(a ? { title: a.title, content: a.content, classId: a.class_id ? String(a.class_id) : '' }
             : { title: '', content: '', classId: '' });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/announcements/${editing.id}`, form);
        toast.success('Announcement updated');
      } else {
        await api.post('/announcements', form);
        toast.success('Announcement posted');
      }
      setModal(false);
      fetchAnnouncements();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/announcements/${deleteTarget.id}`);
      toast.success('Announcement deleted');
      setDeleteTarget(null);
      fetchAnnouncements();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Announcements</h2>
          <p className="text-sm text-muted">Post updates and news for your students</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10" placeholder="Search announcements…" />
        </div>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }}
          className="input-field sm:w-44">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Announcements */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="card text-center py-16">
          <Megaphone className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No announcements yet</p>
          <p className="text-sm text-muted mb-4">Post an update to keep your students informed.</p>
          <button onClick={() => openModal()} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" /> Post Announcement
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <div key={a.id} className="card group hover:shadow-soft transition-all">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                  <Megaphone className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
                    <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openModal(a)}
                        className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5 text-muted" />
                      </button>
                      <button onClick={() => setDeleteTarget(a)}
                        className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5 text-muted" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{a.content}</p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {a.class_name ? (
                      <span className="flex items-center gap-1 text-xs badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                        <BookOpen className="w-3 h-3" /> {a.class_name}
                      </span>
                    ) : (
                      <span className="text-xs badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        All Classes
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Calendar className="w-3 h-3" />
                      {new Date(a.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 10 && <Pagination page={page} totalPages={Math.ceil(total / 10)} onPageChange={setPage} />}

      {/* Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Announcement' : 'New Announcement'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field" placeholder="Announcement title" required />
          </div>
          <div>
            <label className="label">Content *</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              className="input-field resize-none" rows={5} placeholder="Write your announcement…" required />
          </div>
          <div>
            <label className="label">Target Class</label>
            <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))} className="input-field">
              <option value="">All My Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-xs text-muted mt-1">Leave blank to announce to all your students</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {editing ? 'Update' : 'Post'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Announcement"
        message={`Delete "${deleteTarget?.title}"?`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
