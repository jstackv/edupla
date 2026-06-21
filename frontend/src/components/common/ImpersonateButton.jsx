import { useState } from 'react';
import { UserCog, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

/**
 * ImpersonateButton — super admin only.
 *
 * Calls POST /api/system/impersonate/:userId, then opens a NEW browser tab
 * pointed at the app's impersonation-handoff route, passing the short-lived
 * token via the URL hash (never logged, never sent in a Referer header).
 *
 * Why a new tab + sessionStorage: auth (token/user) is stored in
 * sessionStorage, which is scoped per browser tab — even tabs on the same
 * origin don't share it. That's what lets the super admin's tab and any
 * number of impersonation tabs (teacher, student, admin — any mix) all stay
 * signed in as different users at the same time, indefinitely, without one
 * tab's session overwriting another's.
 *
 * Usage: <ImpersonateButton userId={t.id} name={t.name} />
 */
export default function ImpersonateButton({ userId, name, size = 13, style = {} }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);

    // Open the tab synchronously (in direct response to the click) so
    // browser popup blockers don't intercept it once the await resolves.
    const tab = window.open('', '_blank');

    try {
      const res = await api.post(`/system/impersonate/${userId}`);
      const { token, user } = res.data;

      if (tab) {
        const handoffUrl = `${window.location.origin}/impersonate-handoff#token=${encodeURIComponent(token)}`;
        tab.location.href = handoffUrl;
      } else {
        toast.error('Pop-up blocked. Please allow pop-ups for EDUPLA and try again.');
      }

      toast.success(`Impersonating ${user.name} (${user.role}) — opened in a new tab. Token expires in 2 hours.`);
    } catch (err) {
      if (tab) tab.close();
      toast.error(err.response?.data?.message || 'Failed to start impersonation session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={`Log in as ${name || 'this user'} (new tab)`}
      style={{
        padding: '5px 7px', borderRadius: 8, border: 'none', cursor: loading ? 'default' : 'pointer',
        background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: loading ? 0.6 : 1,
        ...style,
      }}
    >
      {loading
        ? <Loader2 size={size} className="animate-spin" style={{ color: '#7c3aed' }} />
        : <UserCog size={size} style={{ color: '#7c3aed' }} />}
    </button>
  );
}
