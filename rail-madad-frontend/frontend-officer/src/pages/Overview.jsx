import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Clock3, HelpCircle, Layers, ArrowRight,
  ListChecks, AlertOctagon, CheckCircle2, ImageOff, Star, MessageSquare,
} from 'lucide-react';
import {
  getReviewQueue, getFlaggedComplaints, getClusters, getSlaBreaches,
  getDetailedSummary, submitClassificationOverride, confirmCluster, escalateSla,
  getResolvedComplaints,
} from '../api/officerClient';
import CollapsibleSection from '../components/CollapsibleSection';
import ConfidenceMeter from '../components/ConfidenceMeter';
import NearbyStaffList from '../components/NearbyStaffList';

function StatCard({ label, value, note, emphasized }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${emphasized ? 'border-slate-900' : 'border-slate-200'}`}>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-black mt-1 ${emphasized ? 'text-slate-900' : 'text-slate-800'}`}>{value}</p>
      {note && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{note}</p>}
    </div>
  );
}

function Thumb({ src }) {
  if (!src) {
    return (
      <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-4 h-4 text-slate-300" />
      </div>
    );
  }
  return <img src={src} alt="" className="w-11 h-11 rounded-lg object-cover border border-slate-200 flex-shrink-0" />;
}

function Row({ children, expanded }) {
  return (
    <div className={`px-4 py-3 border-b border-slate-100 last:border-b-0 ${expanded ? 'bg-slate-50/60' : ''}`}>
      {children}
    </div>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const [flagged, setFlagged] = useState([]);
  const [slaBreaches, setSlaBreaches] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [resolvedComplaints, setResolvedComplaints] = useState([]);
  const [summary, setSummary] = useState(null);
  const [openStaffFor, setOpenStaffFor] = useState(null); // id of row currently showing nearby staff
  const [assignments, setAssignments] = useState({}); // id -> staffId

  useEffect(() => {
    getFlaggedComplaints().then(setFlagged);
    getSlaBreaches().then(setSlaBreaches);
    getReviewQueue().then(setReviewQueue);
    getClusters().then((c) => setClusters(c.filter((cl) => cl.status === 'Awaiting confirmation')));
    getDetailedSummary().then(setSummary);
    getResolvedComplaints().then(setResolvedComplaints);
  }, []);

  const handleConfirmClassification = async (item) => {
    await submitClassificationOverride(item.id, { action: 'confirm', category: item.aiCategory });
    setReviewQueue((prev) => prev.filter((r) => r.id !== item.id));
  };

  const handleConfirmCluster = async (cluster) => {
    await confirmCluster(cluster.id);
    setClusters((prev) => prev.filter((c) => c.id !== cluster.id));
  };

  const handleEscalateSla = async (item) => {
    await escalateSla(item.id);
    setOpenStaffFor(openStaffFor === item.id ? null : item.id);
  };

  const handleAssign = (id, staff) => {
    setAssignments((prev) => ({ ...prev, [id]: staff.id }));
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-black text-slate-900">Overview</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">What needs your attention right now</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Complaints today"
          value={summary ? summary.complaintsToday : '—'}
          note={summary ? `${summary.resolvedToday} resolved` : ''}
          emphasized={summary && summary.complaintsToday > 0}
        />
        <StatCard
          label="Flagged (suspicious)"
          value={summary ? summary.flaggedToday : '—'}
          note="Need officer review"
          emphasized={summary && summary.flaggedToday > 0}
        />
        <StatCard
          label="Avg time to fix"
          value={summary ? `${summary.avgTimeToFixHrs}h` : '—'}
          note="Resolution speed"
        />
        <StatCard
          label="Staff approvals pending"
          value={summary ? summary.pendingStaffApprovals : '—'}
          note="New staff to verify"
          emphasized={summary && summary.pendingStaffApprovals > 0}
        />
      </div>

      {/* Prioritized action list */}
      <div className="space-y-3">
        {flagged.length > 0 && (
          <CollapsibleSection
            title="Flagged — verification mismatch"
            subtitle="Possible fraud or misattribution"
            count={flagged.length}
            icon={ShieldAlert}
            emphasized
          >
            {flagged.map((f) => (
              <Row key={f.id}>
                <div className="flex items-center gap-3">
                  <Thumb src={f.imageUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{f.description}</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {f.train} · {f.trainName} · Coach {f.coach}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black text-slate-900">{f.distanceKm} km</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">location mismatch</p>
                  </div>
                  <button
                    onClick={() => navigate('/flagged')}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                  >
                    Investigate <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Row>
            ))}
          </CollapsibleSection>
        )}

        {slaBreaches.length > 0 && (
          <CollapsibleSection
            title="SLA breach — needs escalation"
            subtitle="Department hasn't acted in time"
            count={slaBreaches.length}
            icon={Clock3}
            emphasized
          >
            {slaBreaches.map((s) => (
              <Row key={s.id} expanded={openStaffFor === s.id}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                    <AlertOctagon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{s.description}</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {s.train} · {s.trainName} · Coach {s.coach} · {s.department}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black text-slate-900">+{s.overdueByHours} hr</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">over {s.slaHours} hr SLA</p>
                  </div>
                  <button
                    onClick={() => handleEscalateSla(s)}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900"
                  >
                    Escalate & assign
                  </button>
                </div>
                {openStaffFor === s.id && (
                  <div className="mt-3 ml-14">
                    <NearbyStaffList
                      department={s.department}
                      seed={s.id}
                      assignedId={assignments[s.id]}
                      onAssign={(staff) => handleAssign(s.id, staff)}
                    />
                  </div>
                )}
              </Row>
            ))}
          </CollapsibleSection>
        )}

        {reviewQueue.length > 0 && (
          <CollapsibleSection
            title="Low confidence — needs classification review"
            subtitle="Below auto-route threshold"
            count={reviewQueue.length}
            icon={HelpCircle}
          >
            {reviewQueue.map((r) => (
              <Row key={r.id}>
                <div className="flex items-center gap-3">
                  <Thumb src={r.imageUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{r.excerpt}</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      AI predicted <span className="text-slate-600 font-semibold">{r.aiCategory}</span> · {r.train} · Coach {r.coach}
                    </p>
                  </div>
                  <ConfidenceMeter value={r.confidence} />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleConfirmClassification(r)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => navigate('/review')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Reassign
                    </button>
                  </div>
                </div>
              </Row>
            ))}
          </CollapsibleSection>
        )}

        {clusters.length > 0 && (
          <CollapsibleSection
            title="Active clusters awaiting confirmation"
            subtitle="Multiple passengers, same issue"
            count={clusters.length}
            icon={Layers}
          >
            {clusters.map((c) => (
              <Row key={c.id}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-slate-800 leading-none">{c.reports.length}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">reports</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{c.category}</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {c.train} · {c.trainName} · Coach {c.coach} · first reported {c.firstReportedAgo}
                    </p>
                  </div>
                  <button
                    onClick={() => handleConfirmCluster(c)}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm as one incident
                  </button>
                </div>
              </Row>
            ))}
          </CollapsibleSection>
        )}

        {resolvedComplaints.length > 0 && (
          <CollapsibleSection
            title="Resolved complaints"
            subtitle="Solved by staff"
            count={resolvedComplaints.length}
            icon={CheckCircle2}
          >
            {resolvedComplaints.map((item) => (
              <Row key={item.id}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {item.train} · Coach {item.coach}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      Solved by <span className="font-bold text-slate-800">{item.staffName}</span> in <span className="font-bold text-slate-800">{item.staffDepartment}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Problem: {item.description}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Action taken: {item.actionTaken}</p>
                    {item.passengerFeedback && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="inline-flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${star <= Math.round(item.passengerFeedback.rating || 0) ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                            />
                          ))}
                        </span>
                        {item.passengerFeedback.comment && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 italic truncate max-w-[240px]">
                            <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                            "{item.passengerFeedback.comment}"
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {item.proofImage && (
                    <img src={item.proofImage} alt="Proof" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                  )}
                </div>
              </Row>
            ))}
          </CollapsibleSection>
        )}

        {flagged.length === 0 && slaBreaches.length === 0 && reviewQueue.length === 0 && clusters.length === 0 && resolvedComplaints.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <ListChecks className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Queue is clear</p>
            <p className="text-xs text-slate-400 mt-1">Nothing needs officer review right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
