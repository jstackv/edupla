import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { BookMarked, Users, FileText, User } from 'lucide-react';

const LEVEL_CLASSES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
];
const TRADE_CLASSES = [
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
];
// Returns a Tailwind class string for any arbitrary level/trade value
const getLevelClass = (val) => LEVEL_CLASSES[(val?.charCodeAt(0) || 0) % LEVEL_CLASSES.length];
const getTradeClass = (val) => TRADE_CLASSES[(val?.charCodeAt(0) || 0) % TRADE_CLASSES.length];

export default function StudentClasses() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/classes/my')
      .then(r => setClasses(r.data.classes || []))
      .catch(() => toast.error('Failed to load classes'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>My Classes</h2>
        <p className="text-sm text-muted">{classes.length} class{classes.length !== 1 ? 'es' : ''} enrolled</p>
      </div>

      {classes.length === 0 ? (
        <div className="card text-center py-16">
          <BookMarked className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No classes yet</p>
          <p className="text-sm text-muted">Your teacher will enroll you in classes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(cls => (
            <div key={cls.id} className="card hover:shadow-soft transition-all hover:-translate-y-0.5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                  <BookMarked className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{cls.name}</h3>
                  {cls.description && (
                    <p className="text-xs text-muted line-clamp-2 mt-0.5">{cls.description}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {cls.level && <span className={`badge text-xs ${getLevelClass(cls.level) || ''}`}>{cls.level}</span>}
                {cls.trade && <span className={`badge text-xs ${getTradeClass(cls.trade) || ''}`}>{cls.trade}</span>}
              </div>
              <div className="pt-3 space-y-2" style={{ borderTop: '1px solid var(--card-border)' }}>
                {cls.teacher_name && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <User className="w-3.5 h-3.5" />
                    <span>{cls.teacher_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Users className="w-3.5 h-3.5" />
                  <span>{cls.student_count || 0} student{cls.student_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
