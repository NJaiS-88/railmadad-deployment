# RailMadad: Connecting Staff, Passenger & Officer Dashboards

## User Types & Connections

```
┌─────────────────────────────────────────────────────────────────┐
│                        PASSENGER                                 │
│                   Files Complaint via App                        │
│         (Text + Photo + Audio/Video + Location)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │      ML SERVICE (LLM Analysis)       │
        │  • Extract complaint category        │
        │  • Calculate severity/confidence     │
        │  • Verify location/media authenticity│
        └──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        OFFICER                                   │
│              Reviews & Routes Complaint                         │
│  • Verifies AI classification (Review Queue)                   │
│  • Checks for fraud/mismatches (Flagged)                       │
│  • Groups duplicates (Clusters)                                │
│  • Routes to correct department(s)                             │
└──────────────────────────────┬────────────────────────────────┘
                               │
                  ┌────────────┴────────────┐
                  │                         │
                  ▼                         ▼
        ┌──────────────────┐      ┌──────────────────┐
        │  ASSIGN STAFF    │      │  DEPARTMENT      │
        │  (From approved  │      │  WORKFLOW        │
        │   staff pool)    │      │  (Electrical,    │
        └────────┬─────────┘      │   Maintenance,   │
                 │                │   etc.)          │
                 ▼                └────────┬─────────┘
┌─────────────────────────────────────────┼──────────────────────┐
│                        STAFF                   │                 │
│             Works on Assigned Tasks           ▼                 │
│  • Views assigned complaints                                    │
│  • Updates status (In Progress → Resolved)                     │
│  • Uploads completion proof (photos, etc.)                     │
│  • Gets performance metrics                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow: From Complaint to Resolution

### 1. Passenger Files Complaint
```
Frontend: frontend-passenger
├─ Complaint Form:
│  ├─ Text description
│  ├─ Photo upload
│  ├─ Audio/Video upload
│  ├─ Location (GPS)
│  ├─ Train number
│  ├─ Coach number
│  └─ PNR (if booked)
│
├─ Browser Processing (HuggingFace):
│  ├─ Image → Text caption (if photo)
│  ├─ Audio → Transcription (if audio)
│  └─ Video → Scene description (if video)
│
└─ API Call: POST /api/complaints/
   └─ Backend processes and triggers ML service
```

### 2. Officer Reviews & Routes
```
Frontend: frontend-officer
├─ Review Queue:
│  ├─ AI suggested category + confidence
│  ├─ Officer confirms or overrides
│  └─ POST /officer/override
│
├─ Flagged Complaints:
│  ├─ Location mismatch detected
│  ├─ Media authenticity check
│  ├─ Officer approves or rejects
│  └─ POST /officer/flagged/:id/resolve
│
├─ Clusters (Duplicates):
│  ├─ Multiple complaints same issue
│  ├─ Grouped for efficiency
│  └─ POST /officer/clusters/:id/confirm
│
└─ Route to Department(s):
   ├─ Officer selects owner department
   ├─ For multi-dept: mark secondary teams
   └─ POST /officer/complaints/:id/assign-owner
```

### 3. Staff Approval (New Feature)
```
Frontend: frontend-officer → Staff Approval page
├─ Officer reviews new staff applications
├─ Checks:
│  ├─ ID proof validity
│  ├─ Department match
│  ├─ Experience level
│  └─ Certifications/specializations
│
├─ Actions:
│  ├─ Approve → staff.approvalStatus = 'approved'
│  │           → staff becomes available for assignment
│  │           → POST /officer/staff-approval/:id/approve
│  │
│  └─ Reject → staff.approvalStatus = 'rejected'
│             → reason recorded
│             → POST /officer/staff-approval/:id/reject
│
└─ Backend: Staff model updated with approval fields
```

### 4. Staff Assignment
```
Officer Dashboard:
├─ When routing complaint to department
├─ Select staff member:
│  ├─ Must be approved (approvalStatus = 'approved')
│  ├─ Must be in correct department
│  ├─ Should be available
│  └─ Filter by specialization if needed
│
└─ POST /officer/complaints/:id/assign-staff
   ├─ Links staff to complaint
   ├─ Creates notification for staff
   └─ Staff sees new task on their dashboard
```

### 5. Staff Works on Task
```
Frontend: frontend-staff
├─ Dashboard shows:
│  ├─ Assigned complaints (new tasks)
│  ├─ In-progress work
│  ├─ Completed tasks
│  └─ Performance metrics
│
├─ For each complaint:
│  ├─ View details:
│  │  ├─ Passenger complaint text
│  │  ├─ Photos/media
│  │  ├─ Location
│  │  ├─ Category assigned by AI
│  │  └─ Officer notes
│  │
│  └─ Update status:
│     ├─ Start work → "In Progress"
│     ├─ Upload proof:
│     │  ├─ Before/after photos
│     │  ├─ Video of fix
│     │  └─ Maintenance report
│     │
│     └─ Mark complete → "Resolved"
│        └─ Complaint marked resolved in Officer dashboard
```

### 6. Officer Monitoring
```
Frontend: frontend-officer
├─ Analytics Dashboard:
│  ├─ Tracks resolution times
│  ├─ Monitors staff performance
│  ├─ Identifies bottlenecks
│  └─ Measures passenger satisfaction
│
├─ Hotspots View:
│  ├─ Recurring issues on trains
│  ├─ Risk scoring
│  ├─ Maintenance prioritization
│  └─ Predictive alerts
│
└─ Staff Performance:
   ├─ Completion rate
   ├─ Average resolution time
   ├─ Quality ratings
   └─ Availability patterns
```

---

## Database Connections

### Complaint Document
```javascript
{
  _id: ObjectId,
  complaintId: "RMDA12345678",
  user: ObjectId → User,
  passengerName: "John Doe",
  passengerPhone: "+919876543210",
  trainNumber: "12001",
  coach: "A1",
  pnr: "1234567890",
  description: "AC is not working",
  category: "Coach Electrical Fault",
  severity: "High|Medium|Low",
  status: "Submitted|Verified|Routed to Department|Resolved|Rejected",
  media: {
    image: "url",
    audio: "url",
    video: "url",
    audioText: "transcription",
    imageText: "description"
  },
  llmAnalysis: {
    summary: "...",
    keywords: [...],
    confidence: 0.85
  },
  assignedStaff: ObjectId → Staff,
  department: "Electrical",
  timestamp: Date,
  timeline: [
    { status: "Submitted", time: "15 Dec 09:30", completed: true },
    { status: "Verified", time: "15 Dec 10:15", completed: true },
    { status: "Routed to Department", time: "15 Dec 10:30", completed: true },
    { status: "Resolved", time: "15 Dec 14:00", completed: true }
  ]
}
```

### Staff Document
```javascript
{
  _id: ObjectId,
  staffId: "STF-001",
  name: "Rajesh Kumar",
  email: "rajesh@railway.in",
  phone: "+919876543210",
  role: "Electrical Officer",
  department: "Electrical",
  specialisation: ["AC repair", "Lighting", "Wiring"],
  shift: "morning|evening|night",
  station: "Central Station",
  experience_years: 5,
  available: true,
  approvalStatus: "pending|approved|rejected",  // NEW
  idProof: "A123456789012345",  // NEW
  idProofType: "Aadhar",  // NEW
  approvedBy: "Officer A. Verma",  // NEW
  approvalDate: Date,  // NEW
  rejectionReason: "Incomplete documentation"  // NEW
}
```

### User Document
```javascript
{
  _id: ObjectId,
  name: "Priya Sharma",
  email: "priya@email.com",
  phone: "+919876543210",
  password: "hashed_password",
  role: "passenger|staff|officer",
  createdAt: Date
}
```

---

## API Flow for Each User Type

### Passenger API
```
POST   /api/auth/signup              - Register
POST   /api/auth/login               - Login
POST   /api/complaints/              - File complaint
GET    /api/complaints/my-complaints - View own complaints
GET    /api/complaints/:id           - View complaint details
PUT    /api/complaints/:id/feedback  - Rate resolution
```

### Officer API
```
GET    /api/officer/summary-detailed      - Dashboard stats
GET    /api/officer/review-queue          - Low confidence
GET    /api/officer/flagged               - Suspicious complaints
GET    /api/officer/clusters              - Duplicates
GET    /api/officer/multi-department      - Multi-dept complaints
GET    /api/officer/staff-approval        - Pending staff approvals
GET    /api/officer/hotspots              - Recurring issues
GET    /api/officer/analytics/detailed    - Analytics metrics
GET    /api/officer/reports               - All complaints for reports

POST   /api/officer/override              - Override classification
POST   /api/officer/flagged/:id/resolve   - Approve/reject flagged
POST   /api/officer/clusters/:id/confirm  - Confirm cluster
POST   /api/officer/staff-approval/:id/approve - Approve staff
POST   /api/officer/staff-approval/:id/reject  - Reject staff
POST   /api/officer/complaints/:id/assign-staff - Assign to staff
```

### Staff API
```
GET    /api/staff/dashboard           - My tasks
GET    /api/staff/complaints/:id      - View complaint details
PUT    /api/staff/complaints/:id      - Update status
POST   /api/staff/complaints/:id/proof - Upload completion proof
GET    /api/staff/performance         - My metrics
```

---

## Key Integration Points

### 1. **Staff Approval Workflow** (New)
```
Officer approves staff → Staff.approvalStatus = 'approved'
                      → Staff becomes available for assignment
                      → Officer can select approved staff when routing complaints
```

### 2. **AI-Officer Loop**
```
AI suggests category with confidence
         ↓
Officer reviews (Review Queue)
         ↓
Officer confirms or overrides
         ↓
System learns from overrides
         ↓
AI accuracy improves over time
```

### 3. **Officer-Staff Loop**
```
Officer routes complaint to department
                      ↓
Officer selects approved staff member
                      ↓
Staff views complaint on their dashboard
                      ↓
Staff works and updates status
                      ↓
Officer monitors progress via Analytics/hotspots
                      ↓
Staff marked performance metrics
```

### 4. **Passenger-Officer-Staff Loop**
```
Passenger files complaint
         ↓
Officer verifies & routes
         ↓
Staff resolves
         ↓
Passenger sees resolution
         ↓
System tracks satisfaction
         ↓
Analytics shows passenger satisfaction rate
```

---

## Environment Variables Setup

**.env (Backend)**
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/railmadad
NODE_ENV=development
```

**.env.local (Frontend Officer)**
```
VITE_API_URL=http://localhost:5000/api
```

**.env.local (Frontend Passenger)**
```
VITE_API_URL=http://localhost:5000/api
```

**.env.local (Frontend Staff)**
```
VITE_API_URL=http://localhost:5000/api
```

---

## Running All Services

```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev

# Terminal 2: Officer Dashboard
cd rail-madad-frontend/frontend-officer
npm install
npm run dev

# Terminal 3: Passenger App
cd rail-madad-frontend/frontend-passenger
npm install
npm run dev

# Terminal 4: Staff Dashboard
cd rail-madad-frontend/frontend-staff
npm install
npm run dev
```

**Access Points:**
- Officer: http://localhost:5173 (or configured port)
- Passenger: http://localhost:5174 (or configured port)
- Staff: http://localhost:5175 (or configured port)
- Backend: http://localhost:5000

---

## Summary

✅ **Passenger**: Files complaint with media
✅ **AI/LLM**: Analyzes and categorizes  
✅ **Officer**: Verifies, routes, approves staff, monitors
✅ **Staff**: Works on assigned tasks, marks complete
✅ **Feedback Loop**: System learns and improves

All connected through real database records with no dummy data.
