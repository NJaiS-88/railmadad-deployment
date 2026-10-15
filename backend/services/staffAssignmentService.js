const Staff = require('../models/Staff');
const { normalizeDepartment } = require('../config/departments');

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const lat1 = Number(a.lat ?? a.latitude ?? 0);
  const lon1 = Number(a.lng ?? a.longitude ?? 0);
  const lat2 = Number(b.lat ?? b.latitude ?? 0);
  const lon2 = Number(b.lng ?? b.longitude ?? 0);

  if (!Number.isFinite(lat1) || !Number.isFinite(lat2) || !Number.isFinite(lon1) || !Number.isFinite(lon2)) {
    return Number.POSITIVE_INFINITY;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

function canStaffAccessPortal(staff) {
  return !!staff && staff.approvalStatus === 'approved';
}

function findBestApprovedStaff(staffList = [], complaint = {}) {
  const requiredDepartment = normalizeDepartment(complaint.department || complaint.category || 'General');
  const complaintLocation = complaint.location || {};

  const isExactDeptMatch = (staff) =>
    normalizeDepartment(staff.department) === requiredDepartment ||
    normalizeDepartment(staff.role || '') === requiredDepartment ||
    normalizeDepartment(staff.specialisation?.join(' ') || '') === requiredDepartment;

  const candidates = (staffList || []).filter((staff) => {
    if (!staff || staff.approvalStatus !== 'approved') return false;
    if (!staff.department) return false;
    if (staff.available === false) return false;
    return true;
  });

  if (!candidates.length) {
    return null;
  }

  // Prefer an exact department match; otherwise fall back to the nearest
  // available approved staff so the task still gets assigned (mirrors the
  // staff assignment agent's "closest operational department" rule).
  return candidates
    .map((staff) => ({
      ...staff.toObject ? staff.toObject() : staff,
      distanceKm: haversineKm(complaintLocation, staff.location || { lat: 0, lng: 0 }),
      exactDeptMatch: isExactDeptMatch(staff)
    }))
    .sort((a, b) => {
      if (a.exactDeptMatch !== b.exactDeptMatch) return a.exactDeptMatch ? -1 : 1;
      const distanceDiff = (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
      if (distanceDiff !== 0) return distanceDiff;
      return Number(b.experience_years || 0) - Number(a.experience_years || 0);
    })[0];
}

async function assignDynamicStaff(complaint) {
  const staffList = await Staff.find({ approvalStatus: 'approved', available: true }).sort({ createdAt: -1 });

  if (!staffList || !staffList.length) {
    return null;
  }

  const best = findBestApprovedStaff(staffList, complaint);
  if (!best) {
    return null;
  }

  const isFallback = !best.exactDeptMatch;
  const neededDept = normalizeDepartment(complaint.department || complaint.category || 'General');

  return {
    status: 'assigned',
    staff_id: best.staffId || best.id || best._id,
    staff_name: best.name,
    role: best.role,
    department: best.department,
    contact_phone: best.phone,
    station_area: best.station || best.zone || best.depot || 'Station Area',
    assignment_reason: isFallback
      ? `No approved ${neededDept} staff available — assigned nearest approved ${best.department} staff (${best.name}) as fallback.`
      : `Approved ${best.department} staff matched the complaint department and was selected from the nearest available station area.`,
    priority_action: `Inspect and resolve the ${complaint.department || complaint.category || 'complaint'} issue at the reported location.`,
    estimated_response_time: '10-20 minutes',
    confidence: isFallback ? 0.6 : 0.92,
    escalation_required: isFallback,
    backup_staff_id: null,
    backup_staff_name: null,
    assignedStaff: best
  };
}

module.exports = {
  normalizeDepartment,
  haversineKm,
  canStaffAccessPortal,
  findBestApprovedStaff,
  assignDynamicStaff
};
