const mongoose = require('mongoose');
const { MockUser } = require('./mockDb');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['passenger', 'staff', 'officer'],
    default: 'passenger'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const RealUserModel = mongoose.model('User', UserSchema);

class UserModelWrapper {
  constructor(data) {
    if (global.useLocalMockDB) {
      return new MockUser(data);
    } else {
      return new RealUserModel(data);
    }
  }

  static find(query) {
    if (global.useLocalMockDB) {
      return MockUser.find(query);
    }
    return RealUserModel.find(query);
  }

  static findOne(query) {
    if (global.useLocalMockDB) {
      return MockUser.findOne(query);
    }
    return RealUserModel.findOne(query);
  }

  static findById(id) {
    if (global.useLocalMockDB) {
      return MockUser.findById(id);
    }
    return RealUserModel.findById(id);
  }
}

module.exports = UserModelWrapper;
