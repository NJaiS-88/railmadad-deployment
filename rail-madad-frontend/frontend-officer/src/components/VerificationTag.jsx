import React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

export default function VerificationTag({ verified, detail }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-500 border border-slate-200">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
        Location verified{detail ? ` — ${detail}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-900 text-white border border-slate-900">
      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
      Verification mismatch{detail ? ` — ${detail}` : ''}
    </span>
  );
}
