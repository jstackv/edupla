import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import Pagination from '../../components/common/Pagination';
import {
  Search, ClipboardList, Calendar, FileText,
  Award, TrendingUp, X, ChevronDown, Filter,
  Clock, AlertCircle, CheckCircle, BarChart3,
  Users, GraduationCap, ExternalLink, Star,
  BookOpen, ArrowUpRight, Layers,
} from 'lucide-react';

/* ── Constants (mirrors Classes page) ── */
const LEVEL_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#64748b'];
const TRADE_COLORS = ['#f59e0b', '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#10b981', '#3b82f6', '#8b5cf6'];
const LEVEL_BG    = ['#dbeafe', '#d1fae5', '#ede9fe', '#fef3c7', '#fce7f3', '#cffafe', '#ffedd5', '#f1f5f9'];
const TRADE_BG    = ['#fef3c7', '#cffafe', '#fce7f3', '#ffedd5', '#e0e7ff', '#d1fae5', '#dbeafe', '#ede9fe'];

const getLevelMeta = (val) => {
  const i = (val?.charCodeAt(0) || 0) % LEVEL_COLORS.length;
  return { color: LEVEL_COLORS[i], bg: LEVEL_BG[i], label: val };
};
const getTradeMeta = (val) => {
  const i = (val?.charCodeAt(0) || 0) % TRADE_COLORS.length;
  return { color: TRADE_COLORS[i], bg: TRADE_BG[i], label: val };
};

const AVATAR_COLORS = [
  ['#6366f1','#4338ca'], ['#0ea5e9','#0284c7'], ['#10b981','#059669'],
  ['#f59e0b','#d97706'], ['#ec4899','#db2777'], ['#8b5cf6','#7c3aed'],
];
function getAvatarColors(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

/* ── Avatar (same as Classes) ── */
function Avatar({ name, size = 32 }) {
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

/* ── Level pill (same as Classes) ── */
function LevelBadge({ level }) {
  if (!level) return null;
  const m = getLevelMeta(level);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: m.bg, color: m.color, letterSpacing: '0.04em',
    }}>{level}</span>
  );
}

/* ── Trade pill (same as Classes) ── */
function TradeBadge({ trade }) {
  if (!trade) return null;
  const m = getTradeMeta(trade);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: m.bg, color: m.color,
    }}>{trade}</span>
  );
}

/* ── Deadline status pill ── */
function DeadlinePill({ deadline }) {
  const d = new Date(deadline);
  const now = new Date();
  const diff = d - now;
  const overdue = diff < 0;
  const soon = diff > 0 && diff < 86400000 * 3;

  let color, bg, text, Icon;
  if (overdue)     { color = '#dc2626'; bg = '#fef2f2'; text = 'Overdue';  Icon = AlertCircle; }
  else if (soon)   { color = '#d97706'; bg = '#fffbeb'; text = 'Due Soon'; Icon = Clock; }
  else             { color = '#059669'; bg = '#ecfdf5'; text = 'Open';     Icon = CheckCircle; }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 6, width: 'fit-content',
        background: bg, color, fontSize: 10, fontWeight: 700,
      }}>
        <Icon size={10} /> {text}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Calendar size={10} />
        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
    </div>
  );
}

/* ── Submission progress bar ── */
function SubmissionProgress({ current, max }) {
  const pct = Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#6366f1';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{current} / {max}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
      </div>
      <div style={{ width: 120, height: 5, borderRadius: 99, background: 'var(--surface-100)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99, width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </div>
    </div>
  );
}

/* ── Stat Strip (mirrors Classes StatStrip) ── */
function StatStrip({ assignments }) {
  const totalSubmissions = assignments.reduce((a, x) => a + (x.submission_count || 0), 0);
  const overdue = assignments.filter(a => new Date(a.deadline) < new Date()).length;
  const classes = [...new Set(assignments.map(a => a.class_name).filter(Boolean))].length;
  const avgScore = assignments.length
    ? Math.round(assignments.reduce((s, a) => s + (a.max_score || 0), 0) / assignments.length)
    : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {[
        { icon: ClipboardList, label: 'Total Assignments', value: assignments.length, color: '#6366f1', bg: '#eef2ff' },
        { icon: GraduationCap, label: 'Total Submissions', value: totalSubmissions,  color: '#10b981', bg: '#ecfdf5' },
        { icon: Layers,        label: 'Active Classes',    value: classes,           color: '#0ea5e9', bg: '#f0f9ff' },
        { icon: Star,          label: 'Avg Max Score',     value: avgScore,          color: '#f59e0b', bg: '#fffbeb', isText: true },
      ].map(({ icon: Icon, label, value, color, bg }) => (
        <div key={label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Expanded row detail panel ── */
function ExpandedDetail({ a }) {
  return (
    <div style={{
      margin: '0 0 2px', padding: '16px 20px',
      background: 'var(--surface-50)',
      borderTop: '1px solid var(--card-border)',
      animation: 'slideUp 0.2s ease both',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24 }}>
        {a.description && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>Description</p>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{a.description}</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Created</p>
            <p style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={11} style={{ color: 'var(--text-secondary)' }} />
              {new Date(a.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          {a.original_name && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Attachment</p>
              <a href="#" style={{ fontSize: 12, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, textDecoration: 'none' }}>
                <FileText size={11} /> {a.original_name} <ExternalLink size={10} />
              </a>
            </div>
          )}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Analytics</p>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>Rate: {Math.round((a.submission_count / Math.max(a.max_score, 1)) * 100)}%</span>
              <span>Target: {a.max_score || 50} students</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Assignment Table Row ── */
function AssignmentRow({ a, idx, animDelay = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [from] = getAvatarColors(a.title);

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.4fr 1.2fr 1.1fr 1.1fr 0.7fr 32px',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--card-border)',
          background: expanded
            ? 'var(--surface-50)'
            : hovered
              ? 'var(--surface-50)'
              : idx % 2 === 0 ? 'transparent' : 'var(--surface-50)',
          cursor: 'pointer',
          transition: 'background 0.15s',
          animation: `slideUp 0.35s ease both`,
          animationDelay: `${animDelay}ms`,
        }}
      >
        {/* Assignment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: `linear-gradient(135deg, ${from}22, ${from}44)`,
            border: `1.5px solid ${from}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ClipboardList size={16} style={{ color: from }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</p>
            {a.description && (
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{a.description}</p>
            )}
          </div>
        </div>

        {/* Teacher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar name={a.teacher_name} size={28} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.teacher_name}</p>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.teacher_email}</p>
          </div>
        </div>

        {/* Class + badges */}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.class_name}</p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {a.level && <LevelBadge level={a.level} />}
            {a.trade && <TradeBadge trade={a.trade} />}
          </div>
        </div>

        {/* Deadline */}
        <DeadlinePill deadline={a.deadline} />

        {/* Submissions */}
        <SubmissionProgress current={a.submission_count} max={a.max_score || 50} />

        {/* Points */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 8,
          background: 'var(--surface-100)',
        }}>
          <Award size={12} style={{ color: '#8b5cf6' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{a.max_score}</span>
        </div>

        {/* Expand chevron */}
        <ChevronDown size={14} style={{
          color: 'var(--text-secondary)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }} />
      </div>

      {expanded && <ExpandedDetail a={a} />}
    </>
  );
}

/* ══ MAIN ══ */
export default function AdminAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading]         = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const LIMIT = 10;

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/assignments', {
        params: { search, page, limit: LIMIT, status: filterStatus },
      });
      setAssignments(data.assignments || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [search, page, filterStatus]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setFilterStatus('all');
    setPage(1);
  };

  /* hero quick counts */
  const totalSubmissions = assignments.reduce((a, x) => a + (x.submission_count || 0), 0);
  const overdueCount     = assignments.filter(a => new Date(a.deadline) < new Date()).length;

  /* trade breakdown for hero strip */
  const byTrade = assignments.reduce((acc, a) => {
    if (a.trade) acc[a.trade] = (acc[a.trade] || 0) + 1;
    return acc;
  }, {});

  const TRADE_STRIP_COLORS = ['#f59e0b','#06b6d4','#ec4899','#f97316','#6366f1','#10b981','#3b82f6','#8b5cf6'];

  const activeFilters = (search ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0);

  const STATUS_OPTIONS = [
    { value: 'all',      label: 'All Status' },
    { value: 'overdue',  label: 'Overdue' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'today',    label: 'Due Today' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Hero Banner — same structure as Classes ── */}
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
            {/* Label chips — same as Classes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: '4px 10px', borderRadius: 99, background: 'rgba(14,165,233,0.2)', border: '1px solid rgba(14,165,233,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ClipboardList size={11} style={{ color: '#7dd3fc' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#7dd3fc', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Assignment Hub</span>
              </div>
              <div style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#6ee7b7' }}>{total} active</span>
              </div>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 5, lineHeight: 1.2 }}>
              📋 Assignments
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', maxWidth: 380, lineHeight: 1.6 }}>
              Monitor all academic assignments, track submission rates, and review deadlines across every class.
            </p>
          </div>

          {/* Quick counters — same pattern as Classes level counters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Total',       value: total,            accent: '#fff' },
              { label: 'Submissions', value: totalSubmissions, accent: '#86efac' },
              { label: 'Overdue',     value: overdueCount,     accent: '#fca5a5' },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                textAlign: 'center', padding: '10px 16px', borderRadius: 14,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                minWidth: 62,
              }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3, fontWeight: 600 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trade breakdown strip — same as Classes */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(byTrade).map(([trade, count], i) => (
            <div key={trade} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: TRADE_STRIP_COLORS[i % TRADE_STRIP_COLORS.length] }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{trade}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stat Strip ── */}
      {!loading && assignments.length > 0 && <StatStrip assignments={assignments} />}

      {/* ── Toolbar — same as Classes ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <form onSubmit={handleSearch} style={{ position: 'relative', flex: 1, minWidth: 200, display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="input-field"
              style={{ paddingLeft: 34 }}
              placeholder="Search assignments, teachers or classes…"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>
            )}
          </div>
          <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap', padding: '0 16px' }}>
            Search
          </button>
        </form>

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
      </div>

      {/* ── Filter Panel — same as Classes ── */}
      {showFilters && (
        <div className="card" style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
          flexWrap: 'wrap', animation: 'slideUp 0.2s ease',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Filter by status:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUS_OPTIONS.map(({ value, label }) => {
              const active = filterStatus === value;
              return (
                <button key={value} onClick={() => { setFilterStatus(value); setPage(1); }}
                  style={{
                    padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700,
                    background: active ? '#eef2ff' : 'var(--surface-100)',
                    color: active ? '#6366f1' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}>{label}</button>
              );
            })}
          </div>
          {activeFilters > 0 && (
            <button onClick={clearFilters}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#ef4444', background: '#fef2f2', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 7 }}>
              <X size={11} /> Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--surface-100)', borderTopColor: '#0ea5e9', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading assignments…</p>
          </div>
        </div>
      ) : assignments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ClipboardList size={28} style={{ color: '#6366f1' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No assignments found</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {search || filterStatus !== 'all' ? 'Try adjusting your search or filters.' : 'No assignments have been created yet.'}
          </p>
          {(search || filterStatus !== 'all') && (
            <button onClick={clearFilters} className="btn-secondary" style={{ margin: '16px auto 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.4fr 1.2fr 1.1fr 1.1fr 0.7fr 32px',
            gap: 12,
            padding: '10px 16px',
            borderBottom: '1px solid var(--card-border)',
            background: 'var(--surface-50)',
          }}>
            {['Assignment', 'Teacher', 'Class', 'Deadline', 'Submissions', 'Points', ''].map((h, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div>
            {assignments.map((a, i) => (
              <AssignmentRow key={a.id} a={a} idx={i} animDelay={i * 40} />
            ))}
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {total > LIMIT && (
        <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} onPageChange={setPage} />
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}