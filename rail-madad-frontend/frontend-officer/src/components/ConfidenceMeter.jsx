import React from 'react';

export default function ConfidenceMeter({ value, threshold = 70 }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 bg-slate-150 rounded-full overflow-hidden bg-slate-200">
        <div className="h-full bg-slate-900 rounded-full" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-9 text-right">{value}%</span>
    </div>
  );
}
