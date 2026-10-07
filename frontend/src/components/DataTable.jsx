import React from "react";

const DataTable = ({ columns, rows, emptyText = "No records found." }) => {
  if (!rows || rows.length === 0) {
    return <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-muted">{emptyText}</div>;
  }
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col) => (
              <th key={col.key} className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wide whitespace-nowrap">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={row._id || i} className="hover:bg-slate-50/60 transition">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-ink align-middle">{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default DataTable;
