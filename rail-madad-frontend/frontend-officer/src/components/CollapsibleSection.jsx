import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CollapsibleSection({ title, subtitle, count, icon: Icon, emphasized, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`bg-white rounded-xl border overflow-hidden ${
        emphasized ? 'border-slate-900' : 'border-slate-200'
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className={`w-4 h-4 ${emphasized ? 'text-slate-900' : 'text-slate-400'}`} />}
          <span className={`text-sm ${emphasized ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
            {title}
          </span>
          <span
            className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
              emphasized ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {count}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {subtitle && <span className="text-[11px] text-slate-400 font-medium hidden sm:block">{subtitle}</span>}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && <div className="border-t border-slate-200">{children}</div>}
    </div>
  );
}
