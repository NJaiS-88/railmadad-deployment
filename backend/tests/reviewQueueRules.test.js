const test = require('node:test');
const assert = require('node:assert/strict');

const { isOfficerReviewCase } = require('../routes/officerRoutes');

test('auto-routed complaints with active staff are excluded from officer review queue', () => {
  const complaint = {
    complaintId: 'RMDA123',
    status: 'Routed to Department',
    manual_review_required: false,
    evidenceVerification: { verification_status: 'VERIFIED', human_review_required: false },
    llmAnalysis: { is_sufficient: true, has_issue: true },
    staffAssignment: { staff_id: 'S1', staff_name: 'Ramesh', status: 'Assigned' }
  };

  assert.equal(isOfficerReviewCase(complaint), false);
});

test('auto-verified complaints are excluded even when LLM text mentions review keywords', () => {
  const autoVerified = {
    complaintId: 'RMDA101',
    status: 'Verified',
    manual_review_required: false,
    evidenceVerification: { verification_status: 'VERIFIED', human_review_required: false },
    classification: { manual_review_required: false, confidence: 92 },
    llmAnalysis: {
      is_sufficient: true,
      has_issue: true,
      decision_reasoning: 'Evidence matches train position. No manual review required, no conflict found, report is not insufficient.'
    },
    staffAssignment: { staff_id: 'S2', staff_name: 'Sita', status: 'Accepted' }
  };

  assert.equal(isOfficerReviewCase(autoVerified), false);
});

test('routed auto-verified complaints never appear even with lingering flags', () => {
  const routedWithLingeringFlags = {
    complaintId: 'RMDA102',
    status: 'Routed to Department',
    manual_review_required: true,
    evidenceVerification: { verification_status: 'VERIFIED', human_review_required: false },
    llmAnalysis: { is_sufficient: true, has_issue: true },
    staffAssignment: { staff_id: 'S3', staff_name: 'Anil', status: 'Assigned' }
  };

  assert.equal(isOfficerReviewCase(routedWithLingeringFlags), false);
});

test('suspicious verification status requires manual review', () => {
  const suspicious = {
    complaintId: 'RMDA103',
    status: 'Submitted',
    manual_review_required: false,
    evidenceVerification: { verification_status: 'SUSPICIOUS', human_review_required: true },
    llmAnalysis: { is_sufficient: true, has_issue: true }
  };

  assert.equal(isOfficerReviewCase(suspicious), true);
});

test('resolved and rejected complaints are always excluded', () => {
  const resolved = {
    complaintId: 'RMDA104',
    status: 'Resolved',
    manual_review_required: true,
    evidenceVerification: { verification_status: 'FLAGGED', human_review_required: true },
    llmAnalysis: { is_sufficient: false, has_issue: false }
  };

  assert.equal(isOfficerReviewCase(resolved), false);
});

test('manual and flagged complaints are included in officer review queue', () => {
  const manualReview = {
    complaintId: 'RMDA456',
    status: 'Submitted',
    manual_review_required: true,
    evidenceVerification: { verification_status: 'VERIFIED', human_review_required: false },
    llmAnalysis: { is_sufficient: true, has_issue: true }
  };

  const flaggedEvidence = {
    complaintId: 'RMDA789',
    status: 'Submitted',
    manual_review_required: false,
    evidenceVerification: { verification_status: 'FLAGGED', human_review_required: true },
    llmAnalysis: { is_sufficient: true, has_issue: true }
  };

  assert.equal(isOfficerReviewCase(manualReview), true);
  assert.equal(isOfficerReviewCase(flaggedEvidence), true);
});

test('complaints awaiting passenger clarification are excluded from officer queue', () => {
  const awaitingClarification = {
    complaintId: 'RMDA200',
    status: 'Submitted',
    manual_review_required: false,
    evidenceVerification: { verification_status: 'VERIFIED', human_review_required: false },
    llmAnalysis: { is_sufficient: false, has_issue: true, requires_manual_officer_review: false },
    followUp: { status: 'awaiting_response', questions: ['Please describe the issue?'], answers: [] }
  };

  assert.equal(isOfficerReviewCase(awaitingClarification), false);
});

test('partially-related complaints are included in officer review queue', () => {
  const partiallyRelated = {
    complaintId: 'RMDA201',
    status: 'Submitted',
    manual_review_required: true,
    evidenceVerification: { verification_status: 'VERIFIED', human_review_required: false },
    llmAnalysis: { is_sufficient: false, has_issue: true, relevance: 'partially_related', requires_manual_officer_review: true },
    followUp: { status: 'manual_review', questions: [], answers: [] }
  };

  assert.equal(isOfficerReviewCase(partiallyRelated), true);
});

test('rejected complaints never appear in the officer queue even with review flags', () => {
  const rejected = {
    complaintId: 'RMDA202',
    status: 'Rejected',
    manual_review_required: true,
    evidenceVerification: { verification_status: 'FLAGGED', human_review_required: true },
    llmAnalysis: { is_sufficient: false, has_issue: false, relevance: 'unrelated' },
    rejectionReason: 'Not related to a railway issue.'
  };

  assert.equal(isOfficerReviewCase(rejected), false);
});

test('verified complaints without a staff assignment stay in the review queue', () => {
  const verifiedNoStaff = {
    complaintId: 'RMDA203',
    status: 'Verified',
    manual_review_required: false,
    evidenceVerification: { verification_status: 'VERIFIED', human_review_required: false },
    llmAnalysis: { is_sufficient: true, has_issue: true }
  };

  assert.equal(isOfficerReviewCase(verifiedNoStaff), true);
});

test('routed complaints without an active staff assignment surface for manual review', () => {
  const routedNoStaff = {
    complaintId: 'RMDA204',
    status: 'Routed to Department',
    manual_review_required: false,
    evidenceVerification: { verification_status: 'VERIFIED', human_review_required: false },
    llmAnalysis: { is_sufficient: true, has_issue: true }
  };

  assert.equal(isOfficerReviewCase(routedNoStaff), true);
});

test('routed complaints with rejected staff assignments surface for manual review', () => {
  const routedStaffRejected = {
    complaintId: 'RMDA205',
    status: 'Routed to Department',
    manual_review_required: false,
    evidenceVerification: { verification_status: 'VERIFIED', human_review_required: false },
    llmAnalysis: { is_sufficient: true, has_issue: true },
    staffAssignment: { staff_id: 'S9', staff_name: 'Rejected Staff', status: 'Rejected' }
  };

  assert.equal(isOfficerReviewCase(routedStaffRejected), true);
});
