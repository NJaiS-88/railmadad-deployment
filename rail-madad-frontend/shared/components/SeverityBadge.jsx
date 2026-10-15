import React from 'react';

export default function SeverityBadge({ level }) {
  const cleanLevel = level ? level.toLowerCase() : 'low';
  let bgClass = '';
  let textClass = 'Low';
  let dotClass = 'bg-green-500';

  if (cleanLevel === 'high') {
    bgClass = 'bg-red-50 text-red-700 border-red-200';
    textClass = 'High';
    dotClass = 'bg-red-500';
  } else if (cleanLevel === 'medium') {
    bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
    textClass = 'Medium';
    dotClass = 'bg-amber-500';
  } else {
    bgClass = 'bg-green-50 text-green-700 border-green-200';
    textClass = 'Low';
    dotClass = 'bg-green-500';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${bgClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotClass}`}></span>
      {textClass}
    </span>
  );
}
