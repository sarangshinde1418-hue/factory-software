import React from 'react';

interface BadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, label, size = 'md' }) => {
  const norm = (status || '').toLowerCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (['active', 'approved', 'passed', 'completed', 'in_stock'].includes(norm)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['in_production', 'running', 'receipt'].includes(norm)) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['planned', 'draft', 'pending', 'quarantine', 'qa_pending'].includes(norm)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['archived', 'cancelled', 'rejected', 'out_of_stock', 'shortage', 'wastage'].includes(norm)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['issue', 'dispatch'].includes(norm)) {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (['adjustment', 'opening'].includes(norm)) {
    colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  const displayLabel = label || status.replace(/_/g, ' ').toUpperCase();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${padding} ${colorClasses} tracking-wider font-semibold uppercase`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {displayLabel}
    </span>
  );
};
