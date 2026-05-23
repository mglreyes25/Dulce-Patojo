import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft size={16} /> Anterior
      </button>
      <div className="pagination-pages">
        {start > 1 && (
          <>
            <button className="pagination-page-btn" onClick={() => onPageChange(1)}>1</button>
            {start > 2 && <span className="pagination-ellipsis">...</span>}
          </>
        )}
        {pages.map(p => (
          <button
            key={p}
            className={`pagination-page-btn${p === currentPage ? ' active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="pagination-ellipsis">...</span>}
            <button className="pagination-page-btn" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
          </>
        )}
      </div>
      <button
        className="pagination-btn"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Siguiente <ChevronRight size={16} />
      </button>
    </div>
  );
}
