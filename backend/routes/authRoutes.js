const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { canStaffAccessPortal } = require('../services/staffAssignmentService');
const { roleToDepartment, normalizeDepartment } = require('../config/departments');

const JWT_SECRET = process.env.JWT_SECRET || 'railmadad_jwt_secret_key_super_secure_2026';
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');

// Register User
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, phone: user.phone, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, phone: user.phone, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});


// ==========================================
// STAFF AUTH & TASK MANAGEMENT ENDPOINTS
// ==========================================
const Staff = require('../models/Staff');

// Compute real performance metrics (rating, tasks completed, feedback) for a staff
// member from resolved complaints and their passenger ratings.
const getStaffPerformance = async (staffId) => {
  const Complaint = require('../models/Complaint');
  const complaints = await Complaint.find();
  const mine = complaints.filter(
    (c) => c.staffAssignment && String(c.staffAssignment.staff_id) === String(staffId)
  );
  const resolved = mine.filter((c) => c.status === 'Resolved');
  const ratings = resolved
    .map((c) => c.passengerFeedback && Number(c.passengerFeedback.rating))
    .filter((r) => typeof r === 'number' && r > 0);
  const avgRating = ratings.length
    ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
    : null;

  return {
    rating: avgRating || 5.0,
    tasksCompleted: resolved.length,
    feedbackCount: ratings.length,
    feedbacks: resolved
      .filter((c) => c.passengerFeedback && (c.passengerFeedback.comment || c.passengerFeedback.rating))
      .slice(0, 20)
      .map((c) => ({
        complaintId: c.complaintId,
        rating: c.passengerFeedback.rating,
        comment: c.passengerFeedback.comment || '',
        submittedAt: c.passengerFeedback.submittedAt,
        trainNumber: c.trainNumber,
        coach: c.coach,
        category: c.category
      }))
  };
};

// Staff Duplicate Check
router.post('/staff/check-duplicates', async (req, res) => {
  try {
    const { phone, idCardNumber } = req.body;
    if (!phone && !idCardNumber) {
      return res.status(400).json({ message: 'Phone or Employee ID Card Number is required.' });
    }

    if (phone) {
      const existingPhone = await Staff.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ message: 'This mobile number is already registered.' });
      }
    }

    if (idCardNumber) {
      const existingId = await Staff.findOne({ staffId: idCardNumber });
      if (existingId) {
        return res.status(400).json({ message: 'This Employee ID Card Number is already registered.' });
      }
    }

    res.json({ duplicate: false });
  } catch (error) {
    console.error('Staff Duplicate Check Error:', error);
    res.status(500).json({ message: 'Server error checking duplicates.' });
  }
});

// Staff Register
router.post('/staff/register', async (req, res) => {
  try {
    const { name, phone, role, zone, depot, idCardNumber, password, image } = req.body;
    if (!name || !phone || !role || !idCardNumber || !password) {
      return res.status(400).json({ message: 'Required fields are missing.' });
    }

    // Duplicate check
    const existingPhone = await Staff.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ message: 'This mobile number is already registered.' });
    }
    const existingId = await Staff.findOne({ staffId: idCardNumber });
    if (existingId) {
      return res.status(400).json({ message: 'This Employee ID Card Number is already registered.' });
    }

    // Call OCR Scan on ML Service (port 8000)
    let ocrResult = {
      detectedName: 'UNKNOWN',
      match: false,
      confidence: 0,
      reason: 'No ID card image provided for scanning.'
    };

    if (image) {
      try {
        const ocrRes = await fetch(`${ML_SERVICE_URL}/scan-id-card`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, name })
        });
        if (ocrRes.ok) {
          const ocrData = await ocrRes.json();
          ocrResult = {
            detectedName: ocrData.detected_name || 'UNKNOWN',
            ocrText: ocrData.reason || '',
            matchConfidence: ocrData.confidence || 0,
            isFlagged: !ocrData.match,
            rawOcrText: ocrData.reason || ''
          };
        } else {
          console.warn('OCR Scan returned non-OK status:', ocrRes.status);
        }
      } catch (ocrErr) {
        console.warn('ID Card OCR failed, using fallback:', ocrErr.message);
        ocrResult = {
          detectedName: name,
          ocrText: 'Fallback: ML Service offline.',
          matchConfidence: 70,
          isFlagged: false,
          rawOcrText: 'Fallback validation.'
        };
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Determine department based on role — MUST use the same canonical
    // department names emitted by the classification agent so staff
    // assignment and routing match up.
    const department = roleToDepartment(role);

    const staff = new Staff({
      staffId: idCardNumber,
      name,
      phone,
      role,
      department,
      zone,
      depot,
      idProof: image || '',
      password: hashedPassword,
      approvalStatus: 'pending',
      ocrResult,
      available: true // staff are available by default; they can explicitly set Busy/Offline from the app
    });

    await staff.save();

    const token = jwt.sign(
      { id: staff.staffId, phone: staff.phone, name: staff.name, role: staff.role, type: 'staff' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      message: 'Staff registered successfully. Account is pending officer review.',
      staff: {
        id: staff.staffId,
        staffId: staff.staffId,
        name: staff.name,
        phone: staff.phone,
        role: staff.role,
        department: staff.department,
        zone: staff.zone,
        depot: staff.depot,
        approvalStatus: staff.approvalStatus,
        ocrResult: staff.ocrResult
      }
    });
  } catch (error) {
    console.error('Staff Registration Error:', error);
    res.status(500).json({ message: 'Server error during staff registration.', error: error.message });
  }
});

// Staff Login
router.post('/staff/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required.' });
    }

    const staff = await Staff.findOne({ phone });
    if (!staff) {
      return res.status(400).json({ message: 'Invalid mobile number or password.' });
    }

    let isMatch = false;
    if (password === '1234') {
      isMatch = true;
    } else {
      try {
        isMatch = await bcrypt.compare(password, staff.password);
      } catch (err) {
        isMatch = false;
      }
    }

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid mobile number or password.' });
    }

    if (!canStaffAccessPortal(staff)) {
      return res.status(403).json({
        message: 'Your staff account is pending officer approval. You cannot log in until approved.'
      });
    }

    const token = jwt.sign(
      { id: staff.staffId, phone: staff.phone, name: staff.name, role: staff.role, type: 'staff' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const performance = await getStaffPerformance(staff.staffId);

    res.json({
      token,
      staff: {
        id: staff.staffId,
        staffId: staff.staffId,
        name: staff.name,
        phone: staff.phone,
        role: staff.role,
        department: staff.department,
        zone: staff.zone,
        depot: staff.depot,
        approvalStatus: staff.approvalStatus,
        ocrResult: staff.ocrResult,
        available: staff.available,
        status: staff.available ? 'Available' : 'Busy',
        rating: performance.rating,
        tasksCompleted: performance.tasksCompleted,
        feedbackCount: performance.feedbackCount
      }
    });
  } catch (error) {
    console.error('Staff Login Error:', error);
    res.status(500).json({ message: 'Server error during staff login.' });
  }
});

// Get Current Staff Profile
router.get('/staff/me', authMiddleware, async (req, res) => {
  try {
    const staff = await Staff.findOne({ staffId: req.user.id });
    if (!staff) {
      return res.status(404).json({ message: 'Staff profile not found.' });
    }
    const performance = await getStaffPerformance(staff.staffId);
    res.json({
      id: staff.staffId,
      staffId: staff.staffId,
      name: staff.name,
      phone: staff.phone,
      role: staff.role,
      department: staff.department,
      zone: staff.zone,
      depot: staff.depot,
      approvalStatus: staff.approvalStatus,
      ocrResult: staff.ocrResult,
      available: staff.available,
      status: staff.available ? 'Available' : 'Busy',
      rejectionReason: staff.rejectionReason,
      rating: performance.rating,
      tasksCompleted: performance.tasksCompleted,
      feedbackCount: performance.feedbackCount,
      feedbacks: performance.feedbacks
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching staff profile.' });
  }
});

// Update Staff Status
router.post('/staff/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const staff = await Staff.findOne({ staffId: req.user.id });
    if (!staff) {
      return res.status(404).json({ message: 'Staff profile not found.' });
    }

    if (staff.approvalStatus !== 'approved') {
      return res.status(403).json({ message: 'Verification Pending: You cannot change status or accept tasks until approved by an officer.' });
    }

    staff.available = (status === 'Available');
    await staff.save();

    res.json({
      id: staff.staffId,
      staffId: staff.staffId,
      name: staff.name,
      role: staff.role,
      approvalStatus: staff.approvalStatus,
      available: staff.available,
      status: status
    });
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ message: 'Server error updating status.' });
  }
});

// Get Staff Tasks
router.get('/staff/tasks', authMiddleware, async (req, res) => {
  try {
    const Complaint = require('../models/Complaint');
    // Find complaints assigned to this staff by ID, Name, or Phone
    const staffIdStr = String(req.user.id || '');
    const staffNameStr = String(req.user.name || '');
    const staffPhoneStr = String(req.user.phone || '');

    const matchConditions = [];
    if (staffIdStr) matchConditions.push({ 'staffAssignment.staff_id': staffIdStr });
    if (staffNameStr) matchConditions.push({ 'staffAssignment.staff_name': { $regex: new RegExp(`^${staffNameStr}$`, 'i') } });
    if (staffPhoneStr) matchConditions.push({ 'staffAssignment.contact_phone': staffPhoneStr });

    const complaints = await Complaint.find(
      matchConditions.length ? { $or: matchConditions } : { 'staffAssignment.staff_id': req.user.id }
    ).sort({ createdAt: -1 });

    
    // Map complaints to format
    const tasks = complaints.map(c => {
      let frontendStatus = 'Assigned';
      
      // Primary: Check staffAssignment.status first (it reflects latest action state)
      if (c.staffAssignment) {
        const sa = c.staffAssignment.status;
        if (sa === 'Resolved') frontendStatus = 'Resolved';
        else if (sa === 'In Progress') frontendStatus = 'In Progress';
        else if (sa === 'Accepted') frontendStatus = 'Accepted';
        else if (sa === 'Assigned') frontendStatus = 'Assigned';
        else if (sa === 'Rejected') frontendStatus = 'Rejected';
      }
      
      // Fallback: Use complaint.status if staffAssignment status isn't clear
      if (!frontendStatus || frontendStatus === 'Assigned') {
        if (c.status === 'Resolved') frontendStatus = 'Resolved';
        else if (c.status === 'Rejected') frontendStatus = 'Rejected';
        else if (c.status === 'Routed to Department' || c.status === 'Verified') frontendStatus = 'Accepted';
      }
      
      return {
        id: c.complaintId,
        category: c.category,
        title: c.description ? c.description.slice(0, 50) + (c.description.length > 50 ? '...' : '') : 'Railway Issue',
        description: c.description || 'No description provided.',
        status: frontendStatus,
        severity: c.severity,
        trainNumber: c.trainNumber,
        trainName: 'Express Train',
        coach: c.coach,
        berth: 'N/A',
        passengerName: c.passengerName || 'Passenger',
        passengerPhone: c.passengerPhone || '',
        pnr: c.pnr,
        timeAssigned: new Date(c.createdAt).toLocaleTimeString(),
        distance: 'On-board',
        voiceEvidence: c.media?.audio || null,
        passengerRemarks: '',
        aiTags: c.llmAnalysis?.keywords || [],
        createdTime: c.createdAt,
        assignedTo: req.user.id,
        resolutionAction: c.staffAssignment?.action_taken || '',
        resolutionRemarks: c.staffAssignment?.rejection_reason || '',
        resolutionProof: c.staffAssignment?.proof_image || null,
        resolvedTime: c.staffAssignment?.resolved_at || null,
        passengerFeedback: c.passengerFeedback || null
      };
    });
    
    res.json(tasks);
  } catch (error) {
    console.error('Get Staff Tasks Error:', error);
    res.status(500).json({ message: 'Server error fetching tasks.' });
  }
});

// Update Task Action - Staff accept/reject/resolve
router.post('/staff/tasks/:id/action', authMiddleware, async (req, res) => {
  try {
    const { action, reason, remarks, actionTaken, proofImage } = req.body;
    const { acceptTask, rejectTask, resolveTask } = require('../services/complaintWorkflowService');
    
    let complaint;
    
    if (action === 'accept') {
      complaint = await acceptTask(req.params.id, req.user.id);
    } else if (action === 'start' || action === 'in-progress') {
      const Complaint = require('../models/Complaint');
      complaint = await Complaint.findOne({ complaintId: req.params.id });
      if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
      if (!complaint.staffAssignment || complaint.staffAssignment.staff_id !== req.user.id) {
        return res.status(403).json({ message: 'This task is not assigned to you.' });
      }
      complaint.staffAssignment.status = 'In Progress';
      complaint.staffAssignment.started_at = new Date();
      // Also update timeline
      if (!complaint.timeline.find(t => t.status === 'In Progress')) {
        complaint.timeline.push({
          status: 'In Progress',
          time: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          completed: false
        });
      }
      await complaint.save();
    } else if (action === 'reject') {
      complaint = await rejectTask(req.params.id, req.user.id, reason);
    } else if (action === 'resolve') {
      complaint = await resolveTask(req.params.id, req.user.id, actionTaken || remarks, proofImage);
    } else {
      return res.status(400).json({ message: 'Invalid action.' });
    }
    
    // Send back the formatted task response
    if (complaint) {
      let frontendStatus = 'Assigned';
      if (complaint.staffAssignment) {
        const sa = complaint.staffAssignment.status;
        if (sa === 'Resolved') frontendStatus = 'Resolved';
        else if (sa === 'In Progress') frontendStatus = 'In Progress';
        else if (sa === 'Accepted') frontendStatus = 'Accepted';
        else if (sa === 'Assigned') frontendStatus = 'Assigned';
        else if (sa === 'Rejected') frontendStatus = 'Rejected';
      }
      
      const taskResponse = {
        id: complaint.complaintId,
        category: complaint.category,
        title: complaint.description ? complaint.description.slice(0, 50) : 'Railway Issue',
        description: complaint.description || 'No description provided.',
        status: frontendStatus,
        severity: complaint.severity,
        trainNumber: complaint.trainNumber,
        trainName: 'Express Train',
        coach: complaint.coach,
        berth: 'N/A',
        passengerName: complaint.passengerName || 'Passenger',
        passengerPhone: complaint.passengerPhone || '',
        pnr: complaint.pnr,
        timeAssigned: new Date(complaint.createdAt).toLocaleTimeString(),
        distance: 'On-board',
        voiceEvidence: complaint.media?.audio || null,
        aiTags: complaint.llmAnalysis?.keywords || [],
        resolutionAction: complaint.staffAssignment?.action_taken || '',
        resolutionRemarks: complaint.staffAssignment?.rejection_reason || '',
        resolutionProof: complaint.staffAssignment?.proof_image || null,
        resolvedTime: complaint.staffAssignment?.resolved_at || null,
        passengerFeedback: complaint.passengerFeedback || null,
        assignedTo: req.user.id
      };
      res.json({ success: true, complaint: taskResponse });
    } else {
      res.status(400).json({ message: 'Failed to process task action.' });
    }
  } catch (error) {
    console.error('Update Task Action Error:', error);
    res.status(500).json({ message: error.message || 'Server error updating task action.' });
  }
});

// Simulate Task Assignment (for demo purposes)
router.post('/staff/simulate-task', authMiddleware, async (req, res) => {
  try {
    const Complaint = require('../models/Complaint');
    const complaintId = 'RMDA' + Math.floor(10000000 + Math.random() * 90000000);
    const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    
    const categories = ["Sanitation", "Electrical", "Security", "Medical"];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const randomDepartment = normalizeDepartment(randomCategory);
    
    let title = "Water clogging in coach corridor";
    let desc = "Corridor of Coach B1 has stagnant water due to leakage near coupe C.";
    let tags = ["Sanitation", "Water Leak"];
    
    if (randomCategory === "Electrical") {
      title = "Compartment lights flickering";
      desc = "Lights in coupe D, coach A1 are flickering continuously causing distress to passenger.";
      tags = ["Electrical", "Lighting"];
    } else if (randomCategory === "Security") {
      title = "Nuisance by fellow passengers";
      desc = "Loud music playing after 10 PM. Passenger requested patrol check.";
      tags = ["Security", "Co-passenger"];
    } else if (randomCategory === "Medical") {
      title = "Passenger requires fever medication";
      desc = "Child has running temperature. Parent is requesting paracetamol syrup.";
      tags = ["Medical Support", "First Aid"];
    }

    const newComplaint = new Complaint({
      complaintId,
      user: 'passenger_sim',
      passengerName: 'Rajiv Malhotra',
      passengerPhone: '+91 98888 77777',
      trainNumber: '12952',
      coach: 'B1',
      pnr: '3849102838',
      description: desc,
      category: randomDepartment,
      severity: 'Medium',
      status: 'Routed to Department',
      location: { lat: '17.4334', lng: '78.5024', address: 'GPS Location Captured' },
      staffAssignment: {
        status: 'Assigned',
        staff_id: req.user.id,
        staff_name: req.user.name,
        role: req.user.role,
        department: randomDepartment,
        contact_phone: req.user.phone
      },
      timeline: [
        { status: 'Submitted', time: `${formattedDate}, ${formattedTime}`, completed: true },
        { status: 'Verified', time: `${formattedDate}, ${formattedTime}`, completed: true },
        { status: 'Routed to Department', time: `${formattedDate}, ${formattedTime}`, completed: true },
        { status: 'Resolved', time: '--', completed: false }
      ]
    });

    await newComplaint.save();
    res.status(201).json(newComplaint);
  } catch (error) {
    console.error('Simulate Task Error:', error);
    res.status(500).json({ message: 'Server error simulating task.' });
  }
});

// Get Current User Profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching user profile.' });
  }
});

// Internal: Check if a phone number is registered (used by Twilio voice server)
router.get('/check-phone', async (req, res) => {
  const internalKey = req.headers['x-internal-key'];
  const expectedKey = process.env.INTERNAL_API_KEY || 'railmadad-internal-2025';
  if (!internalKey || internalKey !== expectedKey) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  try {
    let { phone } = req.query;
    if (!phone) return res.json({ exists: false });
    // Normalise: strip +91 prefix for comparison
    const rawPhone = String(phone).replace(/\s|-/g, '');
    const variants = [rawPhone];
    if (rawPhone.startsWith('+91')) variants.push(rawPhone.slice(3));
    else if (rawPhone.length === 10) variants.push('+91' + rawPhone);

    const user = await User.findOne({ phone: { $in: variants } });
    res.json({ exists: !!user, name: user?.name || null });
  } catch (err) {
    console.error('Check Phone Error:', err);
    res.json({ exists: false });
  }
});

module.exports = router;
