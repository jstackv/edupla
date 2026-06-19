import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import FileViewer, { downloadFile } from '../../components/common/FileViewer';
import { Search, FileText, Download, Eye, BookOpen, ChevronRight, ArrowLeft, Inbox } from 'lucide-react';

function formatSize(bytes) {
  if (!bytes) return '—';
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
  txt:  { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600',  label: 'TXT' },
  mp4:  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600', label: 'VID' },
  mp3:  { bg: 'bg-cyan-100 dark:bg-cyan-900/30',   text: 'text-cyan-600',   label: 'AUD' },
};

function FileIconBlock({ name }) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const style = FILE_TYPE_CONFIG[ext] || {
    bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600',
    label: ext.toUpperCase().slice(0, 4) || 'FILE',
  };
  return (
    <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
      <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
    </div>
  );
}

const MODULE_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30',  text: 'text-violet-700 dark:text-violet-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30',     text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30',     text: 'text-cyan-700 dark:text-cyan-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
];
function moduleColor(idx) { return MODULE_COLORS[idx % MODULE_COLORS.length]; }

function DocumentCard({ doc, onPreview, onDownload, isNew }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors hover:bg-primary-50/40 dark:hover:bg-primary-900/10"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <FileIconBlock name={doc.original_name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</p>
          {isNew && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#fef9c3', color: '#854d0e' }}>New</span>
          )}
        </div>
        <p className="text-xs text-muted mt-0.5 truncate">{doc.original_name}</p>
        {doc.description && <p className="text-xs text-muted truncate">{doc.description}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onPreview(doc)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--card-border)', color: 'var(--text-primary)', border: '1px solid var(--input-border)' }}>
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button onClick={() => onDownload(doc)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--primary-600, #6366f1)', color: '#fff', border: 'none' }}>
          <Download className="w-3.5 h-3.5" /> Download
        </button>
      </div>
    </div>
  );
}

/* ─── Extract unique modules from a flat list of documents ─── */
function extractModulesFromDocs(docs) {
  const seen = new Map();
  docs.forEach(d => {
    // Support various field names the backend might use
    const cid  = d.course_id   || d.courseId   || null;
    const name = d.course_name || d.module_name || d.courseName || null;
    const code = d.course_code || d.courseCode  || '';
    const cat  = d.course_category || d.courseCategory || d.category || '';
    const teacher = d.teacher_name  || d.teacherName   || '';
    if (cid && !seen.has(String(cid))) {
      seen.set(String(cid), {
        _id: cid, name: name || 'Module', code, category: cat,
        teacher_id: { name: teacher },
      });
    }
  });
  return Array.from(seen.values());
}

export default function StudentDocuments() {
  const [view, setView] = useState('modules'); // 'modules' | 'docs'
  const [selectedModule, setSelectedModule] = useState(null);

  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [studentClass, setStudentClass] = useState(null);

  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);

  const [seenIds, setSeenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('edupla_seen_docs') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    const init = async () => {
      setLoadingModules(true);
      try {
        // 1. Get the student's enrolled class
        const clsRes = await api.get('/classes/my');
        const myClasses = clsRes.data.classes || [];
        if (myClasses.length === 0) { setLoadingModules(false); return; }
        const cls = myClasses[0];
        const classId = String(cls.id || cls._id);
        setStudentClass({ id: classId, name: cls.name });

        // 2. Fetch all courses assigned to this student's class via the dedicated endpoint
        let fetchedModules = [];
        try {
          const res = await api.get('/assessment/student/courses');
          fetchedModules = res.data.courses || [];
        } catch {
          // Fallback: try admin endpoint (works if user is admin viewing as student)
          try {
            const res = await api.get('/assessment/admin/courses');
            const all = res.data.courses || [];
            fetchedModules = all.filter(c =>
              String(c.class_id?._id || c.class_id || '') === classId
            );
          } catch { /* ignore */ }
        }

        setModules(fetchedModules);
      } catch {
        toast.error('Failed to load class info');
      } finally {
        setLoadingModules(false);
      }
    };
    init();
  }, []);

  // Fetch notes for the selected module
  const fetchDocs = useCallback(async () => {
    if (view !== 'docs' || !selectedModule) return;
    setLoading(true);
    try {
      const params = { page, limit: 12 };
      if (search) params.search = search;
      if (studentClass) params.classId = studentClass.id;
      params.courseId = selectedModule._id;
      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents || []);
      setTotal(res.data.total || res.data.documents?.length || 0);
    } catch { toast.error('Failed to load notes'); }
    finally { setLoading(false); }
  }, [view, search, page, selectedModule, studentClass]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const markSeen = (id) => {
    setSeenIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('edupla_seen_docs', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const handlePreview = (doc) => { markSeen(doc.id); setViewingFile(doc); };
  const handleDownload = (doc) => downloadFile(doc);
  const openModule = (mod) => { setSelectedModule(mod); setSearch(''); setPage(1); setDocuments([]); setView('docs'); };

  // Group by TVET category order
  const CATEGORY_ORDER = ['Specific modules', 'General modules', 'Complementary modules', 'Elective Non Examinable'];
  const grouped = {};
  CATEGORY_ORDER.forEach(cat => {
    const items = modules.filter(m => (m.category || '') === cat);
    if (items.length) grouped[cat] = items;
  });
  const uncategorised = modules.filter(m => !CATEGORY_ORDER.includes(m.category || ''));
  if (uncategorised.length) grouped['Other Modules'] = uncategorised;
  const hasGroups = Object.keys(grouped).length > 0;

  // ── Modules list view ──
  if (view === 'modules') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Notes & Documents</h2>
          <p className="text-sm text-muted">
            {studentClass ? `${studentClass.name} — select a module to view notes` : 'Select a module to view notes'}
          </p>
        </div>

        {loadingModules ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : !hasGroups ? (
          <div className="card text-center py-16">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted opacity-30" />
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No modules found</p>
            <p className="text-sm text-muted">
              {studentClass
                ? `No modules have been assigned to ${studentClass.name} yet.`
                : 'You are not enrolled in a class yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, mods]) => (
              <div key={cat}>
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2 px-1">{cat}</p>
                <div className="space-y-2">
                  {mods.map((mod, idx) => {
                    const color = moduleColor(idx);
                    return (
                      <button key={mod._id} onClick={() => openModule(mod)}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all hover:scale-[1.005] active:scale-[0.99]"
                        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                        <div className={`w-12 h-12 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-sm font-bold ${color.text}`}>
                            {(mod.code || mod.name || '').slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {mod.code && <p className={`text-xs font-bold ${color.text} mb-0.5`}>{mod.code}</p>}
                          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{mod.name}</p>
                          {mod.teacher_id?.name && <p className="text-xs text-muted mt-0.5">{mod.teacher_id.name}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Notes view for selected module ──
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('modules'); setDocuments([]); }}
          className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted font-medium mb-0.5">
            <BookOpen className="w-3 h-3" />
            <span>{studentClass?.name}</span>
            <ChevronRight className="w-3 h-3" />
            {selectedModule?.code && <span className="text-primary-600 font-bold">{selectedModule.code}</span>}
          </div>
          <h2 className="font-display font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>
            {selectedModule?.name}
          </h2>
          <p className="text-sm text-muted">{total} note{total !== 1 ? 's' : ''} available</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input-field pl-10" placeholder="Search notes…" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : documents.length === 0 ? (
        <div className="card text-center py-16">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No document posted for this module</p>
          <p className="text-sm text-muted">
            Teacher hasn't posted any notes for <strong>{selectedModule?.name}</strong> yet.
          </p>
        </div>
      ) : (
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Notes</p>
          {documents.map(doc => (
            <DocumentCard key={doc.id} doc={doc}
              isNew={!seenIds.has(doc.id)}
              onPreview={handlePreview}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />}
      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  );
}