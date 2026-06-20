import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import FileViewer, { downloadFile } from '../../components/common/FileViewer';
import {
  Upload, FileText, Download, Eye, Edit2, Trash2,
  CloudUpload, X, BookOpen, ChevronRight, ArrowLeft, AlertCircle, Search,
} from 'lucide-react';

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const FILE_TYPE_CONFIG = {
  pdf:  { bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-600',    label: 'PDF' },
  doc:  { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-600',   label: 'DOC' },
  docx: { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-600',   label: 'DOCX' },
  xls:  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600', label: 'XLS' },
  xlsx: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600', label: 'XLSX' },
  ppt:  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600', label: 'PPT' },
  pptx: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600', label: 'PPTX' },
  png:  { bg: 'bg-pink-100 dark:bg-pink-900/30',   text: 'text-pink-600',   label: 'IMG' },
  jpg:  { bg: 'bg-pink-100 dark:bg-pink-900/30',   text: 'text-pink-600',   label: 'IMG' },
  jpeg: { bg: 'bg-pink-100 dark:bg-pink-900/30',   text: 'text-pink-600',   label: 'IMG' },
  zip:  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600',  label: 'ZIP' },
  txt:  { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600',  label: 'TXT' },
  mp4:  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600', label: 'VID' },
  mp3:  { bg: 'bg-cyan-100 dark:bg-cyan-900/30',   text: 'text-cyan-600',   label: 'AUD' },
};

function FileIcon({ name }) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const style = FILE_TYPE_CONFIG[ext] || {
    bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600',
    label: ext.toUpperCase().slice(0, 4) || 'FILE',
  };
  return (
    <div className={`w-11 h-11 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
      <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
    </div>
  );
}

const MODULE_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: '#3b82f6' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: '#10b981' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', dot: '#8b5cf6' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: '#f59e0b' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', dot: '#f43f5e' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', dot: '#06b6d4' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: '#f97316' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', dot: '#6366f1' },
];
function moduleColor(idx) { return MODULE_COLORS[idx % MODULE_COLORS.length]; }

/* ─── Step 1: Pick class → Step 2: Pick module → Step 3: Upload ─── */
function UploadModal({ isOpen, onClose, teacherClasses, onSuccess }) {
  const [step, setStep] = useState(1);
  const [selectedClass, setSelectedClass] = useState(null);   // { _id, name, modules[] }
  const [selectedModule, setSelectedModule] = useState(null); // course object
  const [form, setForm] = useState({ title: '', description: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => { setStep(1); setSelectedClass(null); setSelectedModule(null); setForm({ title: '', description: '' }); setFile(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    setSaving(true);
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description);
    if (selectedClass) fd.append('classId', selectedClass._id);
    if (selectedModule) fd.append('courseId', selectedModule._id);
    fd.append('file', file);
    try {
      await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Note uploaded successfully');
      reset();
      onClose();
      onSuccess();
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setSaving(false); }
  };

  const stepLabels = ['Select class', 'Select module', 'Upload note'];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Note">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${
              step > s ? 'bg-green-500 text-white' : step === s ? 'bg-primary-600 text-white' : 'bg-surface-100 text-muted'
            }`}>{step > s ? '✓' : s}</div>
            {i < 2 && <div className={`flex-1 h-0.5 rounded transition-colors ${step > s ? 'bg-green-400' : step === s ? 'bg-primary-300' : 'bg-surface-100'}`} />}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mb-4">{stepLabels[step - 1]}</p>

      {/* ── Step 1: Pick class ── */}
      {step === 1 && (
        <div className="space-y-2">
          <p className="text-sm text-muted mb-3">Which class are you uploading notes for?</p>
          {teacherClasses.length === 0 ? (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">No classes with modules assigned to you yet.</p>
            </div>
          ) : (
            teacherClasses.map((cls, idx) => {
              const color = moduleColor(idx);
              return (
                <button key={cls._id} type="button"
                  onClick={() => { setSelectedClass(cls); setStep(2); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all border-2 hover:border-primary-400 active:scale-[0.99]"
                  style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}
                >
                  <div className={`w-10 h-10 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                    <BookOpen className={`w-5 h-5 ${color.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{cls.name}</p>
                    <p className="text-xs text-muted">{cls.modules.length} module{cls.modules.length !== 1 ? 's' : ''}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted" />
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ── Step 2: Pick module ── */}
      {step === 2 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary-500" />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedClass?.name}</p>
          </div>
          <p className="text-sm text-muted mb-3">Which module is this note for?</p>
          {(selectedClass?.modules || []).map((mod, idx) => {
            const color = moduleColor(idx);
            return (
              <button key={mod._id} type="button"
                onClick={() => { setSelectedModule(mod); setStep(3); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all border-2 hover:border-primary-400 active:scale-[0.99]"
                style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}
              >
                <div className={`w-10 h-10 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-xs font-bold ${color.text}`}>{(mod.code || mod.name || '').slice(0, 3).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {mod.code && <p className={`text-xs font-bold ${color.text} mb-0.5`}>{mod.code}</p>}
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{mod.name}</p>
                  {mod.category && <p className="text-xs text-muted">{mod.category}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            );
          })}
          <button type="button" onClick={() => setStep(1)} className="btn-secondary w-full mt-2">← Back to classes</button>
        </div>
      )}

      {/* ── Step 3: Note details + file ── */}
      {step === 3 && (
        <form onSubmit={handleUpload} className="space-y-4">
          {/* Module context pill */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--surface-50, var(--card-bg))', border: '1px solid var(--card-border)' }}>
            <BookOpen className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-muted">{selectedClass?.name}</span>
            <ChevronRight className="w-3 h-3 text-muted" />
            <span style={{ color: 'var(--text-primary)' }}>{selectedModule?.code && `[${selectedModule.code}] `}{selectedModule?.name}</span>
          </div>

          <div>
            <label className="label">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field" placeholder="Note title" required autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field resize-none" rows={2} placeholder="Optional description" />
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
              <input id="doc-file-input" type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
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
          <div className="flex justify-between gap-3 pt-2">
            <button type="button" onClick={() => setStep(2)} className="btn-secondary">← Back</button>
            <div className="flex gap-3">
              <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving || !file} className="btn-primary">
                {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ─── Main component ─── */
export default function Documents() {
  const [view, setView] = useState('classes');          // 'classes' | 'modules' | 'docs'
  const [selectedClass, setSelectedClass] = useState(null);   // { _id, name, modules[] }
  const [selectedModule, setSelectedModule] = useState(null); // course object

  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  const [courses, setCourses] = useState([]);   // teacher's courses from /assessment/teacher/courses
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);

  // Load teacher's assigned courses (which include class_id)
  useEffect(() => {
    api.get('/assessment/teacher/courses')
      .then(r => setCourses(r.data.courses || []))
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoadingInit(false));
  }, []);

  // Derive unique classes with their modules from courses.
  // Supports both new class_ids[] array and legacy class_id field.
  const teacherClasses = (() => {
    const map = new Map();
    courses.forEach(c => {
      const classEntries = [];
      if (Array.isArray(c.class_ids) && c.class_ids.length > 0) {
        c.class_ids.forEach(cls => { if (cls) classEntries.push(cls); });
      }
      if (c.class_id) {
        const legacyId = String(c.class_id._id || c.class_id);
        const alreadyCovered = classEntries.some(e => String(e._id || e) === legacyId);
        if (!alreadyCovered) classEntries.push(c.class_id);
      }
      classEntries.forEach(cls => {
        const id = String(cls._id || cls);
        if (!map.has(id)) map.set(id, { _id: id, name: cls.name || 'Class', modules: [] });
        map.get(id).modules.push(c);
      });
    });
    return Array.from(map.values());
  })();

  // Fetch documents for the selected module
  const fetchDocs = useCallback(async () => {
    if (view !== 'docs' || !selectedModule) return;
    setLoading(true);
    try {
      const params = { page, limit: 12 };
      if (search) params.search = search;
      if (selectedClass) params.classId = selectedClass._id;
      if (selectedModule) params.courseId = selectedModule._id;
      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents || []);
      setTotal(res.data.total || res.data.documents?.length || 0);
    } catch { toast.error('Failed to load notes'); }
    finally { setLoading(false); }
  }, [view, search, page, selectedClass, selectedModule]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

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
    setForm({ title: doc.title, description: doc.description || '' });
    setEditModal(true);
  };

  const goToModules = (cls) => {
    setSelectedClass(cls);
    setSelectedModule(null);
    setDocuments([]);
    setView('modules');
  };

  const goToDocs = (mod) => {
    setSelectedModule(mod);
    setSearch('');
    setPage(1);
    setDocuments([]);
    setView('docs');
  };

  /* ── Classes view ── */
  if (view === 'classes') {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Notes & Documents</h2>
            <p className="text-sm text-muted">Select a class to manage module notes</p>
          </div>
          <button onClick={() => setModal(true)} className="btn-primary">
            <Upload className="w-4 h-4" /> Upload Note
          </button>
        </div>

        {loadingInit ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : teacherClasses.length === 0 ? (
          <div className="card text-center py-16">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No modules assigned yet</p>
            <p className="text-sm text-muted">Ask the admin to assign modules to you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teacherClasses.map((cls, idx) => {
              const color = moduleColor(idx);
              return (
                <button key={cls._id} onClick={() => goToModules(cls)}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <div className={`w-12 h-12 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                    <BookOpen className={`w-6 h-6 ${color.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{cls.name}</p>
                    <p className="text-xs text-muted mt-0.5">{cls.modules.length} module{cls.modules.length !== 1 ? 's' : ''} assigned to you</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted" />
                </button>
              );
            })}
          </div>
        )}

        <UploadModal isOpen={modal} onClose={() => setModal(false)} teacherClasses={teacherClasses} onSuccess={() => {}} />
      </div>
    );
  }

  /* ── Modules view ── */
  if (view === 'modules') {
    const modules = selectedClass?.modules || [];
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('classes')}
            className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-muted font-medium">Classes → Modules</p>
            <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{selectedClass?.name}</h2>
          </div>
          <button onClick={() => setModal(true)} className="btn-primary">
            <Upload className="w-4 h-4" /> Upload Note
          </button>
        </div>

        <div className="space-y-2">
          {modules.map((mod, idx) => {
            const color = moduleColor(idx);
            return (
              <button key={mod._id} onClick={() => goToDocs(mod)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all hover:scale-[1.005] active:scale-[0.99]"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <div className={`w-12 h-12 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-sm font-bold ${color.text}`}>{(mod.code || mod.name || '').slice(0, 3).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {mod.code && <p className={`text-xs font-bold ${color.text} mb-0.5`}>{mod.code}</p>}
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{mod.name}</p>
                  {mod.category && <p className="text-xs text-muted">{mod.category}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            );
          })}
        </div>

        <UploadModal isOpen={modal} onClose={() => setModal(false)} teacherClasses={teacherClasses} onSuccess={fetchDocs} />
      </div>
    );
  }

  /* ── Documents view ── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('modules'); setDocuments([]); }}
          className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted font-medium mb-0.5">
            <span>{selectedClass?.name}</span>
            <ChevronRight className="w-3 h-3" />
            {selectedModule?.code && <span className="text-primary-600 font-bold">{selectedModule.code}</span>}
          </div>
          <h2 className="font-display font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>
            {selectedModule?.name}
          </h2>
          <p className="text-sm text-muted">{total} note{total !== 1 ? 's' : ''} posted</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex-shrink-0">
          <Upload className="w-4 h-4" /> Upload Note
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input-field pl-10" placeholder="Search notes…" />
      </div>

      {/* Documents list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : documents.length === 0 ? (
        <div className="card text-center py-16">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>You haven't posted any notes for this module yet</p>
          <p className="text-sm text-muted mb-4">Upload the first note for {selectedModule?.name}.</p>
          <button onClick={() => setModal(true)} className="btn-primary mx-auto">
            <Upload className="w-4 h-4" /> Upload Note
          </button>
        </div>
      ) : (
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Notes</p>
          {documents.map(doc => (
            <div key={doc.id}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors hover:bg-primary-50/40 dark:hover:bg-primary-900/10"
              style={{ background: 'var(--surface-50, var(--card-bg))', border: '1px solid var(--card-border)' }}>
              <FileIcon name={doc.original_name} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</p>
                <p className="text-xs text-muted mt-0.5 truncate">{doc.original_name}</p>
                <p className="text-xs text-muted">{formatSize(doc.file_size)} · {doc.download_count || 0} downloads</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setViewingFile(doc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--card-border)', color: 'var(--text-primary)', border: '1px solid var(--input-border)' }}>
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                <button onClick={() => downloadFile(doc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ background: '#6366f1', color: '#fff', border: 'none' }}>
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <div className="flex items-center gap-1 ml-1 pl-2" style={{ borderLeft: '1px solid var(--card-border)' }}>
                  <button onClick={() => openEdit(doc)} className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors" title="Edit">
                    <Edit2 className="w-4 h-4 text-muted" />
                  </button>
                  <button onClick={() => setDeleteTarget(doc)} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4 text-muted" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />}

      <UploadModal isOpen={modal} onClose={() => setModal(false)} teacherClasses={teacherClasses} onSuccess={fetchDocs} />

      {/* Edit Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Note">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field resize-none" rows={2} />
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
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} loading={deleting}
        title="Delete Note" message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText="Delete" variant="danger"
      />

      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  );
}