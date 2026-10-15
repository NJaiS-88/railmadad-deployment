import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';

export default function VerificationBadge({ verified, distanceKm }) {
  if (verified) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
        <Check className="w-3.5 h-3.5 mr-1 text-green-600 flex-shrink-0" />
        <span className="mr-1 font-extrabold">Verified</span>
        <span className="text-green-600 font-normal">({distanceKm}km match)</span>
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
        <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-600 flex-shrink-0" />
        <span className="mr-1 font-extrabold">Flagged</span>
        <span className="text-red-600 font-normal">({distanceKm}km mismatch)</span>
      </span>
    );
  }
}
