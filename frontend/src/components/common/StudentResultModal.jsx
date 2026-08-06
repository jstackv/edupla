/**
 * StudentResultModal.jsx
 *
 * The student-facing counterpart to the teacher's OverallResultsModal: a
 * single place for a student to see how they did on an assessment. If the
 * module/type/term/year an assessment belongs to has more than one shared
 * assessment (e.g. Formative Assessment 1 + 2), every one of them gets its
 * own tab, plus a combined "Overall" tab computed with the exact same
 * best-score / module-weight-scaling logic the teacher's Overall mark
 * sheet uses — so the decision (C/NYC) shown here always agrees with what
 * the teacher sees.
 *
 * Only this student's own data is ever shown — no classmate scores or
 * class averages, just this student's own numbers, presented against the
 * competency line for the module.
 *
 * API contract: GET /assessment/student/assessments/:id/result
 */
import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Loader2, Layers, Trophy, Target, RotateCcw, Clock, CheckCircle2, XCircle,
  AlertTriangle, Inbox, Sparkles, TrendingUp, TrendingDown, Award, Hourglass,
  Zap, BarChart3, ChevronRight, BookOpen, GraduationCap, Flag,
} from 'lucide-react';

function scoreColor(pct) {
  if (pct == null) return '#9ca3af';
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#6366f1';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// "Formative Assessment 2" -> "FA2" — same shorthand convention as the
// teacher's Overall mark sheet, so the same series reads consistently in
// both places.
function shorthandTitle(title) {
  if (!title) return '';
  const match = title.trim().match(/^(.*?)\s*(\d+)?$/);
  const base = (match?.[1] || title).trim();
  const num = match?.[2] || '1';
  const initialsStr = base.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase();
  return `${initialsStr}${num}`;
}

const STATUS_META = {
  graded:        { label: 'Graded',          color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle2 },
  needs_grading: { label: 'Needs grading',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: Clock },
  not_attempted: { label: 'Not attempted',   color: '#9ca3af', bg: 'rgba(156,163,175,0.14)', icon: Inbox },
};

const ATTEMPT_STATUS_META = {
  graded:      { label: 'Graded',          color: '#10b981' },
  submitted:   { label: 'Awaiting grading', color: '#f59e0b' },
  in_progress: { label: 'In progress',     color: '#8b5cf6' },
};

/* Big circular percentage gauge used in every hero — fills in on mount
   with an eased sweep, and throws a brief confetti/sparkle burst for a
   genuinely strong result. */
function Gauge({ pct, size = 108, celebrate = false }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFilled(true), 100); return () => clearTimeout(t); }, [pct]);
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(pct);
  const showPct = pct != null;
  return (
    <span className="srm-hero-ring relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-border)" strokeWidth={stroke} />
        {showPct && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={filled ? c - (Math.min(pct, 100) / 100) * c : c}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        )}
        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.26} fontWeight="800" fill={showPct ? color : 'var(--text-secondary)'} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {showPct ? Math.round(pct) : '—'}
        </text>
        {showPct && (
          <text x="50%" y="68%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.115} fontWeight="700" fill="var(--text-secondary)">
            %
          </text>
        )}
      </svg>
      {celebrate && (
        <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="srm-confetti-piece"
              style={{
                '--srm-rot': `${180 + Math.random() * 180}deg`,
                left: `${10 + Math.random() * 80}%`,
                background: ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#eab308'][i % 5],
                animationDelay: `${Math.random() * 0.3}s`,
              }}
            />
          ))}
        </span>
      )}
    </span>
  );
}

function StatTile({ icon: Icon, color, value, label }) {
  return (
    <div className="card srm-stat-tile p-3 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}1f` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      </div>
    </div>
  );
}

function DecisionBadge({ decision, size = 'md' }) {
  if (!decision) return null;
  const pass = decision === 'C';
  return (
    <span
      className={`font-bold rounded-full flex items-center gap-1 flex-shrink-0 ${size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5'}`}
      style={{ background: pass ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)', color: pass ? '#10b981' : '#ef4444' }}
    >
      {pass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {pass ? 'Competent' : 'Not Yet Competent'}
    </span>
  );
}

/* Small pill-style row showing which module & teacher this result belongs
   to — reused in both the per-assessment and overall heroes. */
function MetaRow({ moduleName, teacherName, extra }) {
  if (!moduleName && !teacherName && !extra) return null;
  return (
    <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1.5 flex-wrap">
      {moduleName && (
        <span className="srm-meta-pill">
          <BookOpen className="w-3 h-3" /> {moduleName}
        </span>
      )}
      {teacherName && (
        <span className="srm-meta-pill">
          <GraduationCap className="w-3 h-3" /> {teacherName}
        </span>
      )}
      {extra}
    </div>
  );
}

/* Personal-performance-only insight: how this score sits relative to the
   module's competency line (50% for most modules, 70% for "Specific
   modules"). No classmate data involved — just this student's own margin,
   in both percentage points and marks, with a clear, encouraging read-out
   either way. */
function MarginMeter({ percentage, passingLine, marginPercentage, marginMarks }) {
  if (percentage == null || passingLine == null) return null;
  const passed = marginPercentage != null && marginPercentage >= 0;
  const color = passed ? '#10b981' : '#ef4444';
  return (
    <div className="srm-margin p-3 rounded-xl" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <Flag className="w-3 h-3" /> Competency margin
        </span>
        <span className="text-[11px] font-bold flex items-center gap-1" style={{ color }}>
          {passed ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {passed ? `+${Math.abs(marginPercentage)}%` : `-${Math.abs(marginPercentage)}%`}
        </span>
      </div>
      <div className="srm-margin-track">
        <div className="srm-margin-fill" style={{ width: `${Math.min(100, Math.max(0, percentage))}%`, background: color }} />
        <div className="srm-margin-line" style={{ left: `${passingLine}%` }} title={`Competent line — ${passingLine}%`} />
      </div>
      <div className="flex justify-between text-[10px] mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
        <span>0%</span>
        <span style={{ marginLeft: `${passingLine - 4}%` }}>Line {passingLine}%</span>
        <span>100%</span>
      </div>
      <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        {passed
          ? <>You're <strong style={{ color }}>{Math.abs(marginMarks)} pts</strong> clear of the {passingLine}% competency line — nice work.</>
          : <><strong style={{ color }}>{Math.abs(marginMarks)} more pts</strong> would put you right at the {passingLine}% competency line.</>}
      </p>
    </div>
  );
}

function AttemptRow({ att, i, maxMarks }) {
  const meta = ATTEMPT_STATUS_META[att.status] || ATTEMPT_STATUS_META.in_progress;
  const color = att.status === 'graded' ? scoreColor(att.percentage) : meta.color;
  return (
    <div style={{ '--i': i, '--srm-a-color': color }} className="srm-attempt-card p-3 flex items-center gap-3 relative">
      {att.is_best && <span className="srm-attempt-best-glow" />}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ background: `${color}1f`, color }}>
        #{att.attempt_number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Attempt {att.attempt_number}</span>
          {att.is_best && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: 'rgba(234,179,8,0.16)', color: '#eab308' }}>
              <Trophy className="w-2.5 h-2.5" /> Best
            </span>
          )}
          {att.auto_submitted && (
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Auto-submitted</span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {att.status === 'in_progress' ? `Started ${fmtDateTime(att.started_at)}` : `Submitted ${fmtDateTime(att.submitted_at)}`}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        {att.status === 'graded' ? (
          <>
            <p className="font-bold text-sm" style={{ color }}>{att.total_score} / {maxMarks}</p>
            <p className="text-[11px] font-semibold" style={{ color }}>{att.percentage}%</p>
          </>
        ) : (
          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: `${meta.color}1f`, color: meta.color }}>
            {att.needs_manual_grading ? 'Needs grading' : meta.label}
          </span>
        )}
      </div>
    </div>
  );
}

function AssessmentPanel({ a, moduleName }) {
  const st = STATUS_META[a.status] || STATUS_META.not_attempted;
  const color = scoreColor(a.percentage);

  return (
    <div className="srm-panel space-y-4">
      <div className="srm-hero flex flex-col sm:flex-row items-center gap-5" style={{ '--srm-color': color }}>
        <Gauge pct={a.percentage} celebrate={a.percentage != null && a.percentage >= 80} />
        <div className="min-w-0 flex-1 text-center sm:text-left relative z-10">
          <h3 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
          <MetaRow moduleName={moduleName} teacherName={a.teacher_name} />
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1.5 flex-wrap">
            <span className="badge text-xs flex items-center gap-1.5" style={{ background: st.bg, color: st.color }}>
              <st.icon className="w-3 h-3" /> {st.label}
            </span>
            <DecisionBadge decision={a.decision} />
          </div>
          {a.best_score != null && (
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              Best score: <strong style={{ color: 'var(--text-primary)' }}>{a.best_score} / {a.max_marks}</strong> pts
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile icon={Clock} color="#6366f1" value={`${a.duration_minutes ?? '—'} min`} label="Time limit" />
        <StatTile icon={RotateCcw} color="#f59e0b" value={`${a.attempts_used} / ${a.max_attempts}`} label="Attempts used" />
        <StatTile icon={Target} color="#10b981" value={`${a.max_marks} pts`} label="Total marks" />
        <StatTile
          icon={a.margin_percentage != null && a.margin_percentage >= 0 ? TrendingUp : TrendingDown}
          color={a.margin_percentage != null && a.margin_percentage >= 0 ? '#10b981' : '#ef4444'}
          value={a.margin_percentage != null ? `${a.margin_percentage >= 0 ? '+' : ''}${a.margin_percentage}%` : '—'}
          label="vs. competency line"
        />
      </div>

      <MarginMeter percentage={a.percentage} passingLine={a.passing_line} marginPercentage={a.margin_percentage} marginMarks={a.margin_marks} />

      {a.status === 'needs_grading' && (
        <div className="sa-note sa-note-amber p-3 rounded-xl text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Part of this attempt still needs manual grading from your teacher — the score above may still change.</p>
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <BarChart3 className="w-3.5 h-3.5" /> Attempt history
        </p>
        {a.attempts.length === 0 ? (
          <div className="card p-6 text-center">
            <Inbox className="w-6 h-6 mx-auto mb-2 opacity-50" style={{ color: 'var(--text-secondary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No attempts yet for this assessment.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {a.attempts.map((att, i) => <AttemptRow key={att.id} att={att} i={i} maxMarks={a.max_marks} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function OverallPanel({ data }) {
  const o = data.overall;
  const st = STATUS_META[o.status] || STATUS_META.not_attempted;
  const color = scoreColor(o.percentage);

  return (
    <div className="srm-panel space-y-4">
      <div className="srm-hero flex flex-col sm:flex-row items-center gap-5" style={{ '--srm-color': color }}>
        <Gauge pct={o.percentage} celebrate={o.percentage != null && o.percentage >= 80} />
        <div className="min-w-0 flex-1 text-center sm:text-left relative z-10">
          <h3 className="font-display font-bold text-lg flex items-center justify-center sm:justify-start gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <Layers className="w-4.5 h-4.5" style={{ color: '#6366f1' }} /> Overall — {data.type_label}
          </h3>
          <MetaRow
            moduleName={data.course.name}
            teacherName={data.teachers?.length ? data.teachers.join(', ') : null}
            extra={<span className="srm-meta-pill">{data.term} · {data.academic_year}</span>}
          />
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1.5 flex-wrap">
            <span className="badge text-xs flex items-center gap-1.5" style={{ background: st.bg, color: st.color }}>
              <st.icon className="w-3 h-3" /> {st.label}
            </span>
            <DecisionBadge decision={o.decision} />
          </div>
        </div>
      </div>

      <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
        <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
        Combines {data.assessments.length} assessment{data.assessments.length > 1 ? 's' : ''} ({data.assessments.map(a => a.title).join(', ')}) — your best score on each is summed out of {data.combined_max} and scaled onto the module weight ({data.module_weight}), exactly how your teacher's mark sheet calculates it.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile icon={Target} color="#6366f1" value={o.total_obtained != null ? `${Math.round(o.total_obtained)} / ${o.combined_max}` : '—'} label="Total obtained" />
        <StatTile icon={TrendingUp} color={color} value={o.percentage != null ? `${o.percentage}%` : '—'} label="Overall %" />
        <StatTile icon={Award} color="#8b5cf6" value={o.marks_on_mw != null ? `${Math.round(o.marks_on_mw)} / ${o.module_weight}` : '—'} label="On module weight" />
        <StatTile icon={Zap} color="#f59e0b" value={data.assessments.length} label="Assessments" />
      </div>

      <MarginMeter percentage={o.percentage} passingLine={o.passing_line} marginPercentage={o.margin_percentage} marginMarks={o.total_obtained != null && o.passing_line != null ? Math.round((o.total_obtained - (o.passing_line / 100) * o.combined_max) * 10) / 10 : null} />

      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <BarChart3 className="w-3.5 h-3.5" /> Per-assessment breakdown
        </p>
        <div className="card p-2 space-y-1">
          {data.assessments.map((a, i) => {
            const aColor = scoreColor(a.percentage);
            return (
              <div key={a.assessment_id} className="srm-mini-row flex items-center gap-3 p-2">
                <span className="text-xs font-bold w-9 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{shorthandTitle(a.title)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                  <div className="assessment-progress-track mt-1">
                    <div className="assessment-progress-fill" style={{ width: `${a.percentage != null ? Math.min(100, a.percentage) : 0}%`, background: aColor }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0 w-20">
                  <p className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {a.best_score != null ? `${Math.round(a.best_score)}/${a.max_marks}` : `—/${a.max_marks}`}
                  </p>
                  {a.decision && <span className="text-[10px] font-bold" style={{ color: a.decision === 'C' ? '#10b981' : '#ef4444' }}>{a.decision}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function StudentResultModal({ assessment, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(String(assessment.id));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/assessment/student/assessments/${assessment.id}/result`);
        if (!alive) return;
        setData(data);
        setActiveTab(String(data.anchor_assessment_id));
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load your result');
        onClose();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment.id]);

  const tabs = useMemo(() => {
    if (!data) return [];
    const assessmentTabs = data.assessments.map(a => ({
      key: String(a.assessment_id),
      label: shorthandTitle(a.title),
      title: a.title,
      color: (STATUS_META[a.status] || STATUS_META.not_attempted).color,
    }));
    const showOverall = data.assessments.length > 1;
    return showOverall ? [...assessmentTabs, { key: 'overall', label: 'Overall', title: 'Overall', color: '#6366f1' }] : assessmentTabs;
  }, [data]);

  const activeAssessment = data?.assessments.find(a => String(a.assessment_id) === activeTab);

  return (
    <Modal isOpen={true} onClose={onClose} title={loading ? assessment.title : `Your Result — ${data.type_label}`} size="xl">
      {loading || !data ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : (
        <div className="space-y-4">
          {tabs.length > 1 && (
            <div className="srm-tabs">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`srm-tab ${activeTab === t.key ? 'srm-tab-active' : ''}`}
                  title={t.title}
                >
                  {t.key === 'overall'
                    ? <Layers className="w-3.5 h-3.5" />
                    : <span className="srm-tab-dot" style={{ color: activeTab === t.key ? '#fff' : t.color }} />}
                  {t.label}
                  {activeTab !== t.key && <ChevronRight className="w-3 h-3 opacity-40" />}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'overall'
            ? <OverallPanel data={data} />
            : activeAssessment
              ? <AssessmentPanel a={activeAssessment} moduleName={data.course.name} />
              : null}
        </div>
      )}
    </Modal>
  );
}