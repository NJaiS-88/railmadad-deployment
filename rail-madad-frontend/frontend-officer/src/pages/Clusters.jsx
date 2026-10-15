import React, { useEffect, useState } from 'react';
import { ChevronDown, Layers, CheckCircle2, ArrowUpCircle } from 'lucide-react';
import { getClusters, confirmCluster, escalateCluster } from '../api/officerClient';
import PriorityTag from '../components/PriorityTag';
import StatusTag from '../components/StatusTag';
import NearbyStaffList from '../components/NearbyStaffList';

export default function Clusters() {
  const [clusters, setClusters] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [staffOpenFor, setStaffOpenFor] = useState(null);
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    getClusters().then(setClusters);
  }, []);

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleConfirm = async (cluster) => {
    await confirmCluster(cluster.id);
    setClusters((prev) => prev.map((c) => (c.id === cluster.id ? { ...c, status: 'Confirmed' } : c)));
  };

  const handleEscalate = async (cluster) => {
    await escalateCluster(cluster.id);
    setClusters((prev) => prev.map((c) => (c.id === cluster.id ? { ...c, status: 'Escalated' } : c)));
    setStaffOpenFor(cluster.id);
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-black text-slate-900">Active incident clusters</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Duplicate reports auto-grouped by train, coach and category</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clusters.map((cluster) => (
          <div
            key={cluster.id}
            className={`bg-white rounded-xl border p-4 space-y-3 ${
              cluster.status === 'Escalated' ? 'border-slate-900' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{cluster.id}</p>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">{cluster.category}</h3>
                <p className="text-[11px] text-slate-500 font-medium">{cluster.train} · {cluster.trainName} · Coach {cluster.coach}</p>
              </div>
              <PriorityTag level={cluster.priority} compact />
            </div>

            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black text-slate-900 leading-none">{cluster.reports.length}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">reports merged</p>
              </div>
              <StatusTag status={cluster.status} />
            </div>

            <p className="text-[11px] text-slate-400 font-medium">First reported {cluster.firstReportedAgo}</p>

            <button
              onClick={() => toggle(cluster.id)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-600 border-t border-slate-100 pt-2.5"
            >
              <span className="inline-flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> View reports</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded[cluster.id] ? 'rotate-180' : ''}`} />
            </button>

            {expanded[cluster.id] && (
              <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                {cluster.reports.map((r) => (
                  <div key={r.id} className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2">
                    <p className="font-semibold text-slate-700">{r.excerpt}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{r.id} · {r.submittedAgo}</p>
                  </div>
                ))}
              </div>
            )}

            {cluster.status === 'Awaiting confirmation' && (
              <div className="flex gap-1.5 pt-1">
                <button
                  onClick={() => handleConfirm(cluster)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-slate-900 text-white hover:bg-slate-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirm as one incident
                </button>
                <button
                  onClick={() => handleEscalate(cluster)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" /> Escalate
                </button>
              </div>
            )}

            {staffOpenFor === cluster.id && (
              <div className="pt-1">
                <NearbyStaffList
                  department={cluster.department}
                  seed={cluster.id}
                  assignedId={assignments[cluster.id]}
                  onAssign={(staff) => setAssignments((prev) => ({ ...prev, [cluster.id]: staff.id }))}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {clusters.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No active clusters</p>
          <p className="text-xs text-slate-400 mt-1">No repeated reports have been grouped in the last few hours.</p>
        </div>
      )}
    </div>
  );
}
