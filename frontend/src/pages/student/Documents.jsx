import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import FileViewer, { downloadFile } from '../../components/common/FileViewer';
import { Search, FileText, Download, Eye, BookOpen } from 'lucide-react';

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

function FileIcon({ name }) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const style = FILE_TYPE_CONFIG[ext] || { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600', label: ext.toUpperCase().slice(0, 4) || 'FILE' };
  return (
    <div className={`w-11 h-11 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
      <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
    </div>
  );
}

export default function StudentDocuments() {
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [viewingFile, setViewingFile] = useState(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 12 };
      if (filterClass) params.classId = filterClass;
      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents || []);
      setTotal(res.data.total || res.data.documents?.length || 0);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  }, [search, page, filterClass]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => {
    api.get('/classes/my').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  const handleDownload = (doc) => downloadFile(doc);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Notes & Documents</h2>
        <p className="text-sm text-muted">{total} document{total !== 1 ? 's' : ''} available</p>
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
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No documents available</p>
          <p className="text-sm text-muted">Your teacher hasn't uploaded any study materials yet.</p>
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
                          <BookOpen className="w-3 h-3 inline mr-1" />{doc.class_name}
                        </span>
                      ) : <span className="text-muted text-xs">All Classes</span>}
                    </td>
                    <td className="table-cell hidden lg:table-cell text-sm text-muted">
                      {formatSize(doc.file_size)}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setViewingFile(doc)}
                          className="p-1.5 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors"
                          title="Preview file">
                          <Eye className="w-4 h-4 text-muted" />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
                          title="Download">
                          <Download className="w-4 h-4 text-muted" />
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

      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  );
}
