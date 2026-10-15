import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock3, Shield, AlertCircle } from 'lucide-react';
import { getStaffApprovals, approveStaff, rejectStaff } from '../api/officerClient';

function StaffCard({ staff, onApprove, onReject, loading }) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');

  const handleReject = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    await onReject(staff.id, reason);
    setShowReason(false);
    setReason('');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{staff.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{staff.role}</p>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
            Pending
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Department</span>
            <span className="font-medium text-slate-900">{staff.department}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Phone</span>
            <span className="font-medium text-slate-900">{staff.phone}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Station</span>
            <span className="font-medium text-slate-900">{staff.station}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Experience</span>
            <span className="font-medium text-slate-900">{staff.experience_years} years</span>
          </div>
          {staff.specialisation && staff.specialisation.length > 0 && (
            <div className="flex items-start justify-between text-xs">
              <span className="text-slate-500">Specialisation</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {staff.specialisation.map((spec, idx) => (
                  <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-slate-500">ID Proof</span>
            <span className="font-medium text-slate-900">{staff.idProofType}</span>
          </div>
        </div>
      </div>

      {showReason ? (
        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
          <p className="text-xs font-medium text-slate-700">Why reject this application?</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter rejection reason..."
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            rows="3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={loading}
              className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
            <button
              onClick={() => {
                setShowReason(false);
                setReason('');
              }}
              className="flex-1 px-3 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
          <button
            onClick={() => onApprove(staff.id)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={() => setShowReason(true)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function StaffApproval() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const data = await getStaffApprovals();
      setStaff(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (staffId) => {
    try {
      setLoading(true);
      await approveStaff(staffId, 'Officer A. Verma');
      setStaff(prev => prev.filter(s => s.id !== staffId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (staffId, reason) => {
    try {
      setLoading(true);
      await rejectStaff(staffId, reason);
      setStaff(prev => prev.filter(s => s.id !== staffId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-black text-slate-900">Staff Approvals</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Verify and approve new railway staff members</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {loading && staff.length === 0 ? (
        <div className="text-center py-12">
          <Clock3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading staff approvals...</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-900">No pending approvals</p>
          <p className="text-xs text-slate-500 mt-1">All staff applications have been processed</p>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pending Approvals ({staff.length})
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map(s => (
              <StaffCard
                key={s.id}
                staff={s}
                onApprove={handleApprove}
                onReject={handleReject}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
