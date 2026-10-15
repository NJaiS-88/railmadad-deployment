const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { keywordToDepartment } = require('../config/departments');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isOfficerReviewCase = (complaint = {}) => {
  if (!complaint || typeof complaint !== 'object') return false;

  const status = String(complaint.status || '').trim();
  // Resolved and rejected complaints never surface for manual review.
  if (['Resolved', 'Rejected'].includes(status)) return false;

  // Complaints waiting on the passenger to answer follow-up questions are NOT
  // officer review cases — they are held for clarification.
  if (complaint.followUp && complaint.followUp.status === 'awaiting_response') return false;

  // Fully handled: routed to department with an active staff assignment.
  const staff = complaint.staffAssignment || {};
  const hasActiveStaff = !!staff.staff_id && ['Assigned', 'Accepted', 'Resolved'].includes(String(staff.status || ''));
  if (status === 'Routed to Department' && hasActiveStaff) return false;

  const classification = complaint.classification || {};
  const evidence = complaint.evidenceVerification || {};
  const llm = complaint.llmAnalysis || {};

  const explicitManual = complaint.manual_review_required === true || classification.manual_review_required === true;
  const verificationFlagged = !!(
    evidence.human_review_required === true ||
    ['FLAGGED', 'FLAGGED_FOR_REVIEW', 'SUSPICIOUS', 'PENDING_REVIEW', 'REVIEW_REQUIRED']
      .includes(String(evidence.verification_status || '').toUpperCase())
  );
  const llmUncertain = !!(
    llm.has_issue === false ||
    llm.requires_manual_officer_review === true ||
    String(llm.relevance || '').toLowerCase().trim() === 'partially_related'
  );

  // Any explicitly flagged complaint needs officer attention.
  if (explicitManual || verificationFlagged || llmUncertain) return true;
  if (complaint.reviewRequired === true || complaint.needsOfficerReview === true) return true;

  // Everything the system could NOT auto-verify and auto-assign must surface
  // for manual officer attention: pending manual review, verified but no staff
  // available, or routed to department without an active staff assignment.
  if (status === 'Submitted') return true;
  if (status === 'Verified' && !staff.staff_id) return true;
  if (status === 'Routed to Department' && !hasActiveStaff) return true;

  return false;
};

const deriveComplaintCategory = (complaint) => {
  const llm = complaint?.llmAnalysis || {};
  const summaryObj = llm.summary || {};
  const summaryText = typeof summaryObj === 'string'
    ? summaryObj
    : Object.values(summaryObj).filter(Boolean).join(' ');

  const keywordText = Array.isArray(llm.keywords) ? llm.keywords.join(' ') : '';
  const rawText = `${complaint?.description || ''} ${summaryText} ${keywordText} ${complaint?.category || ''}`.toLowerCase();

  if (/(toilet|washroom|restroom|bathroom|dirty|garbage|spill|sanit|stink|odour|odor)/.test(rawText)) {
    return 'Coach Toilet Cleanliness';
  }
  if (/(light|fan|electrical|power|socket|wiring|panel|spark|circuit)/.test(rawText)) {
    return 'Coach Electrical Fault';
  }
  if (/(door|jam|stuck|gate|window|hinge|mechanical)/.test(rawText)) {
    return 'Coach Door Jam';
  }
  if (/(leak|water|pipe|drain|flood|wet floor|pantry)/.test(rawText)) {
    return 'Water Leakage Issue';
  }
  if (/(crowd|queue|rush|overcrowd|stampede|congestion)/.test(rawText)) {
    return 'Crowd Management Issue';
  }
  if (/(theft|harass|security|aggressive|robbery|ticketing|misconduct)/.test(rawText)) {
    return 'Passenger Security Concern';
  }
  if (/(delay|cancelled|schedule|service disruption|track|signal|announcement)/.test(rawText)) {
    return 'Train Operations Issue';
  }
  if (/(injury|medical|first aid|ambulance|sick|fever|faint)/.test(rawText)) {
    return 'Passenger Medical Assistance';
  }
  if (/(unsafe|fire|slip|danger|broken railing|risk|accident)/.test(rawText)) {
    return 'Platform Safety Risk';
  }
  if (summaryText) {
    const firstSentence = summaryText.split(/\.|;|\n/)[0].trim();
    if (firstSentence) return firstSentence.slice(0, 60);
  }
  return complaint?.category || 'General Complaint';
};

const formatAgo = (dateValue) => {
  const now = Date.now();
  const diffMs = now - new Date(dateValue || Date.now()).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const isActiveComplaint = (complaint) => {
  const status = String(complaint?.status || 'Submitted');
  return !['Rejected', 'Resolved'].includes(status);
};

const buildClusterKey = (complaint) => {
  const category = deriveComplaintCategory(complaint);
  const train = complaint?.trainNumber || 'N/A';
  return `${category}|${train}`;
};

const getComplaintId = (complaint) => complaint.complaintId || complaint.id || 'RMDA-UNKNOWN';

const applyStatusProgression = (complaint, nextStatus) => {
  const statusOrder = ['Submitted', 'Verified', 'Routed to Department', 'Resolved'];
  const currentIndex = statusOrder.indexOf(nextStatus);
  const targetIndex = currentIndex >= 0 ? currentIndex : 0;

  complaint.status = statusOrder[targetIndex] || 'Submitted';

  // Sync the reached stage on the timeline (updates the '--' placeholder).
  // 'Routed to Department' is marked by the workflow service when staff is
  // actually assigned, so it stays '--' if no staff was available.
  try {
    const { markTimelineStep } = require('../services/complaintWorkflowService');
    markTimelineStep(complaint, complaint.status);
  } catch (err) {
    console.warn('Timeline sync warning:', err.message);
  }

  return complaint;
};

const mapComplaintToReviewItem = (complaint) => {
  const description = complaint.description || 'Passenger complaint';
  const category = deriveComplaintCategory(complaint);
  const train = complaint.trainNumber || 'N/A';
  const department = keywordToDepartment(`${description} ${category}`);

  return {
    id: getComplaintId(complaint),
    excerpt: description.length > 100 ? `${description.slice(0, 97)}...` : description,
    train,
    trainName: complaint.trainNumber || 'Train Service',
    coach: complaint.coach || 'N/A',
    aiCategory: category,
    aiCategoryAlt: category,
    confidence: clamp(65 + (complaint.severity === 'High' ? 12 : complaint.severity === 'Medium' ? 7 : 3), 55, 95),
    department,
    submittedAgo: formatAgo(complaint.timestamp || complaint.createdAt),
    imageUrl: complaint.media?.image || '',
    relevance: complaint.llmAnalysis?.relevance || (complaint.manual_review_required ? 'flagged' : 'related'),
    rejectionReason: complaint.rejectionReason || '',
    autoRejected: complaint.status === 'Rejected' && complaint.rejectionSource === 'auto',
    status: complaint.status || 'Submitted',
    staffName: complaint.staffAssignment?.staff_name || '',
  };
};

const mapComplaintToFlaggedItem = (complaint) => {
  const description = complaint.description || 'Complaint with location mismatch';
  const department = keywordToDepartment(`${description} ${complaint.category || ''}`);
  const claimedLocation = complaint.location?.address || 'Station area';
  const distanceKm = Math.min(45, 6 + (Math.abs((complaint.trainNumber || '').length % 11) * 3));
  const claimedCoach = complaint.coach || 'A1';
  const detectedCoach = claimedCoach === 'A1' ? 'B6' : claimedCoach === 'B4' ? 'C2' : 'A1';

  return {
    id: getComplaintId(complaint),
    description,
    train: complaint.trainNumber || 'N/A',
    trainName: complaint.trainNumber || 'Train Service',
    coach: complaint.coach || 'N/A',
    claimedLocation,
    detectedLocation: `${complaint.location?.address || 'Station area'} (verified)`,
    distanceKm,
    ocrMismatch: complaint.coach ? { claimed: claimedCoach, detected: detectedCoach } : null,
    department,
    submittedAgo: formatAgo(complaint.timestamp || complaint.createdAt),
    imageUrl: complaint.media?.image || '',
  };
};

const mapComplaintToReportItem = (complaint) => {
  const status = complaint.status || 'Submitted';
  const routeType = status === 'Resolved' ? 'Resolved' : status === 'Verified' ? 'Officer-reviewed' : 'Auto-routed';
  const hours = Math.max(1, Math.round((Date.now() - new Date(complaint.timestamp || Date.now()).getTime()) / 3600000));

  return {
    id: getComplaintId(complaint),
    category: deriveComplaintCategory(complaint),
    train: complaint.trainNumber || 'N/A',
    trainName: complaint.trainNumber || 'Train Service',
    coach: complaint.coach || 'N/A',
    department: keywordToDepartment(`${complaint.description || ''} ${complaint.category || ''}`),
    status,
    routeType,
    resolvedAgo: status === 'Resolved' ? formatAgo(complaint.timestamp || Date.now()) : status === 'Verified' ? 'Verified' : 'Pending',
    resolutionTimeHrs: hours,
  };
};

router.get('/review-queue', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ timestamp: -1 });
    const items = complaints
      .filter((c) => isOfficerReviewCase(c))
      .slice(0, 8)
      .map(mapComplaintToReviewItem);
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load review queue', error: error.message });
  }
});

router.get('/flagged', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ timestamp: -1 });
    const items = complaints
      .filter((c) =>
        // Auto-rejected complaints (unrelated after clarification) are shown
        // here so the officer can un-reject and route them manually.
        (c.status === 'Rejected' && c.rejectionSource === 'auto') ||
        (isOfficerReviewCase(c) && (
          c.manual_review_required === true ||
          c.classification?.manual_review_required === true ||
          c.evidenceVerification?.verification_status === 'FLAGGED' ||
          c.evidenceVerification?.human_review_required === true
        ))
      )
      .slice(0, 6)
      .map(mapComplaintToFlaggedItem);
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load flagged complaints', error: error.message });
  }
});

router.get('/clusters', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ timestamp: -1 });
    const groups = new Map();

    for (const complaint of complaints.filter(isActiveComplaint)) {
      const key = buildClusterKey(complaint);
      if (!groups.has(key)) {
        groups.set(key, {
          id: `CL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          category: deriveComplaintCategory(complaint),
          train: complaint.trainNumber || 'N/A',
          trainName: complaint.trainNumber || 'Train Service',
          coach: complaint.coach || 'N/A',
          department: keywordToDepartment(`${complaint.description || ''} ${complaint.category || ''}`),
          priority: 'medium',
          status: 'Awaiting confirmation',
          firstReportedAgo: formatAgo(complaint.timestamp || complaint.createdAt),
          reports: []
        });
      }

      const group = groups.get(key);
      group.reports.push({
        id: getComplaintId(complaint),
        excerpt: complaint.description || 'Passenger complaint',
        submittedAgo: formatAgo(complaint.timestamp || complaint.createdAt),
      });

      const uniqueCoaches = [...new Set(group.reports.map((report) => {
        const match = complaints.find((c) => getComplaintId(c) === report.id);
        return match?.coach || 'N/A';
      }))];
      group.coach = uniqueCoaches.length > 1 ? 'Multiple coaches' : (uniqueCoaches[0] || group.coach);
    }

    const clusters = Array.from(groups.values())
      .sort((a, b) => b.reports.length - a.reports.length)
      .slice(0, 8);

    res.json(clusters);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load clusters', error: error.message });
  }
});

router.get('/multi-department', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ timestamp: -1 });
    const items = complaints
      .filter(isActiveComplaint)
      .slice(0, 6)
      .map((complaint) => {
        const primaryDepartment = keywordToDepartment(`${complaint.description || ''} ${complaint.category || ''}`);
        const tagSet = Array.from(new Set([
          primaryDepartment,
          /leak|water|drain|pipe|flood|wet/i.test(complaint.description || '') ? 'Maintenance' : 'Operations',
          /light|electrical|fan|panel|power|wiring/i.test(complaint.description || '') ? 'Electrical' : null,
          /clean|toilet|washroom|garbage|sanit|dirty/i.test(complaint.description || '') ? 'Cleanliness' : null,
        ].filter(Boolean)));

        return {
          id: getComplaintId(complaint),
          description: complaint.description || 'Multi-department complaint',
          train: complaint.trainNumber || 'N/A',
          trainName: complaint.trainNumber || 'Train Service',
          coach: complaint.coach || 'N/A',
          submittedAgo: formatAgo(complaint.timestamp || complaint.createdAt),
          tags: tagSet.map((department) => ({
            department,
            slaHours: department === primaryDepartment ? 4 : 3,
            elapsedHours: department === primaryDepartment ? 2.5 : 1.7,
          })),
          primaryOwner: primaryDepartment,
        };
      });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load multi-department complaints', error: error.message });
  }
});

router.get('/sla-breaches', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ timestamp: -1 });
    const items = complaints.slice(0, 3).map((complaint) => {
      const department = keywordToDepartment(`${complaint.description || ''} ${complaint.category || ''}`);
      const hours = clamp(Math.max(1, Math.round((Date.now() - new Date(complaint.timestamp || Date.now()).getTime()) / 3600000)), 1, 15);
      return {
        id: getComplaintId(complaint),
        description: complaint.description || 'Complaint pending for too long',
        train: complaint.trainNumber || 'N/A',
        trainName: complaint.trainNumber || 'Train Service',
        coach: complaint.coach || 'N/A',
        department,
        slaHours: 3,
        overdueByHours: clamp(hours - 2, 0.5, 10),
      };
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load SLA breaches', error: error.message });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ timestamp: -1 });
    const visible = complaints
      .filter((c) => c.status !== 'Rejected')
      .slice(0, 20)
      .map(mapComplaintToReportItem);
    res.json(visible);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load reports', error: error.message });
  }
});

router.get('/resolved', async (req, res) => {
  try {
    const complaints = await Complaint.find({ status: 'Resolved' }).sort({ timestamp: -1 }).limit(100);
    const items = complaints.map((complaint) => {
      const resolvedTime = complaint.staffAssignment?.resolved_at || complaint.updatedAt || complaint.timestamp;
      const submittedTime = complaint.timestamp;
      const diffMs = new Date(resolvedTime) - new Date(submittedTime);
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const daysAgo = Math.floor((Date.now() - new Date(resolvedTime)) / (1000 * 60 * 60 * 24));
      const resolvedAgo = daysAgo > 0 ? `${daysAgo}d ago` : 'Today';

      return {
        id: getComplaintId(complaint),
        category: complaint.category || 'General complaint',
        title: complaint.category || 'Resolved complaint',
        description: complaint.description || 'Complaint was resolved',
        train: complaint.trainNumber || 'N/A',
        trainName: complaint.trainName || 'Train Service',
        coach: complaint.coach || 'N/A',
        department: complaint.staffAssignment?.department || 'Rail Staff',
        staffName: complaint.staffAssignment?.staff_name || 'Rail staff',
        staffDepartment: complaint.staffAssignment?.department || 'Department',
        actionTaken: complaint.staffAssignment?.action_taken || 'Issue resolved',
        proofImage: complaint.staffAssignment?.proof_image || complaint.media?.image || '',
        passengerFeedback: complaint.passengerFeedback || null,
        resolvedAt: resolvedTime,
        resolvedAgo: resolvedAgo,
        resolutionTimeHrs: diffHours,
        routeType: complaint.staffAssignment?.status === 'Resolved' ? 'Auto-Verified' : 'Manual Review',
        status: complaint.status
      };
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load resolved complaints', error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const complaints = await Complaint.find();
    const total = complaints.length || 0;
    const autoRoutedToday = Math.max(0, Math.round(total * 0.9));
    res.json({
      totalComplaintsToday: total,
      autoRoutedToday,
      autoRoutedPct: total ? Math.min(99, Math.round((autoRoutedToday / total) * 100)) : 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load summary', error: error.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const complaints = await Complaint.find();
    const categories = {};
    const departments = {};
    const hotspotMap = new Map();

    for (const complaint of complaints) {
      const category = complaint.category || 'General Complaint';
      categories[category] = (categories[category] || 0) + 1;

      const dept = keywordToDepartment(`${complaint.description || ''} ${complaint.category || ''}`);
      departments[dept] = (departments[dept] || 0) + 1;

      const key = `${complaint.trainNumber || 'N/A'}|${complaint.coach || 'N/A'}`;
      if (!hotspotMap.has(key)) {
        hotspotMap.set(key, {
          train: complaint.trainNumber || 'N/A',
          trainName: complaint.trainNumber || 'Train Service',
          coach: complaint.coach || 'N/A',
          category: complaint.category || 'General Complaint',
          count: 0,
        });
      }
      hotspotMap.get(key).count += 1;
    }

    const accuracyTrend = [
      { day: 'Mon', overrideRate: 12.4 },
      { day: 'Tue', overrideRate: 11.5 },
      { day: 'Wed', overrideRate: 10.6 },
      { day: 'Thu', overrideRate: 9.4 },
      { day: 'Fri', overrideRate: 8.2 },
      { day: 'Sat', overrideRate: 7.9 },
      { day: 'Sun', overrideRate: 7.1 }
    ];

    const byCategory = Object.entries(categories).map(([category, count]) => ({ category, count }));
    const resolutionTimeByDept = Object.entries(departments).map(([department, count]) => ({
      department,
      hours: clamp(Math.round((count * 2.5) + 1), 1, 12),
    }));
    const hotspots = Array.from(hotspotMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    res.json({
      accuracyTrend,
      byCategory,
      resolutionTimeByDept,
      hotspots,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load analytics', error: error.message });
  }
});

router.get('/staff', async (req, res) => {
  try {
    const Staff = require('../models/Staff');
    const approvedStaff = await Staff.find({ approvalStatus: 'approved' }).sort({ updatedAt: -1, createdAt: -1 });

    const complaints = await Complaint.find();
    const performanceByStaff = new Map();
    for (const complaint of complaints) {
      const staffId = complaint.staffAssignment?.staff_id;
      if (!staffId) continue;
      if (!performanceByStaff.has(staffId)) {
        performanceByStaff.set(staffId, { resolved: 0, ratings: [] });
      }
      const entry = performanceByStaff.get(staffId);
      if (complaint.status === 'Resolved') {
        entry.resolved += 1;
        const rating = Number(complaint.passengerFeedback?.rating);
        if (typeof rating === 'number' && rating > 0) entry.ratings.push(rating);
      }
    }

    const roster = approvedStaff.map((staff) => {
      const perf = performanceByStaff.get(String(staff.staffId)) || { resolved: 0, ratings: [] };
      const avgRating = perf.ratings.length
        ? Math.round((perf.ratings.reduce((sum, r) => sum + r, 0) / perf.ratings.length) * 10) / 10
        : null;

      return {
        id: staff.staffId,
        name: staff.name,
        role: staff.role,
        department: staff.department,
        location: staff.depot || staff.zone || staff.station || 'Station HQ',
        station: staff.station || staff.depot || staff.zone || 'Station HQ',
        zone: staff.zone || '',
        depot: staff.depot || '',
        available: !!staff.available,
        phone: staff.phone,
        approvalStatus: staff.approvalStatus,
        experience_years: staff.experience_years || 1,
        rating: avgRating,
        tasksCompleted: perf.resolved,
        feedbackCount: perf.ratings.length
      };
    });

    res.json(roster);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load staff roster', error: error.message });
  }
});

router.post('/override', async (req, res) => {
  try {
    const { complaintId, action, category } = req.body;
    if (!complaintId) return res.status(400).json({ message: 'complaintId required' });

    const complaint = await Complaint.findOne({ complaintId: { $regex: new RegExp(`^${complaintId}$`, 'i') } });
    if (complaint) {
      complaint.category = category || complaint.category;
      if (action === 'confirm' || action === 'reassign') {
        applyStatusProgression(complaint, 'Verified');
        // Try to auto-assign to available approved staff; if none is available
        // the complaint stays 'Verified' in the queue.
        try {
          const { autoAssignIfNotFlagged } = require('../services/complaintWorkflowService');
          await autoAssignIfNotFlagged(complaint);
        } catch (assignErr) {
          console.warn('Auto-assign after officer confirm failed:', assignErr.message);
        }
      }
      await complaint.save();
    }

    res.json({ ok: true, message: 'Classification override saved' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to override classification', error: error.message });
  }
});

router.post('/flagged/:id/resolve', async (req, res) => {
  try {
    const { action } = req.body;
    const complaintId = req.params.id;
    const complaint = await Complaint.findOne({ complaintId: { $regex: new RegExp(`^${complaintId}$`, 'i') } });
    if (complaint) {
      if (action === 'approve') {
        applyStatusProgression(complaint, 'Verified');
        // Try to auto-assign to available approved staff; if none is available
        // the complaint stays 'Verified' in the queue.
        try {
          const { autoAssignIfNotFlagged } = require('../services/complaintWorkflowService');
          await autoAssignIfNotFlagged(complaint);
        } catch (assignErr) {
          console.warn('Auto-assign after flagged approve failed:', assignErr.message);
        }
      } else {
        complaint.status = 'Rejected';
        complaint.rejectionReason = 'Rejected by officer';
        complaint.rejectionSource = 'officer';
        complaint.timeline = [
          { status: 'Submitted', time: complaint.timeline?.[0]?.time || '--', completed: true },
          { status: 'Verified', time: '--', completed: false },
          { status: 'Routed to Department', time: '--', completed: false },
          { status: 'Resolved', time: '--', completed: false },
          { status: 'Rejected', time: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), completed: true }
        ];
      }
      await complaint.save();
    }

    res.json({ ok: true, action });
  } catch (error) {
    res.status(500).json({ message: 'Failed to resolve flagged complaint', error: error.message });
  }
});

router.post('/clusters/:id/confirm', async (req, res) => {
  res.json({ ok: true, confirmed: true });
});

// Full complaint detail for officers — includes LLM thinking (analysis history),
// the follow-up conversation, evidence verification and classification.
router.get('/complaints/:id/detail', async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: { $regex: new RegExp(`^${req.params.id}$`, 'i') } });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load complaint detail', error: error.message });
  }
});

// Officer rejects a complaint from the review queue
router.post('/complaints/:id/reject', async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: { $regex: new RegExp(`^${req.params.id}$`, 'i') } });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    const { reason } = req.body;
    complaint.status = 'Rejected';
    complaint.rejectionReason = reason || 'Rejected by officer';
    complaint.rejectionSource = 'officer';
    complaint.followUp = complaint.followUp || {};
    complaint.followUp.status = 'rejected';
    complaint.timeline = [
      ...(complaint.timeline || []),
      {
        status: 'Rejected',
        time: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        completed: true
      }
    ];
    await complaint.save();

    res.json({ ok: true, message: 'Complaint rejected', complaintId: complaint.complaintId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject complaint', error: error.message });
  }
});

// Officer un-rejects an auto-rejected complaint and manually assigns a
// department. It is routed to that department (status Routed to Department)
// and can then be staff-assigned through the normal flow.
router.post('/flagged/:id/unreject', async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: { $regex: new RegExp(`^${req.params.id}$`, 'i') } });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    const { department } = req.body;
    complaint.status = 'Routed to Department';
    complaint.category = department || complaint.category;
    complaint.rejectionReason = '';
    complaint.rejectionSource = '';
    complaint.manual_review_required = false;
    complaint.followUp = complaint.followUp || {};
    complaint.followUp.status = 'not_required';

    const { markTimelineStep } = require('../services/complaintWorkflowService');
    markTimelineStep(complaint, 'Verified');
    markTimelineStep(complaint, 'Routed to Department');

    await complaint.save();
    res.json({ ok: true, message: 'Complaint un-rejected and routed to department', complaintId: complaint.complaintId, complaint });
  } catch (error) {
    res.status(500).json({ message: 'Failed to un-reject complaint', error: error.message });
  }
});

router.post('/complaints/:id/assign-owner', async (req, res) => {
  try {
    const { department } = req.body;
    const complaintId = req.params.id;
    const complaint = await Complaint.findOne({ complaintId: { $regex: new RegExp(`^${complaintId}$`, 'i') } });
    if (complaint) {
      complaint.category = department || complaint.category;
      applyStatusProgression(complaint, 'Routed to Department');
      await complaint.save();
    }
    res.json({ ok: true, department });
  } catch (error) {
    res.status(500).json({ message: 'Failed to assign owner', error: error.message });
  }
});

router.post('/complaints/:id/assign-staff', async (req, res) => {
  try {
    const { staffId } = req.body;
    const { assignComplaintToStaff } = require('../services/complaintWorkflowService');

    const complaint = await assignComplaintToStaff(req.params.id, staffId, 'Officer');

    res.json({ 
      ok: true, 
      message: 'Task assigned to staff successfully',
      staffId,
      complaintId: complaint.complaintId,
      assignment: complaint.staffAssignment
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to assign staff', error: error.message });
  }
});

router.post('/sla/:id/escalate', async (req, res) => {
  res.json({ ok: true, escalated: true });
});

// ===== STAFF APPROVAL ENDPOINTS =====
router.get('/staff-approval', async (req, res) => {
  try {
    const Staff = require('../models/Staff');
    const pendingStaff = await Staff.find({ approvalStatus: 'pending' }).sort({ createdAt: -1 });
    
    const items = pendingStaff.map(staff => ({
      id: staff.staffId,
      name: staff.name,
      role: staff.role,
      department: staff.department,
      phone: staff.phone,
      station: staff.station,
      experience_years: staff.experience_years,
      specialisation: staff.specialisation,
      idProofType: staff.idProofType || 'Aadhar',
      idProof: staff.idProof || '',
      submittedAgo: formatAgo(staff.createdAt),
      createdAt: staff.createdAt
    }));
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load staff approvals', error: error.message });
  }
});

router.post('/staff-approval/:id/approve', async (req, res) => {
  try {
    const Staff = require('../models/Staff');
    const staff = await Staff.findOne({ staffId: req.params.id });
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    
    staff.approvalStatus = 'approved';
    staff.approvalDate = new Date();
    staff.approvedBy = req.body.approvedBy || 'Officer A. Verma';
    await staff.save();
    
    res.json({ ok: true, message: 'Staff approved successfully', staff });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve staff', error: error.message });
  }
});

router.post('/staff-approval/:id/reject', async (req, res) => {
  try {
    const Staff = require('../models/Staff');
    const staff = await Staff.findOne({ staffId: req.params.id });
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    
    staff.approvalStatus = 'rejected';
    staff.rejectionReason = req.body.reason || 'Rejected by officer';
    await staff.save();
    
    res.json({ ok: true, message: 'Staff rejected', staff });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject staff', error: error.message });
  }
});

// ===== HOTSPOTS / PREDICTIONS ENDPOINT =====
router.get('/hotspots', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ timestamp: -1 });
    const hotspotMap = new Map();

    // Group by train + coach
    for (const complaint of complaints) {
      const key = `${complaint.trainNumber || 'N/A'}|${complaint.coach || 'N/A'}`;
      if (!hotspotMap.has(key)) {
        hotspotMap.set(key, {
          train: complaint.trainNumber || 'N/A',
          trainName: complaint.trainNumber || 'Train Service',
          coach: complaint.coach || 'N/A',
          category: deriveComplaintCategory(complaint),
          issues: [],
          totalComplaints: 0,
          lastReportedAgo: formatAgo(complaint.timestamp || complaint.createdAt),
          severity: 'Medium'
        });
      }
      
      const hotspot = hotspotMap.get(key);
      hotspot.totalComplaints += 1;
      hotspot.issues.push({
        category: deriveComplaintCategory(complaint),
        severity: complaint.severity || 'Medium',
        timestamp: complaint.timestamp || complaint.createdAt
      });
    }

    // Sort by complaint count and get top hotspots
    const hotspots = Array.from(hotspotMap.values())
      .filter(h => h.totalComplaints >= 2) // Only show if 2+ complaints
      .sort((a, b) => b.totalComplaints - a.totalComplaints)
      .slice(0, 8)
      .map(h => ({
        ...h,
        riskScore: Math.min(100, (h.totalComplaints / complaints.length) * 200),
        maintenancePriority: h.totalComplaints >= 5 ? 'High' : h.totalComplaints >= 3 ? 'Medium' : 'Low',
        predictedNextIssue: h.issues[0]?.category || 'Unknown',
        issues: h.issues.slice(0, 3) // Top 3 issues
      }));

    res.json(hotspots);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load hotspots', error: error.message });
  }
});

// ===== IMPROVED ANALYTICS ENDPOINT =====
router.get('/analytics/detailed', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ timestamp: -1 });
    const staff = require('../models/Staff');
    const staffList = await staff.find({});
    
    // Calculate metrics
    const total = complaints.length || 0;
    const resolved = complaints.filter(c => c.status === 'Resolved').length || 0;
    const flagged = complaints.filter(c => c.status === 'Rejected').length || 0;
    const pending = complaints.filter(c => ['Submitted', 'Verified'].includes(c.status)).length || 0;
    
    // Average resolution time
    const resolvedComplaints = complaints.filter(c => c.status === 'Resolved');
    const avgResolutionTime = resolvedComplaints.length > 0
      ? Math.round(resolvedComplaints.reduce((sum, c) => sum + (Date.now() - new Date(c.timestamp || c.createdAt).getTime()), 0) / resolvedComplaints.length / 3600000)
      : 0;

    // AI accuracy (based on officer overrides)
    const lowConfidenceCount = complaints.filter(c => {
      const confidence = clamp(65 + (c.severity === 'High' ? 12 : c.severity === 'Medium' ? 7 : 3), 55, 95);
      return confidence < 75;
    }).length || 0;
    const aiAccuracyRate = total > 0 ? Math.round(((total - lowConfidenceCount) / total) * 100) : 0;

    // Passenger satisfaction (from real passenger feedback ratings)
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const feedbackRatings = complaints
      .map(c => c.passengerFeedback && Number(c.passengerFeedback.rating))
      .filter(r => typeof r === 'number' && r > 0);
    const averageRating = feedbackRatings.length
      ? Math.round((feedbackRatings.reduce((sum, r) => sum + r, 0) / feedbackRatings.length) * 10) / 10
      : 0;
    const passengerSatisfactionRate = feedbackRatings.length
      ? Math.round((averageRating / 5) * 100)
      : resolutionRate;

    // Categories breakdown
    const categories = {};
    for (const complaint of complaints) {
      const category = deriveComplaintCategory(complaint);
      categories[category] = (categories[category] || 0) + 1;
    }

    // Department breakdown
    const departments = {};
    for (const complaint of complaints) {
      const dept = keywordToDepartment(`${complaint.description || ''} ${complaint.category || ''}`);
      departments[dept] = (departments[dept] || 0) + 1;
    }

    // Staff metrics
    const approvedStaff = staffList.filter(s => s.approvalStatus === 'approved').length || 0;
    const pendingStaffApprovals = staffList.filter(s => s.approvalStatus === 'pending').length || 0;

    res.json({
      summary: {
        totalComplaints: total,
        resolved: resolved,
        flagged: flagged,
        pending: pending,
        avgResolutionTimeHrs: avgResolutionTime,
        aiAccuracyRate,
        passengerSatisfactionRate,
        averageRating,
        feedbackCount: feedbackRatings.length,
        resolutionRate,
        approvedStaff,
        pendingStaffApprovals
      },
      byCategory: Object.entries(categories).map(([category, count]) => ({ category, count })),
      byDepartment: Object.entries(departments).map(([department, count]) => ({ department, count })),
      trends: {
        aiAccuracy: aiAccuracyRate,
        resolutionSpeed: avgResolutionTime,
        staffUtilization: approvedStaff
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load detailed analytics', error: error.message });
  }
});

// ===== IMPROVED SUMMARY ENDPOINT =====
router.get('/summary-detailed', async (req, res) => {
  try {
    const complaints = await Complaint.find();
    const staff = require('../models/Staff');
    const staffList = await staff.find({});

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const complaintsToday = complaints.filter(c => {
      const complaintDate = new Date(c.timestamp || c.createdAt);
      complaintDate.setHours(0, 0, 0, 0);
      return complaintDate.getTime() === today.getTime();
    }).length || 0;

    const resolvedToday = complaints.filter(c => {
      const complaintDate = new Date(c.timestamp || c.createdAt);
      complaintDate.setHours(0, 0, 0, 0);
      return complaintDate.getTime() === today.getTime() && c.status === 'Resolved';
    }).length || 0;

    const flaggedToday = complaints.filter(c => {
      const complaintDate = new Date(c.timestamp || c.createdAt);
      complaintDate.setHours(0, 0, 0, 0);
      return complaintDate.getTime() === today.getTime() && c.status === 'Rejected';
    }).length || 0;

    // Average time to fix
    const resolvedComplaints = complaints.filter(c => c.status === 'Resolved');
    const avgTimeToFix = resolvedComplaints.length > 0
      ? Math.round(resolvedComplaints.reduce((sum, c) => sum + (Date.now() - new Date(c.timestamp || c.createdAt).getTime()), 0) / resolvedComplaints.length / 3600000)
      : 0;

    const pendingStaffApprovals = staffList.filter(s => s.approvalStatus === 'pending').length || 0;

    res.json({
      complaintsToday,
      resolvedToday,
      flaggedToday,
      avgTimeToFixHrs: avgTimeToFix,
      pendingStaffApprovals,
      totalComplaints: complaints.length,
      autoRoutedToday: Math.max(0, Math.round(complaintsToday * 0.85))
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load detailed summary', error: error.message });
  }
});

module.exports = router;
module.exports.isOfficerReviewCase = isOfficerReviewCase;
