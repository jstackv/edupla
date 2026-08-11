import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { BookMarked, Users, ClipboardCheck, GraduationCap, Award, Mail, Copy, Check } from 'lucide-react';

/* Each class gets a stable two-tone identity + accent, hashed from its id so
   the same class always renders the same way, and multiple classes read as
   visually distinct from one another. */
const CLASS_PALETTES = [
  { from: '#4338ca', to: '#7c3aed', accent: '#818cf8' }, // indigo → violet
  { from: '#0369a1', to: '#0891b2', accent: '#38bdf8' }, // ocean
  { from: '#047857', to: '#059669', accent: '#34d399' }, // emerald
  { from: '#b45309', to: '#ea580c', accent: '#fbbf24' }, // amber
  { from: '#be123c', to: '#db2777', accent: '#fb7185' }, // rose
  { from: '#0f766e', to: '#115e59', accent: '#2dd4bf' }, // teal
];
const hashStr = (s) => {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
const getPalette = (id) => CLASS_PALETTES[hashStr(String(id)) % CLASS_PALETTES.length];

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
};

function SkeletonStack() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 1 }).map((_, i) => (
        <div key={i} className="clsx-skel-card">
          <div className="skeleton" style={{ height: 128, borderRadius: 0 }} />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton" style={{ width: 46, height: 46, borderRadius: 15 }} />
              <div className="flex-1 space-y-2">
                <div className="skeleton" style={{ height: 12, width: '40%' }} />
                <div className="skeleton" style={{ height: 10, width: '25%' }} />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="skeleton" style={{ height: 52, flex: 1, borderRadius: 14 }} />
              <div className="skeleton" style={{ height: 52, flex: 1, borderRadius: 14 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StudentClasses() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  const copyEmail = (email, id) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedId(id);
      toast.success('Email copied');
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1600);
    }).catch(() => toast.error('Could not copy email'));
  };

  useEffect(() => {
    api.get('/classes/my')
      .then(r => setClasses(r.data.classes || []))
      .catch(() => toast.error('Failed to load classes'))
      .finally(() => setLoading(false));
  }, []);

  const palettes = useMemo(
    () => Object.fromEntries(classes.map(c => [c.id, getPalette(c.id)])),
    [classes]
  );

  if (loading) return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>My Class</h2>
        <p className="text-sm text-muted">class enrolled</p>
      </div>
      <SkeletonStack />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>My Class</h2>
        <p className="text-sm text-muted">class enrolled</p>
      </div>

      {classes.length === 0 ? (
        <div className="modx-empty">
          <div className="modx-empty-icon">
            <BookMarked className="w-7 h-7" />
          </div>
          <p className="font-display font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No classes yet</p>
          <p className="text-sm text-muted">Your teacher will enroll you in classes.</p>
        </div>
      ) : (
        <div className="clsx-stack space-y-5">
          {classes.map((cls, i) => {
            const pal = palettes[cls.id];
            const sealText = cls.level || cls.trade;
            const sealLabel = cls.level ? 'Level' : 'Trade';
            return (
              <div
                key={cls.id}
                className="clsx-card"
                style={{ '--clsx-from': pal.from, '--clsx-to': pal.to, '--clsx-accent': pal.accent, '--i': i }}
              >
                {/* ── Banner ─────────────────────────────────── */}
                <div className="clsx-banner">
                  <div className="clsx-stripes" />
                  <BookMarked className="clsx-watermark" size={150} strokeWidth={1.2} />
                  <div className="clsx-shine" />

                  <div className="flex items-start justify-between gap-4" style={{ position: 'relative', zIndex: 1 }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-3.5 h-3.5" style={{ opacity: 0.75 }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ opacity: 0.75 }}>
                          Enrolled Class
                        </span>
                      </div>
                      <h3 className="font-display font-extrabold text-2xl leading-tight truncate" style={{ letterSpacing: '-0.02em' }}>
                        {cls.name}
                      </h3>
                      {cls.description && (
                        <p className="text-xs mt-1.5 max-w-md" style={{ opacity: 0.8 }}>{cls.description}</p>
                      )}

                      <div className="flex flex-wrap gap-1.5 mt-3.5">
                        {cls.level && <span className="clsx-glass-pill"><GraduationCap className="w-3 h-3" />{cls.level}</span>}
                        {cls.trade && <span className="clsx-glass-pill"><BookMarked className="w-3 h-3" />{cls.trade}</span>}
                      </div>
                    </div>

                    {sealText && (
                      <div className="clsx-seal" title={`${sealLabel}: ${sealText}`}>
                        <span className="clsx-seal-label">{sealLabel}</span>
                        <span className="clsx-seal-value">{sealText}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Panel: teacher profile + stats ────────────────── */}
                <div className="clsx-panel">
                  {cls.teacher_name ? (
                    <div className="clsx-teacher-card">
                      <div className="clsx-teacher-avatar-wrap">
                        <div className="clsx-teacher-avatar">{getInitials(cls.teacher_name)}</div>
                        <div className="clsx-role-badge" title="Class Teacher">
                          <GraduationCap className="w-3 h-3" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="clsx-role-pill">Class Teacher</span>
                        <p className="font-display font-bold text-sm truncate mt-1" style={{ color: 'var(--text-primary)' }}>
                          {cls.teacher_name}
                        </p>
                        {cls.teacher_email && (
                          <a href={`mailto:${cls.teacher_email}`} className="clsx-email-row">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{cls.teacher_email}</span>
                          </a>
                        )}
                      </div>
                      {cls.teacher_email && (
                        <button
                          type="button"
                          className={`clsx-copy-btn ${copiedId === cls.id ? 'clsx-copied' : ''}`}
                          title="Copy email"
                          onClick={() => copyEmail(cls.teacher_email, cls.id)}
                        >
                          {copiedId === cls.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">No class teacher assigned yet</p>
                  )}

                  <div className="clsx-stat-row">
                    <div className="clsx-stat-tile" style={{ animationDelay: '80ms' }}>
                      <div className="clsx-stat-icon"><Users className="w-4 h-4" /></div>
                      <div>
                        <div className="clsx-stat-num">{cls.student_count ?? 0}</div>
                        <div className="clsx-stat-label">Classmates</div>
                      </div>
                    </div>
                    <div className="clsx-stat-tile" style={{ animationDelay: '140ms' }}>
                      <div className="clsx-stat-icon"><ClipboardCheck className="w-4 h-4" /></div>
                      <div>
                        <div className="clsx-stat-num">{cls.assessment_count ?? 0}</div>
                        <div className="clsx-stat-label">Assessments</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}