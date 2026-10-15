/**
 * Complaint Workflow Service
 * Handles all state transitions in the complaint lifecycle
 */

const Staff = require('../models/Staff');
const Complaint = require('../models/Complaint');

/**
 * Mark a timeline stage as completed with the current timestamp — updates the
 * existing placeholder entry (created with '--') or appends a new one.
 */
function markTimelineStep(complaint, statusLabel, completed = true) {
  const nowLabel = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const timeline = Array.isArray(complaint.timeline) ? complaint.timeline : [];
  const index = timeline.findIndex((node) => node.status === statusLabel);
  if (index >= 0) {
    // NOTE: do NOT spread the existing subdocument ({ ...timeline[index] }) —
    // Mongoose subdoc paths are not enumerable, so status would be dropped
    // and the next save fails with "timeline.X.status: Path `status` is required".
    timeline[index] = {
      status: statusLabel,
      time: nowLabel,
      completed
    };
  } else {
    timeline.push({ status: statusLabel, time: nowLabel, completed });
  }
  complaint.timeline = timeline;
  return complaint;
}

/**
 * Officer manually assigns a complaint to an approved staff member
 */
async function assignComplaintToStaff(complaintId, staffId, assignedByOfficer = 'Officer') {
  try {
    const complaint = await Complaint.findOne({ complaintId });
    if (!complaint) throw new Error('Complaint not found');

    const staff = await Staff.findOne({ staffId });
    if (!staff) throw new Error('Staff not found');
    if (staff.approvalStatus !== 'approved') throw new Error('Staff not approved');

    complaint.staffAssignment = {
      status: 'Assigned',
      staff_id: staff.staffId,
      staff_name: staff.name,
      role: staff.role,
      department: staff.department,
      contact_phone: staff.phone,
      station_area: staff.station || staff.depot || staff.zone || 'Station HQ',
      assignment_reason: `Manually assigned by ${assignedByOfficer} to ${staff.name} (${staff.department})`,
      priority_action: `Inspect and resolve the ${complaint.category || 'reported issue'}`,
      estimated_response_time: '10-20 minutes',
      confidence: 0.95,
      escalation_required: false,
      assigned_at: new Date(),
      assignment_by: assignedByOfficer
    };

    complaint.status = 'Routed to Department';
    markTimelineStep(complaint, 'Routed to Department');

    await complaint.save();
    return complaint;
  } catch (err) {
    throw new Error(`Assignment failed: ${err.message}`);
  }
}

function isStaffMatched(staffAssignment, staffIdentifier) {
  if (!staffAssignment) return false;
  const ident = String(staffIdentifier || '').toLowerCase().trim();
  if (!ident) return false;
  const targetId = String(staffAssignment.staff_id || '').toLowerCase().trim();
  const targetName = String(staffAssignment.staff_name || '').toLowerCase().trim();
  const targetPhone = String(staffAssignment.contact_phone || '').trim();

  return targetId === ident || targetName === ident || targetPhone === ident;
}

/**
 * Staff member accepts the assigned task
 */
async function acceptTask(complaintId, staffId) {
  try {
    const complaint = await Complaint.findOne({ complaintId });
    if (!complaint) throw new Error('Complaint not found');
    if (!complaint.staffAssignment || !isStaffMatched(complaint.staffAssignment, staffId)) {
      throw new Error('Task not assigned to this staff');
    }

    complaint.staffAssignment.status = 'Accepted';
    complaint.staffAssignment.accepted_at = new Date();
    complaint.status = 'Routed to Department';

    await complaint.save();
    return complaint;
  } catch (err) {
    throw new Error(`Accept failed: ${err.message}`);
  }
}

/**
 * Staff member rejects the task (flags for manual officer review)
 */
async function rejectTask(complaintId, staffId, reason) {
  try {
    const complaint = await Complaint.findOne({ complaintId });
    if (!complaint) throw new Error('Complaint not found');
    if (!complaint.staffAssignment || !isStaffMatched(complaint.staffAssignment, staffId)) {
      throw new Error('Task not assigned to this staff');
    }

    complaint.staffAssignment.status = 'Rejected';
    complaint.staffAssignment.rejection_reason = reason || 'Staff unable to handle';
    complaint.staffAssignment.rejected_at = new Date();
    complaint.staffAssignment.flagged_for_manual_review = true;
    complaint.status = 'Submitted';

    complaint.timeline.push({
      status: 'Rejected by Staff',
      time: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      completed: true
    });

    await complaint.save();
    return complaint;
  } catch (err) {
    throw new Error(`Rejection failed: ${err.message}`);
  }
}

/**
 * Staff member marks task as complete with proof
 */
async function resolveTask(complaintId, staffId, actionTaken, proofImage) {
  try {
    const complaint = await Complaint.findOne({ complaintId });
    if (!complaint) throw new Error('Complaint not found');
    if (!complaint.staffAssignment || !isStaffMatched(complaint.staffAssignment, staffId)) {
      throw new Error('Task not assigned to this staff');
    }

    complaint.staffAssignment.status = 'Resolved';
    complaint.staffAssignment.action_taken = actionTaken || 'Task completed';
    complaint.staffAssignment.proof_image = proofImage || null;
    complaint.staffAssignment.resolved_at = new Date();

    complaint.status = 'Resolved';
    complaint.timeline = complaint.timeline.map(step => {
      if (step.status === 'Resolved') {
        // Same as markTimelineStep — never spread subdocs, build explicitly.
        return {
          status: 'Resolved',
          time: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          completed: true
        };
      }
      return step;
    });

    await complaint.save();
    return complaint;
  } catch (err) {
    throw new Error(`Resolution failed: ${err.message}`);
  }
}

/**
 * Auto-assign if complaint is not flagged (after classification)
 */
async function autoAssignIfNotFlagged(complaint) {
  try {
    if (complaint.staffAssignment && complaint.staffAssignment.status !== 'Rejected') {
      return complaint;
    }

    if (complaint.status === 'Submitted' || (complaint.evidenceVerification && complaint.evidenceVerification.human_review_required)) {
      return complaint;
    }

    const { assignDynamicStaff } = require('./staffAssignmentService');
    const complaintContext = {
      department: complaint.classification?.department || complaint.category || 'General',
      category: complaint.category || 'General Complaint',
      location: complaint.location || { lat: 17.4334, lng: 78.5024 }
    };

    const assignment = await assignDynamicStaff(complaintContext);
    if (assignment && assignment.status === 'assigned') {
      complaint.staffAssignment = {
        status: 'Assigned',
        staff_id: assignment.staff_id,
        staff_name: assignment.staff_name,
        role: assignment.role,
        department: assignment.department,
        contact_phone: assignment.contact_phone,
        station_area: assignment.station_area,
        assignment_reason: assignment.assignment_reason,
        priority_action: assignment.priority_action,
        estimated_response_time: assignment.estimated_response_time,
        confidence: assignment.confidence,
        escalation_required: assignment.escalation_required,
        assigned_at: new Date(),
        assignment_by: 'Auto-Assignment System'
      };

      complaint.status = 'Routed to Department';
      markTimelineStep(complaint, 'Routed to Department');
    }

    return complaint;
  } catch (err) {
    console.warn('Auto-assign warning:', err.message);
    return complaint;
  }
}

module.exports = {
  assignComplaintToStaff,
  acceptTask,
  rejectTask,
  resolveTask,
  autoAssignIfNotFlagged,
  markTimelineStep
};
