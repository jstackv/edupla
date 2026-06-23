import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import FileViewer, { downloadFile } from '../../components/common/FileViewer';
import {
  Search, FileText, Download, Eye, BookOpen, ChevronRight,
  ArrowLeft, Inbox, X, Grid3X3, List, Filter, Clock,
  SortAsc, SortDesc, Layers, Tag, User, FolderOpen,
} from 'lucide-react';

/* ── Helpers ── */
function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ── File type config ── */
const FILE_TYPE_CONFIG = {
  pdf:  { bg: '#fee2e2', text: '#dc2626', darkBg: 'rgba(220,38,38,0.18)',  label: 'PDF',  icon: '📄' },
  doc:  { bg: '#dbeafe', text: '#2563eb', darkBg: 'rgba(37,99,235,0.18)',  label: 'DOC',  icon: '📝' },
  docx: { bg: '#dbeafe', text: '#2563eb', darkBg: 'rgba(37,99,235,0.18)',  label: 'DOCX', icon: '📝' },
  xls:  { bg: '#d1fae5', text: '#059669', darkBg: 'rgba(5,150,105,0.18)', label: 'XLS',  icon: '📊' },
  xlsx: { bg: '#d1fae5', text: '#059669', darkBg: 'rgba(5,150,105,0.18)', label: 'XLSX', icon: '📊' },
  ppt:  { bg: '#ffedd5', text: '#ea580c', darkBg: 'rgba(234,88,12,0.18)', label: 'PPT',  icon: '📽' },
  pptx: { bg: '#ffedd5', text: '#ea580c', darkBg: 'rgba(234,88,12,0.18)', label: 'PPTX', icon: '📽' },
  png:  { bg: '#fce7f3', text: '#db2777', darkBg: 'rgba(219,39,119,0.18)',label: 'IMG',  icon: '🖼' },
  jpg:  { bg: '#fce7f3', text: '#db2777', darkBg: 'rgba(219,39,119,0.18)',label: 'IMG',  icon: '🖼' },
  jpeg: { bg: '#fce7f3', text: '#db2777', darkBg: 'rgba(219,39,119,0.18)',label: 'IMG',  icon: '🖼' },
  txt:  { bg: '#f1f5f9', text: '#475569', darkBg: 'rgba(71,85,105,0.18)', label: 'TXT',  icon: '📃' },
  mp4:  { bg: '#ede9fe', text: '#7c3aed', darkBg: 'rgba(124,58,237,0.18)',label: 'VID',  icon: '🎬' },
  mp3:  { bg: '#cffafe', text: '#0891b2', darkBg: 'rgba(8,145,178,0.18)', label: 'AUD',  icon: '🎵' },
};
function getFileConfig(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  return FILE_TYPE_CONFIG[ext] || { bg: '#f1f5f9', text: '#475569', darkBg: 'rgba(71,85,105,0.18)', label: ext.toUpperCase().slice(0, 4) || 'FILE', icon: '📁' };
}

/* ── Module color palette ── */
const MOD_COLORS = [
  { accent: '#6366f1', light: 'rgba(99,102,241,0.1)',  label: '#6366f1' },
  { accent: '#10b981', light: 'rgba(16,185,129,0.1)',  label: '#10b981' },
  { accent: '#f59e0b', light: 'rgba(245,158,11,0.1)',  label: '#f59e0b' },
  { accent: '#ef4444', light: 'rgba(239,68,68,0.1)',   label: '#ef4444' },
  { accent: '#8b5cf6', light: 'rgba(139,92,246,0.1)',  label: '#8b5cf6' },
  { accent: '#06b6d4', light: 'rgba(6,182,212,0.1)',   label: '#06b6d4' },
  { accent: '#f97316', light: 'rgba(249,115,22,0.1)',  label: '#f97316' },
  { accent: '#ec4899', light: 'rgba(236,72,153,0.1)',  label: '#ec4899' },
];
const modColor = (i) => MOD_COLORS[i % MOD_COLORS.length];

/* ── File icon badge ── */
function FileBadge({ name, size = 48 }) {
  const cfg = getFileConfig(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25,
      background: cfg.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      gap: 1,
    }}>
      <span style={{ fontSize: size * 0.28, lineHeight: 1 }}>{cfg.icon}</span>
      <span style={{ fontSize: size * 0.18, fontWeight: 800, color: cfg.text, letterSpacing: '0.02em' }}>{cfg.label}</span>
    </div>
  );
}

/* ── Document card — list view ── */
function DocListCard({ doc, onPreview, onDownload, isNew, index }) {
  const [hov, setHov] = useState(false);
  const cfg = getFileConfig(doc.original_name);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 16,
      background: hov ? 'var(--card-border)' : 'transparent',
      border: `1px solid ${hov ? cfg.text + '30' : 'var(--card-border)'}`,
      transition: 'all 0.2s ease',
      transform: hov ? 'translateX(3px)' : 'translateX(0)',
      animation: `fadeSlide 0.35s ease ${index * 0.05}s both`,
    }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <FileBadge name={doc.original_name} size={46} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.title}
          </p>
          {isNew && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', flexShrink: 0 }}>
              NEW
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.original_name}
        </p>
        {doc.description && (
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          {doc.file_size && <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6 }}>{formatSize(doc.file_size)}</span>}
          {doc.created_at && (
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.55, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock style={{ width: 10, height: 10 }} /> {timeAgo(doc.created_at)}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={() => onPreview(doc)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px',
          borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: 'var(--card-border)', color: 'var(--text-primary)',
          border: '1px solid var(--card-border)', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = cfg.bg; e.currentTarget.style.color = cfg.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}>
          <Eye style={{ width: 13, height: 13 }} /> Preview
        </button>
        <button onClick={() => onDownload(doc)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px',
          borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: cfg.text, color: '#fff', border: 'none',
          transition: 'opacity 0.15s', opacity: hov ? 1 : 0.85,
        }}>
          <Download style={{ width: 13, height: 13 }} /> Download
        </button>
      </div>
    </div>
  );
}

/* ── Document card — grid view ── */
function DocGridCard({ doc, onPreview, onDownload, isNew, index }) {
  const [hov, setHov] = useState(false);
  const cfg = getFileConfig(doc.original_name);
  return (
    <div style={{
      borderRadius: 18, overflow: 'hidden',
      border: `1px solid ${hov ? cfg.text + '40' : 'var(--card-border)'}`,
      background: 'var(--card-bg)',
      transform: hov ? 'translateY(-4px)' : 'translateY(0)',
      boxShadow: hov ? `0 12px 32px ${cfg.text}22` : '0 2px 6px rgba(0,0,0,0.04)',
      transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      animation: `fadeSlide 0.35s ease ${index * 0.05}s both`,
      display: 'flex', flexDirection: 'column',
    }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>

      {/* top colored band */}
      <div style={{ height: 6, background: cfg.text, opacity: 0.7 }} />

      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <FileBadge name={doc.original_name} size={44} />
          {isNew && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', flexShrink: 0 }}>
              NEW
            </span>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 3 }}>
            {doc.title}
          </p>
          {doc.description && (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {doc.description}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {doc.file_size && <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6 }}>{formatSize(doc.file_size)}</span>}
          {doc.created_at && (
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.55, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock style={{ width: 9, height: 9 }} /> {timeAgo(doc.created_at)}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button onClick={() => onPreview(doc)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '8px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: cfg.bg, color: cfg.text, border: 'none', transition: 'opacity 0.15s',
          }}>
            <Eye style={{ width: 12, height: 12 }} /> Preview
          </button>
          <button onClick={() => onDownload(doc)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '8px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: cfg.text, color: '#fff', border: 'none', transition: 'opacity 0.15s',
          }}>
            <Download style={{ width: 12, height: 12 }} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Module card ── */
function ModuleCard({ mod, index, docCount, onClick }) {
  const [hov, setHov] = useState(false);
  const col = modColor(index);
  const abbr = (mod.code || mod.name || '').slice(0, 3).toUpperCase();
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '16px 18px', borderRadius: 18, textAlign: 'left', cursor: 'pointer',
      background: 'var(--card-bg)',
      border: `1.5px solid ${hov ? col.accent + '60' : 'var(--card-border)'}`,
      transform: hov ? 'translateY(-2px)' : 'translateY(0)',
      boxShadow: hov ? `0 8px 24px ${col.accent}22` : '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      animation: `fadeSlide 0.35s ease ${index * 0.06}s both`,
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>

      {/* shimmer bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: col.accent, borderRadius: '18px 0 0 18px', opacity: hov ? 1 : 0.4, transition: 'opacity 0.2s' }} />

      {/* icon */}
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: col.light,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        border: `1px solid ${col.accent}30`,
        transition: 'transform 0.2s',
        transform: hov ? 'rotate(-3deg) scale(1.05)' : 'none',
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: col.accent }}>{abbr}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {mod.code && (
          <p style={{ fontSize: 10, fontWeight: 800, color: col.accent, letterSpacing: '0.08em', marginBottom: 2 }}>{mod.code}</p>
        )}
        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mod.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          {mod.teacher_id?.name && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, opacity: 0.75 }}>
              <User style={{ width: 10, height: 10 }} /> {mod.teacher_id.name}
            </span>
          )}
          {mod.category && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: col.light, color: col.accent }}>
              {mod.category}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {docCount !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: col.light, color: col.accent }}>
            {docCount} {docCount === 1 ? 'note' : 'notes'}
          </span>
        )}
        <ChevronRight style={{ width: 16, height: 16, color: hov ? col.accent : 'var(--text-secondary)', transition: 'all 0.2s', transform: hov ? 'translateX(2px)' : '' }} />
      </div>
    </button>
  );
}

/* ── Search bar ── */
function SearchBar({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: focused ? '#6366f1' : 'var(--text-secondary)', opacity: 0.6, transition: 'color 0.2s' }} />
      <input value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          width: '100%', paddingLeft: 42, paddingRight: value ? 40 : 16,
          paddingTop: 11, paddingBottom: 11,
          borderRadius: 14, fontSize: 13, outline: 'none',
          background: 'var(--card-bg)',
          border: `1.5px solid ${focused ? '#6366f1' : 'var(--card-border)'}`,
          color: 'var(--text-primary)',
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }} />
      {value && (
        <button onClick={() => onChange('')} style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: 'var(--text-secondary)', opacity: 0.5,
        }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}

/* ── Stats bar ── */
function StatsBar({ docs }) {
  const types = {};
  docs.forEach(d => {
    const ext = (d.original_name || '').split('.').pop().toLowerCase();
    types[ext] = (types[ext] || 0) + 1;
  });
  const top = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
        {docs.length} file{docs.length !== 1 ? 's' : ''}
      </span>
      {top.map(([ext, count]) => {
        const cfg = getFileConfig(`file.${ext}`);
        return (
          <span key={ext} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 8, background: cfg.bg, color: cfg.text, fontWeight: 700 }}>
            {count} {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ icon: Icon, title, subtitle, color = '#6366f1' }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 0' }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon style={{ width: 28, height: 28, color, opacity: 0.6 }} />
      </div>
      <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.7, maxWidth: 280, margin: '0 auto' }}>{subtitle}</p>
    </div>
  );
}

/* ── Spinner ── */
function Spinner({ color = '#6366f1' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 14 }}>
      <div style={{ position: 'relative', width: 40, height: 40 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.12)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: color, animation: 'spin 0.8s linear infinite' }} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Loading…</p>
    </div>
  );
}

/* ══ MAIN ══ */
export default function StudentDocuments() {
  const [view, setView] = useState('modules');
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
  const [layout, setLayout] = useState('list'); // 'list' | 'grid'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'name'
  const [filterType, setFilterType] = useState('all');
  const [moduleSearch, setModuleSearch] = useState('');
  const [docCounts, setDocCounts] = useState({});

  const [seenIds, setSeenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('edupla_seen_docs') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    (async () => {
      setLoadingModules(true);
      try {
        const clsRes = await api.get('/classes/my');
        const myClasses = clsRes.data.classes || [];
        if (!myClasses.length) { setLoadingModules(false); return; }
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
            fetchedModules = (res.data.courses || []).filter(c =>
              String(c.class_id?._id || c.class_id || '') === classId
            );
          } catch { }
        }
        setModules(fetchedModules);
      } catch { toast.error('Failed to load class info'); }
      finally { setLoadingModules(false); }
    })();
  }, []);

  const fetchDocs = useCallback(async () => {
    if (view !== 'docs' || !selectedModule) return;
    setLoading(true);
    try {
      const params = { page, limit: 24 };
      if (search) params.search = search;
      if (studentClass) params.classId = studentClass.id;
      params.courseId = selectedModule._id;
      const res = await api.get('/documents', { params });
      const docs = res.data.documents || [];
      setDocuments(docs);
      setTotal(res.data.total || docs.length);
      // update count for this module
      setDocCounts(prev => ({ ...prev, [selectedModule._id]: res.data.total || docs.length }));
    } catch { toast.error('Failed to load notes'); }
    finally { setLoading(false); }
  }, [view, search, page, selectedModule, studentClass]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const markSeen = (id) => {
    setSeenIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('edupla_seen_docs', JSON.stringify([...next])); } catch { }
      return next;
    });
  };

  const handlePreview = (doc) => { markSeen(doc.id); setViewingFile(doc); };
  const handleDownload = (doc) => downloadFile(doc);
  const openModule = (mod) => { setSelectedModule(mod); setSearch(''); setPage(1); setDocuments([]); setView('docs'); };

  /* Sort + filter docs */
  const processedDocs = (() => {
    let d = [...documents];
    if (filterType !== 'all') {
      d = d.filter(doc => {
        const ext = (doc.original_name || '').split('.').pop().toLowerCase();
        if (filterType === 'pdf') return ext === 'pdf';
        if (filterType === 'doc') return ['doc', 'docx'].includes(ext);
        if (filterType === 'img') return ['png', 'jpg', 'jpeg'].includes(ext);
        if (filterType === 'sheet') return ['xls', 'xlsx'].includes(ext);
        if (filterType === 'slide') return ['ppt', 'pptx'].includes(ext);
        if (filterType === 'media') return ['mp4', 'mp3'].includes(ext);
        return true;
      });
    }
    if (sortOrder === 'newest') d.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sortOrder === 'oldest') d.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sortOrder === 'name') d.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return d;
  })();

  /* Available file type filters */
  const availableTypes = (() => {
    const exts = new Set(documents.map(d => (d.original_name || '').split('.').pop().toLowerCase()));
    const map = { pdf: exts.has('pdf'), doc: exts.has('doc') || exts.has('docx'), img: exts.has('png') || exts.has('jpg'), sheet: exts.has('xls') || exts.has('xlsx'), slide: exts.has('ppt') || exts.has('pptx'), media: exts.has('mp4') || exts.has('mp3') };
    return Object.entries(map).filter(([, v]) => v).map(([k]) => k);
  })();

  /* Module grouping */
  const CATEGORY_ORDER = ['Specific modules', 'General modules', 'Complementary modules', 'Elective Non Examinable'];
  const filteredMods = moduleSearch
    ? modules.filter(m => (m.name + m.code + m.category + (m.teacher_id?.name || '')).toLowerCase().includes(moduleSearch.toLowerCase()))
    : modules;
  const grouped = {};
  CATEGORY_ORDER.forEach(cat => {
    const items = filteredMods.filter(m => (m.category || '') === cat);
    if (items.length) grouped[cat] = items;
  });
  const uncategorised = filteredMods.filter(m => !CATEGORY_ORDER.includes(m.category || ''));
  if (uncategorised.length) grouped['Other Modules'] = uncategorised;
  const hasGroups = Object.keys(grouped).length > 0;

  const filterLabels = { all: 'All', pdf: 'PDF', doc: 'Docs', img: 'Images', sheet: 'Sheets', slide: 'Slides', media: 'Media' };
  const col = selectedModule ? modColor(modules.findIndex(m => m._id === selectedModule._id)) : MOD_COLORS[0];

  /* ── MODULE VIEW ── */
  if (view === 'modules') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              Notes & Documents
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FolderOpen style={{ width: 13, height: 13 }} />
              {studentClass ? `${studentClass.name} — pick a module below` : 'Select a module to view notes'}
            </p>
          </div>
          {modules.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
              {modules.length} module{modules.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Module search */}
        {modules.length > 3 && (
          <SearchBar value={moduleSearch} onChange={setModuleSearch} placeholder="Search modules…" />
        )}

        {loadingModules ? <Spinner />
          : !hasGroups ? (
            <div className="card">
              <EmptyState icon={BookOpen} title="No modules found"
                subtitle={moduleSearch ? `No modules match "${moduleSearch}"` : studentClass ? `No modules have been assigned to ${studentClass.name} yet.` : 'You are not enrolled in a class yet.'} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {Object.entries(grouped).map(([cat, mods]) => (
                <div key={cat}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Tag style={{ width: 12, height: 12, color: 'var(--text-secondary)', opacity: 0.5 }} />
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', opacity: 0.6 }}>{cat}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--card-border)', marginLeft: 4 }} />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.5 }}>{mods.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mods.map((mod, idx) => (
                      <ModuleCard key={mod._id} mod={mod} index={idx}
                        docCount={docCounts[mod._id]}
                        onClick={() => openModule(mod)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        <style>{`@keyframes fadeSlide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } } @keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── DOCS VIEW ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Breadcrumb + back */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <button onClick={() => { setView('modules'); setDocuments([]); setFilterType('all'); setSortOrder('newest'); }} style={{
          width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--card-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', flexShrink: 0,
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = col.accent + '15'; e.currentTarget.style.borderColor = col.accent + '40'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-bg)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}>
          <ArrowLeft style={{ width: 16, height: 16, color: 'var(--text-primary)' }} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <BookOpen style={{ width: 11, height: 11 }} /> {studentClass?.name}
            </span>
            <ChevronRight style={{ width: 11, height: 11, color: 'var(--text-secondary)', opacity: 0.4 }} />
            {selectedModule?.code && (
              <>
                <span style={{ fontSize: 11, fontWeight: 700, color: col.accent }}>{selectedModule.code}</span>
                <ChevronRight style={{ width: 11, height: 11, color: 'var(--text-secondary)', opacity: 0.4 }} />
              </>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6 }}>Notes</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedModule?.name}
          </h2>
          {!loading && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, opacity: 0.7 }}>{total} note{total !== 1 ? 's' : ''} available</p>}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search notes…" />
        </div>

        {/* Sort */}
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{
          padding: '10px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)',
          outline: 'none',
        }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">A → Z</option>
        </select>

        {/* Layout toggle */}
        <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden' }}>
          {[['list', List], ['grid', Grid3X3]].map(([mode, Icon]) => (
            <button key={mode} onClick={() => setLayout(mode)} style={{
              padding: '9px 12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
              background: layout === mode ? col.accent : 'transparent',
              color: layout === mode ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.18s',
            }}>
              <Icon style={{ width: 15, height: 15 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Type filter chips */}
      {availableTypes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...availableTypes].map(type => {
            const active = filterType === type;
            return (
              <button key={type} onClick={() => setFilterType(type)} style={{
                padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: active ? col.accent : 'var(--card-border)',
                color: active ? '#fff' : 'var(--text-secondary)',
                border: `1.5px solid ${active ? col.accent : 'transparent'}`,
                transition: 'all 0.18s',
              }}>
                {filterLabels[type] || type}
              </button>
            );
          })}
        </div>
      )}

      {/* Stats bar */}
      {!loading && documents.length > 0 && <StatsBar docs={processedDocs} />}

      {/* Content */}
      {loading ? <Spinner color={col.accent} />
        : processedDocs.length === 0 ? (
          <div className="card">
            <EmptyState icon={Inbox}
              title={search || filterType !== 'all' ? 'No matching notes' : 'No notes posted yet'}
              subtitle={search ? `No documents match "${search}"` : filterType !== 'all' ? 'Try a different file type filter' : `Your teacher hasn't uploaded any notes for ${selectedModule?.name} yet.`}
              color={col.accent} />
          </div>
        ) : layout === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {processedDocs.map((doc, i) => (
              <DocGridCard key={doc.id} doc={doc} index={i}
                isNew={!seenIds.has(doc.id)}
                onPreview={handlePreview}
                onDownload={handleDownload} />
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {processedDocs.map((doc, i) => (
              <DocListCard key={doc.id} doc={doc} index={i}
                isNew={!seenIds.has(doc.id)}
                onPreview={handlePreview}
                onDownload={handleDownload} />
            ))}
          </div>
        )}

      {total > 24 && (
        <Pagination page={page} totalPages={Math.ceil(total / 24)} onPageChange={setPage} />
      )}

      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
      <style>{`@keyframes fadeSlide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } } @keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}