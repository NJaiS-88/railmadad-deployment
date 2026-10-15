// Field staff roster. In production this comes from the crew-management
// system (GET /officer/staff) — see src/api/officerClient.js.

export const MOCK_STAFF = [
  { id: 'ST-101', name: 'Ramesh Yadav', role: 'Cleaning Supervisor', department: 'Cleanliness/Housekeeping', base: 'Mumbai Central', onDuty: true },
  { id: 'ST-102', name: 'Suresh Pawar', role: 'Coach Attendant', department: 'Cleanliness/Housekeeping', base: 'Kalyan Jn', onDuty: true },
  { id: 'ST-103', name: 'Anita Kamble', role: 'Cleaning Supervisor', department: 'Cleanliness/Housekeeping', base: 'Nagpur Jn', onDuty: true },
  { id: 'ST-104', name: 'Firoz Sheikh', role: 'Sanitation Lead', department: 'Cleanliness/Housekeeping', base: 'Bhopal Jn', onDuty: false },

  { id: 'ST-201', name: 'Vikram Nair', role: 'Electrician', department: 'Electrical', base: 'Guntakal Jn', onDuty: true },
  { id: 'ST-202', name: 'Deepak Rao', role: 'Electrician', department: 'Electrical', base: 'Secunderabad Jn', onDuty: true },
  { id: 'ST-203', name: 'Meena Iyer', role: 'Electrical Supervisor', department: 'Electrical', base: 'Vijayawada Jn', onDuty: true },

  { id: 'ST-301', name: 'Harpreet Singh', role: 'Mechanical Fitter', department: 'Mechanical', base: 'Itarsi Jn', onDuty: true },
  { id: 'ST-302', name: 'Ajay Chauhan', role: 'Coach Mechanic', department: 'Mechanical', base: 'Bina Jn', onDuty: true },
  { id: 'ST-303', name: 'Rakesh Sharma', role: 'Mechanical Fitter', department: 'Mechanical', base: 'Asansol Jn', onDuty: true },

  { id: 'ST-401', name: 'Insp. R. K. Verma', role: 'RPF Inspector', department: 'RPF/Security', base: 'Kalyan Jn', onDuty: true },
  { id: 'ST-402', name: 'Const. Sunita Devi', role: 'RPF Constable', department: 'RPF/Security', base: 'Nagpur Jn', onDuty: true },
  { id: 'ST-403', name: 'Const. Manoj Tiwari', role: 'RPF Constable', department: 'RPF/Security', base: 'Warangal', onDuty: true },

  { id: 'ST-501', name: 'S. Balakrishnan', role: 'Catering Inspector', department: 'Commercial/Catering', base: 'Vijayawada Jn', onDuty: true },
  { id: 'ST-502', name: 'Neha Joshi', role: 'IRCTC Coordinator', department: 'Commercial/Catering', base: 'Bhopal Jn', onDuty: true },

  { id: 'ST-601', name: 'P. Subramaniam', role: 'Permanent Way Inspector', department: 'Civil/Infrastructure', base: 'Warangal', onDuty: true },
  { id: 'ST-602', name: 'Kiran Bedi Gill', role: 'Track Maintainer', department: 'Civil/Infrastructure', base: 'Secunderabad Jn', onDuty: true },
];
