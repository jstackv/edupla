/**
 * QuizBuilderModal.jsx
 *
 * Lets a teacher build the question paper for an assessment: pick a
 * question type per question (Multiple Choice, True/False, Fill in the
 * Gap, Matching, Open), enter marks and the expected answer, then save
 * the whole set in one go.
 *
 * API contract:
 *   GET  /assessment/teacher/assessments/:id/questions  -> { questions, locked }
 *   POST /assessment/teacher/assessments/:id/questions  -> body: { questions }
 */
import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Save, GripVertical, ListChecks, ToggleLeft,
  PenLine, Shuffle, MessageSquareText, Lock, Loader2, Sparkles, PencilLine,
  Scale, ClipboardList, Minus,
} from 'lucide-react';

const QUESTION_TYPES = [
  { key: 'mcq',        label: 'Multiple Choice', icon: ListChecks,        color: '#6366f1' },
  { key: 'true_false',  label: 'True / False',    icon: ToggleLeft,        color: '#0d9488' },
  { key: 'fill_gap',    label: 'Fill in the Gap', icon: PenLine,           color: '#8b5cf6' },
  { key: 'matching',    label: 'Matching',        icon: Shuffle,           color: '#f59e0b' },
  { key: 'open',        label: 'Open Question',   icon: MessageSquareText, color: '#ec4899' },
];

const COMPLEXITY_LEVELS = [
  { key: 'easy',     label: 'Easy' },
  { key: 'medium',   label: 'Medium' },
  { key: 'advanced', label: 'Advanced' },
];

/* Small +/- stepper used for anything mark- or count-related — nicer to
   tap than a bare number input, while still accepting typed values. */
function Stepper({ value, onChange, min = 0, max, step = 1, className = '', title }) {
  const clamp = (v) => {
    let n = parseFloat(v);
    if (Number.isNaN(n)) n = min;
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    return step >= 1 ? Math.round(n) : Math.round(n * 100) / 100;
  };
  return (
    <div className={`qm2-stepper ${className}`} title={title}>
      <button type="button" onClick={() => onChange(clamp((Number(value) || 0) - step))} aria-label="Decrease">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number" value={value} step={step} min={min} max={max}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onChange(clamp(e.target.value))}
      />
      <button type="button" onClick={() => onChange(clamp((Number(value) || 0) + step))} aria-label="Increase">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function blankQuestion(type = 'mcq') {
  const base = { _key: Math.random().toString(36).slice(2), type, question_text: '', marks: 1 };
  if (type === 'mcq') return { ...base, options: [{ key: 'A', text: '' }, { key: 'B', text: '' }], correct_answer: [] };
  if (type === 'true_false') return { ...base, correct_answer: 'true' };
  if (type === 'fill_gap') return { ...base, correct_answer: [''] };
  if (type === 'matching') return { ...base, pairs: [{ left: '', right: '' }, { left: '', right: '' }] };
  return { ...base, correct_answer: '' }; // open — reference answer only, for the teacher's own use while grading
}

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function QuizBuilderModal({ assessment, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [questions, setQuestions] = useState([]);

  // 'manual' shows the question-by-question editor (existing behaviour).
  // 'ai' shows the generation form; once generation succeeds we drop back
  // to 'manual' so the teacher reviews/edits the AI output with the exact
  // same controls used for hand-built questions.
  const [builderMode, setBuilderMode] = useState('manual');
  const [generating, setGenerating] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [bulkMarks, setBulkMarks] = useState(1);
  const [aiForm, setAiForm] = useState({
    topic: assessment.course_id?.name || assessment.title || '',
    references: '',
    complexity: 'medium',
    counts: { mcq: 0, true_false: 0, fill_gap: 0, matching: 0, open: 0 },
  });

  const moduleWeight = assessment.course_id?.total_marks || 100;
  const aiQuestionTotal = Object.values(aiForm.counts).reduce((s, n) => s + (Number(n) || 0), 0);

  const updateAiCount = (type, value) => {
    setAiForm(f => ({ ...f, counts: { ...f.counts, [type]: value } }));
  };

  const handleGenerate = async () => {
    if (!aiForm.topic.trim()) return toast.error('Enter a topic for the AI to write questions about.');
    if (aiQuestionTotal === 0) return toast.error('Set at least one question count in the mix below.');

    setGenerating(true);
    try {
      const { data } = await api.post(`/assessment/teacher/assessments/${assessment.id}/questions/generate`, {
        topic: aiForm.topic.trim(),
        references: aiForm.references.trim(),
        complexity: aiForm.complexity,
        counts: aiForm.counts,
      });
      const generated = (data.questions || []).map(q => ({ ...blankQuestion(q.type), ...q, _key: Math.random().toString(36).slice(2) }));
      if (!generated.length) return toast.error('The AI did not return any questions — try adjusting the topic or mix.');
      setQuestions(generated);
      setBuilderMode('manual');
      setJustGenerated(true);
      toast.success(`Generated ${generated.length} question${generated.length !== 1 ? 's' : ''}. Review and edit before saving.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/assessment/teacher/assessments/${assessment.id}/questions`);
        if (!alive) return;
        setLocked(!!data.locked);
        setQuestions(
          data.questions.length
            ? data.questions.map(q => ({ ...q, _key: q.id }))
            : [blankQuestion('mcq')]
        );
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load questions');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [assessment.id]);

  const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  const updateQuestion = (key, patch) => {
    setQuestions(qs => qs.map(q => (q._key === key ? { ...q, ...patch } : q)));
  };
  const changeType = (key, type) => {
    setQuestions(qs => qs.map(q => (q._key === key ? { ...blankQuestion(type), _key: key, question_text: q.question_text, marks: q.marks } : q)));
  };
  const addQuestion = () => setQuestions(qs => [...qs, blankQuestion('mcq')]);
  const removeQuestion = (key) => setQuestions(qs => (qs.length > 1 ? qs.filter(q => q._key !== key) : qs));

  const addOption = (key) => {
    setQuestions(qs => qs.map(q => {
      if (q._key !== key) return q;
      const nextKey = OPTION_KEYS[q.options.length] || `Opt${q.options.length + 1}`;
      return { ...q, options: [...q.options, { key: nextKey, text: '' }] };
    }));
  };
  const removeOption = (key, optKey) => {
    setQuestions(qs => qs.map(q => (q._key === key
      ? { ...q, options: q.options.filter(o => o.key !== optKey), correct_answer: (q.correct_answer || []).filter(k => k !== optKey) }
      : q)));
  };
  const toggleCorrectOption = (key, optKey) => {
    setQuestions(qs => qs.map(q => {
      if (q._key !== key) return q;
      const has = (q.correct_answer || []).includes(optKey);
      return { ...q, correct_answer: has ? q.correct_answer.filter(k => k !== optKey) : [...(q.correct_answer || []), optKey] };
    }));
  };

  const addPair = (key) => setQuestions(qs => qs.map(q => (q._key === key ? { ...q, pairs: [...q.pairs, { left: '', right: '' }] } : q)));
  const removePair = (key, idx) => setQuestions(qs => qs.map(q => (q._key === key ? { ...q, pairs: q.pairs.filter((_, i) => i !== idx) } : q)));
  const updatePair = (key, idx, side, value) => setQuestions(qs => qs.map(q => {
    if (q._key !== key) return q;
    const pairs = q.pairs.map((p, i) => (i === idx ? { ...p, [side]: value } : p));
    return { ...q, pairs };
  }));

  const handleSave = async () => {
    for (const q of questions) {
      if (!q.question_text.trim()) return toast.error('Every question needs question text.');
      if (!q.marks || Number(q.marks) <= 0) return toast.error('Every question needs marks greater than 0.');
      if (q.type === 'mcq' && (!q.correct_answer || q.correct_answer.length === 0)) return toast.error('Select the correct option for every multiple choice question.');
      if (q.type === 'fill_gap' && !(q.correct_answer || []).some(a => a.trim())) return toast.error('Add at least one expected answer for every fill-in-the-gap question.');
      if (q.type === 'matching' && q.pairs.some(p => !p.left.trim() || !p.right.trim())) return toast.error('Fill in every matching pair.');
    }

    setSaving(true);
    try {
      const payload = questions.map(({ _key, id, ...q }) => ({
        ...q,
        marks: Number(q.marks),
        correct_answer: q.type === 'fill_gap' ? (q.correct_answer || []).filter(a => a.trim()) : q.correct_answer,
      }));
      await api.post(`/assessment/teacher/assessments/${assessment.id}/questions`, { questions: payload });
      toast.success('Questions saved.');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save questions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true} onClose={onClose}
      title={`Build Questions — ${assessment.title}`} size="xl"
      icon={ClipboardList} accent="#6366f1" accent2="#8b5cf6"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : (
        <div className="space-y-4">
          {!locked && (
            <div className="qm2-segmented">
              <span className="qm2-segmented-thumb" style={{ left: builderMode === 'manual' ? '4px' : 'calc(50% + 1px)', width: 'calc(50% - 5px)' }} />
              <button type="button" onClick={() => setBuilderMode('manual')} className={builderMode === 'manual' ? 'active' : ''}>
                <PencilLine className="w-4 h-4" /> Manual Creation
              </button>
              <button type="button" onClick={() => setBuilderMode('ai')} className={builderMode === 'ai' ? 'active' : ''}>
                <Sparkles className="w-4 h-4" /> AI Generation
              </button>
            </div>
          )}

          {builderMode === 'ai' && !locked && (
            <div className="card p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Topic</label>
                <input
                  value={aiForm.topic}
                  onChange={e => setAiForm(f => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. Cell division and mitosis"
                  className="chat-form-field qm-field w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>References (optional)</label>
                <textarea
                  value={aiForm.references}
                  onChange={e => setAiForm(f => ({ ...f, references: e.target.value }))}
                  placeholder="Paste links, textbook chapters, or notes to keep the questions precise — one per line"
                  rows={2}
                  className="chat-form-field qm-field w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>Question mix</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {QUESTION_TYPES.map(t => (
                    <div key={t.key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl" style={{ border: '1px solid var(--card-border)' }}>
                      <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <t.icon className="w-3.5 h-3.5" style={{ color: t.color }} /> {t.label}
                      </span>
                      <Stepper
                        value={aiForm.counts[t.key]}
                        onChange={v => updateAiCount(t.key, v)}
                        min={0} step={1}
                        className="w-24 flex-shrink-0"
                        title={`Number of ${t.label} questions`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>Complexity</label>
                <div className="flex gap-2">
                  {COMPLEXITY_LEVELS.map(c => (
                    <button key={c.key} type="button" onClick={() => setAiForm(f => ({ ...f, complexity: c.key }))}
                      className={`qm2-pill-btn flex-1 py-1.5 rounded-xl text-sm font-semibold border-2 ${aiForm.complexity === c.key ? 'active' : ''}`}
                      style={{
                        borderColor: aiForm.complexity === c.key ? '#10b981' : 'var(--card-border)',
                        background: aiForm.complexity === c.key ? 'rgba(16,185,129,0.12)' : 'transparent',
                        color: aiForm.complexity === c.key ? '#10b981' : 'var(--text-secondary)',
                      }}>{c.label}</button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={handleGenerate} disabled={generating}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Searching sources and drafting…' : `Generate ${aiQuestionTotal || ''} Question${aiQuestionTotal !== 1 ? 's' : ''}`}
              </button>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Powered by Google's free Gemini API. It drafts questions from its own subject knowledge plus anything you paste into References above — it doesn't browse the web live, so for the most accurate results paste in key facts, definitions, or links yourself. Review and edit everything on the Manual Creation tab before saving — nothing is saved automatically.
              </p>
            </div>
          )}

          {builderMode === 'manual' && locked && (
            <div className="p-3 rounded-xl text-sm flex items-start gap-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <Lock className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p style={{ color: 'var(--text-secondary)' }}>
                Questions are locked — one or more students have already submitted an attempt for this assessment.
              </p>
            </div>
          )}

          {builderMode === 'manual' && (
          <>
          {justGenerated && !locked && (
            <div className="p-3 rounded-xl text-sm flex flex-wrap items-center gap-2"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Set marks for every generated question at once:</span>
              <Stepper value={bulkMarks} onChange={setBulkMarks} min={0.5} step={0.5} className="w-28" title="Marks per question" />
              <button type="button"
                onClick={() => {
                  const m = Number(bulkMarks);
                  if (!m || m <= 0) return toast.error('Enter a mark value greater than 0.');
                  setQuestions(qs => qs.map(q => ({ ...q, marks: m })));
                  toast.success(`Set ${m} mark${m !== 1 ? 's' : ''} on every question.`);
                }}
                className="btn-secondary text-sm py-1 px-3"
              >
                Apply to all
              </button>
              <button type="button" onClick={() => setJustGenerated(false)}
                className="ml-auto text-xs underline" style={{ color: 'var(--text-secondary)' }}>
                Dismiss
              </button>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Total Marks (what you've built so far) vs Module Weight (the fixed
             ceiling results get scaled onto) — kept as two distinctly styled
             chips on purpose, so they never read as the same number. */}
          <div className="qm-stats-row">
            <div className="qm-stat-chip qm-stat-chip-marks">
              <span className="qm-stat-icon"><PenLine className="w-4 h-4" /></span>
              <div className="min-w-0">
                <span className="qm-stat-label">Total Marks (this paper)</span>
                <span className="qm-stat-value"><span key={totalMarks} className="qm2-count">{totalMarks}</span></span>
              </div>
            </div>
            <div className="qm-stat-chip qm-stat-chip-weight">
              <span className="qm-stat-icon"><Scale className="w-4 h-4" /></span>
              <div className="min-w-0">
                <span className="qm-stat-label">Module Weight (fixed)</span>
                <span className="qm-stat-value"><span key={moduleWeight} className="qm2-count">{moduleWeight}</span></span>
              </div>
            </div>
          </div>

          {totalMarks > moduleWeight ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Your questions add up to more than the module weight — that's fine, a student's raw score is automatically scaled down onto the {moduleWeight}-mark module weight when results are calculated.
            </p>
          ) : totalMarks > 0 && totalMarks < moduleWeight ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Your questions add up to less than the module weight — that's fine too, a student's raw score is automatically scaled up onto the {moduleWeight}-mark module weight when results are calculated.
            </p>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Total Marks is calculated automatically from each question below — it doesn't need to match the Module Weight exactly; results are always scaled onto it.
            </p>
          )}

          <fieldset disabled={locked} className="space-y-4">
            {questions.map((q, idx) => {
              const qColor = QUESTION_TYPES.find(t => t.key === q.type)?.color || '#6366f1';
              return (
              <div key={q._key} className="qm-question-card card p-4" style={{ '--qi': idx, '--qm-q-color': qColor }}>
                <div className="flex items-start gap-2 mb-3">
                  <GripVertical className="qm-drag-handle w-4 h-4 mt-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs font-bold mt-2" style={{ color: qColor }}>Q{idx + 1}</span>
                  <select
                    value={q.type}
                    onChange={e => changeType(q._key, e.target.value)}
                    className="chat-form-field qm-field text-sm py-1.5 px-2 w-44"
                  >
                    {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                  <Stepper
                    value={q.marks}
                    onChange={v => updateQuestion(q._key, { marks: v })}
                    min={0.5} step={0.5}
                    className="w-28"
                    title="Marks for this question"
                  />
                  <button type="button" onClick={() => removeQuestion(q._key)}
                    className="ml-auto p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <textarea
                  value={q.question_text}
                  onChange={e => updateQuestion(q._key, { question_text: e.target.value })}
                  placeholder="Type the question here…"
                  rows={2}
                  className="chat-form-field w-full text-sm mb-3"
                />

                {q.type === 'mcq' && (
                  <div className="space-y-2">
                    {q.options.map(opt => (
                      <div key={opt.key} className="flex items-center gap-2">
                        <button type="button" onClick={() => toggleCorrectOption(q._key, opt.key)}
                          className={`qm-correct-toggle w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border-2 ${(q.correct_answer || []).includes(opt.key) ? 'qm-correct-toggle-active' : ''}`}
                          style={{
                            borderColor: (q.correct_answer || []).includes(opt.key) ? '#10b981' : 'var(--card-border)',
                            background: (q.correct_answer || []).includes(opt.key) ? '#10b981' : 'transparent',
                            color: (q.correct_answer || []).includes(opt.key) ? '#fff' : 'var(--text-secondary)',
                          }}
                          title="Mark as correct answer">{opt.key}</button>
                        <input
                          value={opt.text}
                          onChange={e => updateQuestion(q._key, { options: q.options.map(o => (o.key === opt.key ? { ...o, text: e.target.value } : o)) })}
                          placeholder={`Option ${opt.key}`}
                          className="chat-form-field flex-1 text-sm"
                        />
                        {q.options.length > 2 && (
                          <button type="button" onClick={() => removeOption(q._key, opt.key)} className="p-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    ))}
                    {q.options.length < 6 && (
                      <button type="button" onClick={() => addOption(q._key)} className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                        <Plus className="w-3.5 h-3.5" /> Add option
                      </button>
                    )}
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Click a letter to mark it as a correct answer (select more than one for multi-select).</p>
                  </div>
                )}

                {q.type === 'true_false' && (
                  <div className="flex gap-2">
                    {['true', 'false'].map(v => (
                      <button key={v} type="button" onClick={() => updateQuestion(q._key, { correct_answer: v })}
                        className="px-4 py-1.5 rounded-xl text-sm font-semibold border-2 transition-colors capitalize"
                        style={{
                          borderColor: q.correct_answer === v ? '#10b981' : 'var(--card-border)',
                          background: q.correct_answer === v ? 'rgba(16,185,129,0.12)' : 'transparent',
                          color: q.correct_answer === v ? '#10b981' : 'var(--text-secondary)',
                        }}>{v}</button>
                    ))}
                  </div>
                )}

                {q.type === 'fill_gap' && (
                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Accepted answer(s) — student's answer matches if it exactly matches any one of these (not case-sensitive).</p>
                    {(q.correct_answer || ['']).map((ans, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={ans}
                          onChange={e => updateQuestion(q._key, { correct_answer: q.correct_answer.map((a, ai) => (ai === i ? e.target.value : a)) })}
                          placeholder="Expected answer"
                          className="chat-form-field flex-1 text-sm"
                        />
                        {q.correct_answer.length > 1 && (
                          <button type="button" onClick={() => updateQuestion(q._key, { correct_answer: q.correct_answer.filter((_, ai) => ai !== i) })} className="p-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => updateQuestion(q._key, { correct_answer: [...(q.correct_answer || []), ''] })} className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Plus className="w-3.5 h-3.5" /> Add alternative answer
                    </button>
                  </div>
                )}

                {q.type === 'matching' && (
                  <div className="space-y-2">
                    {q.pairs.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={p.left} onChange={e => updatePair(q._key, i, 'left', e.target.value)} placeholder="Item" className="chat-form-field flex-1 text-sm" />
                        <span style={{ color: 'var(--text-secondary)' }}>→</span>
                        <input value={p.right} onChange={e => updatePair(q._key, i, 'right', e.target.value)} placeholder="Correct match" className="chat-form-field flex-1 text-sm" />
                        {q.pairs.length > 2 && (
                          <button type="button" onClick={() => removePair(q._key, i)} className="p-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addPair(q._key)} className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Plus className="w-3.5 h-3.5" /> Add pair
                    </button>
                  </div>
                )}

                {q.type === 'open' && (
                  <div className="space-y-1">
                    <textarea
                      value={q.correct_answer || ''}
                      onChange={e => updateQuestion(q._key, { correct_answer: e.target.value })}
                      placeholder="Model answer (for your reference only — not shared with students, not auto-graded)"
                      rows={2}
                      className="chat-form-field w-full text-sm"
                    />
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Open questions are graded manually by you after a student submits.</p>
                  </div>
                )}
              </div>
              );
            })}

            <button type="button" onClick={addQuestion}
              className="qm-add-question-btn w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
              <Plus className="w-4 h-4" /> Add question
            </button>
          </fieldset>
          </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            {!locked && builderMode === 'manual' && (
              <button onClick={handleSave} disabled={saving} className={`btn-primary flex items-center gap-2 ${!saving ? 'qm2-cta-ready' : ''}`}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Questions
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}