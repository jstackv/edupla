import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import ManageClassModal from '../../components/common/ManageClassModal';
import {
  LEVEL_COLORS, TRADE_COLORS, LEVEL_BG, TRADE_BG,
  StatusBadge, Avatar, LevelBadge, TradeBadge, getAvatarColors,
} from '../../components/common/classUI';
import {
  Plus, Search, BookOpen, Users, Edit2, Trash2, UserPlus,
  GraduationCap, ChevronRight, Filter, LayoutGrid, List,
  ArrowUpRight, X, Award, TrendingUp, Layers,
  BarChart2, CheckCircle2, Clock, Star, Copy, Eye, EyeOff,
  ToggleLeft, ToggleRight, Settings2, ArrowRightLeft, ShieldAlert,
  LayoutDashboard, Eraser, AlertTriangle, ArrowLeft, ChevronDown,
  FileDown, ArrowDownAZ,
} from 'lucide-react';

/* ── Constants ── */

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

/* ── Mini sparkline ── */
function Sparkline({ count = 0, max = 1, color = '#c2410c' }) {
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

/* ── Summary stat strip ── */
function StatStrip({ classes, levels = [], trades = [] }) {
  const { t: tr } = useTranslation();
  const totalStudents = classes.reduce((a, c) => a + (c.student_count || 0), 0);
  // byTrade is now computed from actual class data, no hardcoded trades needed
  const byTrade = classes.reduce((acc, c) => { if (c.trade) { acc[c.trade] = (acc[c.trade] || 0) + 1; } return acc; }, {});
  const maxTrade = Object.entries(byTrade).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10,
    }}>
      {[
        { icon: BookOpen, label: tr('adminClasses.statStrip.totalClasses'), value: classes.length, color: '#c2410c', bg: '#fed7aa' },
        { icon: GraduationCap, label: tr('adminClasses.statStrip.totalStudents'), value: totalStudents, color: '#10b981', bg: '#ecfdf5' },
        { icon: Layers, label: tr('adminClasses.statStrip.tradesActive'), value: Object.values(byTrade).filter(Boolean).length, color: '#c2410c', bg: '#fed7aa' },
        { icon: Star, label: tr('adminClasses.statStrip.topTrade'), value: maxTrade?.[0] || '—', color: '#f59e0b', bg: '#fffbeb', isText: true },
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
// Fixed brand accent for every class card's icon badge + top strip — not
// name-hash-derived like Avatar, since with class names like "L3/L4/L5..."
// virtually all of them share a first letter and would otherwise collide on
// the exact same hashed color anyway. One deliberate teal reads as "this
// is a class" consistently, the same way Online Assessment Performance
// settled on one indigo instead of a per-card rainbow.
const CLASS_CARD_ACCENT = '#0f766e';

function ClassCard({ cls, onEdit, onDelete, onToggle, onViewStudents, onEnroll, onManage, animDelay = 0, levels = [], trades = [] }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const from = CLASS_CARD_ACCENT;
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
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800,
            padding: '3px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.03em',
            background: cls.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.14)',
            color: cls.is_active ? '#059669' : '#6b7280',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cls.is_active ? '#059669' : '#9ca3af' }} />
            {cls.is_active ? t('common.active') : t('common.inactive')}
          </span>
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
              background: '#fdba74', color: '#9a3412', display: 'inline-flex', alignItems: 'center', gap: 4,
              maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <Award size={10} /> {cls.program_rtqf_level || cls.level || t('adminClasses.card.linked')}
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
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 1 }}>{t('adminClasses.card.classTeacher')}</p>
            <p style={{
              fontSize: 12, fontWeight: 600,
              color: cls.teacher_name ? 'var(--text-primary)' : '#f59e0b',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{cls.teacher_name || t('adminClasses.card.unassigned')}</p>
          </div>
        </div>

        {/* Students progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={11} /> {t('adminClasses.card.students')}
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

        {/* Why inactive — a class only ever turns on once it has BOTH a
            class teacher and at least one student; spell out whichever is
            still missing so it isn't a mystery. */}
        {!cls.is_active && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 10px', borderRadius: 9,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 12,
          }}>
            <AlertTriangle size={12} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 11, color: '#b45309', margin: 0, lineHeight: 1.4 }}>
              {!cls.teacher_name && !cls.student_count && t('adminClasses.card.needsBoth')}
              {!cls.teacher_name && cls.student_count > 0 && t('adminClasses.card.needsTeacher')}
              {cls.teacher_name && !cls.student_count && t('adminClasses.card.needsStudent')}
              {cls.teacher_name && cls.student_count > 0 && t('adminClasses.card.manuallyDeactivated')}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 10, borderTop: '1px solid var(--card-border)', gap: 6,
        }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 16 }}>{cls.student_count || 0}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {t('adminClasses.card.student', { count: cls.student_count || 0 })}
            </span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => onEdit(cls)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 600, color: from,
              background: `${from}14`, border: 'none', cursor: 'pointer',
              padding: '5px 10px', borderRadius: 8, transition: 'background 0.15s',
            }}>
              {t('adminClasses.card.editClassInfo')} <ArrowUpRight size={12} />
            </button>
            <button onClick={() => onManage(cls)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 700, color: '#fff',
              background: 'linear-gradient(135deg, #7c2d12, #c2410c)',
              border: 'none', cursor: 'pointer',
              padding: '6px 12px', borderRadius: 8,
              boxShadow: '0 3px 10px rgba(194, 65, 12,0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 14px rgba(194, 65, 12,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(194, 65, 12,0.35)'; }}
            >
              <Settings2 size={12} /> {t('adminClasses.card.manage')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Class Row (list view) ── */
function ClassRow({ cls, onEdit, onDelete, onToggle, onViewStudents, onEnroll, onManage, animDelay = 0, levels = [], trades = [] }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const from = CLASS_CARD_ACCENT;

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
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 7 }}>
          {cls.name}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 800,
            padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.03em',
            background: cls.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.14)',
            color: cls.is_active ? '#059669' : '#6b7280',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: cls.is_active ? '#059669' : '#9ca3af' }} />
            {cls.is_active ? t('common.active') : t('common.inactive')}
          </span>
        </p>
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
            background: '#fdba74', color: '#9a3412', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Award size={10} /> {cls.program_rtqf_level || cls.level || t('adminClasses.card.linked')}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 120 }}>
        <Avatar name={cls.teacher_name || '?'} size={26} />
        <span style={{ fontSize: 12, color: cls.teacher_name ? 'var(--text-secondary)' : '#f59e0b', fontWeight: cls.teacher_name ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cls.teacher_name || t('adminClasses.card.unassigned')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 0.5, minWidth: 70 }}>
        <Users size={13} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{cls.student_count || 0}</span>
      </div>

      <div style={{ display: 'flex', gap: 4, opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}>
        <button onClick={() => onEnroll(cls)} title={t('adminClasses.card.enroll')}
          style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#ecfdf5', display: 'flex' }}>
          <UserPlus size={13} style={{ color: '#10b981' }} />
        </button>
        <button onClick={() => onViewStudents(cls)} title={t('adminClasses.card.students2')}
          style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex' }}>
          <Users size={13} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button onClick={() => onEdit(cls)} title={t('adminClasses.card.edit')}
          style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex' }}>
          <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button onClick={() => onDelete(cls)} title={t('adminClasses.card.delete')}
          style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fef2f2', display: 'flex' }}>
          <Trash2 size={13} style={{ color: '#ef4444' }} />
        </button>
        <button onClick={() => onManage(cls)} title={t('adminClasses.card.manage')} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg, #7c2d12, #c2410c)',
          border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: 8,
          boxShadow: '0 2px 8px rgba(194, 65, 12,0.35)',
        }}>
          <Settings2 size={12} /> {t('adminClasses.card.manage')}
        </button>
      </div>
    </div>
  );
}

/* ── Small helper used only inside the Create/Edit modal: a sentence-case
   section header with icon, distinct from the uppercase field labels so
   the form reads in two clear tiers instead of one flat wall of caps. */
function FormSectionHeader({ icon: Icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
      <div style={{
        width: 20, height: 20, borderRadius: 6, background: 'rgba(194,65,12,0.14)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={11} style={{ color: '#c2410c' }} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
    </div>
  );
}

/* ══ MAIN ══ */
export default function AdminClasses() {
  const { t } = useTranslation();
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
  const [modal, setModal] = useState(false);
  const [studentsModal, setStudentsModal] = useState(false);
  const [enrollModal, setEnrollModal] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [manageTarget, setManageTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [studentsTarget, setStudentsTarget] = useState(null);
  const [enrollTarget, setEnrollTarget] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsSortAsc, setStudentsSortAsc] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  // Registering + enrolling a brand-new student directly into the selected
  // class — no other class is offered here since a student can only ever
  // belong to one class, and this one is already decided by which class
  // the admin clicked "enroll" from.
  const [enrollForm, setEnrollForm] = useState({ name: '', email: '', class_year: '' });
  const [enrollDefaultPassword, setEnrollDefaultPassword] = useState('');
  const [enrollShowPassword, setEnrollShowPassword] = useState(false);
  // Live roster search inside the Enroll modal — lets the admin quickly
  // confirm a student isn't already enrolled in this class before
  // registering a new one, without leaving the modal.
  const [enrollClassRoster, setEnrollClassRoster] = useState([]);
  const [loadingEnrollRoster, setLoadingEnrollRoster] = useState(false);
  const [enrollRosterSearch, setEnrollRosterSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', level: '', trade: '', teacher_id: '', extra_teacher_ids: [], programConfigId: '',
  });

  // Custom TVET Program dropdown — a native <select> auto-sizes its option
  // list to the longest option text, which is what let the list spill past
  // the modal's edge. This one is a plain button + absolutely-positioned
  // panel pinned to the trigger's own width, so it never escapes the modal.
  const [programDropdownOpen, setProgramDropdownOpen] = useState(false);
  const programDropdownRef = useRef(null);

  useEffect(() => {
    if (!programDropdownOpen) return;
    const handler = (e) => {
      if (programDropdownRef.current && !programDropdownRef.current.contains(e.target)) {
        setProgramDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [programDropdownOpen]);

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

  // Keep the open Manage Class modal's data fresh: a teacher assignment,
  // co-teacher change, or student enrollment made from inside that modal
  // triggers fetchClasses(), but manageTarget itself is a snapshot taken
  // when the modal opened and won't reflect that refresh on its own.
  useEffect(() => {
    if (!manageTarget) return;
    const fresh = classes.find(c => c.id === manageTarget.id);
    if (fresh && fresh !== manageTarget) setManageTarget(fresh);
  }, [classes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchClasses(); }, [fetchClasses]);
  useEffect(() => {
    api.get('/admin/teachers?limit=200').then(r => setTeachers(r.data.teachers || [])).catch(() => {});
    api.get('/admin/students?limit=500').then(r => setAllStudents(r.data.students || [])).catch(() => {});
    api.get('/admin/levels').then(r => setLevels(r.data.levels || [])).catch(() => {});
    api.get('/admin/trades').then(r => setTrades(r.data.trades || [])).catch(() => {});
    api.get('/admin/program-configs').then(r => setProgramConfigs(r.data.programConfigs || [])).catch(() => {});
  }, []);

  const openModal = (cls = null) => {
    setEditing(cls);
    if (cls) {
      setForm({
        name: cls.name, description: cls.description || '',
        level: cls.level || '', trade: cls.trade || '',
        teacher_id: String(cls.teacher_id?._id || cls.teacher_id || ''),
        programConfigId: String(cls.program_config_id?._id || cls.program_config_id || ''),
      });
    } else {
      setForm({ name: '', description: '', level: '', trade: '', teacher_id: '', programConfigId: '' });
    }
    // No network round-trip before opening — the class teacher and
    // co-teachers are edited from their own dedicated Manage Class buttons,
    // not this form, so there's nothing left here worth waiting on.
    setProgramDropdownOpen(false);
    setModal(true);
  };

  const openStudentsModal = async (cls) => {
    setStudentsTarget(cls);
    setStudentsModal(true);
    setLoadingStudents(true);
    setStudentsSortAsc(true);
    try {
      const res = await api.get(`/admin/classes/${cls.id}/students`);
      setClassStudents(res.data.students);
    } catch { toast.error('Failed to load students'); }
    finally { setLoadingStudents(false); }
  };

  // Builds a polished, brand-styled PDF roster for the class currently
  // open in the Students modal — a deep terracotta masthead with the
  // class name and export meta, then a clean three-column table of
  // No / Student Name / Email, nothing else, so it's easy to print or
  // hand off as-is.
  const exportRosterPDF = () => {
    if (!studentsTarget || classStudents.length === 0) return;
    setExportingPdf(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 44;
      const HEADER_H = 156;

      // ── Masthead backdrop ──
      doc.setFillColor(20, 10, 6);
      doc.rect(0, 0, pageWidth, HEADER_H, 'F');
      doc.setFillColor(194, 65, 12);
      doc.rect(0, 0, 7, HEADER_H, 'F');
      doc.setFillColor(124, 45, 18);
      doc.rect(0, HEADER_H - 4, pageWidth, 4, 'F');

      // Soft glow behind the logo mark
      doc.setGState(new doc.GState({ opacity: 0.3 }));
      doc.setFillColor(234, 88, 12);
      doc.circle(margin + 21, 40, 27, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));

      // Logo mark — rounded badge with a gloss highlight + monogram
      doc.setFillColor(194, 65, 12);
      doc.roundedRect(margin, 21, 40, 40, 11, 11, 'F');
      doc.setGState(new doc.GState({ opacity: 0.22 }));
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 3, 24, 34, 15, 7, 7, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text('E', margin + 20, 47, { align: 'center' });

      // EDUPLA wordmark — split two-tone treatment, tagline beneath
      const wmX = margin + 52;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(21);
      doc.setTextColor(255, 255, 255);
      doc.text('EDU', wmX, 39);
      const eduW = doc.getTextWidth('EDU');
      doc.setTextColor(251, 146, 60);
      doc.text('PLA', wmX + eduW, 39);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setCharSpace(1.6);
      doc.setTextColor(196, 158, 133);
      doc.text('EDUCATION MANAGEMENT PLATFORM', wmX, 50);
      doc.setCharSpace(0);


      // Divider between the brand row and the class heading
      doc.setDrawColor(80, 45, 28);
      doc.setLineWidth(0.75);
      doc.line(margin, 68, pageWidth - margin, 68);

      // Class name + export meta
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(19);
      doc.setTextColor(255, 255, 255);
      doc.text(studentsTarget.name, margin, 97);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(255, 214, 178);
      const meta = [
        `${sortedClassStudents.length} student${sortedClassStudents.length !== 1 ? 's' : ''} enrolled`,
        studentsTarget.teacher_name ? `Class teacher: ${studentsTarget.teacher_name}` : null,
        new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      ].filter(Boolean).join('   ·   ');
      doc.text(meta, margin, 118);

      // ── Table — always exported alphabetically by student name ──
      const alphabetical = [...sortedClassStudents].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );

      autoTable(doc, {
        startY: HEADER_H + 24,
        margin: { left: margin, right: margin },
        head: [['No', 'Student Name', 'Email']],
        body: alphabetical.map((s, i) => [String(i + 1), s.name || '—', s.email || '—']),
        theme: 'plain',
        styles: {
          font: 'helvetica', fontSize: 10.5, cellPadding: { top: 9, bottom: 9, left: 10, right: 10 },
          textColor: [40, 32, 28], lineColor: [237, 224, 213], lineWidth: 0.6,
        },
        headStyles: {
          fillColor: [194, 65, 12], textColor: 255, fontStyle: 'bold', fontSize: 9,
          cellPadding: { top: 10, bottom: 10, left: 10, right: 10 },
        },
        alternateRowStyles: { fillColor: [251, 246, 242] },
        columnStyles: {
          0: { cellWidth: 46, halign: 'center', textColor: [180, 83, 9], fontStyle: 'bold' },
          1: { cellWidth: 220, fontStyle: 'bold' },
          2: { cellWidth: 'auto', textColor: [90, 78, 70] },
        },
        didDrawPage: () => {
          // Footer on every page — brand tag + page count.
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(194, 65, 12);
          doc.text('EDUPLA', margin, pageHeight - 24);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(160, 150, 142);
          doc.text(`  ·  ${studentsTarget.name}`, margin + doc.getTextWidth('EDUPLA'), pageHeight - 24);
          doc.text(
            `Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${doc.internal.getNumberOfPages()}`,
            pageWidth - margin, pageHeight - 24, { align: 'right' }
          );
        },
      });

      const safeName = (studentsTarget.name || 'class').trim().replace(/[^a-z0-9]+/gi, '_');
      doc.save(`${safeName}_students.pdf`);
      toast.success('Roster exported');
    } catch {
      toast.error('Failed to export roster');
    } finally {
      setExportingPdf(false);
    }
  };

  // Opening the Enroll modal now also pulls the class's current roster so
  // the search box below has something to search the moment it opens.
  const openEnrollModal = (cls) => {
    setEnrollTarget(cls);
    setEnrollForm({ name: '', email: '', class_year: '' });
    setEnrollDefaultPassword('');
    setEnrollShowPassword(false);
    setEnrollRosterSearch('');
    setEnrollModal(true);
    setLoadingEnrollRoster(true);
    api.get(`/admin/classes/${cls.id}/students`)
      .then(res => setEnrollClassRoster(res.data.students || []))
      .catch(() => setEnrollClassRoster([]))
      .finally(() => setLoadingEnrollRoster(false));
  };

  const openManageModal = (cls) => {
    setManageTarget(cls);
    setManageModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
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

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    if (!enrollTarget) return;
    setEnrolling(true);
    try {
      const res = await api.post('/admin/students', { ...enrollForm, classIds: [enrollTarget.id] });
      setEnrollDefaultPassword(res.data.defaultPassword);
      toast.success('Student enrolled successfully');
      fetchClasses();
      // Refresh the searchable roster in this modal, and the standalone
      // Students modal if it happens to be open for the same class.
      const res2 = await api.get(`/admin/classes/${enrollTarget.id}/students`);
      setEnrollClassRoster(res2.data.students || []);
      if (studentsModal && studentsTarget?.id === enrollTarget.id) {
        setClassStudents(res2.data.students);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to enroll student'); }
    finally { setEnrolling(false); }
  };

  const enrolledIds = new Set(classStudents.map(s => s.id));
  const activeFilters = [filterLevel, filterTrade].filter(Boolean).length;
  const selectedProgram = programConfigs.find(p => p._id === form.programConfigId);

  // A–Z toggle for the Students modal roster — on by default so both the
  // on-screen list and the exported PDF read alphabetically unless the
  // admin flips back to enrollment order.
  const sortedClassStudents = useMemo(() => {
    if (!studentsSortAsc) return classStudents;
    return [...classStudents].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [classStudents, studentsSortAsc]);

  // Filtered view over the enroll modal's roster search box.
  const filteredEnrollRoster = useMemo(() => enrollClassRoster.filter(s =>
    !enrollRosterSearch
    || s.name?.toLowerCase().includes(enrollRosterSearch.toLowerCase())
    || s.email?.toLowerCase().includes(enrollRosterSearch.toLowerCase())
  ), [enrollClassRoster, enrollRosterSearch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Hero Banner ── */}
      <div className="hero-card" style={{
        borderRadius: 20, padding: '22px 26px', position: 'relative', overflow: 'hidden',
        background: 'var(--hero-bg)', border: '1px solid var(--hero-border)',
        boxShadow: 'var(--hero-shadow)',
      }}>
        {/* Decorative circle — single restrained brand glow */}
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'var(--hero-glow)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: '4px 10px', borderRadius: 99, background: 'rgba(194, 65, 12,0.12)', border: '1px solid rgba(194, 65, 12,0.25)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <BookOpen size={11} style={{ color: '#c2410c' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#c2410c', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('adminClasses.hero.classManagement')}</span>
              </div>
              <div style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#10b981' }}>{t('adminClasses.hero.active', { count: total })}</span>
              </div>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--hero-fg)', marginBottom: 5, lineHeight: 1.2 }}>
              {t('adminClasses.hero.title')}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--hero-fg-soft)', maxWidth: 380, lineHeight: 1.6 }}>
              {t('adminClasses.hero.subtitle')}
            </p>
          </div>

          {/* Quick counters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {levels.map(l => {
              const count = classes.filter(c => c.level === l.value).length;
              return (
                <div key={l.value} style={{
                  textAlign: 'center', padding: '10px 16px', borderRadius: 14,
                  background: 'var(--hero-glass)', border: '1px solid var(--hero-glass-border)',
                  minWidth: 62,
                }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--hero-fg)', lineHeight: 1 }}>{count}</p>
                  <p style={{ fontSize: 10, color: 'var(--hero-fg-dim)', marginTop: 3, fontWeight: 600 }}>{l.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trade breakdown strip */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--hero-glass-border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {trades.map((t, i) => {
            const count = classes.filter(c => c.trade === t.value).length;
            return (
              <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: TRADE_COLORS[i % TRADE_COLORS.length] }} />
                <span style={{ fontSize: 11, color: 'var(--hero-fg-dim)', fontWeight: 500 }}>{t.value}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--hero-fg)' }}>{count}</span>
              </div>
            );
          })}
          <button
            onClick={() => openModal()}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #c2410c, #9a3412)', color: '#fff',
              fontSize: 12, fontWeight: 700, transition: 'filter 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.12)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            <Plus size={14} /> {t('adminClasses.toolbar.newClass')}
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
            placeholder={t('adminClasses.toolbar.searchPlaceholder')}
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(f => !f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)',
            background: showFilters || activeFilters ? '#fed7aa' : 'var(--card-bg)',
            color: showFilters || activeFilters ? '#c2410c' : 'var(--text-secondary)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <Filter size={13} />
          Filters
          {activeFilters > 0 && (
            <span style={{
              width: 16, height: 16, borderRadius: '50%', background: '#c2410c',
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
                color: viewMode === mode ? '#c2410c' : 'var(--text-secondary)',
                boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                display: 'flex', transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <button onClick={() => openModal()} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
          <Plus size={14} /> {t('adminClasses.toolbar.newClass')}
        </button>
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="card" style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
          flexWrap: 'wrap', animation: 'slideUp 0.2s ease',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('adminClasses.filterBy')}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>{t('adminClasses.level')}</span>
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
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>{t('adminClasses.trade')}</span>
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
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--surface-100)', borderTopColor: '#c2410c', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('adminClasses.states.loading')}</p>
          </div>
        </div>
      ) : classes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={28} style={{ color: '#c2410c' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{t('adminClasses.states.noClassesFound')}</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {search || activeFilters ? 'Try adjusting your search or filters.' : 'Create the first class to get started.'}
          </p>
          {!search && !activeFilters && (
            <button onClick={() => openModal()} className="btn-primary" style={{ margin: '0 auto' }}>
              <Plus size={14} /> {t('adminClasses.states.createClass')}
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {classes.map((cls, i) => (
            <ClassCard key={cls.id} cls={cls} animDelay={i * 50}
              levels={levels} trades={trades}
              onEdit={openModal} onDelete={setDeleteTarget} onToggle={handleToggle}
              onViewStudents={openStudentsModal} onEnroll={openEnrollModal} onManage={openManageModal} />
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
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('adminClasses.table.class')}</span>
            </div>
            <div style={{ flex: 0.8, minWidth: 80 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('adminClasses.table.tags')}</span>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('adminClasses.table.teacher')}</span>
            </div>
            <div style={{ flex: 0.5, minWidth: 70 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('adminClasses.table.students')}</span>
            </div>
            <div style={{ width: 130 }} />
          </div>
          <div style={{ padding: '4px 0' }}>
            {classes.map((cls, i) => (
              <ClassRow key={cls.id} cls={cls} animDelay={i * 40}
                levels={levels} trades={trades}
                onEdit={openModal} onDelete={setDeleteTarget} onToggle={handleToggle}
                onViewStudents={openStudentsModal} onEnroll={openEnrollModal} onManage={openManageModal} />
            ))}
          </div>
        </div>
      )}

      {total > 12 && (
        <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />
      )}

      {/* ── Create/Edit Modal ── */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? t('adminClasses.modal.editTitle') : t('adminClasses.modal.createTitle')}>
        <div className="class-modal-pop" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Live preview — updates as the admin types, so the class never
              feels abstract: they see the exact chip combination students
              and teachers will see on the card. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(194,65,12,0.14), rgba(124,45,18,0.05))',
            border: '1px solid rgba(194,65,12,0.28)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #c2410c, #7c2d12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(194,65,12,0.4)',
            }}>
              <BookOpen size={18} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {form.name || t('adminClasses.modal.classNamePlaceholder')}
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', minHeight: 18 }}>
                {form.level && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(194,65,12,0.16)', color: '#c2410c' }}>
                    {form.level}
                  </span>
                )}
                {form.trade && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(15,118,110,0.16)', color: '#0f766e' }}>
                    {form.trade}
                  </span>
                )}
                {!form.level && !form.trade && (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('adminClasses.modal.noneNotLinked')}</span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* ── Basics ── */}
            <div>
              <FormSectionHeader icon={BookOpen} title="Basics" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="label">{t('adminClasses.modal.className')}</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="input-field class-modal-input" placeholder={t('adminClasses.modal.classNamePlaceholder')} required />
                </div>
              </div>
            </div>

            {/* ── TVET Program (drives the Classification badges below) ── */}
            <div>
              <FormSectionHeader icon={Award} title="TVET program" />
              <label className="label">{t('adminClasses.modal.tvetProgram')}</label>

              <div ref={programDropdownRef} style={{ position: 'relative', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setProgramDropdownOpen(o => !o)}
                  className="class-modal-input class-program-trigger"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 10,
                    border: programDropdownOpen ? '1.5px solid #c2410c' : '1.5px solid var(--card-border)',
                    background: 'var(--surface-50)', cursor: 'pointer', textAlign: 'left',
                    boxShadow: programDropdownOpen ? '0 0 0 3px rgba(194,65,12,0.15)' : 'none',
                  }}
                >
                  <Award size={14} style={{ color: '#c2410c', flexShrink: 0 }} />
                  {selectedProgram ? (
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: 'rgba(15,118,110,0.16)', color: '#0f766e' }}>
                          {selectedProgram.trade}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: 'rgba(194,65,12,0.16)', color: '#c2410c' }}>
                          {selectedProgram.rtqfLevel}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {selectedProgram.qualificationTitle}
                      </span>
                    </div>
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{t('adminClasses.modal.noneNotLinked')}</span>
                  )}
                  <ChevronDown size={14} style={{
                    color: 'var(--text-secondary)', flexShrink: 0,
                    transform: programDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
                  }} />
                </button>

                {programDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40,
                    maxHeight: 260, overflowY: 'auto', borderRadius: 12,
                    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.28)', padding: 6,
                    animation: 'slideUp 0.15s ease both',
                  }}>
                    <button
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, programConfigId: '', level: '', trade: '' })); setProgramDropdownOpen(false); }}
                      className="class-modal-dropdown-option"
                      style={{
                        width: '100%', textAlign: 'left', padding: '9px 10px 9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                        background: !form.programConfigId ? 'rgba(194,65,12,0.12)' : 'transparent',
                        color: !form.programConfigId ? '#c2410c' : 'var(--text-secondary)',
                        fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                        borderLeft: '3px solid transparent',
                      }}
                    >
                      {!form.programConfigId && <CheckCircle2 size={12} />}
                      {t('adminClasses.modal.noneNotLinked')}
                    </button>

                    {programConfigs.map(p => {
                      const active = form.programConfigId === p._id;
                      return (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() => {
                            setForm(f => ({ ...f, programConfigId: p._id, level: p.rtqfLevel, trade: p.trade }));
                            setProgramDropdownOpen(false);
                          }}
                          className="class-modal-dropdown-option"
                          style={{
                            width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9, border: 'none',
                            cursor: 'pointer', marginTop: 2,
                            background: active ? 'rgba(194,65,12,0.12)' : 'transparent',
                            display: 'flex', flexDirection: 'column', gap: 4,
                            borderLeft: '3px solid transparent',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: 'rgba(15,118,110,0.16)', color: '#0f766e' }}>
                              {p.trade}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: 'rgba(194,65,12,0.16)', color: '#c2410c' }}>
                              {p.rtqfLevel}
                            </span>
                            {active && <CheckCircle2 size={12} style={{ color: '#c2410c', marginLeft: 'auto' }} />}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                            {p.qualificationTitle}
                          </span>
                        </button>
                      );
                    })}

                    {programConfigs.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 10px', margin: 0 }}>
                        {t('adminClasses.modal.noProgramsYet')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {programConfigs.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{t('adminClasses.modal.noProgramsYet')}</p>
              )}
            </div>

            {/* ── Classification — read-only, derived from the TVET program above ── */}
            <div>
              <FormSectionHeader icon={Layers} title="Classification" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">{t('adminClasses.modal.rtqfLevel')}</label>
                  <div style={{
                    marginTop: 4, padding: '9px 12px', borderRadius: 10, minHeight: 20,
                    border: '1.5px dashed var(--card-border)', background: 'var(--surface-50)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {form.level ? (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800,
                        color: '#c2410c', background: 'rgba(194,65,12,0.14)', padding: '3px 9px', borderRadius: 7,
                      }}>
                        <CheckCircle2 size={12} /> {form.level}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('adminClasses.modal.none')}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 5 }}>
                    Set automatically from the TVET program above
                  </p>
                </div>
                <div>
                  <label className="label">{t('adminClasses.modal.trade')}</label>
                  <div style={{
                    marginTop: 4, padding: '9px 12px', borderRadius: 10, minHeight: 20,
                    border: '1.5px dashed var(--card-border)', background: 'var(--surface-50)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {form.trade ? (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800,
                        color: '#0f766e', background: 'rgba(15,118,110,0.14)', padding: '3px 9px', borderRadius: 7,
                      }}>
                        <CheckCircle2 size={12} /> {form.trade}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('adminClasses.modal.none')}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 5 }}>
                    Set automatically from the TVET program above
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6, borderTop: '1px solid var(--card-border)' }}>
              <button type="button" onClick={() => setModal(false)} className="btn-secondary class-modal-btn">
                {t('adminClasses.modal.cancel')}
              </button>
              <button type="submit" disabled={saving} className="btn-primary class-modal-btn class-modal-btn-primary">
                {saving && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
                {editing ? t('adminClasses.modal.updateClass') : t('adminClasses.modal.createClass')}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ── Students Modal ── */}
      <Modal isOpen={studentsModal} onClose={() => setStudentsModal(false)} title={t('adminClasses.studentsModal.title', { name: studentsTarget?.name })}>
        {loadingStudents ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--surface-100)', borderTopColor: '#c2410c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : classStudents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <GraduationCap size={24} style={{ color: '#c2410c' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{t('adminClasses.studentsModal.noStudentsEnrolled')}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>{t('adminClasses.studentsModal.addStudentsDesc')}</p>
            <button onClick={() => { setStudentsModal(false); openEnrollModal(studentsTarget); }} className="btn-primary" style={{ margin: '0 auto' }}>
              <UserPlus size={14} /> {t('adminClasses.studentsModal.enrollAStudent')}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {studentsSortAsc ? 'Sorted A–Z' : 'Enrollment order'}
              </span>
              <button
                onClick={() => setStudentsSortAsc(a => !a)}
                className="students-sort-toggle"
                data-active={studentsSortAsc}
              >
                <ArrowDownAZ size={13} />
                {studentsSortAsc ? 'A–Z' : 'Sort A–Z'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              {sortedClassStudents.map((s, i) => {
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
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('adminClasses.studentsModal.studentsEnrolled', { count: classStudents.length })}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={exportRosterPDF} disabled={exportingPdf} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: exportingPdf ? 0.6 : 1 }}>
                  {exportingPdf
                    ? <div style={{ width: 13, height: 13, border: '2px solid var(--surface-100)', borderTopColor: '#c2410c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    : <FileDown size={13} />}
                  Export Students
                </button>
                <button onClick={() => setStudentsModal(false)} className="btn-secondary">{t('adminClasses.studentsModal.close')}</button>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* ── Enroll Modal: register + enroll a brand-new student directly into this class ── */}
      <Modal isOpen={enrollModal} onClose={() => { setEnrollModal(false); setEnrollDefaultPassword(''); }} title={t('adminClasses.enrollModal.title', { name: enrollTarget?.name })}>
        {enrollDefaultPassword ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Single orchestrated moment: a stamp of confirmation, not a
                generic checkmark tile. This is the one beat in the flow
                worth spending motion on. */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 0' }}>
              <div className="enroll-stamp-ring">
                <div className="enroll-stamp-core">
                  <CheckCircle2 size={24} style={{ color: '#fff' }} />
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  Enrolled into {enrollTarget?.name}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                  Hand these sign-in details to {enrollForm.name || 'the student'}.
                </p>
              </div>
            </div>

            {/* Credential card — styled like the physical student ID this
                data will stand in for, right down to a ticket-stub
                perforation separating "who" from "how they sign in". */}
            <div className="enroll-id-card">
              <div className="enroll-id-card-top">
                <Avatar name={enrollForm.name || '?'} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="enroll-id-name">{enrollForm.name}</p>
                  <p className="enroll-id-meta">
                    {enrollTarget?.name}{enrollForm.class_year ? ` · Intake ${enrollForm.class_year}` : ''}
                  </p>
                </div>
                <GraduationCap size={18} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
              </div>

              <div className="enroll-id-perforation" />

              <div className="enroll-id-row">
                <div style={{ minWidth: 0 }}>
                  <p className="enroll-id-label">{t('adminClasses.enrollModal.email')}</p>
                  <p className="enroll-id-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{enrollForm.email}</p>
                </div>
                <button className="enroll-id-icon-btn" title="Copy email"
                  onClick={() => navigator.clipboard.writeText(enrollForm.email).then(() => toast.success('Email copied!'))}>
                  <Copy size={13} />
                </button>
              </div>

              <div className="enroll-id-row">
                <div style={{ minWidth: 0 }}>
                  <p className="enroll-id-label">{t('adminClasses.enrollModal.defaultPassword')}</p>
                  <p className="enroll-id-value">{enrollShowPassword ? enrollDefaultPassword : '••••••••••'}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="enroll-id-icon-btn" title={enrollShowPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setEnrollShowPassword(p => !p)}>
                    {enrollShowPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button className="enroll-id-icon-btn" title="Copy password"
                    onClick={() => navigator.clipboard.writeText(enrollDefaultPassword).then(() => toast.success('Password copied!'))}>
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setEnrollModal(false); setEnrollDefaultPassword(''); }} className="btn-secondary">{t('adminClasses.enrollModal.close')}</button>
              <button onClick={() => { setEnrollDefaultPassword(''); setEnrollForm({ name: '', email: '', class_year: '' }); setEnrollShowPassword(false); }} className="btn-primary">
                <UserPlus size={14} /> {t('adminClasses.enrollModal.enrollAnother')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleEnrollSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Search the class roster ──
                Replaces the old static "here's how this works" banner.
                Lets the admin quickly check a student isn't already
                enrolled in this class before registering a new one. */}
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={12} /> {t('adminClasses.enrollModal.searchRosterLabel', { defaultValue: `Search students in ${enrollTarget?.name || ''}` })}
              </label>
              <div style={{ position: 'relative', marginTop: 4 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  value={enrollRosterSearch}
                  onChange={e => setEnrollRosterSearch(e.target.value)}
                  className="input-field class-modal-input enroll-roster-search"
                  style={{ paddingLeft: 34, paddingRight: loadingEnrollRoster ? 34 : 12 }}
                  placeholder={loadingEnrollRoster
                    ? 'Loading roster…'
                    : `Search ${enrollClassRoster.length} enrolled student${enrollClassRoster.length !== 1 ? 's' : ''}…`}
                />
                {loadingEnrollRoster && (
                  <div style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 14, height: 14, border: '2px solid var(--surface-100)', borderTopColor: '#c2410c',
                    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                )}
              </div>

              {enrollRosterSearch && !loadingEnrollRoster && (
                <div className="enroll-roster-results" style={{
                  marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6,
                  maxHeight: 172, overflowY: 'auto', padding: filteredEnrollRoster.length ? 6 : 0,
                  borderRadius: 12, background: filteredEnrollRoster.length ? 'var(--surface-50)' : 'transparent',
                  border: filteredEnrollRoster.length ? '1px solid var(--card-border)' : 'none',
                }}>
                  {filteredEnrollRoster.length === 0 ? (
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', textAlign: 'center', padding: '10px 0' }}>
                      No enrolled student matches "{enrollRosterSearch}".
                    </p>
                  ) : filteredEnrollRoster.map((s, i) => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 9,
                      background: 'var(--card-bg)', animation: 'slideUp 0.2s ease both', animationDelay: `${i * 30}ms`,
                    }}>
                      <Avatar name={s.name} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                        <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {s.level && <LevelBadge level={s.level} levels={levels} />}
                        {s.trade && <TradeBadge trade={s.trade} trades={trades} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                New students are registered and enrolled directly into <strong style={{ color: 'var(--text-primary)' }}>{enrollTarget?.name}</strong>.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">{t('adminClasses.enrollModal.fullName')}</label>
                <input value={enrollForm.name} onChange={e => setEnrollForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field class-modal-input" placeholder={t('adminClasses.enrollModal.fullNamePlaceholder')} required />
              </div>
              <div>
                <label className="label">{t('adminClasses.enrollModal.emailLabel')}</label>
                <input type="email" value={enrollForm.email} onChange={e => setEnrollForm(f => ({ ...f, email: e.target.value }))}
                  className="input-field class-modal-input" placeholder={t('adminClasses.enrollModal.emailPlaceholder')} required />
              </div>
            </div>

            <div>
              <label className="label">{t('adminClasses.enrollModal.intakeYear')}</label>
              <select value={enrollForm.class_year} onChange={e => setEnrollForm(f => ({ ...f, class_year: e.target.value }))}
                className="input-field class-modal-input">
                <option value="">{t('adminClasses.enrollModal.selectYear')}</option>
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setEnrollModal(false)} className="btn-secondary">{t('adminClasses.enrollModal.cancel')}</button>
              <button type="submit" disabled={enrolling} className="btn-primary">
                {enrolling && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
                {t('adminClasses.enrollModal.enrollStudent')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!toggleTarget} onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleConfirm} loading={toggling}
        title={toggleTarget?.is_active !== false ? t('adminClasses.confirm.deactivateTitle') : t('adminClasses.confirm.activateTitle')}
        message={toggleTarget?.is_active !== false
          ? t('adminClasses.confirm.deactivateMessage', { name: toggleTarget?.name })
          : t('adminClasses.confirm.activateMessage', { name: toggleTarget?.name })}
        confirmText={toggleTarget?.is_active !== false ? t('adminClasses.confirm.deactivateConfirm') : t('adminClasses.confirm.activateConfirm')}
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} loading={deleting}
        title={t('adminClasses.confirm.deleteTitle')}
        message={t('adminClasses.confirm.deleteMessage', { name: deleteTarget?.name })}
        confirmText={t('adminClasses.confirm.deleteConfirm')} variant="danger"
      />

      <ManageClassModal
        cls={manageTarget}
        isOpen={manageModal}
        onClose={() => setManageModal(false)}
        levels={levels}
        trades={trades}
        onEdit={(cls) => { setManageModal(false); openModal(cls); }}
        onViewStudents={(cls) => { setManageModal(false); openStudentsModal(cls); }}
        onEnroll={(cls) => { setManageModal(false); openEnrollModal(cls); }}
        onToggle={(cls) => { setManageModal(false); handleToggle(cls); }}
        onDelete={(cls) => { setManageModal(false); setDeleteTarget(cls); }}
        onChanged={fetchClasses}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes classModalPop { from { opacity:0; transform:translateY(8px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }

        .class-modal-pop { animation: classModalPop 0.28s cubic-bezier(0.16,1,0.3,1) both; }

        .class-modal-pill { transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
        .class-modal-pill:hover { transform: translateY(-2px); }
        .class-modal-pill:active { transform: translateY(0) scale(0.97); }

        .class-modal-input { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
        .class-modal-input:focus { border-color: #c2410c !important; box-shadow: 0 0 0 3px rgba(194,65,12,0.15); outline: none; }

        .class-modal-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease; }
        .class-modal-btn:hover { transform: translateY(-1px); }
        .class-modal-btn:active { transform: translateY(0); }
        .class-modal-btn-primary:hover { box-shadow: 0 6px 16px rgba(194,65,12,0.4); filter: brightness(1.05); }

        .class-modal-dropdown-option { transition: background 0.15s ease, border-left-color 0.15s ease, transform 0.15s ease; }
        .class-modal-dropdown-option:hover { background: rgba(194,65,12,0.16) !important; border-left-color: #c2410c !important; transform: translateX(2px); }
        .class-modal-dropdown-option:active { transform: translateX(2px) scale(0.99); }

        .enroll-roster-results { animation: slideUp 0.18s cubic-bezier(0.16,1,0.3,1) both; }

        /* ── Enroll success: one orchestrated stamp + a credential card
           styled after a physical student ID, ticket-stub perforation
           and all — the one moment in this flow worth dressing up. ── */
        @keyframes enrollStampRing {
          0%   { transform: scale(0.4) rotate(-18deg); opacity: 0; }
          65%  { transform: scale(1.08) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); }
        }
        .enroll-stamp-ring {
          width: 62px; height: 62px; border-radius: 50%;
          background: radial-gradient(circle at 32% 30%, rgba(16,185,129,0.38), rgba(16,185,129,0.06) 72%);
          display: flex; align-items: center; justify-content: center;
          animation: enrollStampRing 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .enroll-stamp-core {
          width: 42px; height: 42px; border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #059669);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 18px rgba(16,185,129,0.45);
        }

        @keyframes enrollCardPrint {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .enroll-id-card {
          position: relative;
          border-radius: 16px;
          border: 1px solid rgba(194,65,12,0.32);
          background: linear-gradient(165deg, rgba(194,65,12,0.12), rgba(124,45,18,0.03) 55%);
          overflow: hidden;
          animation: enrollCardPrint 0.4s cubic-bezier(0.16,1,0.3,1) both;
          animation-delay: 0.12s;
        }
        .enroll-id-card-top {
          display: flex; align-items: center; gap: 12px;
          padding: 15px 18px 13px;
        }
        .enroll-id-name {
          font-size: 14px; font-weight: 800; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .enroll-id-meta { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .enroll-id-perforation {
          position: relative;
          height: 1px; margin: 0 18px;
          background-image: repeating-linear-gradient(to right, rgba(255,255,255,0.18) 0 6px, transparent 6px 13px);
        }
        .enroll-id-perforation::before,
        .enroll-id-perforation::after {
          content: ''; position: absolute; top: 50%; width: 18px; height: 18px;
          border-radius: 50%; background: var(--card-bg); transform: translateY(-50%);
        }
        .enroll-id-perforation::before { left: -27px; }
        .enroll-id-perforation::after { right: -27px; }
        .enroll-id-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 12px 18px;
        }
        .enroll-id-row + .enroll-id-row { border-top: 1px solid rgba(255,255,255,0.06); }
        .enroll-id-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-secondary); margin-bottom: 3px;
        }
        .enroll-id-value {
          font-size: 13.5px; font-weight: 700; color: var(--text-primary);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.01em;
        }
        .enroll-id-icon-btn {
          width: 30px; height: 30px; border-radius: 9px; border: none; cursor: pointer;
          background: rgba(16,185,129,0.14); color: #10b981;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .enroll-id-icon-btn:hover { background: rgba(16,185,129,0.24); transform: translateY(-1px); }
        .enroll-id-icon-btn:active { transform: translateY(0); }
        .enroll-id-icon-btn:focus-visible {
          outline: none; box-shadow: 0 0 0 3px rgba(16,185,129,0.35);
        }

        @media (prefers-reduced-motion: reduce) {
          .enroll-stamp-ring, .enroll-id-card { animation: none !important; }
        }

        .students-sort-toggle {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 700; border-radius: 8px; border: none; cursor: pointer;
          padding: 5px 10px; background: var(--surface-100); color: var(--text-secondary);
          transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
        }
        .students-sort-toggle:hover { transform: translateY(-1px); }
        .students-sort-toggle[data-active="true"] { background: rgba(194,65,12,0.16); color: #c2410c; }
      `}</style>
    </div>
  );
}