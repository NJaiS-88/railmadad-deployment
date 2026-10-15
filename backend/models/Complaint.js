const mongoose = require('mongoose');

const TimelineSchema = new mongoose.Schema({
  status: { type: String, required: true },
  time: { type: String, required: true },
  completed: { type: Boolean, default: false }
});

const ComplaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: String,
    ref: 'User'
  },
  passengerName: String,
  passengerPhone: String,
  trainNumber: {
    type: String,
    required: true
  },
  coach: {
    type: String,
    required: true
  },
  pnr: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  category: {
    type: String,
    default: 'General Complaint'
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Submitted', 'Verified', 'Routed to Department', 'Resolved', 'Rejected'],
    default: 'Submitted'
  },
  media: {
    image: String,
    audio: String,
    video: String
  },
  aiConversions: {
    imageText: String,
    audioText: String,
    videoText: String
  },
  llmAnalysis: {
    are_texts_related: String,
    urgency: String,
    decision_reasoning: String,
    missing_info: String,
    missing_questions: [String],
    is_sufficient: Boolean,
    requires_manual_officer_review: Boolean,
    keywords: [String],
    summary: mongoose.Schema.Types.Mixed,
    action_steps: [String],
    has_issue: Boolean
  },
  location: {
    lat: String,
    lng: String,
    address: String
  },
  evidenceVerification: {
    verification_status: String,
    risk_level: String,
    suspicion_score: Number,
    train_number: String,
    entered_coach: String,
    photo_metadata: {
      gps_available: Boolean,
      latitude: Number,
      longitude: Number,
      timestamp: String
    },
    train_position: {
      latitude: Number,
      longitude: Number,
      source: String,
      interpolated: Boolean
    },
    distance_km: Number,
    location_match: Boolean,
    ocr: {
      detected_coach: String,
      coach_match: Boolean,
      edit_distance: Number
    },
    human_review_required: Boolean,
    reasons: [String]
  },
  classification: {
    problem_type: String,
    category: String,
    department: String,
    departments: [String],
    sub_department: String,
    location: String,
    urgency: { type: String, enum: ['critical', 'high', 'medium', 'low'] },
    required_action: String,
    action_steps: [String],
    confidence: Number,
    reason: String,
    escalation_required: Boolean,
    manual_review_required: Boolean
  },
  staffAssignment: {
    status: String,
    staff_id: String,
    staff_name: String,
    role: String,
    department: String,
    departments: [String],
    contact_phone: String,
    station_area: String,
    assignment_reason: String,
    priority_action: String,
    estimated_response_time: String,
    confidence: Number,
    escalation_required: Boolean,
    backup_staff_id: String,
    backup_staff_name: String,
    // Workflow tracking
    assigned_at: Date,
    assignment_by: String,
    accepted_at: Date,
    started_at: Date,
    resolved_at: Date,
    rejected_at: Date,
    // Resolution details
    action_taken: String,
    proof_image: String,
    rejection_reason: String,
    flagged_for_manual_review: Boolean,
    // Department assignments fallback
    department_assignments: [{
      department: String,
      staff_id: String,
      staff_name: String,
      role: String,
      station_area: String,
      contact_phone: String,
      assignment_reason: String,
      priority_action: String,
      estimated_response_time: String,
      confidence: Number
    }]
  },
  timeline: [TimelineSchema],
  followUp: {
    status: {
      type: String,
      enum: ['not_required', 'awaiting_response', 'answered', 'satisfied', 'manual_review', 'rejected'],
      default: 'not_required'
    },
    questions: [String],
    answers: [String],
    answeredAt: Date,
    conversation: [{
      role: String,
      text: String,
      at: Date
    }]
  },
  analysisHistory: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  rejectionReason: String,
  rejectionSource: {
    type: String,
    enum: ['', 'auto', 'officer'],
    default: ''
  },
  passengerFeedback: {
    rating: Number,
    comment: String,
    submittedAt: Date
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const RealComplaintModel = mongoose.model('Complaint', ComplaintSchema);

class ComplaintModelWrapper {
  constructor(data) {
    if (global.useLocalMockDB) {
      return new MockComplaint(data);
    } else {
      return new RealComplaintModel(data);
    }
  }

  static find(query) {
    if (global.useLocalMockDB) {
      return MockComplaint.find(query);
    }
    return RealComplaintModel.find(query);
  }

  static findOne(query) {
    if (global.useLocalMockDB) {
      return MockComplaint.findOne(query);
    }
    return RealComplaintModel.findOne(query);
  }

  static findById(id) {
    if (global.useLocalMockDB) {
      return MockComplaint.findById(id);
    }
    return RealComplaintModel.findById(id);
  }
}

const { MockComplaint } = require('./mockDb');
module.exports = ComplaintModelWrapper;
