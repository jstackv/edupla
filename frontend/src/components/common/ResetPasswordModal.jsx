/**
 * ResetPasswordModal.jsx
 *
 * Shared between the admin Teachers and Students pages. A teacher or
 * student is given a default/self-changed password; if they forget it,
 * there's no self-service "forgot password" flow in this app — the admin
 * who created them is the only way back in. This modal lets the admin
 * generate a brand-new random password server-side (never typed by the
 * admin), with a confirm step first since it immediately invalidates
 * whatever password the person was using before.
 *
 * Usage: <ResetPasswordModal target={user} role="teacher" onClose={...} />
 * `target` needs at least { id, name, email }. `role` is 'teacher' | 'student'.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { KeyRound, ShieldAlert, Copy, Eye, EyeOff, CheckCircle2, Mail, Loader2 } from 'lucide-react';

export default function ResetPasswordModal({ target, role, onClose }) {
  const { t } = useTranslation();
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState(null); // { newPassword, email }
  const [showPassword, setShowPassword] = useState(false);

  const roleLabel = role === 'teacher' ? t('resetPasswordModal.teacher') : t('resetPasswordModal.student');

  const handleReset = async () => {
    setResetting(true);
    try {
      const { data } = await api.post(`/admin/${role}s/${target.id}/reset-password`);
      setResult({ newPassword: data.newPassword, email: data.email });
      setShowPassword(true);
      toast.success(t('resetPasswordModal.resetSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('resetPasswordModal.resetFailed'));
    } finally {
      setResetting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success(t('resetPasswordModal.copied')));
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={result ? t('resetPasswordModal.passwordReset') : t('resetPasswordModal.resetRolePassword', { role: roleLabel })}
      icon={KeyRound}
      accent="#c2410c"
      accent2="#c2410c"
      size="sm"
    >
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <CheckCircle2 size={28} style={{ color: '#c2410c' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              {t('resetPasswordModal.passwordWasReset', { name: target.name })}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
              {t('resetPasswordModal.oldNoLongerWorks')}
            </p>
          </div>

          <div style={{ borderRadius: 14, border: '1px solid var(--surface-100)', background: 'transparent', overflow: 'hidden' }}>
            {[
              { label: t('resetPasswordModal.email'), value: result.email, secret: false },
              { label: t('resetPasswordModal.newPassword'), value: result.newPassword, secret: true },
            ].map(({ label, value, secret }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: label === t('resetPasswordModal.email') ? '1px solid var(--surface-100)' : 'none',
              }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {secret && !showPassword ? '••••••••••' : value}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {secret && (
                    <button onClick={() => setShowPassword(p => !p)}
                      style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fdba74', display: 'flex' }}>
                      {showPassword ? <EyeOff size={14} style={{ color: '#c2410c' }} /> : <Eye size={14} style={{ color: '#c2410c' }} />}
                    </button>
                  )}
                  <button onClick={() => copyToClipboard(value)}
                    style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fdba74', display: 'flex' }}>
                    <Copy size={14} style={{ color: '#c2410c' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-100)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Mail size={14} style={{ color: '#c2410c', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('resetPasswordModal.emailSentNote', { name: target.name.split(' ')[0] })}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} className="btn-primary">{t('resetPasswordModal.done')}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: '#fef3c7', border: '1px solid #fde68a' }}>
            <ShieldAlert size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>{t('resetPasswordModal.invalidatesWarningTitle')}</p>
              <p style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.6 }}>
                {t('resetPasswordModal.invalidatesWarningBody', { name: target.name })}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-50)' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #c2410c, #c2410c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{target.name?.[0]?.toUpperCase()}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target.email}</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={resetting}>{t('resetPasswordModal.cancel')}</button>
            <button type="button" onClick={handleReset} disabled={resetting} className="btn-primary" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 2px 8px rgba(239,68,68,0.35)' }}>
              {resetting ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {resetting ? t('resetPasswordModal.resetting') : t('resetPasswordModal.resetPassword')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
