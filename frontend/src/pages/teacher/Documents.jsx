import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import FileViewer from '../../components/common/FileViewer';
import {
  Plus, Search, Upload, FileText, Download, Eye, Edit2, Trash2,
  CloudUpload, X, BookOpen
} from 'lucide-react';

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const FILE_TYPE_CONFIG = {
  pdf: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600', label: 'PDF' },
  doc: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600', label: 'DOC' },
  docx: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600', label: 'DOCX' },
  xls: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600', label: 'XLS' },
  xlsx: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600', label: 'XLSX' },
  ppt: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600', label: 'PPT' },
  pptx: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600', label: 'PPTX' },
  png: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600', label: 'IMG' },
  jpg: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600', label: 'IMG' },
  jpeg: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600', label: 'IMG' },
  zip: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600', label: 'ZIP' },
  txt: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600', label: 'TXT' },
  mp4: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600', label: 'VID' },
  mp3: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600', label: 'AUD' },
};

function FileIcon({ name }) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const style = FILE_TYPE_CONFIG[ext] || { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600', label: ext.toUpperCase().slice(0, 4) || 'FILE' };
  return (
    <div className={`w-11 h-11 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
      <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
    </div>
  );
}

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', classId: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 12 };
      if (filterClass) params.classId = filterClass;
      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents);
      setTotal(res.data.total || res.data.documents?.length || 0);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  }, [search, page, filterClass]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => {
    api.get('/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    setSaving(true);
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('classId', form.classId);
    fd.append('file', file);
    try {
      await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded');
      setModal(false);
      setForm({ title: '', description: '', classId: '' });
      setFile(null);
      fetchDocs();
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/documents/${editing.id}`, form);
      toast.success('Document updated');
      setEditModal(false);
      fetchDocs();
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/documents/${deleteTarget.id}`);
      toast.success('Document deleted');
      setDeleteTarget(null);
      fetchDocs();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const openEdit = (doc) => {
    setEditing(doc);
    setForm({ title: doc.title, description: doc.description || '', classId: doc.class_id ? String(doc.class_id) : '' });
    setEditModal(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Documents</h2>
          <p className="text-sm text-muted">{total} document{total !== 1 ? 's' : ''} uploaded</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10" placeholder="Search documents…" />
        </div>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }}
          className="input-field sm:w-44">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Documents */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : documents.length === 0 ? (
        <div className="card text-center py-16">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No documents</p>
          <p className="text-sm text-muted mb-4">Upload study materials for your students.</p>
          <button onClick={() => setModal(true)} className="btn-primary mx-auto">
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--table-header)' }}>
                  <th className="table-header">Document</th>
                  <th className="table-header hidden md:table-cell">Class</th>
                  <th className="table-header hidden lg:table-cell">Size</th>
                  <th className="table-header hidden lg:table-cell">Downloads</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <FileIcon name={doc.original_name} />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate max-w-[200px]" style={{ color: 'var(--text-primary)' }}>{doc.title}</p>
                          {doc.description && (
                            <p className="text-xs text-muted truncate max-w-[200px]">{doc.description}</p>
                          )}
                          <p className="text-xs text-muted">{doc.original_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      {doc.class_name ? (
                        <span className="badge text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                          {doc.class_name}
                        </span>
                      ) : <span className="text-muted text-xs">All Classes</span>}
                    </td>
                    <td className="table-cell hidden lg:table-cell text-sm text-muted">{formatSize(doc.file_size)}</td>
                    <td className="table-cell hidden lg:table-cell text-sm text-muted">{doc.download_count || 0}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setViewingFile(doc)}
                          className="p-1.5 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors" title="Preview">
                          <Eye className="w-4 h-4 text-muted" />
                        </button>
                        <a href={`/api/documents/${doc.id}/download`} download
                          className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors" title="Download">
                          <Download className="w-4 h-4 text-muted" />
                        </a>
                        <button onClick={() => openEdit(doc)}
                          className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4 text-muted" />
                        </button>
                        <button onClick={() => setDeleteTarget(doc)}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4 text-muted" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />}

      {/* Upload Modal */}
      <Modal isOpen={modal} onClose={() => { setModal(false); setFile(null); }} title="Upload Document">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field" placeholder="Document title" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field resize-none" rows={2} placeholder="Optional description" />
          </div>
          <div>
            <label className="label">Assign to Class</label>
            <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))} className="input-field">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">File *</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              onClick={() => document.getElementById('doc-file-input').click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'hover:border-primary-400'
              }`}
              style={{ borderColor: dragOver ? undefined : 'var(--input-border)' }}>
              <input id="doc-file-input" type="file" className="hidden"
                onChange={e => setFile(e.target.files[0])} />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5 text-primary-500" />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="ml-1">
                    <X className="w-4 h-4 text-muted" />
                  </button>
                </div>
              ) : (
                <>
                  <CloudUpload className="w-8 h-8 mx-auto mb-2 text-muted opacity-60" />
                  <p className="text-sm text-muted">Drop file here or <span className="text-primary-600 font-medium">browse</span></p>
                  <p className="text-xs text-muted mt-1">PDF, DOCX, XLSX, images and more</p>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setModal(false); setFile(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || !file} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Document">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field resize-none" rows={2} />
          </div>
          <div>
            <label className="label">Assign to Class</label>
            <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))} className="input-field">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Document"
        message={`Delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* File Viewer */}
      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  );
}
