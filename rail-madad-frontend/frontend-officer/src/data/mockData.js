// Mock data for the officer dashboard. Every array here is deliberately sized
// and distributed to match what the officer's six real jobs need — not a
// generic "all complaints" table. Swap these for live API responses via
// src/api/officerClient.js when the backend is ready.

export const TODAY_SUMMARY = {
  totalComplaintsToday: 342,
  autoRoutedToday: 318,
  autoRoutedPct: 93,
};

// ---------------------------------------------------------------------------
// 1. Low-confidence classifications awaiting officer review
// ---------------------------------------------------------------------------
export const REVIEW_QUEUE = [
  {
    id: 'RMDA-88231',
    excerpt: 'Strange smell coming from AC vent near seat 34, getting worse since Bhopal.',
    train: '12951',
    trainName: 'Mumbai Rajdhani',
    coach: 'A1',
    aiCategory: 'AC / Cooling Fault',
    aiCategoryAlt: 'Electrical Fault',
    confidence: 61,
    department: 'Mechanical',
    submittedAgo: '8 min ago',
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300&auto=format&fit=crop&q=60',
  },
  {
    id: 'RMDA-88214',
    excerpt: 'Water pooling near the vestibule door, coach staff say it is from the pantry side.',
    train: '12952',
    trainName: 'August Kranti Rajdhani',
    coach: 'H1',
    aiCategory: 'Water Leakage',
    aiCategoryAlt: 'Catering / Pantry',
    confidence: 57,
    department: 'Mechanical',
    submittedAgo: '19 min ago',
    imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300&auto=format&fit=crop&q=60',
  },
  {
    id: 'RMDA-88198',
    excerpt: 'Passenger reports being asked for extra cash by TTE for a berth change in S7.',
    train: '12137',
    trainName: 'Punjab Mail',
    coach: 'S7',
    aiCategory: 'Staff Misconduct',
    aiCategoryAlt: 'Ticketing Irregularity',
    confidence: 64,
    department: 'RPF/Security',
    submittedAgo: '26 min ago',
    imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=300&auto=format&fit=crop&q=60',
  },
  {
    id: 'RMDA-88176',
    excerpt: 'Charging point spark seen briefly near berth 12, coach now smells slightly burnt.',
    train: '12626',
    trainName: 'Karnataka Express',
    coach: 'B2',
    aiCategory: 'Electrical Fault',
    aiCategoryAlt: 'Fire Safety Concern',
    confidence: 59,
    department: 'Electrical',
    submittedAgo: '41 min ago',
    imageUrl: 'https://images.unsplash.com/photo-1509395062183-67c5ad6faff9?w=300&auto=format&fit=crop&q=60',
  },
];

// ---------------------------------------------------------------------------
// 2. Flagged — verification mismatch (possible fraud / misattribution)
// ---------------------------------------------------------------------------
export const FLAGGED_COMPLAINTS = [
  {
    id: 'RMDA-87990',
    description: 'Broken window pane in coach S3, photo submitted as evidence.',
    train: '17019',
    trainName: 'Secunderabad Express',
    coach: 'S3',
    claimedLocation: 'Between Warangal and Secunderabad',
    detectedLocation: 'Near Vijayawada yard (stationary, 6 hrs earlier)',
    distanceKm: 340,
    ocrMismatch: { claimed: 'S3', detected: 'B6' },
    department: 'Mechanical',
    submittedAgo: '32 min ago',
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=400&auto=format&fit=crop&q=60',
  },
  {
    id: 'RMDA-87955',
    description: 'Toilet flush not working, coach B4 — passenger requests urgent fix.',
    train: '12301',
    trainName: 'Howrah Rajdhani',
    coach: 'B4',
    claimedLocation: 'Near Dhanbad',
    detectedLocation: 'Near Asansol, 78 km from claimed point',
    distanceKm: 78,
    ocrMismatch: null,
    department: 'Cleanliness/Housekeeping',
    submittedAgo: '55 min ago',
    imageUrl: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&auto=format&fit=crop&q=60',
  },
];

// ---------------------------------------------------------------------------
// 3. Active incident clusters — multiple passengers, same issue
// ---------------------------------------------------------------------------
export const CLUSTERS = [
  {
    id: 'CL-4471',
    category: 'Coach Cleanliness',
    train: '12951',
    trainName: 'Mumbai Rajdhani',
    coach: 'B4',
    department: 'Cleanliness/Housekeeping',
    priority: 'high',
    status: 'Awaiting confirmation',
    firstReportedAgo: '48 min ago',
    reports: [
      { id: 'RMDA-88241', excerpt: 'Washroom sink not draining, water on floor.', submittedAgo: '48 min ago' },
      { id: 'RMDA-88239', excerpt: 'Washroom in B4 flooded, unusable.', submittedAgo: '40 min ago' },
      { id: 'RMDA-88233', excerpt: 'Same washroom issue, floor slippery near door.', submittedAgo: '31 min ago' },
      { id: 'RMDA-88227', excerpt: 'Third complaint about B4 washroom this hour.', submittedAgo: '22 min ago' },
      { id: 'RMDA-88219', excerpt: 'Washroom still flooded, no staff seen yet.', submittedAgo: '9 min ago' },
    ],
  },
  {
    id: 'CL-4468',
    category: 'Lighting Issue',
    train: '12626',
    trainName: 'Karnataka Express',
    coach: 'A1',
    department: 'Electrical',
    priority: 'medium',
    status: 'Awaiting confirmation',
    firstReportedAgo: '1 hr 10 min ago',
    reports: [
      { id: 'RMDA-88180', excerpt: 'Entire bay lights out since Guntakal.', submittedAgo: '1 hr 10 min ago' },
      { id: 'RMDA-88171', excerpt: 'Confirming A1 lights still not working.', submittedAgo: '52 min ago' },
      { id: 'RMDA-88162', excerpt: 'Reading lights and bay lights both down.', submittedAgo: '35 min ago' },
    ],
  },
  {
    id: 'CL-4459',
    category: 'Crowding',
    train: '12247',
    trainName: 'Duronto Express',
    coach: 'S1',
    department: 'RPF/Security',
    priority: 'medium',
    status: 'Escalated',
    firstReportedAgo: '2 hr 5 min ago',
    reports: [
      { id: 'RMDA-88090', excerpt: 'Unreserved passengers occupying sleeper berths.', submittedAgo: '2 hr 5 min ago' },
      { id: 'RMDA-88083', excerpt: 'Aisle blocked, cannot reach seat 24.', submittedAgo: '1 hr 40 min ago' },
      { id: 'RMDA-88071', excerpt: 'Same coach, still overcrowded near door.', submittedAgo: '1 hr 5 min ago' },
      { id: 'RMDA-88066', excerpt: 'RPF requested again for S1.', submittedAgo: '48 min ago' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 4. Multi-department complaints — need a primary + secondary owner
// ---------------------------------------------------------------------------
export const MULTI_DEPT_COMPLAINTS = [
  {
    id: 'RMDA-88110',
    description: 'Coach S5 washroom light fused and floor has standing water near the electrical panel.',
    train: '12615',
    trainName: 'Grand Trunk Express',
    coach: 'S5',
    submittedAgo: '1 hr 2 min ago',
    tags: [
      { department: 'Cleanliness/Housekeeping', slaHours: 4, elapsedHours: 3.4 },
      { department: 'Electrical', slaHours: 2, elapsedHours: 2.3 },
    ],
    primaryOwner: 'Electrical',
  },
  {
    id: 'RMDA-88102',
    description: 'Door jammed in D1 and the coach attendant is unreachable — passengers unable to detrain safely.',
    train: '16318',
    trainName: 'Netravati Express',
    coach: 'D1',
    submittedAgo: '1 hr 20 min ago',
    tags: [
      { department: 'Mechanical', slaHours: 1.5, elapsedHours: 1.6 },
      { department: 'RPF/Security', slaHours: 2, elapsedHours: 1.1 },
    ],
    primaryOwner: 'Mechanical',
  },
];

// ---------------------------------------------------------------------------
// 5. SLA breaches — department hasn't acted in time
// ---------------------------------------------------------------------------
export const SLA_BREACHES = [
  {
    id: 'RMDA-87890',
    description: 'No water in coach B2 washrooms since Nagpur — passengers complaining for 3 hours.',
    train: '12056',
    trainName: 'Dehradun Shatabdi',
    coach: 'B2',
    department: 'Cleanliness/Housekeeping',
    slaHours: 2,
    overdueByHours: 1.8,
  },
  {
    id: 'RMDA-87862',
    description: 'Fan not working in coach S9, reported before departure, still pending.',
    train: '12809',
    trainName: 'Mumbai Howrah Mail',
    coach: 'S9',
    department: 'Electrical',
    slaHours: 3,
    overdueByHours: 0.6,
  },
];

// ---------------------------------------------------------------------------
// 6. Already resolved / auto-routed — Reports page only, not the action queue
// ---------------------------------------------------------------------------
export const RESOLVED_COMPLAINTS = [
  { id: 'RMDA-87610', category: 'Coach Cleanliness', train: '12951', trainName: 'Mumbai Rajdhani', coach: 'B7', department: 'Cleanliness/Housekeeping', status: 'Resolved', routeType: 'Auto-routed', resolvedAgo: '3 hr ago', resolutionTimeHrs: 1.2 },
  { id: 'RMDA-87598', category: 'Commercial/Catering', train: '12952', trainName: 'August Kranti Rajdhani', coach: 'H1', department: 'Commercial/Catering', status: 'Resolved', routeType: 'Auto-routed', resolvedAgo: '4 hr ago', resolutionTimeHrs: 2.4 },
  { id: 'RMDA-87571', category: 'Electrical', train: '12615', trainName: 'Grand Trunk Express', coach: 'S5', department: 'Electrical', status: 'Resolved', routeType: 'Officer-reviewed', resolvedAgo: '5 hr ago', resolutionTimeHrs: 3.1 },
  { id: 'RMDA-87534', category: 'Door Issue', train: '16318', trainName: 'Netravati Express', coach: 'D1', department: 'Mechanical', status: 'Resolved', routeType: 'Auto-routed', resolvedAgo: '6 hr ago', resolutionTimeHrs: 1.8 },
  { id: 'RMDA-87498', category: 'Water Supply', train: '12056', trainName: 'Dehradun Shatabdi', coach: 'B2', department: 'Cleanliness/Housekeeping', status: 'Resolved', routeType: 'Officer-reviewed', resolvedAgo: '7 hr ago', resolutionTimeHrs: 4.0 },
  { id: 'RMDA-87455', category: 'Crowding', train: '12247', trainName: 'Duronto Express', coach: 'S1', department: 'RPF/Security', status: 'Resolved', routeType: 'Officer-reviewed', resolvedAgo: '8 hr ago', resolutionTimeHrs: 2.9 },
  { id: 'RMDA-87402', category: 'Lighting Issue', train: '12626', trainName: 'Karnataka Express', coach: 'A1', department: 'Electrical', status: 'Resolved', routeType: 'Auto-routed', resolvedAgo: '9 hr ago', resolutionTimeHrs: 1.5 },
  { id: 'RMDA-87361', category: 'Track Maintenance', train: '17019', trainName: 'Secunderabad Express', coach: '-', department: 'Civil/Infrastructure', status: 'Resolved', routeType: 'Officer-reviewed', resolvedAgo: '11 hr ago', resolutionTimeHrs: 5.6 },
  { id: 'RMDA-87309', category: 'Commercial/Catering', train: '12622', trainName: 'Tamil Nadu Express', coach: 'A2', department: 'Commercial/Catering', status: 'Resolved', routeType: 'Auto-routed', resolvedAgo: '13 hr ago', resolutionTimeHrs: 2.1 },
  { id: 'RMDA-87255', category: 'Coach Cleanliness', train: '12002', trainName: 'Bhopal Shatabdi', coach: 'C1', department: 'Cleanliness/Housekeeping', status: 'Resolved', routeType: 'Auto-routed', resolvedAgo: '15 hr ago', resolutionTimeHrs: 1.1 },
];

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export const ACCURACY_TREND = [
  { day: 'Mon', overrideRate: 14.2 },
  { day: 'Tue', overrideRate: 12.8 },
  { day: 'Wed', overrideRate: 11.5 },
  { day: 'Thu', overrideRate: 10.9 },
  { day: 'Fri', overrideRate: 9.6 },
  { day: 'Sat', overrideRate: 8.4 },
  { day: 'Sun', overrideRate: 7.9 },
];

export const COMPLAINTS_BY_CATEGORY = [
  { category: 'Cleanliness/Housekeeping', count: 96 },
  { category: 'Electrical', count: 74 },
  { category: 'Mechanical', count: 58 },
  { category: 'Commercial/Catering', count: 45 },
  { category: 'Security', count: 33 },
  { category: 'Civil/Infrastructure', count: 21 },
  { category: 'Others', count: 15 },
];

export const RESOLUTION_TIME_BY_DEPT = [
  { department: 'Cleanliness/Housekeeping', hours: 1.8 },
  { department: 'Electrical', hours: 2.4 },
  { department: 'Mechanical', hours: 3.1 },
  { department: 'Commercial/Catering', hours: 1.5 },
  { department: 'RPF/Security', hours: 2.0 },
  { department: 'Civil/Infrastructure', hours: 5.2 },
];

export const HOTSPOTS = [
  { train: '12951', trainName: 'Mumbai Rajdhani', coach: 'B4', count: 7, category: 'Coach Cleanliness' },
  { train: '17019', trainName: 'Secunderabad Express', coach: 'S3', count: 5, category: 'Structural / Mechanical' },
  { train: '12626', trainName: 'Karnataka Express', coach: 'A1', count: 4, category: 'Lighting Issue' },
  { train: '12247', trainName: 'Duronto Express', coach: 'S1', count: 4, category: 'Crowding' },
  { train: '12615', trainName: 'Grand Trunk Express', coach: 'S5', count: 3, category: 'Electrical' },
];
