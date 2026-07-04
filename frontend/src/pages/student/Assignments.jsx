import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import Modal from '../../components/common/Modal';
import FileViewer from '../../components/common/FileViewer';
import {
  Search, ClipboardList, Upload, Eye, Download,
  Clock, CheckCircle2, AlertTriangle, Award, X, CloudUpload, FileText, RefreshCw,
  BookOpen, ChevronRight, ArrowLeft, Inbox,
} from 'lucide-react';

function DeadlineBadge({ deadline }) {
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  if (diff < 0) return <span className="badge bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-xs">Overdue</span>;
  if (diff <= 2) return <span className="badge bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 text-xs">Due in {diff}d</span>;
  return <span className="badge bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs">{diff}d left</span>;
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

function SubmitModal({ assignment, isResubmit, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !notes) return toast.error('Please attach a file or add notes');
    setSaving(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      fd.append('notes', notes);
      await api.post(`/assignments/${assignment.id}/submit`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(isResubmit ? 'Assignment resubmitted successfully!' : 'Assignment submitted successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    }
    setSaving(false);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`${isResubmit ? 'Resubmit' : 'Submit'}: ${assignment.title}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {isResubmit && (
          <div className="p-3 rounded-xl text-sm flex items-start gap-2"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <RefreshCw className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p style={{ color: 'var(--text-secondary)' }}>
              You are resubmitting this assignment. Your previous submission will be replaced.
            </p>
          </div>
        )}
        {assignment.description && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--card-border)', color: 'var(--text-secondary)' }}>
            <p className="font-semibold mb-1 text-xs" style={{ color: 'var(--text-primary)' }}>Assignment Instructions</p>
            {assignment.description}
          </div>
        )}
        <div>
          <label className="label">Attach File</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            onClick={() => document.getElementById('sub-file-input').click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'hover:border-primary-400'
            }`}
            style={{ borderColor: dragOver ? undefined : 'var(--input-border)' }}>
            <input id="sub-file-input" type="file" className="hidden"
              onChange={e => setFile(e.target.files[0])} />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-5 h-5 text-primary-500" />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                <button type="button" onClick={ev => { ev.stopPropagation(); setFile(null); }}>
                  <X className="w-4 h-4 text-muted" />
                </button>
              </div>
            ) : (
              <>
                <CloudUpload className="w-8 h-8 mx-auto mb-2 text-muted opacity-60" />
                <p className="text-sm text-muted">Drop file here or <span className="text-primary-600 font-medium">browse</span></p>
              </>
            )}
          </div>
        </div>
        <div>
          <label className="label">Notes / Comments</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            className="input-field resize-none" rows={3} placeholder="Any notes for your teacher…" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Due: {new Date(assignment.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Upload className="w-4 h-4" />}
              {isResubmit ? 'Resubmit' : 'Submit'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function AssignmentCard({ a, onPreview, onSubmit, onResubmit, cardRef, highlighted }) {
  const isSubmitted = !!a.submission_id;
  const isGraded = a.score !== null && a.score !== undefined;
  const overdue = new Date(a.deadline) < new Date();
  const canResubmit = isSubmitted && !overdue && !isGraded;

  return (
    <div ref={cardRef} className="card hover:shadow-soft transition-all"
      style={highlighted ? { boxShadow: '0 0 0 2px #6366f1, 0 8px 24px rgba(99,102,241,0.25)', transition: 'box-shadow 0.4s ease' } : undefined}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Status Icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isGraded ? 'bg-emerald-100 dark:bg-emerald-900/30' :
          isSubmitted ? 'bg-blue-100 dark:bg-blue-900/30' :
          overdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
        }`}>
          {isGraded
            ? <Award className="w-5 h-5 text-emerald-600" />
            : isSubmitted
            ? <CheckCircle2 className="w-5 h-5 text-blue-600" />
            : overdue
            ? <AlertTriangle className="w-5 h-5 text-red-600" />
            : <Clock className="w-5 h-5 text-amber-600" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {a.class_name && (
                  <span className="badge text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                    {a.class_name}
                  </span>
                )}
                <DeadlineBadge deadline={a.deadline} />
                {isGraded && (
                  <span className={`badge text-xs ${
                    a.score >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : a.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    Score: {a.score}/{a.max_score || 100}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              {a.filename && (
                <button
                  onClick={() => onPreview({ ...a, original_name: a.original_name || a.filename })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--card-border)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--input-border)',
                  }}
                  title="Preview assignment file in new tab"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
              )}
              {!isSubmitted && !overdue && (
                <button onClick={() => onSubmit(a)} className="btn-primary py-1.5 text-xs">
                  <Upload className="w-3.5 h-3.5" /> Submit
                </button>
              )}
              {canResubmit && (
                <button onClick={() => onResubmit(a)} className="btn-secondary py-1.5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Resubmit
                </button>
              )}
              {isSubmitted && !canResubmit && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isGraded ? 'Graded' : 'Submitted'}
                </span>
              )}
              {isSubmitted && overdue && !isGraded && (
                <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                </span>
              )}
            </div>
          </div>

          {a.description && (
            <p className="text-xs text-muted mt-2 line-clamp-2">{a.description}</p>
          )}

          {isGraded && a.feedback && (
            <div className="mt-2 p-2.5 rounded-lg text-xs italic" style={{ background: 'var(--card-border)', color: 'var(--text-secondary)' }}>
              💬 {a.feedback}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
            <span className="text-xs text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Due {new Date(a.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-xs text-muted flex items-center gap-1">
              <Award className="w-3 h-3" /> Max: {a.max_score || 100}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState('modules'); // 'modules' | 'list'
  const [selectedModule, setSelectedModule] = useState(null);

  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [studentClass, setStudentClass] = useState(null);

  const [assignments, setAssignments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const [submitting, setSubmitting] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);
  const [flashId, setFlashId] = useState(searchParams.get('highlight') || null);
  const cardRefs = useRef({});

  // Load the student's class + all modules assigned to that class
  useEffect(() => {
    const init = async () => {
      setLoadingModules(true);
      try {
        const clsRes = await api.get('/classes/my');
        const myClasses = clsRes.data.classes || [];
        if (myClasses.length === 0) { setLoadingModules(false); return; }
        const cls = myClasses[0];
        const classId = String(cls.id || cls._id);
        setStudentClass({ id: classId, name: cls.name });

        let fetchedModules = [];
        try {
          const res = await api.get('/assessment/student/courses');
          fetchedModules = res.data.courses || [];
        } catch {
          try {
            const res = await api.get('/assessment/admin/courses');
            const all = res.data.courses || [];
            fetchedModules = all.filter(c =>
              String(c.class_id?._id || c.class_id || '') === classId
            );
          } catch { /* ignore */ }
        }

        setModules(fetchedModules);

        // Came here from a notification pointing at a specific module — jump straight there.
        const targetCourseId = searchParams.get('courseId');
        if (targetCourseId) {
          const match = fetchedModules.find(m => String(m._id) === targetCourseId);
          if (match) { setSelectedModule(match); setView('list'); }
        }
      } catch {
        toast.error('Failed to load class info');
      } finally {
        setLoadingModules(false);
      }
    };
    init();
  }, []);

  // Fetch assignments for the selected module
  const fetchAssignments = useCallback(async () => {
    if (view !== 'list' || !selectedModule) return;
    setLoading(true);
    try {
      const params = { search, page, limit: 10 };
      if (studentClass) params.classId = studentClass.id;
      params.courseId = selectedModule._id;
      if (filter === 'pending') params.status = 'pending';
      if (filter === 'submitted') params.status = 'submitted';
      if (filter === 'graded') params.status = 'graded';
      const res = await api.get('/assignments', { params });
      setAssignments(res.data.assignments || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Failed to load assignments'); }
    finally { setLoading(false); }
  }, [view, search, page, filter, selectedModule, studentClass]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  /* ── jump to & highlight the assignment a notification pointed to ── */
  useEffect(() => {
    if (!flashId || loading || !assignments.length) return;
    const el = cardRefs.current[flashId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => {
      setFlashId(null);
      const next = new URLSearchParams(searchParams);
      next.delete('highlight'); next.delete('courseId'); next.delete('classId');
      setSearchParams(next, { replace: true });
    }, 3500);
    return () => clearTimeout(t);
  }, [flashId, loading, assignments]);

  const openModule = (mod) => { setSelectedModule(mod); setSearch(''); setFilter('all'); setPage(1); setAssignments([]); setView('list'); };

  // Group modules by TVET category order, same as student Documents.jsx
  const CATEGORY_ORDER = ['Specific modules', 'General modules', 'Complementary modules', 'Elective Non Examinable'];
  const grouped = {};
  CATEGORY_ORDER.forEach(cat => {
    const items = modules.filter(m => (m.category || '') === cat);
    if (items.length) grouped[cat] = items;
  });
  const uncategorised = modules.filter(m => !CATEGORY_ORDER.includes(m.category || ''));
  if (uncategorised.length) grouped['Other Modules'] = uncategorised;
  const hasGroups = Object.keys(grouped).length > 0;

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'graded', label: 'Graded' },
  ];

  /* ── Modules list view ── */
  if (view === 'modules') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Assignments</h2>
          <p className="text-sm text-muted">
            {studentClass ? `${studentClass.name} — select a module to view assignments` : 'Select a module to view assignments'}
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

  /* ── Assignments list view for selected module ── */
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => { setView('modules'); setAssignments([]); }}
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
          <p className="text-sm text-muted">{total} assignment{total !== 1 ? 's' : ''} available</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--card-border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setFilter(t.key); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === t.key ? 'bg-white dark:bg-neutral-800 shadow-sm text-primary-600' : 'text-muted hover:text-primary-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input-field pl-10" placeholder="Search assignments…" />
      </div>

      {/* Assignments List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="card text-center py-16">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No assignment posted for this module</p>
          <p className="text-sm text-muted">
            {filter !== 'all'
              ? `No ${filter} assignments for ${selectedModule?.name}.`
              : <>Teacher hasn't posted any assignments for <strong>{selectedModule?.name}</strong> yet.</>}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <AssignmentCard
              key={a.id}
              a={a}
              onPreview={setViewingFile}
              onSubmit={(assignment) => setSubmitting({ assignment, isResubmit: false })}
              onResubmit={(assignment) => setSubmitting({ assignment, isResubmit: true })}
              cardRef={el => { cardRefs.current[a.id] = el; }}
              highlighted={flashId === a.id}
            />
          ))}
        </div>
      )}

      {total > 10 && (
        <Pagination page={page} totalPages={Math.ceil(total / 10)} onPageChange={setPage} />
      )}

      {submitting && (
        <SubmitModal
          assignment={submitting.assignment}
          isResubmit={submitting.isResubmit}
          onClose={() => setSubmitting(null)}
          onSuccess={fetchAssignments}
        />
      )}

      {viewingFile && (
        <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
      )}
    </div>
  );
}