import React, { useEffect, useState } from 'react';
import { ChevronDown, Users, MapPin } from 'lucide-react';
import { getMultiDeptComplaints, setPrimaryOwner } from '../api/officerClient';
import NearbyStaffList from '../components/NearbyStaffList';

function SlaCountdown({ slaHours, elapsedHours }) {
  const remaining = slaHours - elapsedHours;
  const breached = remaining < 0;
  return (
    <div className="text-right">
      <p className={`text-xs font-black ${breached ? 'text-slate-900' : 'text-slate-600'}`}>
        {breached ? `${Math.abs(remaining).toFixed(1)} hr over` : `${remaining.toFixed(1)} hr left`}
      </p>
      <p className="text-[10px] text-slate-400 font-semibold uppercase">of {slaHours} hr SLA</p>
    </div>
  );
}

export default function MultiDept() {
  const [items, setItems] = useState([]);
  const [staffOpenFor, setStaffOpenFor] = useState(null); // `${complaintId}:${department}`
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    getMultiDeptComplaints().then(setItems);
  }, []);

  const handleSetPrimary = async (item, department) => {
    await setPrimaryOwner(item.id, department);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, primaryOwner: department } : i)));
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-black text-slate-900">Multi-department complaints</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          {items.length} complaint{items.length !== 1 ? 's' : ''} tagged across more than one department — needs a lead assigned
        </p>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.id} · {item.submittedAgo}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{item.description}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {item.train} · {item.trainName} · Coach {item.coach}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Primary owner</p>
                <select
                  value={item.primaryOwner}
                  onChange={(e) => handleSetPrimary(item, e.target.value)}
                  className="mt-1 text-xs font-bold border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-slate-900"
                >
                  {item.tags.map((t) => (
                    <option key={t.department} value={t.department}>{t.department}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 grid gap-2 sm:grid-cols-2">
              {item.tags.map((t) => {
                const key = `${item.id}:${t.department}`;
                const isPrimary = item.primaryOwner === t.department;
                return (
                  <div key={t.department} className={`rounded-lg border p-2.5 ${isPrimary ? 'border-slate-900' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md ${
                          isPrimary ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isPrimary ? 'Primary' : 'Secondary — notified'} · {t.department}
                      </span>
                      <SlaCountdown slaHours={t.slaHours} elapsedHours={t.elapsedHours} />
                    </div>
                    <button
                      onClick={() => setStaffOpenFor(staffOpenFor === key ? null : key)}
                      className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-2 pt-2 border-t border-slate-100"
                    >
                      <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Nearby staff</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${staffOpenFor === key ? 'rotate-180' : ''}`} />
                    </button>
                    {staffOpenFor === key && (
                      <div className="mt-2">
                        <NearbyStaffList
                          department={t.department}
                          seed={key}
                          assignedId={assignments[key]}
                          onAssign={(staff) => setAssignments((prev) => ({ ...prev, [key]: staff.id }))}
                          limit={2}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No multi-department complaints</p>
          <p className="text-xs text-slate-400 mt-1">Nothing right now needs a shared owner across departments.</p>
        </div>
      )}
    </div>
  );
}
