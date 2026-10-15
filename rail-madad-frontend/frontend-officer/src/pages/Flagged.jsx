import React, { useEffect, useState } from 'react';
import { X, MapPin, ScanLine, Check, Ban, ShieldAlert, ShieldCheck, RotateCcw, AlertOctagon } from 'lucide-react';
import { getFlaggedComplaints, resolveFlagged, unrejectFlagged } from '../api/officerClient';
import NearbyStaffList from '../components/NearbyStaffList';

const DEPARTMENTS = [
  'Mechanical',
  'Electrical',
  'Commercial/Catering',
  'Cleanliness/Housekeeping',
  'Civil/Infrastructure',
  'RPF/Security',
  'Medical/Health',
  'Operations/Train Control',
  'Station Administration',
  'Ticket Checking',
  'IT/Systems',
  'Safety',
];

function DetailPanel({ item, onClose, onResolve, onUnreject, assignedStaffId, onAssign }) {
  if (!item) return null;
  const [department, setDepartment] = useState(item.department || DEPARTMENTS[0]);
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-end z-30" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-white border-l border-slate-200 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{item.id}</p>
            <h2 className="text-sm font-black text-slate-900">{item.description}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {item.autoRejected ? (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertOctagon className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-black text-red-600">Auto-rejected — unrelated issue</p>
                  <p className="text-xs text-red-500 mt-1">{item.rejectionReason}</p>
                  <p className="text-[11px] text-red-400 mt-1">
                    This complaint was automatically closed because it was not related to a railway issue.
                    You can un-reject it and assign a department manually if it looks legitimate.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Assign department</p>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <img src={item.imageUrl} alt="" className="w-full h-44 object-cover rounded-lg border border-slate-200" />

              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Claimed vs detected location</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Claimed</p>
                      <p className="text-xs font-semibold text-slate-700">{item.claimedLocation}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-900">
                    <MapPin className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-300 uppercase">Detected from photo metadata</p>
                      <p className="text-xs font-semibold text-white">{item.detectedLocation}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-900 mt-2">{item.distanceKm} km apart</p>
              </div>

              {item.ocrMismatch && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Coach number OCR check</p>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                    <ScanLine className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    Claimed coach <span className="font-black">{item.ocrMismatch.claimed}</span>, photo reads <span className="font-black">{item.ocrMismatch.detected}</span>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">If approved, assign to</p>
                <NearbyStaffList
                  department={item.department}
                  seed={item.id}
                  assignedId={assignedStaffId}
                  onAssign={onAssign}
                />
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 flex gap-2 sticky bottom-0 bg-white">
          {item.autoRejected ? (
            <button
              onClick={() => onUnreject(item, department)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
            >
              <RotateCcw className="w-4 h-4" /> Un-reject & assign department
            </button>
          ) : (
            <>
              <button
                onClick={() => onResolve(item, 'approve')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
              >
                <Check className="w-4 h-4" /> Approve anyway
              </button>
              <button
                onClick={() => onResolve(item, 'reject')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Ban className="w-4 h-4" /> Reject as invalid
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Flagged() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    getFlaggedComplaints().then(setItems);
  }, []);

  const handleResolve = async (item, action) => {
    await resolveFlagged(item.id, action);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setSelected(null);
  };

  const handleUnreject = async (item, department) => {
    await unrejectFlagged(item.id, department);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setSelected(null);
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-black text-slate-900">Flagged complaints</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          {items.length} complaint{items.length !== 1 ? 's' : ''} with a location or coach mismatch, or auto-rejected as unrelated — check before routing
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Complaint</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Claimed train / coach</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Distance mismatch</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Coach OCR check</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wide text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-b-0 border-l-4 border-l-slate-900">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 max-w-xs">
                    <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.description}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.id} · {item.submittedAgo}</p>
                      {item.autoRejected && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-500 mt-1">
                          <AlertOctagon className="w-3 h-3" /> Auto-rejected — unrelated
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-700">{item.train}</p>
                  <p className="text-[11px] text-slate-400">{item.trainName} · Coach {item.coach}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-900">
                    <ShieldAlert className="w-3.5 h-3.5" /> {item.distanceKm} km
                  </span>
                </td>
                <td className="px-4 py-3">
                  {item.ocrMismatch ? (
                    <span className="text-xs font-semibold text-slate-700">
                      {item.ocrMismatch.claimed} → {item.ocrMismatch.detected}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> matches
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelected(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                  >
                    Investigate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="p-10 text-center">
            <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No flagged complaints</p>
            <p className="text-xs text-slate-400 mt-1">Every recent complaint's location and coach details checked out.</p>
          </div>
        )}
      </div>

      <DetailPanel
        item={selected}
        onClose={() => setSelected(null)}
        onResolve={handleResolve}
        onUnreject={handleUnreject}
        assignedStaffId={selected ? assignments[selected.id] : null}
        onAssign={(staff) => setAssignments((prev) => ({ ...prev, [selected.id]: staff.id }))}
      />
    </div>
  );
}
