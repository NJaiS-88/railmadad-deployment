const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }

  return response.json();
}

export async function getReviewQueue() {
  return request('/officer/review-queue');
}

export async function getFlaggedComplaints() {
  return request('/officer/flagged');
}

export async function getClusters() {
  return request('/officer/clusters');
}

export async function getMultiDeptComplaints() {
  return request('/officer/multi-department');
}

export async function getSlaBreaches() {
  return request('/officer/sla-breaches');
}

export async function getResolvedComplaints() {
  return request('/officer/resolved');
}

export async function getTodaySummary() {
  return request('/officer/summary');
}

export async function getAnalytics() {
  return request('/officer/analytics');
}

export async function getStaffRoster() {
  return request('/officer/staff');
}

export async function submitClassificationOverride(complaintId, payload) {
  return request(`/officer/override`, {
    method: 'POST',
    body: JSON.stringify({ complaintId, ...payload }),
  });
}

export async function getComplaintDetail(complaintId) {
  return request(`/officer/complaints/${complaintId}/detail`);
}

export async function rejectReviewItem(complaintId, reason) {
  return request(`/officer/complaints/${complaintId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function resolveFlagged(complaintId, action) {
  return request(`/officer/flagged/${complaintId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export async function unrejectFlagged(complaintId, department) {
  return request(`/officer/flagged/${complaintId}/unreject`, {
    method: 'POST',
    body: JSON.stringify({ department }),
  });
}

export async function confirmCluster(clusterId) {
  return request(`/officer/clusters/${clusterId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function escalateCluster(clusterId) {
  return request(`/officer/clusters/${clusterId}/escalate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function setPrimaryOwner(complaintId, department) {
  return request(`/officer/complaints/${complaintId}/assign-owner`, {
    method: 'POST',
    body: JSON.stringify({ department }),
  });
}

export async function assignStaff(complaintId, staffId) {
  return request(`/officer/complaints/${complaintId}/assign-staff`, {
    method: 'POST',
    body: JSON.stringify({ staffId }),
  });
}

export async function escalateSla(complaintId) {
  return request(`/officer/sla/${complaintId}/escalate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ─── Staff Approval API ─────────────────────────────────────────────────────

export async function getStaffApprovals() {
  return request('/officer/staff-approval');
}

export async function approveStaff(staffId, approvedBy) {
  return request(`/officer/staff-approval/${staffId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy }),
  });
}

export async function rejectStaff(staffId, reason) {
  return request(`/officer/staff-approval/${staffId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ─── Hotspots / Predictions API ─────────────────────────────────────────────

export async function getHotspots() {
  return request('/officer/hotspots');
}

// ─── Analytics API ──────────────────────────────────────────────────────────

export async function getDetailedAnalytics() {
  return request('/officer/analytics/detailed');
}

export async function getDetailedSummary() {
  return request('/officer/summary-detailed');
}

// ─── Train Management API ───────────────────────────────────────────────────

export async function getAllTrains() {
  return request('/trains');
}

export async function addPassengerToTrain(trainNumber, passengerData) {
  return request(`/trains/${trainNumber}/add-passenger`, {
    method: 'POST',
    body: JSON.stringify(passengerData),
  });
}

export async function refreshTrainTelemetry() {
  return request('/trains/refresh-telemetry', { method: 'POST', body: '{}' });
}

export async function getActiveJourney(phone, email) {
  const params = new URLSearchParams();
  if (phone) params.append('phone', phone);
  if (email) params.append('email', email);
  return request(`/trains/active-journey?${params.toString()}`);
}

export async function searchUsers(query) {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({ q: query });
  return request(`/trains/search-users?${params.toString()}`);
}
