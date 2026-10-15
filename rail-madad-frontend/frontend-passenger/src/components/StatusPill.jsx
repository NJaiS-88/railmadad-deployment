import React from 'react';

export default function StatusPill({ status }) {
  const cleanStatus = status ? status.toLowerCase() : 'pending';
  let bgClass = 'bg-gray-100 text-gray-700 border-gray-200';

  if (cleanStatus === 'resolved' || cleanStatus === 'completed' || cleanStatus === 'verified' || cleanStatus === 'active') {
    bgClass = 'bg-green-50 text-green-700 border-green-200';
  } else if (cleanStatus === 'pending' || cleanStatus === 'submitted') {
    bgClass = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (cleanStatus === 'routed to department' || cleanStatus === 'in progress' || cleanStatus === 'routed') {
    bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (cleanStatus === 'flagged' || cleanStatus === 'failed' || cleanStatus === 'rejected') {
    bgClass = 'bg-red-50 text-red-700 border-red-200';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${bgClass}`}>
      {status}
    </span>
  );
}
