# Officer Dashboard Implementation

## Overview
A comprehensive officer dashboard for RailMadad with real-time complaint management, AI verification, staff approvals, and analytics.

## Dashboard Sections

### 1. **Home Screen (Overview)**
**Features:**
- **Today's Statistics**: Shows complaints received today, resolved, flagged, and average time to fix
- **Flagged Complaints**: Mismatches between reported data and verified data (photo/location/audio/video/coach)
- **SLA Breaches**: Complaints that haven't been resolved within SLA
- **Low-Confidence Reviews**: AI classifications that need officer verification
- **Duplicate Clusters**: Multiple passengers reporting the same issue

**Files:**
- [Overview.jsx](frontend-officer/src/pages/Overview.jsx)
- [getDetailedSummary](backend/routes/officerRoutes.js)

---

### 2. **Review Queue** 
**Purpose:** Officers review AI-predicted complaint categories with low confidence scores

**Features:**
- Display low-confidence classifications (< 75%)
- Confidence meter for each complaint
- Confirm or reassign category
- View complaint details (description, train, coach, AI category)

**Files:**
- [ReviewQueue.jsx](frontend-officer/src/pages/ReviewQueue.jsx)
- [/officer/review-queue](backend/routes/officerRoutes.js)

---

### 3. **Flagged List**
**Purpose:** Identify suspicious complaints with mismatches

**Mismatches Detected:**
- Photo doesn't match claimed train/coach
- Location doesn't match claimed train route
- Audio transcript doesn't align with text complaint
- Video doesn't show the claimed issue
- Coach number detected in photo differs from claim

**Features:**
- Distance showing how far location is from claim
- Image thumbnails
- Approve (mark as verified) or Reject actions
- Detailed mismatch information

**Files:**
- [Flagged.jsx](frontend-officer/src/pages/Flagged.jsx)
- [/officer/flagged](backend/routes/officerRoutes.js)

---

### 4. **Duplicates List (Clusters)**
**Purpose:** Group similar complaints into one incident

**Features:**
- Shows 5 passengers complaining about same AC issue on Train 12001 as 1 cluster
- Multiple coaches tracking
- Confirm as single incident to create unified ticket
- Report count and first reported timestamp

**Files:**
- [Clusters.jsx](frontend-officer/src/pages/Clusters.jsx)
- [/officer/clusters](backend/routes/officerRoutes.js)

---

### 5. **Multi-Department View**
**Purpose:** Show complaints requiring multiple departments

**Example:**
- Broken window (Maintenance) + Safety hazard (Safety)
- Dirty toilet (Cleanliness) + Electrical fault with lights (Electrical)

**Features:**
- Display all departments involved
- SLA tracking per department
- Elapsed time per department
- Primary owner designation

**Files:**
- [MultiDept.jsx](frontend-officer/src/pages/MultiDept.jsx)
- [/officer/multi-department](backend/routes/officerRoutes.js)

---

### 6. **Staff Approvals** ⭐ NEW
**Purpose:** Approve or reject new railway staff who signed up

**Features:**
- **Pending Approvals List**: Shows new staff applications
- **Staff Details**:
  - Name, role, department
  - Phone, station, experience years
  - Specialisations/certifications
  - ID proof type (Aadhar, PAN, etc.)
- **Actions**:
  - ✅ Approve - marks staff as active for work assignment
  - ❌ Reject - requires reason entry
- **Submitted timestamp**: Shows "X days ago"

**Database Fields:**
- `approvalStatus`: 'pending', 'approved', 'rejected'
- `idProof`: document image/number
- `idProofType`: document type
- `approvedBy`: officer name
- `approvalDate`: timestamp
- `rejectionReason`: text

**Files:**
- [StaffApproval.jsx](frontend-officer/src/pages/StaffApproval.jsx)
- [Staff.js model](backend/models/Staff.js)
- Backend Endpoints:
  - `GET /officer/staff-approval` - list pending
  - `POST /officer/staff-approval/:id/approve`
  - `POST /officer/staff-approval/:id/reject`

---

### 7. **Hotspots & Predictions** ⭐ NEW
**Purpose:** Identify trains/coaches with recurring issues for preventive maintenance

**Features:**
- **Risk Scoring** (Low, Medium, High)
- **Maintenance Priority**: High/Medium/Low based on complaint frequency
- **Total Complaints** on this train/coach
- **Main Issue Category**: Most common problem
- **Recent Issues**: List of last 3 reported issues with severity
- **Last Report Time**: When was last complaint filed
- **Recommendations**: Maintenance suggestions for high-priority hotspots

**Example:**
- Train 12001, Coach B6: 7 complaints about AC → High Risk
- Recommendation: Schedule immediate AC inspection

**Filters:**
- Only shows locations with 2+ complaints
- Sorted by complaint frequency

**Files:**
- [Hotspots.jsx](frontend-officer/src/pages/Hotspots.jsx)
- [/officer/hotspots](backend/routes/officerRoutes.js)

---

### 8. **Analytics Dashboard** ⭐ ENHANCED
**Purpose:** Measure system performance and AI accuracy

**Key Metrics:**
1. **AI Accuracy Rate** (%)
   - Shows how often officers confirm AI's classification
   - Calculated from low-confidence overrides
   
2. **Passenger Satisfaction** (%)
   - Percentage of complaints successfully resolved
   - Indicates system effectiveness

3. **Average Resolution Time** (hours)
   - How long from complaint to resolution
   - Tracks efficiency improvements

4. **Status Breakdown**:
   - Resolved (✅ green)
   - Pending (⏳ yellow)  
   - Flagged (❌ red)

5. **Complaints by Category**:
   - Bar chart of top issue types
   - Shows workload distribution

6. **Complaints by Department**:
   - Which departments get most complaints
   - Workload balancing insights

7. **Staff Metrics**:
   - Approved staff count
   - Pending staff approvals
   - Total trained workforce

**Files:**
- [Analytics.jsx](frontend-officer/src/pages/Analytics.jsx)
- [/officer/analytics/detailed](backend/routes/officerRoutes.js)

---

### 9. **Reports** 
**Purpose:** Downloadable weekly/daily reports for record-keeping

**Features:**
- **All Metrics Available** for download:
  - Complaints today
  - Resolved today
  - Flagged today
  - Average time to fix
  - AI accuracy rate
  - Passenger satisfaction rate
  
- **Export Formats**:
  - CSV (Excel-compatible)
  - Filterable by date range and department
  
- **Data Included**:
  - Complaint ID, Category, Train, Coach
  - Department, Status, Resolution type
  - Timeline (resolved ago, resolution time)

**Files:**
- [Reports.jsx](frontend-officer/src/pages/Reports.jsx)
- [/officer/reports](backend/routes/officerRoutes.js)

---

## API Endpoints

### Summary Endpoints
```
GET /officer/summary           - Basic summary (legacy)
GET /officer/summary-detailed  - New detailed metrics
```

### Core Operations
```
GET /officer/review-queue      - Low confidence classifications
GET /officer/flagged           - Mismatched complaints
GET /officer/clusters          - Duplicate groups
GET /officer/multi-department  - Multi-dept complaints
GET /officer/sla-breaches      - Overdue complaints
GET /officer/reports           - All complaints for reports
```

### Analytics
```
GET /officer/analytics         - Basic analytics (legacy)
GET /officer/analytics/detailed - Enhanced metrics
GET /officer/hotspots          - Recurring issues
```

### Staff Management
```
GET /officer/staff             - All staff roster
GET /officer/staff-approval    - Pending approvals
POST /officer/staff-approval/:id/approve  - Approve staff
POST /officer/staff-approval/:id/reject   - Reject staff
```

### Actions
```
POST /officer/override         - Officer override classification
POST /officer/flagged/:id/resolve - Approve/reject flagged complaint
POST /officer/clusters/:id/confirm - Confirm cluster
POST /officer/complaints/:id/assign-owner - Set primary department
POST /officer/complaints/:id/assign-staff - Assign staff member
POST /officer/sla/:id/escalate - Escalate SLA breach
```

---

## Data Flow

### Staff-Officer Connection
1. **Staff Signup** → Staff record created with `approvalStatus: 'pending'`
2. **Officer Review** → Officer views Staff Approvals page
3. **Approval** → Staff gets `approvalStatus: 'approved'`, can be assigned to complaints
4. **Assignment** → Officer assigns approved staff to complaints

### Passenger-Officer Connection
1. **Passenger Files Complaint** → Complaint record created
2. **AI Analysis** → LLM analyzes complaint, assigns category, confidence score
3. **Officer Review Queue** → Low-confidence complaints appear
4. **Officer Action** → Confirm/override category, mark for review
5. **AI Learns** → System tracks officer corrections for accuracy

### Multi-Department Flow
1. **AI Detects Multi-Dept** → Complaint tagged with multiple departments
2. **Officer Reviews** → Multi-Department view shows all departments
3. **Primary Owner** → Officer designates primary department
4. **Secondary Teams** → Additional departments notified
5. **Tracking** → Each department has SLA tracked separately

---

## Key Features - No Dummy Data

✅ **All data is real from the database**
- Complaints pulled from MongoDB/mockDB
- Staff records from Staff collection
- Statistics calculated from actual data
- No hardcoded test data

✅ **Dynamic Calculations**
- AI accuracy based on actual overrides
- Resolution time from real timestamps
- Hotspots identified from actual complaint patterns
- Staff approvals loaded from database

✅ **Real-Time Updates**
- Summary updates when complaints are created/resolved
- Staff approval counts reflect actual pending staff
- Analytics reflect current state

---

## Navigation

The sidebar now includes:
- ✅ Overview (Home)
- ✅ Review Queue
- ✅ Flagged
- ✅ Duplicates (Clusters)
- ✅ Multi-Department
- ✅ Staff Approvals ⭐ NEW
- ✅ Hotspots ⭐ NEW
- ✅ Analytics
- ✅ Reports
- ✅ Train Management (unchanged)

---

## Testing Checklist

- [ ] Backend endpoints respond with real data
- [ ] Staff Approval page loads pending staff
- [ ] Hotspots page shows recurring issues
- [ ] Analytics displays real metrics
- [ ] Overview shows correct daily stats
- [ ] All pages handle no-data gracefully
- [ ] CSV export works on Reports page
- [ ] Multi-department complaints display all involved teams
- [ ] Flagged complaints show distance/mismatch details
- [ ] Cluster grouping works for duplicate complaints

---

## Future Enhancements

- Passenger feedback/satisfaction surveys
- Real-time notifications for new complaints
- Mobile app for field officers
- Advanced ML for hotspot predictions
- Integration with maintenance scheduling systems
- Automated staff assignment based on load/availability
