import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1));

  return (
    <div className="flex items-center justify-center gap-1">
      <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
        className="p-2 rounded-xl btn-secondary disabled:opacity-40">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) => {
        const prev = pages[i - 1];
        return [
          prev && p - prev > 1 ? <span key={`gap-${p}`} className="px-2 text-muted text-sm">…</span> : null,
          <button key={p} onClick={() => onPageChange(p)}
            className={`w-8 h-8 rounded-xl text-sm font-semibold transition-all ${p === page ? 'btn-primary' : 'btn-secondary'}`}>
            {p}
          </button>
        ];
      })}
      <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
        className="p-2 rounded-xl btn-secondary disabled:opacity-40">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
