const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  staffId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  specialisation: [String],
  role: {
    type: String,
    required: true
  },
  shift: {
    type: String,
    default: 'morning'
  },
  available: {
    type: Boolean,
    default: true
  },
  station: {
    type: String,
    default: 'Station HQ'
  },
  phone: {
    type: String,
    required: true
  },
  experience_years: {
    type: Number,
    default: 1
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  idProof: String,
  idProofType: {
    type: String,
    default: 'Railway ID Card'
  },
  password: {
    type: String,
    required: true
  },
  zone: String,
  depot: String,
  ocrResult: {
    detectedName: String,
    ocrText: String,
    matchConfidence: Number,
    isFlagged: Boolean,
    rawOcrText: String
  },
  approvedBy: String,
  approvalDate: Date,
  rejectionReason: String
}, { timestamps: true });

const RealStaffModel = mongoose.model('Staff', StaffSchema);

class StaffModelWrapper {
  constructor(data) {
    if (global.useLocalMockDB) {
      const { MockStaff } = require('./mockDb');
      return new MockStaff(data);
    } else {
      return new RealStaffModel(data);
    }
  }

  static find(query) {
    if (global.useLocalMockDB) {
      const { MockStaff } = require('./mockDb');
      return MockStaff.find(query);
    }
    return RealStaffModel.find(query);
  }

  static findOne(query) {
    if (global.useLocalMockDB) {
      const { MockStaff } = require('./mockDb');
      return MockStaff.findOne(query);
    }
    return RealStaffModel.findOne(query);
  }
}

module.exports = StaffModelWrapper;
