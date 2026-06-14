import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import Modal from '../../components/common/Modal';
import FileViewer from '../../components/common/FileViewer';
import {
  Search, ClipboardList, Upload, Eye, Download,
  Clock, CheckCircle2, AlertTriangle, Award, X, CloudUpload, FileText, RefreshCw
} from 'lucide-react';

function DeadlineBadge({ deadline }) {
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  if (diff < 0) return <span className="badge bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-xs">Overdue</span>;
  if (diff <= 2) return <span className="badge bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 text-xs">Due in {diff}d</span>;
  return <span className="badge bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs">{diff}d left</span>;
}

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

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [filterClass, setFilterClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [submitting, setSubmitting] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 10 };
      if (filterClass) params.classId = filterClass;
      if (filter === 'pending') params.status = 'pending';
      if (filter === 'submitted') params.status = 'submitted';
      if (filter === 'graded') params.status = 'graded';
      const res = await api.get('/assignments', { params });
      setAssignments(res.data.assignments || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Failed to load assignments'); }
    finally { setLoading(false); }
  }, [search, page, filter, filterClass]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);
  useEffect(() => {
    api.get('/classes/my').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'graded', label: 'Graded' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Assignments</h2>
        <p className="text-sm text-muted">{total} assignment{total !== 1 ? 's' : ''}</p>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10" placeholder="Search assignments…" />
        </div>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }}
          className="input-field sm:w-44">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Assignments List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="card text-center py-16">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No assignments</p>
          <p className="text-sm text-muted">
            {filter === 'pending' ? "You're all caught up!" : 'No assignments found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const isSubmitted = !!a.submission_id;
            const isGraded = a.score !== null && a.score !== undefined;
            const overdue = new Date(a.deadline) < new Date();
            const canResubmit = isSubmitted && !overdue && !isGraded;

            return (
              <div key={a.id} className="card hover:shadow-soft transition-all">
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
                            onClick={() => setViewingFile({ ...a, original_name: a.original_name || a.filename })}
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
                          <button onClick={() => setSubmitting({ assignment: a, isResubmit: false })}
                            className="btn-primary py-1.5 text-xs">
                            <Upload className="w-3.5 h-3.5" /> Submit
                          </button>
                        )}
                        {canResubmit && (
                          <button onClick={() => setSubmitting({ assignment: a, isResubmit: true })}
                            className="btn-secondary py-1.5 text-xs">
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
          })}
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
