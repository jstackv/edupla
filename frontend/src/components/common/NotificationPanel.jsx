import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck, ClipboardList, FileText, Megaphone, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import api from '../../utils/api';

/* ── helpers ─────────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TYPE_META = {
  info:    { icon: Info,          color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
  success: { icon: CheckCircle,   color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  error:   { icon: XCircle,       color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

function guessIcon(n) {
  const t = (n.title + ' ' + n.message).toLowerCase();
  if (t.includes('assignment') || t.includes('submission')) return ClipboardList;
  if (t.includes('document') || t.includes('notes'))        return FileText;
  if (t.includes('announcement'))                            return Megaphone;
  return (TYPE_META[n.type] || TYPE_META.info).icon;
}

/* ── single notification row ─────────────────────────────────────── */
function NotifRow({ n, dark, onMarkRead }) {
  const meta    = TYPE_META[n.type] || TYPE_META.info;
  const Icon    = guessIcon(n);
  const unread  = !n.is_read;

  const handleClick = () => {
    if (unread) onMarkRead(n.id || n._id);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', gap: 12, padding: '12px 16px',
        background: unread
          ? (dark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)')
          : 'transparent',
        borderBottom: `1px solid ${dark ? '#1e2535' : '#f1f5f9'}`,
        cursor: unread ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (unread) e.currentTarget.style.background = dark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.07)'; }}
      onMouseLeave={e => { if (unread) e.currentTarget.style.background = dark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)'; }}
    >
      {/* icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: meta.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={meta.color} />
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <p style={{
            margin: 0, fontSize: 12.5, fontWeight: unread ? 700 : 500,
            color: dark ? '#e2e8f0' : '#111827',
            lineHeight: 1.4,
          }}>
            {n.title}
          </p>
          {unread && (
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#6366f1', flexShrink: 0, marginTop: 4,
              boxShadow: '0 0 6px rgba(99,102,241,0.6)',
            }} />
          )}
        </div>
        <p style={{
          margin: '3px 0 0', fontSize: 11.5, color: dark ? '#64748b' : '#6b7280',
          lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {n.message}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
          {n.class_name && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4,
              background: dark ? '#1e2535' : '#f1f5f9',
              color: dark ? '#64748b' : '#6b7280',
            }}>{n.class_name}</span>
          )}
          <span style={{ fontSize: 10, color: dark ? '#475569' : '#9ca3af' }}>{timeAgo(n.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function NotificationPanel({ dark }) {
  const [open, setOpen]               = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const panelRef = useRef(null);
  const pollRef  = useRef(null);

  /* ── fetch unread count (silent) ── */
  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count || 0);
    } catch { /* silent */ }
  }, []);

  /* ── fetch notifications page ── */
  const fetchPage = useCallback(async (pg = 1, reset = false) => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications?page=${pg}&limit=15`);
      const list = res.data.notifications || [];
      setNotifications(prev => reset ? list : [...prev, ...list]);
      setHasMore(list.length === 15);
      setPage(pg);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  /* ── open / close ── */
  useEffect(() => {
    if (open) {
      fetchPage(1, true);
    }
  }, [open, fetchPage]);

  /* ── poll unread count every 30 s ── */
  useEffect(() => {
    fetchCount();
    pollRef.current = setInterval(fetchCount, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchCount]);

  /* ── close on outside click ── */
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── mark one read ── */
  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => (n.id || n._id).toString() === id.toString() ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  /* ── mark all read ── */
  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  /* ── load more ── */
  const loadMore = () => fetchPage(page + 1, false);

  const hasUnread = unreadCount > 0;

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
          background: open ? (dark ? '#1d2235' : '#f3f4f6') : (dark ? '#181c27' : '#f9fafb'),
          border: `1px solid ${open ? '#6366f1' : (dark ? '#1e2130' : '#e5e7eb')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.background = dark ? '#1d2235' : '#f3f4f6';
            e.currentTarget.style.borderColor = '#6366f1';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = dark ? '#181c27' : '#f9fafb';
            e.currentTarget.style.borderColor = dark ? '#1e2130' : '#e5e7eb';
          }
        }}
      >
        <Bell size={14} color={dark ? '#7b839a' : '#6b7280'} />
        {hasUnread && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 14, height: 14, borderRadius: 7,
            background: '#6366f1',
            border: `1.5px solid ${dark ? '#13161f' : '#ffffff'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'edupla-pulse 2s infinite',
            fontSize: 8, fontWeight: 800, color: '#fff',
            padding: unreadCount > 9 ? '0 3px' : 0,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount > 9 ? unreadCount : ''}
          </div>
        )}
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 360, borderRadius: 16,
          background: dark ? '#141720' : '#ffffff',
          border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`,
          boxShadow: dark ? '0 24px 60px rgba(0,0,0,0.55)' : '0 24px 60px rgba(0,0,0,0.12)',
          zIndex: 1000,
          animation: 'dropdownIn 0.16s cubic-bezier(0.16,1,0.3,1)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: 520,
        }}>
          <style>{`
            @keyframes dropdownIn { from { opacity:0; transform:translateY(-6px) scale(0.98) } to { opacity:1; transform:translateY(0) scale(1) } }
            .notif-scroll::-webkit-scrollbar { width: 4px; }
            .notif-scroll::-webkit-scrollbar-track { background: transparent; }
            .notif-scroll::-webkit-scrollbar-thumb { background: ${dark ? '#2a3042' : '#e5e7eb'}; border-radius: 4px; }
          `}</style>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 12px',
            borderBottom: `1px solid ${dark ? '#1e2535' : '#f1f5f9'}`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={15} color={dark ? '#818cf8' : '#6366f1'} />
              <span style={{
                fontSize: 13.5, fontWeight: 700,
                color: dark ? '#e2e8f0' : '#111827',
                fontFamily: "'Sora', sans-serif",
              }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '1px 7px', borderRadius: 10,
                  background: 'rgba(99,102,241,0.15)',
                  color: '#6366f1',
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 7, border: 'none',
                    background: dark ? '#1e2535' : '#f1f5f9',
                    color: dark ? '#94a3b8' : '#6b7280',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = dark ? '#2a3042' : '#e5e7eb'}
                  onMouseLeave={e => e.currentTarget.style.background = dark ? '#1e2535' : '#f1f5f9'}
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 26, height: 26, borderRadius: 7, border: 'none',
                  background: dark ? '#1e2535' : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = dark ? '#2a3042' : '#e5e7eb'}
                onMouseLeave={e => e.currentTarget.style.background = dark ? '#1e2535' : '#f1f5f9'}
              >
                <X size={13} color={dark ? '#94a3b8' : '#6b7280'} />
              </button>
            </div>
          </div>

          {/* List */}
          <div
            className="notif-scroll"
            style={{ overflowY: 'auto', flex: 1 }}
          >
            {loading && notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{
                  width: 28, height: 28, margin: '0 auto 10px',
                  border: `2px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
                  borderTopColor: '#6366f1', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ margin: 0, fontSize: 12, color: dark ? '#475569' : '#9ca3af' }}>Loading notifications…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
                  background: dark ? '#1e2535' : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bell size={22} color={dark ? '#334155' : '#d1d5db'} />
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: dark ? '#e2e8f0' : '#111827' }}>All caught up!</p>
                <p style={{ margin: 0, fontSize: 12, color: dark ? '#475569' : '#9ca3af' }}>No notifications yet.</p>
              </div>
            ) : (
              <>
                {notifications.map(n => (
                  <NotifRow
                    key={n.id || n._id}
                    n={n}
                    dark={dark}
                    onMarkRead={markRead}
                  />
                ))}
                {hasMore && (
                  <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <button
                      onClick={loadMore}
                      disabled={loading}
                      style={{
                        padding: '7px 18px', borderRadius: 8, border: 'none',
                        background: dark ? '#1e2535' : '#f1f5f9',
                        color: dark ? '#818cf8' : '#6366f1',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        transition: 'background 0.15s',
                        opacity: loading ? 0.6 : 1,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? '#2a3042' : '#e5e7eb'}
                      onMouseLeave={e => e.currentTarget.style.background = dark ? '#1e2535' : '#f1f5f9'}
                    >
                      {loading ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: `1px solid ${dark ? '#1e2535' : '#f1f5f9'}`,
            flexShrink: 0,
            background: dark ? 'rgba(30,37,53,0.4)' : 'rgba(249,250,251,0.8)',
          }}>
            <p style={{ margin: 0, fontSize: 11, color: dark ? '#475569' : '#9ca3af', textAlign: 'center' }}>
              Showing in-app notifications. Check your email for full details.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
