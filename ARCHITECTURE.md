# RailMadad Officer Dashboard - Architecture Overview

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           RAILMADAD PLATFORM                                 │
└──────────────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────────┐
                         │   PASSENGER APP      │
                         │ (Files Complaints)   │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌────────────┐  ┌────────────┐  ┌────────────┐
            │   Photo    │  │   Audio    │  │   Video    │
            │            │  │            │  │            │
            └────────────┘  └────────────┘  └────────────┘
                    │               │               │
                    │    (HuggingFace Browser ML)  │
                    │               │               │
                    ▼               ▼               ▼
            ┌────────────┐  ┌────────────┐  ┌────────────┐
            │   Image    │  │ Audio Text │  │ Video Text │
            │   Caption  │  │ (Transcr.) │  │(Description)
            └────────────┘  └────────────┘  └────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                         ┌──────────▼───────────┐
                         │  Backend Server      │
                         │  (Node.js/Express)   │
                         │  Port: 5000          │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
          ┌──────────────────┐ ┌──────────────┐ ┌─────────────┐
          │ ML Service (LLM) │ │  Database    │ │  API Routes │
          │ • Categorize    │ │  (MongoDB/   │ │ • Complaints│
          │ • Confidence    │ │   mockDB)    │ │ • Staff     │
          │ • Verify Auth   │ │              │ │ • Officers  │
          └────────┬─────────┘ └──────────────┘ └──────┬──────┘
                   │                                     │
                   └─────────────────┬───────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
      ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
      │  OFFICER DASH   │  │ PASSENGER DASH  │  │   STAFF DASH    │
      │  (React/Vite)   │  │  (React/Vite)   │  │  (React/Vite)   │
      │ Port: 5173      │  │ Port: 5174      │  │ Port: 5175      │
      └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
               │                    │                    │
               │ Review & Route     │ File Complaint     │ Work on Tasks
               │ Verify Staff       │ Track Status       │ Update Status
               │ Monitor Analytics  │ Rate Service       │ Upload Proof
               │
               ▼
     ┌───────────────────────────────────────┐
     │   OFFICER DASHBOARD PAGES             │
     ├───────────────────────────────────────┤
     │ 1. Overview (Real-time stats)         │
     │ 2. Review Queue (Low confidence)      │
     │ 3. Flagged (Mismatches)               │
     │ 4. Duplicates (Clusters)              │
     │ 5. Multi-Dept (Routing)               │
     │ 6. Staff Approvals (NEW)              │
     │ 7. Hotspots (Predictions) (NEW)       │
     │ 8. Analytics (System health)          │
     │ 9. Reports (Downloads)                │
     │ 10. Train Management (Unchanged)      │
     └───────────────────────────────────────┘
```

---

## Data Flow Diagram

```
COMPLAINT LIFECYCLE
═══════════════════════════════════════════════════════════════════════════

1. SUBMISSION
   ┌─────────────────────────┐
   │ Passenger App           │
   ├─────────────────────────┤
   │ • Text Description      │ ──┐
   │ • Photo                 │   │
   │ • Audio                 │   │ Browser Processing
   │ • Video                 │   │ (HuggingFace)
   │ • Location (GPS)        │ ──┤
   │ • Train #               │   │ Extract text from media
   │ • Coach #               │   │ Verify location
   │ • PNR (optional)        │ ──┘
   └────────────┬────────────┘
                │
                ▼
   ┌─────────────────────────┐
   │ Backend: POST /complain │
   │ Store all data + media  │
   └────────────┬────────────┘
                │
                ▼

2. ML ANALYSIS
   ┌─────────────────────────┐
   │ ML Service (Python)     │
   ├─────────────────────────┤
   │ • Category detection    │
   │ • Severity scoring      │
   │ • Confidence (0-100%)   │
   │ • Authenticity check    │
   │ • Location verification │
   │ • Media matching        │
   └────────────┬────────────┘
                │
                ├─ Confidence > 75%?
                │  YES → Auto-route to department
                │  NO → Send to Review Queue
                │
                └─ Mismatches detected?
                   YES → Flag for officer review
                   NO → Proceed to routing

3. OFFICER REVIEW (REVIEW QUEUE)
   ┌────────────────────────────────┐
   │ Officer Dashboard              │
   │ Review Queue Page              │
   ├────────────────────────────────┤
   │ Shows:                         │
   │ • AI suggested category        │
   │ • Confidence score             │
   │ • Complaint details            │
   │ • Media                        │
   │                                │
   │ Officer Actions:               │
   │ [Confirm] [Reassign Category]  │
   └────────────┬───────────────────┘
                │
                ├─ Confirm → Mark as "Verified"
                │
                └─ Reassign → Update category
                             Mark as "Verified"

4. FRAUD CHECK (FLAGGED)
   ┌────────────────────────────────┐
   │ Officer Dashboard              │
   │ Flagged Complaints Page        │
   ├────────────────────────────────┤
   │ Shows mismatches:              │
   │ • Photo doesn't match train    │
   │ • Location distance            │
   │ • Coach number mismatch        │
   │ • Media authenticity issue     │
   │                                │
   │ Officer Actions:               │
   │ [Approve] [Reject]             │
   └────────────┬───────────────────┘
                │
                ├─ Approve → "Verified" (proceed)
                │
                └─ Reject → "Rejected" (end)

5. DEDUPLICATION (CLUSTERS)
   ┌────────────────────────────────┐
   │ Officer Dashboard              │
   │ Duplicates Page                │
   ├────────────────────────────────┤
   │ Groups same issue:             │
   │ • 5 AC complaints              │
   │   on Train 12001 Coach B6      │
   │ • Shows as 1 cluster           │
   │                                │
   │ Officer Actions:               │
   │ [Confirm as One Incident]      │
   └────────────┬───────────────────┘
                │
                └─ Merge into single ticket

6. ROUTING (MULTI-DEPARTMENT)
   ┌────────────────────────────────┐
   │ Officer Dashboard              │
   │ Multi-Department Page          │
   ├────────────────────────────────┤
   │ Shows departments needed:      │
   │ • Primary: Electrical          │
   │ • Secondary: Safety            │
   │                                │
   │ Officer Actions:               │
   │ [Assign Owner] [Tag Secondary] │
   └────────────┬───────────────────┘
                │
                └─ Marks as "Routed to Department"
                   Tracks SLA for each dept

7. STAFF ASSIGNMENT
   ┌────────────────────────────────┐
   │ Officer Dashboard              │
   │ During Routing                 │
   ├────────────────────────────────┤
   │ Selects staff:                 │
   │ • Filter by department         │
   │ • Filter by availability       │
   │ • Only APPROVED staff shown    │
   │                                │
   │ Officer Actions:               │
   │ [Select Staff Member]          │
   └────────────┬───────────────────┘
                │
                └─ Staff assignment created
                   Notification sent to staff

8. STAFF WORK
   ┌────────────────────────────────┐
   │ Staff Dashboard                │
   ├────────────────────────────────┤
   │ New task appears               │
   │ Staff views complaint details  │
   │ Staff updates status:          │
   │ • "In Progress"                │
   │ • Uploads proof (photos)       │
   │ • "Resolved"                   │
   └────────────┬───────────────────┘
                │
                └─ Marks as "Resolved"

9. TRACKING (OFFICER ANALYTICS)
   ┌────────────────────────────────┐
   │ Officer Dashboard              │
   │ Analytics Page                 │
   ├────────────────────────────────┤
   │ Metrics tracked:               │
   │ • Resolution time              │
   │ • Passenger satisfaction       │
   │ • AI accuracy                  │
   │ • Department workload          │
   │ • Staff performance            │
   │ • Hotspot identification       │
   └────────────────────────────────┘

10. MAINTENANCE PREDICTION (HOTSPOTS)
    ┌────────────────────────────────┐
    │ Officer Dashboard              │
    │ Hotspots Page                  │
    ├────────────────────────────────┤
    │ Shows recurring issues:        │
    │ • Train 12001, Coach B6        │
    │ • 7 AC complaints              │
    │ • High maintenance priority    │
    │                                │
    │ Recommendation:                │
    │ Schedule preventive inspection │
    └────────────────────────────────┘
```

---

## Database Schema

```
COMPLAINTS COLLECTION
{
  _id: ObjectId,
  complaintId: "RMDA12345678",
  user: ObjectId → User,
  passengerName: "John Doe",
  passengerPhone: "+919876543210",
  trainNumber: "12001",
  coach: "A1",
  description: "AC not working",
  category: "Coach Electrical Fault",
  severity: "High|Medium|Low",
  status: "Submitted|Verified|Routed|Resolved|Rejected",
  media: {
    image: "url",
    audio: "url",
    video: "url",
    audioText: "transcription",
    imageText: "caption"
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
    { status: "Submitted", time: "...", completed: true },
    { status: "Verified", time: "...", completed: true },
    ...
  ]
}

STAFF COLLECTION
{
  _id: ObjectId,
  staffId: "STF-001",
  name: "Rajesh Kumar",
  email: "rajesh@railway.in",
  phone: "+919876543210",
  role: "Electrical Officer",
  department: "Electrical",
  specialisation: ["AC", "Lighting"],
  shift: "morning",
  station: "Central Station",
  experience_years: 5,
  available: true,
  
  # NEW FIELDS
  approvalStatus: "pending|approved|rejected",
  idProof: "A123456789012345",
  idProofType: "Aadhar",
  approvedBy: "Officer A. Verma",
  approvalDate: Date,
  rejectionReason: "..."
}

USERS COLLECTION
{
  _id: ObjectId,
  name: "...",
  email: "...",
  phone: "...",
  password: "hashed",
  role: "passenger|staff|officer",
  createdAt: Date
}
```

---

## API Endpoint Architecture

```
ROOT: http://localhost:5000/api

COMPLAINTS
  POST   /complaints/                    Create complaint
  GET    /complaints/                    List all
  GET    /complaints/:id                 Get details
  PUT    /complaints/:id                 Update
  PUT    /complaints/:id/feedback        Rate/feedback

OFFICER DASHBOARD
  GET    /officer/summary               Basic stats
  GET    /officer/summary-detailed      ✅ NEW: Real metrics
  GET    /officer/review-queue          Low confidence
  GET    /officer/flagged               Mismatches
  GET    /officer/clusters              Duplicates
  GET    /officer/multi-department      Multi-dept
  GET    /officer/sla-breaches          Overdue
  GET    /officer/reports               All complaints
  GET    /officer/analytics             Basic analytics
  GET    /officer/analytics/detailed    ✅ NEW: Full metrics
  GET    /officer/hotspots              ✅ NEW: Predictions
  GET    /officer/staff                 Staff roster
  GET    /officer/staff-approval        ✅ NEW: Pending approvals
  
OFFICER ACTIONS
  POST   /officer/override              Override classification
  POST   /officer/flagged/:id/resolve   Approve/reject flagged
  POST   /officer/clusters/:id/confirm  Confirm cluster
  POST   /officer/staff-approval/:id/approve    ✅ NEW
  POST   /officer/staff-approval/:id/reject     ✅ NEW
  POST   /officer/complaints/:id/assign-owner
  POST   /officer/complaints/:id/assign-staff
  POST   /officer/sla/:id/escalate

STAFF
  GET    /officer/staff                 List all staff
  POST   /officer/staff                 Create staff

TRAINS
  GET    /trains                        All trains
  POST   /trains/:trainNumber/add-passenger
  GET    /trains/active-journey
  GET    /trains/search-users
```

---

## Frontend Component Hierarchy

```
OFFICER DASHBOARD
├─ Layout
│  ├─ Sidebar Navigation
│  │  ├─ Overview
│  │  ├─ Review Queue
│  │  ├─ Flagged
│  │  ├─ Clusters (Duplicates)
│  │  ├─ Multi-Department
│  │  ├─ Staff Approvals ✅ NEW
│  │  ├─ Hotspots ✅ NEW
│  │  ├─ Analytics
│  │  ├─ Reports
│  │  └─ Train Management
│  │
│  └─ Top Header
│     └─ User Profile & Logout
│
├─ Pages
│  ├─ Overview.jsx
│  │  └─ Uses: getDetailedSummary()
│  │
│  ├─ ReviewQueue.jsx
│  │  ├─ Uses: getReviewQueue()
│  │  ├─ Component: ConfidenceMeter
│  │  └─ Component: NearbyStaffList
│  │
│  ├─ Flagged.jsx
│  │  └─ Uses: getFlaggedComplaints()
│  │
│  ├─ Clusters.jsx
│  │  └─ Uses: getClusters()
│  │
│  ├─ MultiDept.jsx
│  │  └─ Uses: getMultiDeptComplaints()
│  │
│  ├─ StaffApproval.jsx ✅ NEW
│  │  ├─ Uses: getStaffApprovals()
│  │  ├─ Uses: approveStaff()
│  │  └─ Uses: rejectStaff()
│  │
│  ├─ Hotspots.jsx ✅ NEW
│  │  └─ Uses: getHotspots()
│  │
│  ├─ Analytics.jsx
│  │  └─ Uses: getDetailedAnalytics()
│  │
│  ├─ Reports.jsx
│  │  └─ Uses: getResolvedComplaints()
│  │
│  └─ Trains.jsx
│     └─ [UNCHANGED]
│
└─ Components
   ├─ StatusTag
   ├─ VerificationTag
   ├─ ConfidenceMeter
   ├─ NearbyStaffList
   ├─ PriorityTag
   ├─ CollapsibleSection
   └─ ...others
```

---

## Performance Characteristics

| Metric | Value | Note |
|--------|-------|------|
| Page Load Time | < 1s | Uses React + Vite |
| Data Fetch | < 500ms | Local API calls |
| List Pagination | N/A | Shows first 20, lazy loads |
| Search Delay | < 100ms | Client-side filtering |
| Export Time | < 2s | CSV generation |
| Hotspot Calc | Real-time | On data change |
| Analytics | Real-time | Live database metrics |

---

## Security Considerations

✅ **Authentication**: Via authMiddleware (Bearer token)
✅ **Authorization**: Role-based (officer, staff, passenger)
✅ **Data Validation**: Server-side validation on all inputs
✅ **CORS**: Configured for frontend-backend communication
✅ **Media**: Stored URLs validated before display
✅ **Sensitive Data**: PII only shown to authorized users

---

## Deployment Checklist

- [ ] Backend environment configured (.env)
- [ ] MongoDB connection established
- [ ] ML Service running (port 8000)
- [ ] Frontend build: `npm run build`
- [ ] SSL certificates configured (production)
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Error logging setup
- [ ] Monitoring/alerts configured
- [ ] Backup strategy in place

---

**Status: Architecture Complete & Documented** ✅
