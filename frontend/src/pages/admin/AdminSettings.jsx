import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  BookOpen, ChevronRight, Plus, Trash2, Edit2,
  Check, X, Search, GraduationCap, Award, Sparkles,
} from 'lucide-react';

/* ── Constants ── */
const FIELDS = [
  { key: 'sector',             label: 'Sector',              placeholder: 'e.g. ICT and Multimedia' },
  { key: 'trade',              label: 'Trade / Program',     placeholder: 'e.g. Software Development' },
  { key: 'qualificationTitle', label: 'Qualification Title', placeholder: 'e.g. TVET CERTIFICATE IV IN SOFTWARE DEVELOPMENT' },
  { key: 'rtqfLevel',          label: 'RTQF Level',          placeholder: 'e.g. Level 4' },
];

const EMPTY = { sector: '', trade: '', qualificationTitle: '', rtqfLevel: '' };

/* ── deterministic accent per row, same gradient set Teachers.jsx uses ── */
const ROW_COLORS = [
  ['#6366f1','#4338ca'], ['#8b5cf6','#7c3aed'], ['#0ea5e9','#0284c7'],
  ['#10b981','#059669'], ['#f59e0b','#d97706'], ['#ec4899','#db2777'],
];
function getRowColors(seed) {
  return ROW_COLORS[(seed?.charCodeAt(0) || 0) % ROW_COLORS.length];
}

/* ── Level badge — small icon chip, mirrors Classes/Students count chips in Teachers.jsx ── */
function LevelBadge({ level }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 7, background: '#fffbeb' }}>
      <Award size={11} style={{ color: '#f59e0b' }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>{level}</span>
    </div>
  );
}

/* ── EditModal ── */
function EditModal({ open, row, onSave, onClose }) {
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const canSave = FIELDS.every(f => form[f.key].trim());

  useEffect(() => {
    if (open && row) setForm({ sector: row.sector, trade: row.trade, qualificationTitle: row.qualificationTitle, rtqfLevel: row.rtqfLevel });
    if (!open) { setSaving(false); }
  }, [open, row]);

  if (!open || !row) return null;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await api.put(`/admin/program-configs/${row._id}`, form);
      toast.success('Program updated successfully');
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,20,0.55)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 0, overflow: 'hidden', animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ padding: '20px 22px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>Edit Program</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, maxWidth: 360 }}>{row.trade}</p>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', flexShrink: 0, marginLeft: 12 }}>
            <X size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="label">{label} *</label>
              <input
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
                placeholder={placeholder}
                className="input-field"
              />
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 22px 20px', display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={saving} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave || saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
            {saving
              ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <Check size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── TableRow ── */
function TableRow({ row, index, onEdit, onDelete, search, animDelay = 0 }) {
  const [hovered, setHovered] = useState(false);
  const [from] = getRowColors(row.sector);

  const hl = (text) => {
    if (!search || !text) return text;
    const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === search.toLowerCase()
        ? <mark key={i} style={{ background: '#fef3c7', color: '#92400e', borderRadius: 3, padding: '0 2px' }}>{p}</mark>
        : p
    );
  };

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--surface-50)' : 'transparent',
        transition: 'background 0.15s',
        animation: 'slideUp 0.35s ease both',
        animationDelay: `${animDelay}ms`,
      }}
    >
      <td style={{ padding: '10px 16px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{String(index + 1).padStart(2, '0')}</span>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: from, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{hl(row.sector)}</span>
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{hl(row.trade)}</p>
      </td>
      <td style={{ padding: '10px 16px', maxWidth: 320 }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hl(row.qualificationTitle)}</p>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <LevelBadge level={hl(row.rtqfLevel)} />
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}>
          <button onClick={onEdit} style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex' }}>
            <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={onDelete} style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fef2f2', display: 'flex' }}>
            <Trash2 size={13} style={{ color: '#ef4444' }} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Stat strip — same shape as Teachers.jsx's StatStrip ── */
function StatStrip({ rows }) {
  const levels = [...new Set(rows.map(r => r.rtqfLevel))];
  const sectors = [...new Set(rows.map(r => r.sector))];
  const topSector = sectors
    .map(s => ({ s, count: rows.filter(r => r.sector === s).length }))
    .sort((a, b) => b.count - a.count)[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {[
        { icon: BookOpen,      label: 'Programs',     value: rows.length,        color: '#6366f1', bg: '#eef2ff' },
        { icon: GraduationCap, label: 'Sectors',      value: sectors.length,     color: '#0ea5e9', bg: '#f0f9ff' },
        { icon: Award,         label: 'RTQF Levels',  value: levels.length,      color: '#10b981', bg: '#ecfdf5' },
        { icon: Sparkles,      label: 'Top Sector',   value: topSector?.s || '—', color: '#f59e0b', bg: '#fffbeb', isText: true },
      ].map(({ icon: Icon, label, value, color, bg, isText }) => (
        <div key={label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <p style={{ fontSize: isText ? 13 : 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══ MAIN ══ */
export default function AdminSettings() {
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState('');
  const [editTarget, setEditTarget]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [form, setForm]                 = useState(EMPTY);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const canSubmit = FIELDS.every(f => form[f.key].trim());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/program-configs');
      setRows(data.programConfigs || []);
    } catch { toast.error('Failed to load configurations'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── add ── */
  const handleAdd = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await api.post('/admin/program-configs', {
        sector:             form.sector.trim(),
        trade:              form.trade.trim(),
        qualificationTitle: form.qualificationTitle.trim(),
        rtqfLevel:          form.rtqfLevel.trim(),
      });
      toast.success('Program configuration added!');
      setForm(EMPTY);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  /* ── delete ── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/program-configs/${deleteTarget._id}`);
      toast.success('Program configuration removed');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  const filtered = search.trim()
    ? rows.filter(r => FIELDS.some(f => r[f.key]?.toLowerCase().includes(search.toLowerCase())))
    : rows;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Hero Banner — same gradient/structure family as Teachers.jsx ── */}
      <div style={{
        borderRadius: 20, padding: '22px 26px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4c1d95 100%)',
        boxShadow: '0 8px 32px rgba(99,102,241,0.28)',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(139,92,246,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 220, width: 90, height: 90, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 90, width: 55, height: 55, borderRadius: '50%', background: 'rgba(167,139,250,0.1)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: '4px 10px', borderRadius: 99, background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <GraduationCap size={11} style={{ color: '#c4b5fd' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin</span>
              </div>
              <div style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#c4b5fd' }}>{rows.length} configured</span>
              </div>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 5, lineHeight: 1.2 }}>
              🎓 TVET Program Settings
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 420, lineHeight: 1.6 }}>
              Configure sectors, trades, qualification titles and RTQF levels — used across classes, student profiles and assessment reports.
            </p>
          </div>

          {/* Aggregate counters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Programs', value: rows.length, icon: BookOpen },
              { label: 'RTQF Levels', value: [...new Set(rows.map(r => r.rtqfLevel))].length, icon: Award },
            ].map(({ label, value, icon: Ic }) => (
              <div key={label} style={{
                textAlign: 'center', padding: '10px 16px', borderRadius: 14,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 68,
              }}>
                <Ic size={13} style={{ color: '#c4b5fd', margin: '0 auto 4px', display: 'block' }} />
                <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom strip — breadcrumb */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {['Dashboard', 'Admin', 'Program Settings'].map((c, i, a) => (
            <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: i === a.length - 1 ? 700 : 400, color: i === a.length - 1 ? '#fff' : 'rgba(255,255,255,0.4)' }}>{c}</span>
              {i < a.length - 1 && <ChevronRight size={9} style={{ color: 'rgba(255,255,255,0.25)' }} />}
            </span>
          ))}
        </div>
      </div>

      {/* ── Stat Strip ── */}
      {!loading && rows.length > 0 && <StatStrip rows={rows} />}

      {/* ── Add Program form card ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', background: 'var(--surface-50)' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Add New Program Configuration</p>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>All four fields are required — they are stored together and used as one unit across the system</p>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 16 }}>
            {FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  value={form[key]}
                  onChange={e => setF(key, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleAdd(); }}
                  placeholder={placeholder}
                  className="input-field"
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleAdd} disabled={!canSubmit || saving} className="btn-primary">
              {saving ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Plus size={14} />}
              Add Configuration
            </button>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 34 }}
            placeholder="Search by sector, trade, qualification or level…"
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
              <X size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--surface-100)', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading programs…</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <GraduationCap size={28} style={{ color: '#6366f1' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {search ? `No results for "${search}"` : 'No programs configured yet'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {search ? 'Try a different search term.' : 'Use the form above to add your first TVET program.'}
          </p>
          {search && (
            <button onClick={() => setSearch('')} className="btn-secondary" style={{ margin: '0 auto' }}>Clear search</button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--card-border)' }}>
                {['#', 'Sector', 'Trade / Program', 'Qualification Title', 'RTQF Level', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: h === 'Actions' ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <TableRow key={row._id} row={row} index={i} search={search} animDelay={i * 35}
                  onEdit={() => setEditTarget(row)}
                  onDelete={() => setDeleteTarget(row)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* footer count */}
      {!loading && filtered.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
          {search ? `${filtered.length} of ${rows.length} programs` : `${rows.length} program${rows.length !== 1 ? 's' : ''} total`}
        </p>
      )}

      {/* ── Edit Modal ── */}
      <EditModal open={!!editTarget} row={editTarget} onSave={fetchAll} onClose={() => setEditTarget(null)} />

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} loading={deleting}
        title="Remove Program Configuration"
        message={`Remove "${deleteTarget?.trade}"? This cannot be undone.`}
        confirmText="Remove" variant="danger"
      />

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}