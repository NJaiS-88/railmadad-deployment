import React from 'react';

const LABELS = { high: 'High priority', medium: 'Medium priority', low: 'Routine' };

// Priority shown as filled signal bars + weight, never as a red/amber/green
// traffic light. Urgency reads through fill + boldness, not hue.
export default function PriorityTag({ level = 'low', compact = false }) {
  const key = (level || 'low').toLowerCase();
  const filled = key === 'high' ? 3 : key === 'medium' ? 2 : 1;
  const isHigh = key === 'high';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        isHigh ? 'font-bold text-slate-900' : 'font-medium text-slate-500'
      } text-xs`}
    >
      <span className="flex items-end gap-[2px] h-3">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-[3px] rounded-sm ${bar <= filled ? 'bg-slate-900' : 'bg-slate-200'}`}
            style={{ height: `${bar * 3 + 3}px` }}
          />
        ))}
      </span>
      {!compact && <span>{LABELS[key]}</span>}
    </span>
  );
}
