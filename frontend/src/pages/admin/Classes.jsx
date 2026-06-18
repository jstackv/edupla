import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import {
  Plus, Search, BookOpen, Users, Edit2, Trash2, UserPlus,
  GraduationCap, ChevronRight, Filter, LayoutGrid, List,
  ArrowUpRight, X, Award, TrendingUp, Layers, UserCheck,
  BarChart2, CheckCircle2, Clock, Star,
  ToggleLeft, ToggleRight,
} from 'lucide-react';

/* ── Constants ── */

/* ── Status Badge ── */
function StatusBadge({ is_active }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, letterSpacing: 0.3,
      background: is_active !== false ? '#ecfdf5' : '#fef2f2',
      color: is_active !== false ? '#059669' : '#ef4444',
    }}>
      {is_active !== false ? 'Active' : 'Inactive'}
    </span>
  );
}


const LEVEL_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#64748b'];
const TRADE_COLORS = ['#f59e0b', '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#10b981', '#3b82f6', '#8b5cf6'];
const LEVEL_BG    = ['#dbeafe', '#d1fae5', '#ede9fe', '#fef3c7', '#fce7f3', '#cffafe', '#ffedd5', '#f1f5f9'];
const TRADE_BG    = ['#fef3c7', '#cffafe', '#fce7f3', '#ffedd5', '#e0e7ff', '#d1fae5', '#dbeafe', '#ede9fe'];

// Dynamic helpers — build meta on the fly from fetched levels/trades arrays
const getLevelMeta = (levels, value) => {
  const idx = levels.findIndex(l => l.value === value);
  const i = idx >= 0 ? idx : 0;
  return { label: levels[idx]?.label || value, color: LEVEL_COLORS[i % LEVEL_COLORS.length], bg: LEVEL_BG[i % LEVEL_BG.length], dark: LEVEL_COLORS[i % LEVEL_COLORS.length] };
};
const getTradeMeta = (trades, value) => {
  const idx = trades.findIndex(t => t.value === value);
  const i = idx >= 0 ? idx : 0;
  return { label: trades[idx]?.label || value, color: TRADE_COLORS[i % TRADE_COLORS.length], bg: TRADE_BG[i % TRADE_BG.length] };
};

const AVATAR_COLORS = [
  ['#6366f1','#4338ca'], ['#0ea5e9','#0284c7'], ['#10b981','#059669'],
  ['#f59e0b','#d97706'], ['#ec4899','#db2777'], ['#8b5cf6','#7c3aed'],
];
function getAvatarColors(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

/* ── Mini sparkline ── */
function Sparkline({ count = 0, max = 1, color = '#6366f1' }) {
  const bars = 5;
  const heights = Array.from({ length: bars }, (_, i) =>
    Math.max(0.15, (i === bars - 1 ? count : Math.random() * count) / Math.max(max, 1))
  );
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 4, height: `${h * 100}%`, borderRadius: 2,
          background: i === bars - 1 ? color : `${color}55`,
          transition: 'height 0.6s ease',
        }} />
      ))}
    </div>
  );
}

/* ── Avatar ── */
function Avatar({ name, size = 36 }) {
  const [from, to] = getAvatarColors(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `linear-gradient(135deg, ${from}, ${to})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: `0 2px 8px ${from}55`,
    }}>
      <span style={{ color: '#fff', fontWeight: 800, fontSize: size * 0.4, letterSpacing: '-0.01em' }}>
        {name?.[0]?.toUpperCase()}
      </span>
    </div>
  );
}

/* ── Level pill ── */
function LevelBadge({ level, levels = [] }) {
  if (!level) return null;
  const idx = levels.findIndex(l => l.value === level);
  const i = idx >= 0 ? idx : (level.charCodeAt(0) % LEVEL_COLORS.length);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: LEVEL_BG[i % LEVEL_BG.length], color: LEVEL_COLORS[i % LEVEL_COLORS.length], letterSpacing: '0.04em',
    }}>{level}</span>
  );
}

/* ── Trade pill ── */
function TradeBadge({ trade, trades = [] }) {
  if (!trade) return null;
  const idx = trades.findIndex(t => t.value === trade);
  const i = idx >= 0 ? idx : (trade.charCodeAt(0) % TRADE_COLORS.length);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: TRADE_BG[i % TRADE_BG.length], color: TRADE_COLORS[i % TRADE_COLORS.length],
    }}>{trade}</span>
  );
}

/* ── Summary stat strip ── */
function StatStrip({ classes, levels = [], trades = [] }) {
  const totalStudents = classes.reduce((a, c) => a + (c.student_count || 0), 0);
  // byTrade is now computed from actual class data, no hardcoded trades needed
  const byTrade = classes.reduce((acc, c) => { if (c.trade) { acc[c.trade] = (acc[c.trade] || 0) + 1; } return acc; }, {});
  const maxTrade = Object.entries(byTrade).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10,
    }}>
      {[
        { icon: BookOpen, label: 'Total Classes', value: classes.length, color: '#6366f1', bg: '#eef2ff' },
        { icon: GraduationCap, label: 'Total Students', value: totalStudents, color: '#10b981', bg: '#ecfdf5' },
        { icon: Layers, label: 'Trades Active', value: Object.values(byTrade).filter(Boolean).length, color: '#0ea5e9', bg: '#f0f9ff' },
        { icon: Star, label: 'Top Trade', value: maxTrade?.[0] || '—', color: '#f59e0b', bg: '#fffbeb', isText: true },
      ].map(({ icon: Icon, label, value, color, bg, isText }) => (
        <div key={label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <p style={{ fontSize: isText ? 14 : 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Class Card (grid view) ── */
function ClassCard({ cls, onEdit, onDelete, onToggle, onViewStudents, onEnroll, animDelay = 0, levels = [], trades = [] }) {
  const [hovered, setHovered] = useState(false);
  const [from] = getAvatarColors(cls.name);
  const maxStudents = 30;

  return (
    <div
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', overflow: 'hidden', cursor: 'default',
        transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 16px 40px rgba(0,0,0,0.12), 0 0 0 1px ${from}22` : '',
        animation: `slideUp 0.4s ease both`,
        animationDelay: `${animDelay}ms`,
        padding: 0,
      }}
    >
      {/* Colour band top */}
      <div style={{
        height: 4, background: `linear-gradient(90deg, ${from}, ${from}88)`,
        borderRadius: '12px 12px 0 0',
      }} />

      <div style={{ padding: '16px 18px 18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: `linear-gradient(135deg, ${from}22, ${from}44)`,
            border: `1.5px solid ${from}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={20} style={{ color: from }} />
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex', gap: 3,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.18s ease',
          }}>
            <button onClick={() => onEnroll(cls)}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#ecfdf5', display: 'flex', alignItems: 'center', gap: 3, transition: 'background 0.15s' }}
              title="Enroll student">
              <UserPlus size={13} style={{ color: '#10b981' }} />
            </button>
            <button onClick={() => onEdit(cls)}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
              title="Edit class">
              <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button onClick={() => onDelete(cls)}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
              title="Delete class">
              <Trash2 size={13} style={{ color: '#ef4444' }} />
            </button>
            <button onClick={() => onToggle(cls)} title={cls.is_active !== false ? 'Deactivate' : 'Activate'}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: cls.is_active !== false ? '#fef3c7' : '#ecfdf5', display: 'flex' }}>
              {cls.is_active !== false ? <ToggleRight size={13} style={{ color: '#d97706' }} /> : <ToggleLeft size={13} style={{ color: '#10b981' }} />}
            </button>
          </div>
        </div>

        {/* Name */}
        <h3 style={{
          fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
          marginBottom: 4, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{cls.name}</h3>

        {cls.description && (
          <p style={{
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
            marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{cls.description}</p>
        )}

        {/* Badges */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          {cls.level && !cls.program_config_id && <LevelBadge level={cls.level} levels={levels} />}
          {cls.trade && <TradeBadge trade={cls.trade} trades={trades} />}
          {cls.program_config_id && (
            <span title={cls.program_qualification_title || ''} style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: '#ede9fe', color: '#7c3aed', display: 'inline-flex', alignItems: 'center', gap: 4,
              maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <Award size={10} /> {cls.program_rtqf_level || cls.level || 'Linked'}
            </span>
          )}
        </div>

        {/* Teacher */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          borderRadius: 10, background: 'var(--surface-50)',
          marginBottom: 12,
        }}>
          <Avatar name={cls.teacher_name || '?'} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 1 }}>Class Teacher</p>
            <p style={{
              fontSize: 12, fontWeight: 600,
              color: cls.teacher_name ? 'var(--text-primary)' : '#f59e0b',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{cls.teacher_name || '⚠ Unassigned'}</p>
          </div>
        </div>

        {/* Students progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={11} /> Students
            </span>
            <Sparkline count={cls.student_count || 0} max={maxStudents} color={from} />
          </div>
          <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-100)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.min(((cls.student_count || 0) / maxStudents) * 100, 100)}%`,
              background: `linear-gradient(90deg, ${from}99, ${from})`,
              transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 10, borderTop: '1px solid var(--card-border)',
        }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 16 }}>{cls.student_count || 0}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
              student{cls.student_count !== 1 ? 's' : ''}
            </span>
          </span>
          <button onClick={() => onViewStudents(cls)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600, color: from,
            background: `${from}14`, border: 'none', cursor: 'pointer',
            padding: '5px 10px', borderRadius: 8, transition: 'background 0.15s',
          }}>
            View <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Class Row (list view) ── */
function ClassRow({ cls, onEdit, onDelete, onToggle, onViewStudents, onEnroll, animDelay = 0, levels = [], trades = [] }) {
  const [hovered, setHovered] = useState(false);
  const [from] = getAvatarColors(cls.name);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 14,
        background: hovered ? 'var(--surface-50)' : 'transparent',
        transition: 'background 0.15s',
        borderBottom: '1px solid var(--card-border)',
        animation: `slideUp 0.35s ease both`,
        animationDelay: `${animDelay}ms`,
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        background: `linear-gradient(135deg, ${from}22, ${from}44)`,
        border: `1.5px solid ${from}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <BookOpen size={17} style={{ color: from }} />
      </div>

      <div style={{ flex: 1.8, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{cls.name}</p>
        {cls.description && (
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
            {cls.description}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 5, flex: 0.8, minWidth: 80, flexWrap: 'wrap' }}>
        {cls.level && !cls.program_config_id && <LevelBadge level={cls.level} levels={levels} />}
        {cls.trade && <TradeBadge trade={cls.trade} trades={trades} />}
        {cls.program_config_id && (
          <span title={cls.program_qualification_title || ''} style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            background: '#ede9fe', color: '#7c3aed', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Award size={10} /> {cls.program_rtqf_level || cls.level || 'Linked'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 120 }}>
        <Avatar name={cls.teacher_name || '?'} size={26} />
        <span style={{ fontSize: 12, color: cls.teacher_name ? 'var(--text-secondary)' : '#f59e0b', fontWeight: cls.teacher_name ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cls.teacher_name || '⚠ Unassigned'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 0.5, minWidth: 70 }}>
        <Users size={13} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{cls.student_count || 0}</span>
      </div>

      <div style={{ display: 'flex', gap: 4, opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}>
        <button onClick={() => onEnroll(cls)} title="Enroll"
          style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#ecfdf5', display: 'flex' }}>
          <UserPlus size={13} style={{ color: '#10b981' }} />
        </button>
        <button onClick={() => onViewStudents(cls)} title="Students"
          style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex' }}>
          <Users size={13} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button onClick={() => onEdit(cls)} title="Edit"
          style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex' }}>
          <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button onClick={() => onDelete(cls)} title="Delete"
          style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fef2f2', display: 'flex' }}>
          <Trash2 size={13} style={{ color: '#ef4444' }} />
        </button>
      </div>
    </div>
  );
}

/* ══ MAIN ══ */
export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [levels, setLevels] = useState([]);
  const [trades, setTrades] = useState([]);
  const [programConfigs, setProgramConfigs] = useState([]);

  // Trade and RTQF Level chip options for the class form are derived from the
  // TVET Program Configs created in Admin Settings, so every trade/level an admin
  // sets up there is selectable here — instead of relying on the separate,
  // disconnected Level/Trade list.
  const programTradeOptions = useMemo(() => {
    const seen = new Map();
    programConfigs.forEach(p => { if (p.trade && !seen.has(p.trade)) seen.set(p.trade, p.trade); });
    return Array.from(seen.keys()).map(value => ({ value, label: value }));
  }, [programConfigs]);

  const programRtqfLevelOptions = useMemo(() => {
    const seen = new Map();
    programConfigs.forEach(p => { if (p.rtqfLevel && !seen.has(p.rtqfLevel)) seen.set(p.rtqfLevel, p.rtqfLevel); });
    return Array.from(seen.keys()).map(value => ({ value, label: value }));
  }, [programConfigs]);
  const [modal, setModal] = useState(false);
  const [studentsModal, setStudentsModal] = useState(false);
  const [enrollModal, setEnrollModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [studentsTarget, setStudentsTarget] = useState(null);
  const [enrollTarget, setEnrollTarget] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollSearchResults, setEnrollSearchResults] = useState([]);
  const [loadingEnrollSearch, setLoadingEnrollSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', level: '', trade: '', teacher_id: '', extra_teacher_ids: [], programConfigId: '',
  });

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/classes', {
        params: { search, page, limit: 12, level: filterLevel, trade: filterTrade },
      });
      setClasses(res.data.classes);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load classes'); }
    finally { setLoading(false); }
  }, [search, page, filterLevel, filterTrade]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);
  useEffect(() => {
    api.get('/admin/teachers?limit=200').then(r => setTeachers(r.data.teachers || [])).catch(() => {});
    api.get('/admin/students?limit=500').then(r => setAllStudents(r.data.students || [])).catch(() => {});
    api.get('/admin/levels').then(r => setLevels(r.data.levels || [])).catch(() => {});
    api.get('/admin/trades').then(r => setTrades(r.data.trades || [])).catch(() => {});
    api.get('/admin/program-configs').then(r => setProgramConfigs(r.data.programConfigs || [])).catch(() => {});
  }, []);

  const openModal = async (cls = null) => {
    setEditing(cls);
    if (cls) {
      let extraIds = [];
      try {
        const r = await api.get(`/admin/classes/${cls.id}/teachers`);
        const classTeacherId = String(cls.teacher_id?._id || cls.teacher_id || '');
        extraIds = (r.data.teachers || [])
          .map(t => String(t._id || t.id || ''))
          .filter(id => id && id !== classTeacherId);
      } catch {}
      setForm({
        name: cls.name, description: cls.description || '',
        level: cls.level || '', trade: cls.trade || '',
        teacher_id: String(cls.teacher_id?._id || cls.teacher_id || ''),
        extra_teacher_ids: extraIds,
        programConfigId: String(cls.program_config_id?._id || cls.program_config_id || ''),
      });
    } else {
      setForm({ name: '', description: '', level: '', trade: '', teacher_id: '', extra_teacher_ids: [], programConfigId: '' });
    }
    setModal(true);
  };

  const openStudentsModal = async (cls) => {
    setStudentsTarget(cls);
    setStudentsModal(true);
    setLoadingStudents(true);
    try {
      const res = await api.get(`/admin/classes/${cls.id}/students`);
      setClassStudents(res.data.students);
    } catch { toast.error('Failed to load students'); }
    finally { setLoadingStudents(false); }
  };

  const openEnrollModal = async (cls) => {
    setEnrollTarget(cls);
    setEnrollStudentId('');
    setEnrollSearch('');
    setEnrollSearchResults([]);
    setEnrollModal(true);
    // Load initial unenrolled students
    setLoadingEnrollSearch(true);
    try {
      const res = await api.get(`/admin/classes/${cls.id}/unenrolled-students`, { params: { search: '' } });
      setEnrollSearchResults(res.data.students || []);
    } catch { setEnrollSearchResults([]); }
    finally { setLoadingEnrollSearch(false); }
  };
  
  const handleEnrollSearch = async (value) => {
    setEnrollSearch(value);
    setEnrollStudentId('');
    if (!enrollTarget) return;
    setLoadingEnrollSearch(true);
    try {
      const res = await api.get(`/admin/classes/${enrollTarget.id}/unenrolled-students`, { params: { search: value } });
      setEnrollSearchResults(res.data.students || []);
    } catch { setEnrollSearchResults([]); }
    finally { setLoadingEnrollSearch(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, extra_teacher_ids: form.extra_teacher_ids.filter(Boolean) };
      if (editing) {
        await api.put(`/admin/classes/${editing.id}`, payload);
        toast.success('Class updated');
      } else {
        await api.post('/admin/classes', payload);
        toast.success('Class created');
      }
      setModal(false);
      fetchClasses();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleToggle = (cls) => {
    setToggleTarget(cls);
  };

  const handleToggleConfirm = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const res = await api.patch(`/admin/classes/${toggleTarget._id || toggleTarget.id}/toggle-status`);
      toast.success(res.data.message);
      setToggleTarget(null);
      fetchClasses();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update status'); }
    finally { setToggling(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/classes/${deleteTarget.id}`);
      toast.success('Class deleted');
      setDeleteTarget(null);
      fetchClasses();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const handleEnrollStudent = async () => {
    if (!enrollStudentId) return toast.error('Please select a student');
    setEnrolling(true);
    try {
      await api.post(`/admin/classes/${enrollTarget.id}/enroll-student`, { student_id: parseInt(enrollStudentId) });
      toast.success('Student enrolled successfully');
      setEnrollModal(false);
      fetchClasses();
      if (studentsModal && studentsTarget?.id === enrollTarget.id) {
        const res = await api.get(`/admin/classes/${enrollTarget.id}/students`);
        setClassStudents(res.data.students);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to enroll student'); }
    finally { setEnrolling(false); }
  };

  const toggleExtraTeacher = (tid) => {
    const tidStr = String(tid);
    const ids = form.extra_teacher_ids.map(String);
    setForm(f => ({
      ...f,
      extra_teacher_ids: ids.includes(tidStr) ? ids.filter(x => x !== tidStr) : [...ids, tidStr],
    }));
  };

  const enrolledIds = new Set(classStudents.map(s => s.id));
  const activeFilters = [filterLevel, filterTrade].filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Hero Banner ── */}
      <div style={{
        borderRadius: 20, padding: '22px 26px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0c1445 0%, #1e3a5f 40%, #0f4c75 100%)',
        boxShadow: '0 8px 32px rgba(14,165,233,0.25)',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(14,165,233,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 200, width: 90, height: 90, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 80, width: 60, height: 60, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: '4px 10px', borderRadius: 99, background: 'rgba(14,165,233,0.2)', border: '1px solid rgba(14,165,233,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <BookOpen size={11} style={{ color: '#7dd3fc' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#7dd3fc', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Class Management</span>
              </div>
              <div style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#6ee7b7' }}>{total} active</span>
              </div>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 5, lineHeight: 1.2 }}>
              📚 Classes
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', maxWidth: 380, lineHeight: 1.6 }}>
              Create and manage classes, assign teachers, and track student enrollment across all programs.
            </p>
          </div>

          {/* Quick counters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {levels.map(l => {
              const count = classes.filter(c => c.level === l.value).length;
              return (
                <div key={l.value} style={{
                  textAlign: 'center', padding: '10px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                  minWidth: 62,
                }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{count}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3, fontWeight: 600 }}>{l.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trade breakdown strip */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {trades.map((t, i) => {
            const count = classes.filter(c => c.trade === t.value).length;
            return (
              <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: TRADE_COLORS[i % TRADE_COLORS.length] }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{t.value}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{count}</span>
              </div>
            );
          })}
          <button
            onClick={() => openModal()}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.12)', color: '#fff',
              fontSize: 12, fontWeight: 700, transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            <Plus size={14} /> New Class
          </button>
        </div>
      </div>

      {/* ── Stat Strip ── */}
      {!loading && classes.length > 0 && <StatStrip classes={classes} levels={levels} trades={trades} />}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field"
            style={{ paddingLeft: 34 }}
            placeholder="Search classes or teachers…"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(f => !f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)',
            background: showFilters || activeFilters ? '#eef2ff' : 'var(--card-bg)',
            color: showFilters || activeFilters ? '#6366f1' : 'var(--text-secondary)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <Filter size={13} />
          Filters
          {activeFilters > 0 && (
            <span style={{
              width: 16, height: 16, borderRadius: '50%', background: '#6366f1',
              color: '#fff', fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{activeFilters}</span>
          )}
        </button>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--surface-100)', borderRadius: 10, padding: 3, gap: 2 }}>
          {[{ mode: 'grid', icon: LayoutGrid }, { mode: 'list', icon: List }].map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: viewMode === mode ? 'var(--card-bg)' : 'transparent',
                color: viewMode === mode ? '#6366f1' : 'var(--text-secondary)',
                boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                display: 'flex', transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <button onClick={() => openModal()} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
          <Plus size={14} /> New Class
        </button>
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="card" style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
          flexWrap: 'wrap', animation: 'slideUp 0.2s ease',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Filter by:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>Level</span>
            {levels.map((l, i) => {
              const active = filterLevel === l.value;
              return (
                <button key={l.value} onClick={() => { setFilterLevel(active ? '' : l.value); setPage(1); }}
                  style={{
                    padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: active ? LEVEL_BG[i % LEVEL_BG.length] : 'var(--surface-100)',
                    color: active ? LEVEL_COLORS[i % LEVEL_COLORS.length] : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}>{l.value}</button>
              );
            })}
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--card-border)' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>Trade</span>
            {trades.map((t, i) => {
              const active = filterTrade === t.value;
              return (
                <button key={t.value} onClick={() => { setFilterTrade(active ? '' : t.value); setPage(1); }}
                  style={{
                    padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: active ? TRADE_BG[i % TRADE_BG.length] : 'var(--surface-100)',
                    color: active ? TRADE_COLORS[i % TRADE_COLORS.length] : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}>{t.value}</button>
              );
            })}
          </div>
          {activeFilters > 0 && (
            <button onClick={() => { setFilterLevel(''); setFilterTrade(''); setPage(1); }}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#ef4444', background: '#fef2f2', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 7 }}>
              <X size={11} /> Clear
            </button>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--surface-100)', borderTopColor: '#0ea5e9', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading classes…</p>
          </div>
        </div>
      ) : classes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={28} style={{ color: '#0ea5e9' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No classes found</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {search || activeFilters ? 'Try adjusting your search or filters.' : 'Create the first class to get started.'}
          </p>
          {!search && !activeFilters && (
            <button onClick={() => openModal()} className="btn-primary" style={{ margin: '0 auto' }}>
              <Plus size={14} /> Create Class
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {classes.map((cls, i) => (
            <ClassCard key={cls.id} cls={cls} animDelay={i * 50}
              levels={levels} trades={trades}
              onEdit={openModal} onDelete={setDeleteTarget} onToggle={handleToggle}
              onViewStudents={openStudentsModal} onEnroll={openEnrollModal} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* List header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
            borderBottom: '1px solid var(--card-border)',
            background: 'var(--surface-50)',
          }}>
            <div style={{ flex: 1.8, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Class</span>
            </div>
            <div style={{ flex: 0.8, minWidth: 80 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tags</span>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Teacher</span>
            </div>
            <div style={{ flex: 0.5, minWidth: 70 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Students</span>
            </div>
            <div style={{ width: 130 }} />
          </div>
          <div style={{ padding: '4px 0' }}>
            {classes.map((cls, i) => (
              <ClassRow key={cls.id} cls={cls} animDelay={i * 40}
                levels={levels} trades={trades}
                onEdit={openModal} onDelete={setDeleteTarget} onToggle={handleToggle}
                onViewStudents={openStudentsModal} onEnroll={openEnrollModal} />
            ))}
          </div>
        </div>
      )}

      {total > 12 && (
        <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />
      )}

      {/* ── Create/Edit Modal ── */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Class' : 'Create New Class'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Class Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field" placeholder="e.g. Web Development L3" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field resize-none" rows={3} placeholder="Brief class description…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">RTQF Level</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {[{ value: '', label: 'None' }, ...programRtqfLevelOptions].map((l, i) => {
                  const active = form.level === l.value;
                  const color = i === 0 ? 'var(--card-border)' : LEVEL_COLORS[(i - 1) % LEVEL_COLORS.length];
                  const bg = i === 0 ? 'var(--surface-50)' : LEVEL_BG[(i - 1) % LEVEL_BG.length];
                  return (
                    <button key={l.value} type="button"
                      onClick={() => setForm(f => ({ ...f, level: l.value }))}
                      style={{
                        padding: '5px 10px', borderRadius: 8, border: active ? `1.5px solid ${color}` : '1.5px solid var(--card-border)',
                        background: active ? bg : 'var(--surface-50)',
                        color: active ? color : 'var(--text-secondary)',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {l.value || 'None'}
                    </button>
                  );
                })}
              </div>
              {programRtqfLevelOptions.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                  No RTQF levels yet — add a program in Admin Settings first.
                </p>
              )}
            </div>
            <div>
              <label className="label">Trade</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {[{ value: '', label: 'None' }, ...programTradeOptions].map((t, i) => {
                  const active = form.trade === t.value;
                  const color = i === 0 ? 'var(--card-border)' : TRADE_COLORS[(i - 1) % TRADE_COLORS.length];
                  const bg = i === 0 ? 'var(--surface-50)' : TRADE_BG[(i - 1) % TRADE_BG.length];
                  return (
                    <button key={t.value} type="button"
                      onClick={() => setForm(f => ({ ...f, trade: t.value }))}
                      style={{
                        padding: '5px 10px', borderRadius: 8, border: active ? `1.5px solid ${color}` : '1.5px solid var(--card-border)',
                        background: active ? bg : 'var(--surface-50)',
                        color: active ? color : 'var(--text-secondary)',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {t.value || 'None'}
                    </button>
                  );
                })}
              </div>
              {programTradeOptions.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                  No trades yet — add a program in Admin Settings first.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="label">TVET Program / Qualification</label>
            <select
              value={form.programConfigId}
              onChange={e => {
                const id = e.target.value;
                const picked = programConfigs.find(p => p._id === id);
                setForm(f => ({
                  ...f,
                  programConfigId: id,
                  // Keep the RTQF Level / Trade chips above in sync with the chosen program
                  level: picked ? picked.rtqfLevel : f.level,
                  trade: picked ? picked.trade : f.trade,
                }));
              }}
              className="input-field"
            >
              <option value="">None — not linked to a program</option>
              {programConfigs.map(p => (
                <option key={p._id} value={p._id}>
                  {p.trade} · {p.rtqfLevel} — {p.qualificationTitle}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              {programConfigs.length === 0
                ? 'No programs configured yet — add one in Admin Settings to populate this list.'
                : "Sector, qualification title and RTQF level from this program will appear on this class's student reports."}
            </p>
          </div>

          <div>
            <label className="label">Class Teacher *</label>
            <select value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}
              className="input-field" required>
              <option value="">Select class teacher…</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">
              Additional Teachers{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(co-teachers)</span>
            </label>
            <div style={{
              borderRadius: 12, border: '1px solid var(--card-border)',
              maxHeight: 140, overflowY: 'auto', padding: 8,
              background: 'var(--surface-50)',
            }}>
              {teachers.filter(t => String(t.id) !== form.teacher_id).length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 4 }}>No other teachers available</p>
              ) : teachers.filter(t => String(t.id) !== form.teacher_id).map(t => (
                <label key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                  borderRadius: 8, cursor: 'pointer', transition: 'background 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-100)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <input type="checkbox" checked={form.extra_teacher_ids.includes(String(t.id))}
                    onChange={() => toggleExtraTeacher(String(t.id))} style={{ borderRadius: 4 }} />
                  <Avatar name={t.name} size={22} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.email}</span>
                </label>
              ))}
            </div>
            {form.extra_teacher_ids.length > 0 && (
              <p style={{ fontSize: 11, color: '#6366f1', marginTop: 5 }}>
                {form.extra_teacher_ids.length} additional teacher{form.extra_teacher_ids.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
              {editing ? 'Update Class' : 'Create Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Students Modal ── */}
      <Modal isOpen={studentsModal} onClose={() => setStudentsModal(false)} title={`Students — ${studentsTarget?.name}`}>
        {loadingStudents ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--surface-100)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : classStudents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <GraduationCap size={24} style={{ color: '#0ea5e9' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No students enrolled</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Add students to this class to get started.</p>
            <button onClick={() => { setStudentsModal(false); openEnrollModal(studentsTarget); }} className="btn-primary" style={{ margin: '0 auto' }}>
              <UserPlus size={14} /> Enroll a Student
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              {classStudents.map((s, i) => {
                const [from] = getAvatarColors(s.name);
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 12, background: 'var(--surface-50)',
                    animation: 'slideUp 0.3s ease both',
                    animationDelay: `${i * 40}ms`,
                  }}>
                    <Avatar name={s.name} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {s.level && <LevelBadge level={s.level} levels={levels} />}
                      {s.trade && <TradeBadge trade={s.trade} trades={trades} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--card-border)', marginTop: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{classStudents.length} student{classStudents.length !== 1 ? 's' : ''} enrolled</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStudentsModal(false); openEnrollModal(studentsTarget); }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserPlus size={13} /> Enroll Student
                </button>
                <button onClick={() => setStudentsModal(false)} className="btn-secondary">Close</button>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* ── Enroll Modal ── */}
      <Modal isOpen={enrollModal} onClose={() => setEnrollModal(false)} title={`Enroll Student — ${enrollTarget?.name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f0f9ff', border: '1px solid #bae6fd', display: 'flex', gap: 10 }}>
            <UserCheck size={18} style={{ color: '#0ea5e9', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#0369a1', lineHeight: 1.6 }}>
              Search and select an unenrolled student to add to <strong>{enrollTarget?.name}</strong>.
            </p>
          </div>
          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              className="input-field"
              style={{ paddingLeft: 32 }}
              placeholder="Search by name or email…"
              value={enrollSearch}
              onChange={e => handleEnrollSearch(e.target.value)}
            />
          </div>
          {/* Results list */}
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: 10 }}>
            {loadingEnrollSearch ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>Searching…</div>
            ) : enrollSearchResults.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                {enrollSearch ? 'No unenrolled students found for this search.' : 'All students are already enrolled in this class.'}
              </div>
            ) : (
              enrollSearchResults.map(s => (
                <button
                  key={s.id}
                  onClick={() => setEnrollStudentId(String(s.id))}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: String(enrollStudentId) === String(s.id) ? 'rgba(99,102,241,0.08)' : 'transparent',
                    borderBottom: '1px solid var(--card-border)',
                    borderLeft: String(enrollStudentId) === String(s.id) ? '3px solid #6366f1' : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>
                    {s.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</p>
                  </div>
                  {(s.level || s.trade) && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: '#6366f1', flexShrink: 0 }}>{s.level || s.trade}</span>
                  )}
                  {String(enrollStudentId) === String(s.id) && (
                    <UserCheck size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                  )}
                </button>
              ))
            )}
          </div>
          {enrollStudentId && (
            <p style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 5 }}>
              <UserCheck size={13} /> {enrollSearchResults.find(s => String(s.id) === String(enrollStudentId))?.name} selected
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setEnrollModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleEnrollStudent} disabled={enrolling || !enrollStudentId} className="btn-primary">
              {enrolling && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
              Enroll Student
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!toggleTarget} onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleConfirm} loading={toggling}
        title={toggleTarget?.is_active !== false ? 'Deactivate Class' : 'Activate Class'}
        message={toggleTarget?.is_active !== false
          ? `Deactivate "${toggleTarget?.name}"? Students will lose access to assignments and documents in this class.`
          : `Activate "${toggleTarget?.name}"? Students will regain access to this class.`}
        confirmText={toggleTarget?.is_active !== false ? 'Deactivate' : 'Activate'}
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} loading={deleting}
        title="Delete Class"
        message={`Delete "${deleteTarget?.name}"? All assignments and documents for this class will also be removed.`}
        confirmText="Delete" variant="danger"
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}