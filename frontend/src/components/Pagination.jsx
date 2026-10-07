import React from "react";

export const PAGE_SIZE = 15;

// "Showing 16–30 of 47"  [Previous] [Next]
const Pagination = ({ page, total, limit = PAGE_SIZE, onChange }) => {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1, to = Math.min(total, page * limit);
  return (
    <nav aria-label="Pagination" data-testid="pagination" className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm print:hidden">
      <span className="text-muted">Showing {from}–{to} of {total}</span>
      {pages > 1 && (
        <span className="flex items-center gap-2">
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Previous</button>
          <span className="px-2 text-muted">Page {page} of {pages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next →</button>
        </span>
      )}
    </nav>
  );
};
export default Pagination;
