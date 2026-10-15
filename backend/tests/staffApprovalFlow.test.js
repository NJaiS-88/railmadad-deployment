const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDepartment,
  findBestApprovedStaff,
  canStaffAccessPortal
} = require('../services/staffAssignmentService');

test('normalizeDepartment maps complaint department names consistently', () => {
  assert.equal(normalizeDepartment('sanitation / toilet issue'), 'Cleanliness/Housekeeping');
  assert.equal(normalizeDepartment('Electrical fault / fan not working'), 'Electrical');
  assert.equal(normalizeDepartment('medical emergency'), 'Medical/Health');
});

test('staff login is blocked until officer approval', () => {
  const staff = { approvalStatus: 'pending' };
  assert.equal(canStaffAccessPortal(staff), false);

  const approved = { approvalStatus: 'approved' };
  assert.equal(canStaffAccessPortal(approved), true);
});

test('best staff is selected from approved staff in matching department nearby', () => {
  const staffList = [
    { staffId: 'S-1', name: 'A', department: 'Cleanliness/Housekeeping', approvalStatus: 'approved', location: { lat: 17.4322, lng: 78.5034 }, station: 'Platform 3' },
    { staffId: 'S-2', name: 'B', department: 'Electrical', approvalStatus: 'approved', location: { lat: 17.4200, lng: 78.4900 }, station: 'Platform 1' },
    { staffId: 'S-3', name: 'C', department: 'Cleanliness/Housekeeping', approvalStatus: 'pending', location: { lat: 17.4310, lng: 78.5005 }, station: 'Platform 2' }
  ];

  const best = findBestApprovedStaff(staffList, {
    department: 'Cleanliness/Housekeeping',
    location: { lat: 17.4310, lng: 78.5005 }
  });

  assert.equal(best.staffId, 'S-1');
});
