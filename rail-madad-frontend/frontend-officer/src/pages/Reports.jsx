import React, { useEffect, useMemo, useState } from 'react';
import { Download, Search, FileText, Star, MessageSquare } from 'lucide-react';
import { getResolvedComplaints } from '../api/officerClient';
import StatusTag from '../components/StatusTag';

function RatingStars({ value }) {
  if (!value || typeof value !== 'number') return <span className="text-xs text-slate-300 font-semibold">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3 h-3 ${star <= Math.round(value) ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
        />
      ))}
      <span className="ml-1 text-[10px] font-bold text-slate-500">{value}</span>
    </span>
  );
}

export default function Reports() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');

  useEffect(() => {
    getResolvedComplaints().then(setItems);
  }, []);

  const departments = useMemo(
    () => ['All', ...new Set(items.map((i) => i.department))],
    [items]
  );

  const filtered = items.filter((i) => {
    const matchesQuery =
      query.trim() === '' ||
      i.id.toLowerCase().includes(query.toLowerCase()) ||
      i.category.toLowerCase().includes(query.toLowerCase()) ||
      i.train.includes(query);
    const matchesDept = department === 'All' || i.department === department;
    return matchesQuery && matchesDept;
  });

  const handleExport = () => {
    const header = 'ID,Category,Train,Coach,Department,Resolved by,Status,Resolved,Resolution Time (hrs),Rating,Feedback\n';
    const rows = filtered
      .map((i) => [
        i.id, i.category, i.train, i.coach, i.department, i.staffName || 'Rail Staff', i.status,
        i.resolvedAgo, i.resolutionTimeHrs,
        i.passengerFeedback?.rating || '',
        (i.passengerFeedback?.comment || '').replace(/,/g, ';')
      ].join(','))
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rail-madad-reports.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-black text-slate-900">Reports</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Resolved complaints for record-keeping</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, category, or train number"
            className="w-full pl-8 pr-3 py-2 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
          />
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="text-xs font-semibold border border-slate-300 rounded-md px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:border-slate-900"
        >
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">ID</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Category</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Train / coach</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Department</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Resolved by</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Rating</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Feedback</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Resolved</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Resolution time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-2.5 text-xs font-bold text-slate-700">{item.id}</td>
                <td className="px-4 py-2.5 text-xs font-medium text-slate-600">{item.category}</td>
                <td className="px-4 py-2.5 text-xs font-medium text-slate-600">{item.train} · {item.trainName} · {item.coach}</td>
                <td className="px-4 py-2.5 text-xs font-medium text-slate-600">{item.department}</td>
                <td className="px-4 py-2.5 text-xs font-bold text-slate-700">{item.staffName || 'Rail Staff'}</td>
                <td className="px-4 py-2.5"><RatingStars value={item.passengerFeedback?.rating} /></td>
                <td className="px-4 py-2.5">
                  {item.passengerFeedback?.comment ? (
                    <span className="inline-flex items-start gap-1 text-xs text-slate-600 max-w-[220px]">
                      <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                      <span className="truncate block" title={item.passengerFeedback.comment}>{item.passengerFeedback.comment}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 font-medium">No feedback</span>
                  )}
                </td>
                <td className="px-4 py-2.5"><StatusTag status={item.routeType} /></td>
                <td className="px-4 py-2.5 text-xs font-medium text-slate-500">{item.resolvedAgo}</td>
                <td className="px-4 py-2.5 text-xs font-medium text-slate-500">{item.resolutionTimeHrs} hr</td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="p-10 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No matching records</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search term or department filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
