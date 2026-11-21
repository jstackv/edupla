import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import FileViewer, { downloadFile } from '../../components/common/FileViewer';
import { Hero, HeroButton, StatTile, SelectCard, SectionLabel, EmptyPanel, Loader, brandWith, initialsOf, workspaceStyle } from '../../components/common/WorkspaceUI';
import {
  Upload, FileText, Download, Eye, Edit2, Trash2,
  CloudUpload, X, BookOpen, ChevronRight, ArrowLeft, AlertCircle, Search,
  FolderOpen, GraduationCap, Layers, Clock,
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
  mp4:  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600', label: 'VID' },
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
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: '#c2410c' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: '#f59e0b' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', dot: '#f43f5e' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', dot: '#06b6d4' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: '#c2410c' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: '#c2410c' },
];
function moduleColor(idx) { return MODULE_COLORS[idx % MODULE_COLORS.length]; }

/* ─── Step 1: Pick class → Step 2: Pick module → Step 3: Upload ───
   `presetClass` / `presetModule` let a caller that already has this context
   (the teacher has already navigated into that class and/or module) skip
   straight past the steps that would just re-ask for the same thing —
   e.g. opening this from the docs view (both already known) jumps right
   to step 3, and opening it from the modules view (class already known)
   jumps to step 2. */
function UploadModal({ isOpen, onClose, teacherClasses, onSuccess, presetClass, presetModule }) {
  const [step, setStep] = useState(1);
  const [selectedClass, setSelectedClass] = useState(null);   // { _id, name, modules[] }
  const [selectedModule, setSelectedModule] = useState(null); // course object
  const [form, setForm] = useState({ title: '', description: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Re-derive the starting point from presets every time the modal opens,
  // rather than always resetting to step 1.
  useEffect(() => {
    if (!isOpen) return;
    if (presetModule) {
      setSelectedClass(presetClass || null);
      setSelectedModule(presetModule);
      setStep(3);
    } else if (presetClass) {
      setSelectedClass(presetClass);
      setSelectedModule(null);
      setStep(2);
    } else {
      setSelectedClass(null);
      setSelectedModule(null);
      setStep(1);
    }
  }, [isOpen, presetClass, presetModule]);

  const reset = () => { setForm({ title: '', description: '' }); setFile(null); };
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
          {!presetClass && (
            <button type="button" onClick={() => setStep(1)} className="btn-secondary w-full mt-2">← Back to classes</button>
          )}
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
          <div className={`flex gap-3 pt-2 ${presetModule ? 'justify-end' : 'justify-between'}`}>
            {!presetModule && (
              <button type="button" onClick={() => setStep(2)} className="btn-secondary">← Back</button>
            )}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState('classes');          // 'classes' | 'modules' | 'docs'
  const [selectedClass, setSelectedClass] = useState(null);   // { _id, name, modules[] }
  const [selectedModule, setSelectedModule] = useState(null); // course object

  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [flashId, setFlashId] = useState(searchParams.get('highlight') || null);
  const cardRefs = useRef({});
  const deepLinkApplied = useRef(false);

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

  // Deep-link: a notification may point straight at a class/module — jump there once loaded.
  useEffect(() => {
    if (deepLinkApplied.current || loadingInit || !courses.length) return;
    const targetClassId = searchParams.get('classId');
    const targetCourseId = searchParams.get('courseId');
    if (!targetClassId && !targetCourseId) return;
    deepLinkApplied.current = true;
    const cls = targetClassId ? teacherClasses.find(c => String(c._id) === targetClassId) : null;
    if (cls) {
      setSelectedClass(cls);
      const mod = targetCourseId ? cls.modules.find(m => String(m._id) === targetCourseId) : null;
      if (mod) { setSelectedModule(mod); setView('docs'); }
      else setView('modules');
    }
  }, [loadingInit, courses]);

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

  /* ── jump to & highlight the document a notification pointed to ── */
  useEffect(() => {
    if (!flashId || loading || !documents.length) return;
    const el = cardRefs.current[flashId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => {
      setFlashId(null);
      const next = new URLSearchParams(searchParams);
      next.delete('highlight'); next.delete('courseId'); next.delete('classId');
      setSearchParams(next, { replace: true });
    }, 3500);
    return () => clearTimeout(t);
  }, [flashId, loading, documents]);

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
  const libTone = brandWith(FolderOpen);
  if (view === 'classes') {
    const totalModules = teacherClasses.reduce((n, c) => n + c.modules.length, 0);
    return (
      <div className="space-y-6 ws-root">
        <style>{workspaceStyle}</style>
        <Hero tone={libTone} eyebrow="Teacher workspace" title="Resource Library"
          subtitle="Share notes and documents with your classes — organised by class and module."
          trail={['Resource Library', 'Classes']}
          actions={<HeroButton primary icon={Upload} onClick={() => setModal(true)}>Upload Note</HeroButton>}>
          <div className="grid grid-cols-2 gap-3 mt-5 max-w-md">
            <StatTile icon={GraduationCap} label="Classes" value={teacherClasses.length} />
            <StatTile icon={BookOpen} label="Modules you teach" value={totalModules} />
          </div>
        </Hero>

        <div>
          <SectionLabel>Step 1 · Choose a class</SectionLabel>
          {loadingInit ? <Loader /> : teacherClasses.length === 0 ? (
            <EmptyPanel icon={BookOpen} tone={libTone} title="No modules assigned yet" text="Ask the admin to assign modules to you." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teacherClasses.map(cls => (
                <SelectCard key={cls._id} lead={initialsOf(cls.name)} title={cls.name} tone={libTone}
                  desc={`${cls.modules.length} module${cls.modules.length !== 1 ? 's' : ''} assigned to you`}
                  chips={cls.modules.slice(0, 3).map(m => m.code || m.name).filter(Boolean)}
                  onClick={() => goToModules(cls)} />
              ))}
            </div>
          )}
        </div>

        <UploadModal isOpen={modal} onClose={() => setModal(false)} teacherClasses={teacherClasses} onSuccess={() => {}} />
      </div>
    );
  }

  /* ── Modules view ── */
  if (view === 'modules') {
    const modules = selectedClass?.modules || [];
    return (
      <div className="space-y-6 ws-root">
        <style>{workspaceStyle}</style>
        <Hero tone={libTone} onBack={() => setView('classes')} eyebrow="Step 2 · Choose a module" title={selectedClass?.name}
          subtitle={`${modules.length} module${modules.length !== 1 ? 's' : ''} assigned to you in this class`}
          trail={['Resource Library', selectedClass?.name]}
          actions={<HeroButton primary icon={Upload} onClick={() => setModal(true)}>Upload Note</HeroButton>} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map(mod => (
            <SelectCard key={mod._id} lead={(mod.code || mod.name || '').slice(0, 3).toUpperCase()} tone={libTone}
              title={mod.name} desc={mod.code} chips={mod.category ? [mod.category] : []}
              onClick={() => goToDocs(mod)} />
          ))}
        </div>
        {modules.length === 0 && (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">No modules assigned to you in this class.</p>
          </div>
        )}

        <UploadModal isOpen={modal} onClose={() => setModal(false)} teacherClasses={teacherClasses} onSuccess={fetchDocs} presetClass={selectedClass} />
      </div>
    );
  }

  /* ── Documents view ── */
  const totalDownloads = documents.reduce((n, d) => n + (d.download_count || 0), 0);
  const latest = documents.length
    ? new Date(Math.max(...documents.map(d => new Date(d.created_at || 0).getTime()))).toLocaleDateString()
    : '—';
  return (
    <div className="space-y-6 ws-root">
      <style>{workspaceStyle}</style>
      <Hero tone={libTone} onBack={() => { setView('modules'); setDocuments([]); }} eyebrow="Notes & documents" title={selectedModule?.name}
        subtitle={`${selectedClass?.name || ''} · ${total} note${total !== 1 ? 's' : ''} posted`}
        trail={['Resource Library', selectedClass?.name, selectedModule?.code || selectedModule?.name].filter(Boolean)}
        actions={<HeroButton primary icon={Upload} onClick={() => setModal(true)}>Upload Note</HeroButton>}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
          <StatTile icon={FileText} label="Notes posted" value={total} />
          <StatTile icon={Download} label="Downloads (this page)" value={totalDownloads} />
          <StatTile icon={Clock} label="Latest upload (this page)" value={latest} />
        </div>
      </Hero>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input-field pl-11 rounded-2xl" style={{ paddingTop: 12, paddingBottom: 12 }} placeholder="Search notes…" />
      </div>

      {/* Documents list */}
      {loading ? <Loader /> : documents.length === 0 ? (
        <EmptyPanel icon={FileText} tone={libTone}
          title={search ? 'No matching notes' : "You haven't posted any notes for this module yet"}
          text={search ? `No notes match "${search}".` : `Upload the first note for ${selectedModule?.name}.`}>
          {!search && (
            <button onClick={() => setModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
              style={{ background: `linear-gradient(135deg, ${libTone.accent}, ${libTone.accent2})`, boxShadow: `0 10px 24px -8px ${libTone.accent}` }}>
              <Upload className="w-4 h-4" /> Upload Note
            </button>
          )}
        </EmptyPanel>
      ) : (
        <div className="space-y-3">
          <SectionLabel>Notes</SectionLabel>
          {documents.map(doc => (
            <div key={doc.id} ref={el => { cardRefs.current[doc.id] = el; }}
              className="group relative overflow-hidden flex flex-col sm:flex-row sm:items-center gap-4 pl-6 pr-4 py-4 rounded-3xl transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                boxShadow: flashId === doc.id ? `0 0 0 2px ${libTone.accent}, 0 8px 24px ${libTone.ring}` : undefined,
              }}>
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: `linear-gradient(180deg, ${libTone.accent}, ${libTone.accent2})` }} />
              <FileIcon name={doc.original_name} />
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</p>
                <p className="text-xs text-muted mt-0.5 truncate">{doc.original_name}</p>
                <p className="text-xs text-muted">{formatSize(doc.file_size)} · {doc.download_count || 0} downloads</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <button onClick={() => setViewingFile(doc)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                  style={{ background: 'var(--card-border)', color: 'var(--text-primary)', border: '1px solid var(--input-border)' }}>
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                <button onClick={() => downloadFile(doc)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(135deg, ${libTone.accent}, ${libTone.accent2})`, boxShadow: `0 8px 18px -8px ${libTone.accent}` }}>
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

      <UploadModal isOpen={modal} onClose={() => setModal(false)} teacherClasses={teacherClasses} onSuccess={fetchDocs} presetClass={selectedClass} presetModule={selectedModule} />

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