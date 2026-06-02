import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  Plus, Trash2, Edit2, Settings, ShieldCheck,
  X, Check, GraduationCap, Wrench,
  ChevronRight, Sparkles, Search,
} from 'lucide-react';

/* ── Palettes ── */
const LEVEL_PALETTE = [
  { accent: '#7c6af7', light: '#a99df7' },
  { accent: '#5b8dee', light: '#89b3f5' },
  { accent: '#9b6bff', light: '#bc97ff' },
  { accent: '#4fa3e8', light: '#7ec2f0' },
  { accent: '#6e83f5', light: '#99acf9' },
  { accent: '#8b5cf6', light: '#a78bfa' },
  { accent: '#3d9edb', light: '#6bbfe8' },
  { accent: '#a78bfa', light: '#c4b0fc' },
];
const TRADE_PALETTE = [
  { accent: '#f0a500', light: '#f7c84a' },
  { accent: '#e8830a', light: '#f5a84a' },
  { accent: '#e05c1a', light: '#ed8a54' },
  { accent: '#d4842e', light: '#e8ab62' },
  { accent: '#f0bc00', light: '#f7d44a' },
  { accent: '#e06030', light: '#ed8860' },
  { accent: '#c97a40', light: '#dba070' },
  { accent: '#f5960a', light: '#f7b54a' },
];

/* ── EditModal ── */
function EditModal({ open, item, type, palette, onSave, onClose }) {
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && item) setVal(item.label || item.value);
  }, [open, item]);

  if (!open || !item) return null;
  const p = palette[item.idx % palette.length];

  const handleSave = async () => {
    if (!val.trim()) return;
    setSaving(true);
    try { await onSave(item.value, val.trim()); onClose(); }
    catch { setSaving(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
      padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: '#0e0e12',
        borderRadius: 20,
        border: `1px solid ${p.accent}55`,
        boxShadow: `0 0 0 1px ${p.accent}22, 0 40px 80px rgba(0,0,0,0.6), 0 0 60px ${p.accent}18`,
        overflow: 'hidden',
        animation: 'modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)` }} />
        <div style={{ padding: '28px 28px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, color: p.accent,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                margin: '0 0 4px',
              }}>
                EDIT {type?.toUpperCase()}
              </p>
              <p style={{
                fontSize: 21, fontWeight: 800, color: '#fff',
                margin: 0, letterSpacing: '-0.03em',
              }}>
                {item.value}
              </p>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            </button>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'block', marginBottom: 8,
            }}>
              Display Label
            </label>
            <input
              autoFocus
              value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
              placeholder="Label…"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                border: `1.5px solid ${val.trim() ? p.accent + '88' : 'rgba(255,255,255,0.1)'}`,
                background: val.trim() ? `${p.accent}14` : 'rgba(255,255,255,0.04)',
                fontSize: 14, color: '#fff', outline: 'none',
                boxSizing: 'border-box', transition: 'all 0.18s',
                fontWeight: 500,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} disabled={saving} style={{
              flex: 1, padding: '11px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !val.trim()} style={{
              flex: 2, padding: '11px', borderRadius: 12, border: 'none',
              background: val.trim() ? p.accent : 'rgba(255,255,255,0.05)',
              color: val.trim() ? '#fff' : 'rgba(255,255,255,0.25)',
              fontSize: 13, fontWeight: 600,
              cursor: val.trim() && !saving ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              letterSpacing: '0.02em',
              boxShadow: val.trim() ? `0 4px 20px ${p.accent}55` : 'none',
              transition: 'all 0.15s',
            }}>
              {saving
                ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                : <Check size={14} />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ItemRow ── */
function ItemRow({ item, idx, palette, onEdit, onDelete, searchQuery }) {
  const [hov, setHov] = useState(false);
  const p = palette[idx % palette.length];

  const highlight = (text) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase()
        ? <mark key={i} style={{ background: `${p.accent}44`, color: p.light, borderRadius: 3, padding: '0 2px' }}>{part}</mark>
        : part
    );
  };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderRadius: 12,
        border: `1px solid ${hov ? p.accent + '55' : 'rgba(255,255,255,0.06)'}`,
        background: hov ? `${p.accent}0e` : 'rgba(255,255,255,0.02)',
        transition: 'all 0.18s ease',
        overflow: 'hidden',
        cursor: 'default',
        boxShadow: hov ? `0 0 20px ${p.accent}18` : 'none',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        width: 3, alignSelf: 'stretch', flexShrink: 0,
        background: hov ? p.accent : 'transparent',
        transition: 'background 0.18s',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', flex: 1, minWidth: 0 }}>
        {/* Index */}
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: hov ? p.accent : 'rgba(255,255,255,0.2)',
          width: 16, textAlign: 'right', flexShrink: 0,
          transition: 'color 0.15s',
          fontVariantNumeric: 'tabular-nums',
        }}>{String(idx + 1).padStart(2, '0')}</span>

        {/* Code — monospace via system stack */}
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: hov ? p.light : p.accent,
          letterSpacing: '0.1em',
          fontFamily: "'SF Mono','Fira Code','Cascadia Code',Consolas,'Courier New',monospace",
          transition: 'color 0.15s',
          flexShrink: 0,
          minWidth: 44,
        }}>{highlight(item.value)}</span>

        {/* Label */}
        <span style={{
          fontSize: 13,
          color: hov ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
          fontWeight: 400, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color 0.15s',
        }}>
          {item.label && item.label !== item.value
            ? highlight(item.label)
            : <span style={{ fontStyle: 'italic', opacity: 0.5, fontSize: 11 }}>—</span>
          }
        </span>

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 5, flexShrink: 0,
          opacity: hov ? 1 : 0, transition: 'opacity 0.15s',
        }}>
          <button onClick={() => onEdit({ ...item, idx })} style={{
            width: 28, height: 28, borderRadius: 8,
            border: `1px solid ${p.accent}44`,
            background: `${p.accent}18`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Edit2 size={11} style={{ color: p.accent }} />
          </button>
          <button onClick={() => onDelete({ ...item, idx })} style={{
            width: 28, height: 28, borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.12)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trash2 size={11} style={{ color: '#ef4444' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── AddForm ── */
function AddForm({ accent, placeholder, onAdd, loading }) {
  const [code, setCode] = useState('');
  const canSubmit = code.trim() && !loading;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onAdd(code.trim(), code.trim());
    setCode('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
      <input
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder={`New ${placeholder} code…`}
        maxLength={20}
        style={{
          flex: 1, padding: '10px 14px', borderRadius: 11,
          border: `1.5px solid ${code ? accent + '66' : 'rgba(255,255,255,0.08)'}`,
          background: code ? `${accent}12` : 'rgba(255,255,255,0.03)',
          fontSize: 13, fontWeight: 700, color: '#fff',
          outline: 'none', boxSizing: 'border-box', transition: 'all 0.15s',
          letterSpacing: '0.1em',
          fontFamily: "'SF Mono','Fira Code','Cascadia Code',Consolas,'Courier New',monospace",
        }}
        onFocus={e => { e.target.style.borderColor = accent + '99'; e.target.style.background = `${accent}12`; }}
        onBlur={e => { if (!code) { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.03)'; } }}
      />
      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          padding: '10px 18px', borderRadius: 11, border: 'none',
          background: canSubmit ? accent : 'rgba(255,255,255,0.05)',
          color: canSubmit ? '#fff' : 'rgba(255,255,255,0.2)',
          fontSize: 13, fontWeight: 600,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s', flexShrink: 0,
          boxShadow: canSubmit ? `0 4px 18px ${accent}55` : 'none',
          letterSpacing: '0.01em',
        }}
      >
        {loading
          ? <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          : <Plus size={14} />}
        Add
      </button>
    </form>
  );
}

/* ── SectionCard ── */
function SectionCard({
  title, subtitle, accent, icon: Icon,
  items, loading, palette,
  onAdd, adding, placeholder,
  onEdit, onDelete,
}) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const filtered = search
    ? items.filter(it =>
      it.value.toLowerCase().includes(search.toLowerCase()) ||
      (it.label || '').toLowerCase().includes(search.toLowerCase())
    )
    : items;

  return (
    <div style={{
      borderRadius: 22, overflow: 'hidden',
      background: '#0e0e12',
      border: `1px solid rgba(255,255,255,0.07)`,
      boxShadow: `0 0 0 1px ${accent}15, 0 20px 60px rgba(0,0,0,0.4), 0 0 80px ${accent}0c`,
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Top edge glow */}
      <div style={{
        position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
        background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        padding: '20px 22px 18px',
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
        background: `linear-gradient(180deg, ${accent}0d 0%, transparent 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            background: `${accent}20`,
            border: `1px solid ${accent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 20px ${accent}33`,
          }}>
            <Icon size={18} style={{ color: accent }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>{title}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '3px 0 0', fontWeight: 400 }}>{subtitle}</p>
          </div>

          {/* Count */}
          <div style={{
            padding: '5px 13px', borderRadius: 30,
            background: `${accent}18`, border: `1px solid ${accent}44`,
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums' }}>
              {items.length}
            </span>
          </div>

          {/* Collapse */}
          <button onClick={() => setCollapsed(c => !c)} style={{
            width: 30, height: 30, borderRadius: 9,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <ChevronRight size={13} style={{
              color: 'rgba(255,255,255,0.3)',
              transform: collapsed ? 'rotate(90deg)' : 'rotate(270deg)',
              transition: 'transform 0.2s',
            }} />
          </button>
        </div>

        {/* Search */}
        {!collapsed && items.length > 3 && (
          <div style={{ position: 'relative', marginTop: 14 }}>
            <Search size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%', padding: '8px 32px 8px 30px',
                borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)', fontSize: 12,
                color: '#fff', outline: 'none', boxSizing: 'border-box',
                fontWeight: 400,
              }}
              onFocus={e => e.target.style.borderColor = accent + '66'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex',
              }}>
                <X size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      {!collapsed && (
        <div style={{ padding: '14px 18px', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: `2px solid ${accent}30`, borderTopColor: accent,
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '28px 16px',
              border: `1px dashed ${accent}33`, borderRadius: 12,
            }}>
              {search ? (
                <>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>No matches for "{search}"</p>
                  <button onClick={() => setSearch('')} style={{ fontSize: 12, color: accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear</button>
                </>
              ) : (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>No {title.toLowerCase()} yet. Add one below.</p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map((item) => {
                const realIdx = items.findIndex(i => i.value === item.value);
                return (
                  <ItemRow
                    key={item.value} item={item} idx={realIdx}
                    palette={palette} onEdit={onEdit} onDelete={onDelete}
                    searchQuery={search}
                  />
                );
              })}
              {search && filtered.length > 0 && (
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 4 }}>
                  {filtered.length} / {items.length} shown
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {!collapsed && (
        <div style={{
          padding: '14px 18px 18px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, color: accent,
            letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 10px',
          }}>
            + New {placeholder}
          </p>
          <AddForm accent={accent} placeholder={placeholder} onAdd={onAdd} loading={adding} />
        </div>
      )}
    </div>
  );
}

/* ══ MAIN ══ */
export default function AdminSettings() {
  const [levels, setLevels]               = useState([]);
  const [trades, setTrades]               = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [addingLevel, setAddingLevel]     = useState(false);
  const [addingTrade, setAddingTrade]     = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [editTarget, setEditTarget]       = useState(null);

  const fetchLevels = useCallback(async () => {
    setLoadingLevels(true);
    try {
      const { data } = await api.get('/admin/levels');
      setLevels(data.levels || []);
    } catch { toast.error('Failed to load levels'); }
    finally { setLoadingLevels(false); }
  }, []);

  const fetchTrades = useCallback(async () => {
    setLoadingTrades(true);
    try {
      const { data } = await api.get('/admin/trades');
      setTrades(data.trades || []);
    } catch { toast.error('Failed to load trades'); }
    finally { setLoadingTrades(false); }
  }, []);

  useEffect(() => { fetchLevels(); fetchTrades(); }, [fetchLevels, fetchTrades]);

  const addLevel = async (value) => {
    setAddingLevel(true);
    try {
      await api.post('/admin/levels', { value, label: value });
      toast.success(`Level "${value}" added`);
      fetchLevels();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add level'); }
    finally { setAddingLevel(false); }
  };

  const addTrade = async (value) => {
    setAddingTrade(true);
    try {
      await api.post('/admin/trades', { value, label: value });
      toast.success(`Trade "${value}" added`);
      fetchTrades();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add trade'); }
    finally { setAddingTrade(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'level') {
        await api.delete(`/admin/levels/${deleteTarget.value}`);
        toast.success(`Level "${deleteTarget.value}" removed`);
        fetchLevels();
      } else {
        await api.delete(`/admin/trades/${deleteTarget.value}`);
        toast.success(`Trade "${deleteTarget.value}" removed`);
        fetchTrades();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleEditSave = async (value, newLabel) => {
    if (editTarget.type === 'level') {
      await api.put(`/admin/levels/${value}`, { label: newLabel });
      toast.success('Level updated');
      fetchLevels();
    } else {
      await api.put(`/admin/trades/${value}`, { label: newLabel });
      toast.success('Trade updated');
      fetchTrades();
    }
  };

  const totalItems = levels.length + trades.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Keyframes only — no font imports ── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── HERO ── */}
      <div style={{
        borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: '#08080d',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 0 0 1px rgba(124,106,247,0.2), 0 30px 80px rgba(0,0,0,0.5)',
        padding: '32px 34px 28px',
        animation: 'fadeUp 0.5s ease both',
      }}>
        {/* Grid texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(124,106,247,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,106,247,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />

        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -80, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,106,247,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: 60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,165,0,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{
                width: 60, height: 60, borderRadius: 18, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(124,106,247,0.3), rgba(91,141,238,0.2))',
                border: '1px solid rgba(124,106,247,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(124,106,247,0.3)',
                backdropFilter: 'blur(10px)',
              }}>
                <Settings size={26} style={{ color: '#a99df7' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h1 style={{
                    fontSize: 28, fontWeight: 800, color: '#fff', margin: 0,
                    letterSpacing: '-0.04em',
                  }}>
                    System Settings
                  </h1>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 30,
                    background: 'rgba(124,106,247,0.25)', color: '#a99df7',
                    border: '1px solid rgba(124,106,247,0.4)',
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                  }}>ADMIN</span>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.6, fontWeight: 400 }}>
                  Configure academic levels and trade programs
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { icon: GraduationCap, value: levels.length, label: 'Levels', color: '#7c6af7' },
                { icon: Wrench,        value: trades.length, label: 'Trades', color: '#f0a500' },
                { icon: Sparkles,      value: totalItems,    label: 'Total',  color: '#34d399' },
              ].map(({ icon: Icon, value, label, color }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${color}33`,
                  backdropFilter: 'blur(10px)',
                }}>
                  <Icon size={14} style={{ color }} />
                  <div>
                    <p style={{
                      fontSize: 20, fontWeight: 800, color: '#fff',
                      lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums',
                    }}>{value}</p>
                    <p style={{
                      fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: 0,
                      letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
                    }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['Dashboard', 'Admin', 'Settings'].map((crumb, i, arr) => (
              <span key={crumb} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11,
                  color: i === arr.length - 1 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                  fontWeight: i === arr.length - 1 ? 600 : 400,
                  letterSpacing: '0.04em',
                }}>
                  {crumb}
                </span>
                {i < arr.length - 1 && <ChevronRight size={9} style={{ color: 'rgba(255,255,255,0.15)' }} />}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div style={{
        borderRadius: 14, padding: '12px 18px',
        background: '#0e0e12',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        animation: 'fadeUp 0.5s ease 0.1s both',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: 'rgba(124,106,247,0.15)', border: '1px solid rgba(124,106,247,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={14} style={{ color: '#7c6af7' }} />
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, flex: 1, lineHeight: 1.6, fontWeight: 400 }}>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>Hover any row</span> to reveal edit and delete actions.
          Removing an item won't affect existing records.
        </p>
        <div style={{
          padding: '4px 12px', borderRadius: 20, flexShrink: 0,
          background: totalItems > 0 ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${totalItems > 0 ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 800,
            color: totalItems > 0 ? '#34d399' : '#ef4444',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {totalItems}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: totalItems > 0 ? '#34d399' : '#ef4444',
            marginLeft: 4,
          }}>
            configured
          </span>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 18,
        animation: 'fadeUp 0.5s ease 0.2s both',
      }}>
        <SectionCard
          title="Academic Levels"
          subtitle="Level codes used in student profiles"
          accent="#7c6af7"
          icon={GraduationCap}
          items={levels}
          loading={loadingLevels}
          palette={LEVEL_PALETTE}
          onAdd={addLevel}
          adding={addingLevel}
          placeholder="Level"
          onEdit={(item) => setEditTarget({ ...item, type: 'level' })}
          onDelete={(item) => setDeleteTarget({ ...item, type: 'level' })}
        />
        <SectionCard
          title="Trades & Programs"
          subtitle="Trade program codes for specializations"
          accent="#f0a500"
          icon={Wrench}
          items={trades}
          loading={loadingTrades}
          palette={TRADE_PALETTE}
          onAdd={addTrade}
          adding={addingTrade}
          placeholder="Trade"
          onEdit={(item) => setEditTarget({ ...item, type: 'trade' })}
          onDelete={(item) => setDeleteTarget({ ...item, type: 'trade' })}
        />
      </div>

      {/* ── Edit Modal ── */}
      <EditModal
        open={!!editTarget}
        item={editTarget}
        type={editTarget?.type}
        palette={editTarget?.type === 'level' ? LEVEL_PALETTE : TRADE_PALETTE}
        onSave={handleEditSave}
        onClose={() => setEditTarget(null)}
      />

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={`Remove ${deleteTarget?.type === 'level' ? 'Level' : 'Trade'}`}
        message={`Are you sure you want to remove "${deleteTarget?.value}"? This action cannot be undone.`}
        confirmText="Remove"
        variant="danger"
      />
    </div>
  );
}