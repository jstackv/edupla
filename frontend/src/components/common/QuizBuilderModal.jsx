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
  PenLine, Shuffle, MessageSquareText, Lock, Loader2,
} from 'lucide-react';

const QUESTION_TYPES = [
  { key: 'mcq',        label: 'Multiple Choice', icon: ListChecks },
  { key: 'true_false',  label: 'True / False',    icon: ToggleLeft },
  { key: 'fill_gap',    label: 'Fill in the Gap', icon: PenLine },
  { key: 'matching',    label: 'Matching',        icon: Shuffle },
  { key: 'open',        label: 'Open Question',   icon: MessageSquareText },
];

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

  const moduleWeight = assessment.course_id?.total_marks || 100;

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
  const overWeight = totalMarks > moduleWeight;

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
    if (overWeight) return toast.error(`Total question marks (${totalMarks}) exceed the module weight (${moduleWeight}). Reduce some question marks first.`);

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
    <Modal isOpen={true} onClose={onClose} title={`Build Questions — ${assessment.title}`} size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : (
        <div className="space-y-4">
          {locked && (
            <div className="p-3 rounded-xl text-sm flex items-start gap-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <Lock className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p style={{ color: 'var(--text-secondary)' }}>
                Questions are locked — one or more students have already submitted an attempt for this assessment.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
            <span className="font-semibold flex items-center gap-1.5" style={{ color: overWeight ? '#ef4444' : 'var(--text-primary)' }}>
              Total marks: {totalMarks} / {moduleWeight} MW
            </span>
          </div>
          {overWeight && (
            <p className="text-xs -mt-2" style={{ color: '#ef4444' }}>
              This exceeds the module weight ({moduleWeight} marks) — reduce some question marks before saving.
            </p>
          )}
          <p className="text-xs -mt-2" style={{ color: 'var(--text-secondary)' }}>
            The assessment's maximum is calculated automatically from these question marks — no need to set it separately.
          </p>

          <fieldset disabled={locked} className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q._key} className="card p-4">
                <div className="flex items-start gap-2 mb-3">
                  <GripVertical className="w-4 h-4 mt-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs font-bold mt-2" style={{ color: 'var(--text-secondary)' }}>Q{idx + 1}</span>
                  <select
                    value={q.type}
                    onChange={e => changeType(q._key, e.target.value)}
                    className="chat-form-field text-sm py-1.5 px-2 w-44"
                  >
                    {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                  <input
                    type="number" min="1" step="0.5"
                    value={q.marks}
                    onChange={e => updateQuestion(q._key, { marks: e.target.value })}
                    className="chat-form-field text-sm py-1.5 px-2 w-20"
                    placeholder="Marks"
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
                          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border-2 transition-colors"
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
            ))}

            <button type="button" onClick={addQuestion}
              className="w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
              <Plus className="w-4 h-4" /> Add question
            </button>
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            {!locked && (
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
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