# Quick Start Guide - Testing Officer Dashboard

## 🚀 Fast Track to Running the System

### Prerequisites Check
- ✅ Node.js installed? (v14+)
- ✅ MongoDB running or using local mockDB
- ✅ Port 5000 free (backend)
- ✅ Port 5173 free (frontend)

---

## Step 1: Start the Backend (5 minutes)

```bash
# Navigate to backend
cd backend

# Install dependencies (first time only)
npm install

# Start the server
npm run dev
```

**Expected Output:**
```
Server running on port 5000
Connected to database
Ready for API calls
```

**✅ Backend Ready when:** Server logs show "listening on port 5000"

---

## Step 2: Start the Officer Dashboard (3 minutes)

```bash
# Open new terminal
cd rail-madad-frontend/frontend-officer

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
Vite v... ready in ... ms

➜ Local:   http://localhost:5173/
```

**✅ Dashboard Ready when:** Browser shows "Overview" page loading

---

## Step 3: Navigate & Verify (2 minutes)

Open browser to: **http://localhost:5173**

### Pages to Check:

1. **Overview** ✅
   - Should show 4 stat cards (Complaints Today, Resolved, Flagged, Avg Time)
   - Should show complaint lists below
   - Check browser console (F12 → Console) - no red errors?

2. **Review Queue** ✅
   - Should show low-confidence complaints
   - Shows AI predicted category + confidence score
   - Can you see "Confirm" and "Reassign" buttons?

3. **Flagged** ✅
   - Should show complaints with mismatches
   - Approve/Reject buttons visible?

4. **Duplicates** ✅
   - Shows grouped complaints
   - Appears empty if < 2 duplicates (normal)

5. **Multi-Department** ✅
   - Shows multi-dept complaints
   - Appears empty if none assigned (normal)

6. **Staff Approvals** ⭐ NEW ✅
   - Should show pending staff list (if any exist)
   - Approve/Reject buttons work?
   - Can enter rejection reason?

7. **Hotspots** ⭐ NEW ✅
   - Shows locations with 2+ complaints
   - Risk score displayed?
   - Maintenance priority shown?

8. **Analytics** ✅
   - Shows 6 stat cards (Total, Resolved, Pending, Flagged, AI Accuracy, Satisfaction)
   - Shows 4 charts?
   - Numbers not zero (real data)?

9. **Reports** ✅
   - Can search complaints?
   - Can filter by department?
   - Can export CSV?

10. **Train Management** ✅
    - Section unchanged?

---

## Troubleshooting

### Issue: "Cannot GET /api/officer/summary-detailed"
**Solution:** 
```bash
# Kill backend (Ctrl+C)
# Check backend/routes/officerRoutes.js exists
# Restart backend: npm run dev
```

### Issue: Page shows "Loading..." forever
**Solution:**
```bash
# Open browser console (F12)
# Check red errors in Network tab
# Are CORS headers correct?
# Is backend actually running on 5000?
```

### Issue: Empty lists (no data)
**Solution:**
- This is CORRECT if no data in database yet!
- Create test data via Postman or direct DB insert
- See "Creating Test Data" section below

### Issue: Staff Approvals page empty
**Solution:**
```bash
# Create test staff with approvalStatus='pending'
# Insert into database:
{
  name: "Test Staff",
  staffId: "ST001",
  approvalStatus: "pending",
  idProof: "A123456789",
  idProofType: "Aadhar"
}
```

### Issue: Hotspots page shows nothing
**Solution:**
- Create 3+ complaints with same trainNumber + coach
- Refresh page
- Hotspot appears automatically

---

## Creating Test Data

### Via MongoDB Shell

```javascript
// Add test staff
db.staffs.insertOne({
  name: "John Doe",
  staffId: "STF001",
  email: "john@railway.com",
  phone: "9876543210",
  role: "Electrical Officer",
  department: "Electrical",
  specialisation: ["AC", "Wiring"],
  approvalStatus: "pending",
  idProof: "A123456789012345",
  idProofType: "Aadhar"
})

// Add test complaints
db.complaints.insertOne({
  complaintId: "RMDA001",
  trainNumber: "12001",
  coach: "A1",
  description: "AC not working",
  category: "Coach Electrical Fault",
  severity: "High",
  status: "Verified",
  timestamp: new Date(),
  media: { image: null, audio: null, video: null }
})
```

### Via Postman

**Create Complaint:**
```
POST http://localhost:5000/api/complaints
Content-Type: application/json

{
  "complaintId": "RMDA001",
  "trainNumber": "12001",
  "coach": "A1",
  "description": "AC not working",
  "category": "Coach Electrical Fault"
}
```

---

## Quick Verification Checklist

- [ ] Backend server running on 5000
- [ ] Officer dashboard loads on 5173
- [ ] Overview page shows stats
- [ ] Staff Approvals page accessible
- [ ] Hotspots page accessible
- [ ] Analytics page shows charts
- [ ] Reports page accessible
- [ ] No red console errors
- [ ] Navigation sidebar works
- [ ] All 10 pages navigable

---

## Test Workflow

**Scenario: Officer processes a complaint**

1. **Passenger files complaint** (passenger app)
   - Describe issue
   - Take photo
   - Submit

2. **Officer reviews** (officer app, Review Queue)
   - Sees complaint with AI category
   - Clicks "Confirm" if correct

3. **Officer checks for fraud** (Flagged page)
   - Reviews for mismatches
   - Approves if legitimate

4. **Officer routes** (Multi-Department page)
   - Selects responsible department
   - Assigns staff member

5. **Staff works** (staff app)
   - Receives assignment
   - Works on issue
   - Uploads proof
   - Marks complete

6. **Officer tracks** (Analytics page)
   - Sees resolution time updated
   - Satisfaction rate changes
   - Performance metrics updated

---

## Performance Targets

| Operation | Target | Acceptable |
|-----------|--------|-----------|
| Page load | < 1s | < 2s |
| List render | < 500ms | < 1s |
| Approve staff | < 500ms | < 1s |
| Calculate analytics | < 1s | < 2s |
| Export CSV | < 2s | < 5s |

---

## Next Steps After Verification

1. ✅ Verify all pages load
2. ✅ Check data is real (not dummy)
3. ✅ Test staff approval workflow
4. ✅ Test hotspots detection
5. ✅ Test analytics calculations
6. ✅ Test reports export
7. 🔄 Start passenger app
8. 🔄 File test complaints
9. 🔄 Process through officer workflow
10. 🔄 Test staff assignment
11. 🔄 Full end-to-end testing

---

## Support Resources

- **Backend Issues?** Check `backend/routes/officerRoutes.js`
- **Frontend Issues?** Check `rail-madad-frontend/frontend-officer/src/pages/`
- **API Questions?** See `OFFICER_DASHBOARD_GUIDE.md`
- **Architecture?** See `ARCHITECTURE.md`
- **Integration?** See `INTEGRATION_GUIDE.md`

---

## Commands Quick Reference

```bash
# Start backend
cd backend && npm run dev

# Start officer frontend
cd rail-madad-frontend/frontend-officer && npm run dev

# Start passenger frontend
cd rail-madad-frontend/frontend-passenger && npm run dev

# Start staff frontend
cd rail-madad-frontend/frontend-staff && npm run dev

# Kill all services (when done)
# Ctrl+C in each terminal

# Build for production
cd rail-madad-frontend/frontend-officer && npm run build
# Outputs to: dist/
```

---

## Verification Log Template

```markdown
# Officer Dashboard Verification - [DATE]

## Backend
- [ ] Server starts without errors
- [ ] Port 5000 accessible
- [ ] Database connection successful

## Officer Dashboard
- [ ] Page loads (http://localhost:5173)
- [ ] Overview: Real stats shown
- [ ] Review Queue: Low confidence items visible
- [ ] Flagged: Mismatches shown
- [ ] Duplicates: Clusters visible (if duplicates exist)
- [ ] Multi-Dept: Multi-dept items visible
- [ ] Staff Approvals: Pending staff shown
- [ ] Hotspots: Recurring issues shown (if 2+ complaints same train/coach)
- [ ] Analytics: All 6 metrics visible
- [ ] Reports: Search/filter works
- [ ] Train Management: Visible and unchanged

## Data Verification
- [ ] No dummy hardcoded data found
- [ ] All stats from database
- [ ] Real-time updates working
- [ ] Staff approval workflow tested
- [ ] Hotspot detection tested
- [ ] Analytics calculations verified

## Known Limitations
- None documented

## Ready for Production?
- [ ] Yes - all systems verified
- [ ] No - issues found (list below)

Issues Found:
```

---

## 🎯 Success Criteria

**Your Officer Dashboard is working when:**

1. ✅ All 10 pages load without errors
2. ✅ Data displayed is from database (not dummy)
3. ✅ Staff Approvals shows pending staff
4. ✅ Hotspots detects recurring issues (2+ complaints same train/coach)
5. ✅ Analytics shows real system metrics
6. ✅ No red errors in browser console
7. ✅ All navigation works
8. ✅ Approve/Reject buttons functional

---

**Status: Ready to Test** ✅

Good luck! Report any issues found during testing.
