import React from 'react';
import { CheckCircle2, Clock, ArrowUpCircle, Layers, Wrench } from 'lucide-react';

// Status conveyed with icon + fill weight, not a semantic color scale.
// Inverted (dark) fill = needs attention now; outline = everything else.
const CONFIG = {
  'resolved': { icon: CheckCircle2, style: 'outline' },
  'auto-routed': { icon: CheckCircle2, style: 'outline' },
  'officer-reviewed': { icon: CheckCircle2, style: 'outline' },
  'pending': { icon: Clock, style: 'outline' },
  'awaiting confirmation': { icon: Layers, style: 'solid' },
  'escalated': { icon: ArrowUpCircle, style: 'solid' },
  'in progress': { icon: Wrench, style: 'outline' },
};

export default function StatusTag({ status }) {
  const key = (status || '').toLowerCase();
  const cfg = CONFIG[key] || { icon: Clock, style: 'outline' };
  const Icon = cfg.icon;
  const solid = cfg.style === 'solid';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
        solid
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 border-slate-200'
      }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {status}
    </span>
  );
}
