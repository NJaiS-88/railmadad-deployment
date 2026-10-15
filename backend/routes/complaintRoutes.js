const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const authMiddleware = require('../middleware/authMiddleware');
const { captionImage, transcribeAudio, transcribeVideo } = require('../services/aiService');
const { assignDynamicStaff, normalizeDepartment } = require('../services/staffAssignmentService');

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const CLASSIFICATION_SERVICE_URL = (process.env.CLASSIFICATION_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');
const STAFF_SERVICE_URL = (process.env.STAFF_SERVICE_URL || 'http://localhost:8002').replace(/\/$/, '');

// Helper to generate unique complaint ID (RMDA + timestamp + random digits)
const generateComplaintId = () => {
  const randomNum = Math.floor(10000000 + Math.random() * 90000000);
  return `RMDA${randomNum}`;
};

// Create Complaint (Protected with Passenger Auth)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      trainNumber, coach, pnr, description, 
      category, image, audio, video, location,
      aiConversions  // Pre-computed on frontend via HuggingFace browser calls
    } = req.body;

    if (!trainNumber || !coach || !pnr) {
      return res.status(400).json({ message: 'Train Number, Coach, and PNR are required.' });
    }

    if (!/^\d{10}$/.test(String(pnr).trim())) {
      return res.status(400).json({ message: 'PNR must be exactly 10 digits (numbers only).' });
    }

    const complaintId = generateComplaintId();
    const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const imageText = aiConversions?.imageText || '';
    const audioText = aiConversions?.audioText || '';
    const videoText = aiConversions?.videoText || '';

    // ALWAYS execute NVIDIA Nemotron LLM Analysis on submission regardless of input combination
    let llmAnalysis = req.body.llmAnalysis || null;
    if (!llmAnalysis) {
      try {
        const mlRes = await fetch(`${ML_SERVICE_URL}/analyze-complaint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: description || '',
            image: imageText,
            audio: audioText,
            video: videoText,
            trainNumber: trainNumber || '',
            coach: coach || '',
            pnr: pnr || '',
            passengerName: req.user.name || req.body.passengerName || 'Passenger',
            passengerPhone: req.user.phone || req.body.passengerPhone || ''
          })
        });
        if (mlRes.ok) {
          llmAnalysis = await mlRes.json();
          console.log('✅ Automatic submission LLM Analysis generated:', llmAnalysis);
        }
      } catch (llmErr) {
        console.warn('⚠️ Auto LLM Analysis trigger failed during submission:', llmErr.message);
      }
    }

    // ── CLASSIFICATION AGENT — runs on every submission after llmAnalysis ──
    // Standalone Flask server: python classification/classification_agent.py --serve
    // Takes the llmAnalysis output and produces: problem_type, department,
    // ── STEP 1: RUN VERIFICATION AGENT FIRST (Cross-verification against Live Train & EXIF & OCR) ──
    let evidenceVerification = null;
    console.log('🔍 [CONSOLE LOG] Initiating Verification Agent for Train:', trainNumber, 'Coach:', coach);
    try {
      const verifyRes = await fetch(`${ML_SERVICE_URL}/verify-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: image || '',
          trainNumber: trainNumber || '',
          coach: coach || ''
        })
      });
      if (verifyRes.ok) {
        evidenceVerification = await verifyRes.json();
        console.log('\n===========================================================');
        console.log('         VERIFICATION AGENT OUTPUT (CONSOLE LOG)');
        console.log('===========================================================');
        console.log(JSON.stringify(evidenceVerification, null, 2));
        console.log('===========================================================\n');
      } else {
        console.warn('⚠️ [VERIFICATION AGENT] Non-OK status from verification endpoint (Status:', verifyRes.status, ')');
      }
    } catch (verifyErr) {
      console.warn('⚠️ [VERIFICATION AGENT] Failed to contact Verification Agent on port 8000:', verifyErr.message);
    }

    // ── STEP 2: CLASSIFICATION AGENT (Runs ONLY if Verification Agent passes or when proceed anyway) ──
    let classification = null;
    if (llmAnalysis) {
      console.log('🤖 [CONSOLE LOG] Verification Passed or Handled -> Passing LLM Analysis Output to Classification Agent...');
      try {
        const classifyRes = await fetch(`${CLASSIFICATION_SERVICE_URL}/classify-complaint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...llmAnalysis,
            trainNumber: trainNumber || '',
            coach: coach || '',
            pnr: pnr || '',
            passengerName: req.user.name || req.body.passengerName || 'Passenger',
            location: req.body.location || null,
            aiConversions: { imageText, audioText, videoText }
          })
        });
        if (classifyRes.ok) {
          classification = await classifyRes.json();
          console.log('================ CLASSIFICATION AGENT OUTPUT ================');
          console.log(JSON.stringify(classification, null, 2));
          console.log('=============================================================');
        }
      } catch (classifyErr) {
        console.warn('⚠️ Classification Agent call failed, using resilient fallback:', classifyErr.message);
      }
    }

    if (!classification && llmAnalysis) {
      classification = {
        problem_type: llmAnalysis.category ? String(llmAnalysis.category).toLowerCase().replace(/\s+/g, '_') : 'railway_complaint',
        category: llmAnalysis.category || category || 'General Complaint',
        department: llmAnalysis.department || normalizeDepartment(llmAnalysis.category || category || 'General'),
        departments: [llmAnalysis.department || normalizeDepartment(llmAnalysis.category || category || 'General')],
        urgency: llmAnalysis.urgency || 'Medium',
        manual_review_required: Boolean(llmAnalysis.requires_manual_officer_review),
        confidence: llmAnalysis.confidence || 85
      };
    }

    // ── STEP 3: STAFF ASSIGNMENT AGENT — runs using classification output ──
    let staffAssignment = null;
    if (classification) {
      console.log('👥 [CONSOLE LOG] Passing Classification Agent Output to dynamic approved-staff selector...');
      try {
        const complaintContext = {
          department: classification.department || normalizeDepartment(classification.category || description || 'General'),
          category: classification.category || category || 'General Complaint',
          location: location || { lat: 17.4334, lng: 78.5024 }
        };

        try {
          const staffRes = await fetch(`${STAFF_SERVICE_URL}/assign-staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classification, complaintId })
          });
          if (staffRes.ok) {
            staffAssignment = await staffRes.json();
          }
        } catch (callErr) {
          // Agent server not reachable, fallback to local selector
          staffAssignment = await assignDynamicStaff(complaintContext);
        }

        if (!staffAssignment) {
          staffAssignment = await assignDynamicStaff(complaintContext);
        }

        console.log('================ STAFF ASSIGNMENT OUTPUT ================');
        console.log(JSON.stringify(staffAssignment, null, 2));
        console.log('===============================================================');
      } catch (staffErr) {
        console.warn('⚠️ Staff Assignment Agent call failed:', staffErr.message);
      }
    }

    // Determine Manual Review vs Auto Route
    const isVerificationFailed = !!(evidenceVerification && (evidenceVerification.human_review_required === true || evidenceVerification.verification_status === 'FLAGGED'));
    const relevance = String((llmAnalysis && llmAnalysis.relevance) || 'related').toLowerCase().trim();
    const isUnrelated = relevance === 'unrelated';
    const isPartiallyRelated = relevance === 'partially_related';
    const hasNoIssue = !!(llmAnalysis && llmAnalysis.has_issue === false);
    const isLlmManual = !!(llmAnalysis && llmAnalysis.requires_manual_officer_review === true);
    const isAutoVerifiable = !!(
      classification &&
      typeof classification.manual_review_required === 'boolean' &&
      classification.manual_review_required === false
    );

    // Unrelated / no-issue / insufficient content is held for passenger
    // follow-up questions, NOT officer review. Meaningful-but-vague,
    // self-doubt (LLM flagged manual), and contradictory/suspicious content
    // goes to the manual officer queue. Auto-verification happens ONLY when
    // the LLM is fully or mostly sure about the context.
    const needsClarification = !!llmAnalysis && (llmAnalysis.is_sufficient === false || isUnrelated || hasNoIssue);
    const isManualReview = isLlmManual || (isPartiallyRelated && (llmAnalysis?.is_sufficient === true || !llmAnalysis));
    const isFlagged = isVerificationFailed || isManualReview || !!(classification && classification.manual_review_required === true);

    let initialStatus = isFlagged ? 'Submitted' : (isAutoVerifiable ? 'Verified' : 'Routed to Department');
    if (needsClarification && !isFlagged) {
      initialStatus = 'Submitted'; // held for passenger clarification, NOT officer review
    }
    const stageCompleted = isAutoVerifiable || (!isFlagged && !needsClarification);

    const newComplaint = new Complaint({
      complaintId,
      user: req.user.id,
      passengerName: req.user.name || 'Passenger',
      passengerPhone: req.user.phone || '',
      trainNumber,
      coach,
      pnr,
      description: description || 'Issue reported via RailMadad portal',
      // Use classification category if available, otherwise user-selected category
      category: classification?.category || category || 'General Complaint',
      // Severity from classification urgency (critical/high → High, low → Low, else Medium)
      severity: (() => {
        const urg = (classification?.urgency || llmAnalysis?.urgency || '').toLowerCase();
        if (urg.includes('critical') || urg.includes('high')) return 'High';
        if (urg.includes('low')) return 'Low';
        return 'Medium';
      })(),
      status: initialStatus,
      // True for ANY flagged complaint (manual review, LLM self-doubt,
      // evidence failure, classification conflict, gibberish gate) so it
      // surfaces in the officer flagged queue.
      manual_review_required: isFlagged,
      media: {
        image: image || null,
        audio: audio || null,
        video: video || null
      },
      aiConversions: {
        imageText,
        audioText,
        videoText
      },
      llmAnalysis,
      analysisHistory: llmAnalysis ? [llmAnalysis] : [],
      classification: {
        ...(classification || {}),
        departments: Array.isArray(classification?.departments)
          ? classification.departments
          : (classification?.department ? [classification.department] : []),
        manual_review_required: !!(classification && classification.manual_review_required)
      },
      staffAssignment,
      evidenceVerification,
      location: location || { lat: '17.4334', lng: '78.5024', address: 'GPS Location Captured' },
      timeline: [
        { status: 'Submitted', time: `${formattedDate}, ${formattedTime}`, completed: true },
        { 
          status: 'Verified', 
          time: stageCompleted ? `${formattedDate}, ${formattedTime}` : '--', 
          completed: stageCompleted 
        },
        { 
          // Synced to the actual staff assignment by the workflow service —
          // marked completed only when the complaint is really routed to staff.
          status: 'Routed to Department', 
          time: '--', 
          completed: false 
        },
        { status: 'Resolved', time: '--', completed: false }
      ],
      followUp: needsClarification && !isFlagged
        ? { status: 'awaiting_response', questions: llmAnalysis?.missing_questions || [], answers: [] }
        : { status: 'not_required', questions: [], answers: [] }
    });

    await newComplaint.save();

    // Auto-assign to approved staff if not flagged
    if (!isFlagged) {
      try {
        const { autoAssignIfNotFlagged } = require('../services/complaintWorkflowService');
        const updated = await autoAssignIfNotFlagged(newComplaint);
        await updated.save();
        console.log('✅ Auto-assigned complaint', updated.complaintId, 'to staff:', updated.staffAssignment?.staff_name);
      } catch (autoErr) {
        console.warn('⚠️ Auto-assignment note:', autoErr.message);
      }
    }

    res.status(201).json({
      message: 'Complaint created successfully',
      complaint: newComplaint
    });
  } catch (error) {
    console.error('Create Complaint Error:', error);
    res.status(500).json({ message: 'Server error creating complaint.', error: error.message, stack: error.stack });
  }
});

// Standalone ML Captioning & Transcription Endpoints
router.post('/feedback/:id', authMiddleware, async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    if (complaint.status !== 'Resolved') {
      return res.status(400).json({ message: 'Feedback is only allowed after the complaint is resolved.' });
    }

    const { rating, comment } = req.body;
    complaint.passengerFeedback = {
      rating: Number(rating),
      comment: comment || '',
      submittedAt: new Date()
    };
    await complaint.save();

    res.json({
      success: true,
      message: 'Feedback submitted successfully.',
      feedback: complaint.passengerFeedback
    });
  } catch (error) {
    console.error('Complaint Feedback Error:', error);
    res.status(500).json({ message: 'Failed to submit feedback.' });
  }
});

// Passenger answers follow-up questions for an insufficient complaint.
// Re-runs LLM analysis; when satisfied, the complaint is auto-verified and
// auto-assigned to staff instead of being flagged for manual officer review.
router.post('/:id/followup-answers', authMiddleware, async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: req.params.id });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });

    // ── Ownership check (same as /track/:id) ──
    const userId = String(req.user.id || '');
    const userPhone = String(req.user.phone || '');
    const complaintUser = String(complaint.user || '');
    const complaintPhone = String(complaint.passengerPhone || '');
    const isOwner = (userId && complaintUser && userId === complaintUser) ||
      (userPhone && complaintPhone && (
        complaintPhone === userPhone ||
        complaintPhone === '+91' + userPhone ||
        complaintPhone.replace('+91', '') === userPhone.replace('+91', '')
      ));
    if (!isOwner) {
      return res.status(403).json({ message: 'Access denied. You can only update your own complaints.' });
    }

    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'Please provide answers to the follow-up questions.' });
    }

    const questions = (complaint.followUp?.questions || complaint.llmAnalysis?.missing_questions || [])
      .filter((q) => q && String(q).trim());
    if (questions.length === 0) {
      return res.status(400).json({ message: 'No pending follow-up questions for this complaint.' });
    }

    const qaText = questions
      .map((q, i) => `Q: ${q}\nA: ${answers[i] || 'Not provided'}`)
      .join('\n');
    const enrichedText = [
      complaint.description || '',
      '[Follow-up clarification provided by passenger]',
      qaText
    ].filter(Boolean).join('\n\n');

    // Re-run LLM triage analysis with the enriched context
    const mlRes = await fetch(`${ML_SERVICE_URL}/analyze-complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: enrichedText,
        image: complaint.aiConversions?.imageText || '',
        audio: complaint.aiConversions?.audioText || '',
        video: complaint.aiConversions?.videoText || '',
        trainNumber: complaint.trainNumber || '',
        coach: complaint.coach || '',
        pnr: complaint.pnr || '',
        passengerName: complaint.passengerName || 'Passenger',
        passengerPhone: complaint.passengerPhone || ''
      })
    });
    if (!mlRes.ok) {
      return res.status(502).json({ message: 'AI analysis service unavailable. Please try again.' });
    }
    const updatedLlm = await mlRes.json();

    complaint.followUp = {
      status: 'answered',
      questions,
      answers: answers.slice(0, questions.length),
      answeredAt: new Date(),
      conversation: [
        ...(complaint.followUp?.conversation || []),
        { role: 'assistant', text: questions.join('\n'), at: new Date() },
        { role: 'user', text: answers.slice(0, questions.length).join('\n'), at: new Date() }
      ]
    };

    if (updatedLlm) {
      complaint.llmAnalysis = updatedLlm;
      complaint.analysisHistory = [...(complaint.analysisHistory || []), updatedLlm];
    }

    const nowLabel = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const relevance = String((updatedLlm && updatedLlm.relevance) || 'related').toLowerCase().trim();
    const isUnrelated = relevance === 'unrelated';
    const isPartiallyRelated = relevance === 'partially_related';
    const hasNoIssue = !!(updatedLlm && updatedLlm.has_issue === false);

    // Verdict 1 — answers are STILL unrelated to any railway issue → REJECT
    if (isUnrelated || hasNoIssue) {
      complaint.status = 'Rejected';
      complaint.rejectionReason = 'The complaint was not related to a railway issue and was closed after clarification.';
      complaint.rejectionSource = 'auto';
      complaint.followUp.status = 'rejected';
      complaint.timeline = [
        ...(complaint.timeline || []),
        { status: 'Rejected', time: nowLabel, completed: true }
      ];
      await complaint.save();
      return res.json({
        success: true,
        rejected: true,
        verified: false,
        message: 'Your answers were not related to a railway issue, so this complaint has been closed.',
        complaint
      });
    }

    // Verdict 2 — meaningful but vague / self-doubt / still insufficient after
    // clarification → MANUAL OFFICER REVIEW. The passenger already had one
    // clarifying round, so remaining uncertainty is decided by an officer —
    // never auto-verified.
    if (isPartiallyRelated || !!(updatedLlm && updatedLlm.requires_manual_officer_review === true) || !(updatedLlm && updatedLlm.is_sufficient === true)) {
      complaint.manual_review_required = true;
      complaint.followUp.status = 'manual_review';
      complaint.status = 'Submitted';
      await complaint.save();
      return res.json({
        success: true,
        verified: false,
        manualReview: true,
        message: 'Your answers were noted. This complaint has been passed to an officer for manual review.',
        complaint
      });
    }

    // Needs are now met → auto-verify and route, never manual officer review
    if (updatedLlm && updatedLlm.is_sufficient !== false && updatedLlm.has_issue !== false) {
      complaint.llmAnalysis = updatedLlm;
      complaint.followUp.status = 'satisfied';

      // Re-run classification agent
      let classification = null;
      try {
        const classifyRes = await fetch(`${CLASSIFICATION_SERVICE_URL}/classify-complaint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...updatedLlm,
            trainNumber: complaint.trainNumber || '',
            coach: complaint.coach || '',
            pnr: complaint.pnr || '',
            passengerName: complaint.passengerName || 'Passenger',
            location: complaint.location || null,
            aiConversions: complaint.aiConversions || {}
          })
        });
        if (classifyRes.ok) classification = await classifyRes.json();
      } catch (classifyErr) {
        console.warn('Follow-up classification failed, using fallback:', classifyErr.message);
      }

      if (!classification && updatedLlm) {
        classification = {
          problem_type: updatedLlm.category ? String(updatedLlm.category).toLowerCase().replace(/\s+/g, '_') : 'railway_complaint',
          category: updatedLlm.category || complaint.category || 'General Complaint',
          department: updatedLlm.department || normalizeDepartment(updatedLlm.category || complaint.category || 'General'),
          departments: [updatedLlm.department || normalizeDepartment(updatedLlm.category || complaint.category || 'General')],
          urgency: updatedLlm.urgency || 'Medium',
          manual_review_required: Boolean(updatedLlm.requires_manual_officer_review),
          confidence: updatedLlm.confidence || 85
        };
      }

      // Re-run evidence verification
      let evidenceVerification = null;
      try {
        const verifyRes = await fetch(`${ML_SERVICE_URL}/verify-evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: complaint.media?.image || '',
            trainNumber: complaint.trainNumber || '',
            coach: complaint.coach || ''
          })
        });
        if (verifyRes.ok) evidenceVerification = await verifyRes.json();
      } catch (verifyErr) {
        console.warn('Follow-up verification failed:', verifyErr.message);
      }

      const isVerificationFailed = !!(evidenceVerification && (evidenceVerification.human_review_required === true || evidenceVerification.verification_status === 'FLAGGED'));
      // Sufficient, related content reaching this block is auto-verifiable —
      // only evidence/classification conflicts can still route it to an officer.
      const isLlmUncertain = false;
      const isFlagged = isVerificationFailed || isLlmUncertain || !!(classification && classification.manual_review_required === true);

      if (evidenceVerification) complaint.evidenceVerification = evidenceVerification;
      if (classification) {
        complaint.classification = {
          ...classification,
          departments: Array.isArray(classification.departments)
            ? classification.departments
            : (classification.department ? [classification.department] : []),
          manual_review_required: !!classification.manual_review_required
        };
        complaint.category = classification.category || complaint.category;
      }
      complaint.manual_review_required = !!isFlagged;

      const nowLabel = new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      if (!isFlagged) {
        // AUTO-VERIFIED — no manual officer review
        complaint.status = 'Verified';
        const { markTimelineStep } = require('../services/complaintWorkflowService');
        markTimelineStep(complaint, 'Verified');

        const { autoAssignIfNotFlagged } = require('../services/complaintWorkflowService');
        const updated = await autoAssignIfNotFlagged(complaint);
        await updated.save();
        return res.json({
          success: true,
          verified: true,
          message: 'Thank you! Your answers were sufficient — your complaint has been auto-verified and routed to the department.',
          complaint: updated
        });
      }

      // Still needs officer review (suspicious/contradictory content)
      complaint.status = 'Submitted';
      await complaint.save();
      return res.json({
        success: true,
        verified: false,
        message: 'Your answers were noted. This complaint requires manual officer review.',
        complaint
      });
    }

    // Answers still insufficient → ask the remaining questions
    const remaining = (updatedLlm?.missing_questions || []).filter((q) => q && String(q).trim());
    complaint.llmAnalysis = updatedLlm || complaint.llmAnalysis;
    complaint.followUp.status = 'awaiting_response';
    complaint.followUp.questions = remaining;
    await complaint.save();

    return res.json({
      success: true,
      verified: false,
      requiresMoreAnswers: true,
      questions: remaining,
      message: remaining.length
        ? 'Please answer the remaining questions so we can verify your complaint.'
        : 'Your answers have been recorded. We will verify your complaint shortly.',
      complaint
    });
  } catch (error) {
    console.error('Follow-up Answers Error:', error);
    res.status(500).json({ message: 'Failed to process follow-up answers.' });
  }
});

router.post('/caption-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.json({ caption: '' });
    const caption = await captionImage(image);
    res.json({ caption });
  } catch (err) {
    console.error('Caption Image Route Error:', err);
    res.status(500).json({ caption: '' });
  }
});

router.post('/transcribe-audio', async (req, res) => {
  try {
    const { audio } = req.body;
    if (!audio) return res.json({ text: '', transcription: '' });
    const text = await transcribeAudio(audio);
    res.json({ text, transcription: text });
  } catch (err) {
    console.error('Transcribe Audio Route Error:', err);
    res.status(500).json({ text: '', transcription: '' });
  }
});

router.post('/caption-video', async (req, res) => {
  try {
    const { video } = req.body;
    if (!video) return res.json({ caption: '', text: '' });
    const caption = await transcribeVideo(video);
    res.json({ caption, text: caption });
  } catch (err) {
    console.error('Caption Video Route Error:', err);
    res.status(500).json({ caption: '', text: '' });
  }
});

router.post('/analyze-complaint', async (req, res) => {
  try {
    const { text, image, video, audio, trainNumber, coach, pnr, passengerName, passengerPhone } = req.body;
    const response = await fetch(`${ML_SERVICE_URL}/analyze-complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, image, video, audio, trainNumber, coach, pnr, passengerName, passengerPhone })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Analyze Complaint Route Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch Logged-in User's Complaints
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const complaints = await Complaint.find({
      $or: [
        { user: req.user.id },
        { passengerPhone: req.user.phone }
      ]
    }).sort({ timestamp: -1 });
    res.json(complaints);
  } catch (error) {
    console.error('Fetch My Complaints Error:', error);
    res.status(500).json({ message: 'Server error fetching user complaints.' });
  }
});

// Track specific complaint by Complaint ID — enforces ownership
router.get('/track/:id', async (req, res) => {
  try {
    const searchId = req.params.id.trim();
    const complaint = await Complaint.findOne({
      $or: [
        { complaintId: { $regex: new RegExp(`^${searchId}$`, 'i') } },
        { pnr: searchId }
      ]
    });

    if (!complaint) {
      return res.status(404).json({ message: 'No complaint found matching this ID or PNR.' });
    }

    // --- Ownership check ---
    // Extract token from Authorization header if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'railmadad_jwt_secret_key_super_secure_2026';
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        const userId   = String(decoded.id || '');
        const userPhone = String(decoded.phone || '');
        const complaintUser  = String(complaint.user || '');
        const complaintPhone = String(complaint.passengerPhone || '');

        const isOwner = (userId && complaintUser && userId === complaintUser) ||
                        (userPhone && complaintPhone && (
                          complaintPhone === userPhone ||
                          complaintPhone === '+91' + userPhone ||
                          complaintPhone.replace('+91','') === userPhone.replace('+91','')
                        ));

        if (!isOwner) {
          return res.status(403).json({ message: 'Access denied. You can only track your own complaints.' });
        }
      } catch (tokenErr) {
        // Invalid / expired token — block access
        return res.status(401).json({ message: 'Invalid session. Please log in again.' });
      }
    } else {
      // Unauthenticated — block search entirely
      return res.status(401).json({ message: 'Please log in to track your complaint.' });
    }

    res.json(complaint);
  } catch (error) {
    console.error('Track Complaint Error:', error);
    res.status(500).json({ message: 'Server error tracking complaint.' });
  }
});

// ══════════════════════════════════════════════════════════════════
// INTERNAL ENDPOINT — Twilio Voice / Server-side Complaint Creation
// Bypasses auth using X-Internal-Key header (not exposed publicly)
// ══════════════════════════════════════════════════════════════════
router.post('/internal', async (req, res) => {
  const internalKey = req.headers['x-internal-key'];
  const expectedKey = process.env.INTERNAL_API_KEY || 'railmadad-internal-2025';

  if (!internalKey || internalKey !== expectedKey) {
    return res.status(401).json({ message: 'Unauthorized: Invalid internal API key.' });
  }

  try {
    const {
      trainNumber, coach, pnr, description,
      passengerName, passengerPhone,
      category, aiConversions, llmAnalysis,
      location, source
    } = req.body;

    if (!trainNumber || !coach || !pnr) {
      return res.status(400).json({ message: 'Train Number, Coach, and PNR are required.' });
    }

    if (!/^\d{10}$/.test(String(pnr).trim())) {
      return res.status(400).json({ message: 'PNR must be exactly 10 digits (numbers only).' });
    }

    // Try to find an existing user by phone number to link complaint
    const User = require('../models/User');
    let linkedUserId = null;
    if (passengerPhone) {
      try {
        const existingUser = await User.findOne({ phone: passengerPhone });
        if (existingUser) {
          linkedUserId = existingUser._id;
          console.log(`📞 Twilio complaint linked to user: ${existingUser.name} (${passengerPhone})`);
        }
      } catch (userErr) {
        console.warn('⚠️  Could not find user by phone:', userErr.message);
      }
    }

    const complaintId = generateComplaintId();
    const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const newComplaint = new Complaint({
      complaintId,
      user: linkedUserId || undefined,
      passengerName: passengerName || 'Twilio Voice Caller',
      passengerPhone: passengerPhone || '',
      trainNumber,
      coach,
      pnr,
      description: description || 'Complaint registered via Twilio voice call',
      category: category || 'Voice Complaint (Twilio)',
      severity: llmAnalysis?.urgency ? (
        String(llmAnalysis.urgency).toLowerCase().includes('critical') ? 'High' :
        String(llmAnalysis.urgency).toLowerCase().includes('high') ? 'High' :
        String(llmAnalysis.urgency).toLowerCase().includes('low') ? 'Low' : 'Medium'
      ) : 'Medium',
      status: 'Submitted',
      media: { image: null, audio: null, video: null },
      aiConversions: {
        imageText: aiConversions?.imageText || '',
        audioText: aiConversions?.audioText || '',
        videoText: aiConversions?.videoText || ''
      },
      llmAnalysis: llmAnalysis || null,
      location: (location && location.lat && location.lng) ? location : {
        lat: '17.4334',
        lng: '78.5024',
        address: `Twilio Voice Call — Train ${trainNumber || 'En-Route'} (Secunderabad / SCR Network)`
      },
      timeline: [
        { status: 'Submitted', time: `${formattedDate}, ${formattedTime}`, completed: true },
        { status: 'Verified', time: '--', completed: false },
        { status: 'Routed to Department', time: '--', completed: false },
        { status: 'Resolved', time: '--', completed: false }
      ]
    });

    await newComplaint.save();

    console.log(`✅ [Twilio] Complaint created: ${complaintId} | Source: ${source || 'twilio_voice'}`);
    res.status(201).json({
      message: 'Twilio voice complaint created successfully',
      complaint: newComplaint
    });

  } catch (error) {
    console.error('Internal Complaint Creation Error:', error);
    res.status(500).json({ message: 'Server error creating internal complaint.' });
  }
});

// ══════════════════════════════════════════════════════════════════
// INTERNAL ENDPOINT — Update LLM Analysis asynchronously for Twilio call
// ══════════════════════════════════════════════════════════════════
router.patch('/internal/:complaintId/llm-analysis', async (req, res) => {
  const internalKey = req.headers['x-internal-key'];
  const expectedKey = process.env.INTERNAL_API_KEY || 'railmadad-internal-2025';

  if (!internalKey || internalKey !== expectedKey) {
    return res.status(401).json({ message: 'Unauthorized: Invalid internal API key.' });
  }

  try {
    const { llmAnalysis } = req.body;
    const { complaintId } = req.params;

    const complaint = await Complaint.findOne({ complaintId });
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    if (llmAnalysis) {
      complaint.llmAnalysis = llmAnalysis;
      if (llmAnalysis.urgency) {
        const u = String(llmAnalysis.urgency).toLowerCase();
        complaint.severity = u.includes('critical') ? 'High' : (u.includes('high') ? 'High' : (u.includes('low') ? 'Low' : 'Medium'));
      }
      if (llmAnalysis.category) {
        complaint.category = llmAnalysis.category;
      }
      await complaint.save();
    }

    console.log(`🧠 [Twilio Internal] LLM Analysis updated in MongoDB for complaint ${complaintId}`);
    res.json({ message: 'LLM analysis updated successfully', complaint });
  } catch (error) {
    console.error('Update Internal LLM Analysis Error:', error);
    res.status(500).json({ message: 'Server error updating LLM analysis.' });
  }
});

// Centralized mapping from DB Complaint to Flagged UI representation
const mapToFlaggedItem = (complaint) => {
  const ocr = complaint.evidenceVerification?.ocr;
  const ocrMismatch = (ocr && !ocr.coach_match) ? {
    claimed: complaint.coach,
    detected: ocr.detected_coach || 'None'
  } : null;

  const diffMs = new Date() - new Date(complaint.timestamp || Date.now());
  const diffMins = Math.max(1, Math.round(diffMs / 60000));
  const submittedAgo = diffMins < 60 ? `${diffMins} min ago` : `${Math.round(diffMins / 60)} hrs ago`;

  const trainNameMap = {
    '12247': 'Duronto Express',
    '12951': 'Mumbai Rajdhani',
    '12952': 'August Kranti Rajdhani',
    '12137': 'Punjab Mail',
    '12626': 'Karnataka Express',
    '17019': 'Secunderabad Express',
    '12301': 'Howrah Rajdhani'
  };
  const trainName = trainNameMap[complaint.trainNumber] || 'Express Train';

  return {
    id: complaint.complaintId,
    description: complaint.description || 'No description',
    train: complaint.trainNumber,
    trainName,
    coach: complaint.coach,
    claimedLocation: complaint.location?.address || 'GPS Location Captured',
    detectedLocation: complaint.evidenceVerification?.train_position ? 
      `Near Lat: ${Number(complaint.evidenceVerification.train_position.latitude).toFixed(4)}, Lng: ${Number(complaint.evidenceVerification.train_position.longitude).toFixed(4)}` : 'Unknown Location',
    distanceKm: complaint.evidenceVerification?.distance_km ? Math.round(complaint.evidenceVerification.distance_km) : 0,
    ocrMismatch,
    department: complaint.category || 'Mechanical',
    submittedAgo,
    imageUrl: complaint.media?.image || 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&auto=format&fit=crop&q=60'
  };
};

// GET /officer/flagged - retrieve all complaints flagged for human review
router.get('/officer/flagged', async (req, res) => {
  try {
    const complaints = await Complaint.find({
      'evidenceVerification.human_review_required': true
    }).sort({ timestamp: -1 });

    const mapped = complaints.map(mapToFlaggedItem);
    res.json(mapped);
  } catch (error) {
    console.error('Fetch Flagged Complaints Error:', error);
    res.status(500).json({ message: 'Server error fetching flagged complaints.' });
  }
});

// POST /officer/flagged/:id/resolve - resolve a flagged complaint
router.post('/officer/flagged/:id/resolve', async (req, res) => {
  try {
    const { action } = req.body;
    const complaintId = req.params.id;

    const complaint = await Complaint.findOne({ complaintId });
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (action === 'approve') {
      complaint.status = 'Verified';
      if (complaint.evidenceVerification) {
        complaint.evidenceVerification.human_review_required = false;
        complaint.evidenceVerification.risk_level = 'GREEN';
      }
      complaint.timeline = complaint.timeline.map(node => {
        if (node.status === 'Verified') {
          return { status: 'Verified', time: `${formattedDate}, ${formattedTime}`, completed: true };
        }
        return node;
      });
    } else {
      complaint.status = 'Rejected';
      if (complaint.evidenceVerification) {
        complaint.evidenceVerification.human_review_required = false;
      }
      // Add or update Rejected status in the timeline
      const hasRejectedNode = complaint.timeline.some(node => node.status === 'Rejected');
      if (hasRejectedNode) {
        complaint.timeline = complaint.timeline.map(node => {
          if (node.status === 'Rejected') {
            return { status: 'Rejected', time: `${formattedDate}, ${formattedTime}`, completed: true };
          }
          return node;
        });
      } else {
        complaint.timeline.push({
          status: 'Rejected',
          time: `${formattedDate}, ${formattedTime}`,
          completed: true
        });
      }
    }

    await complaint.save();
    res.json({ ok: true });
  } catch (error) {
    console.error('Resolve Flagged Complaint Error:', error);
    res.status(500).json({ message: 'Server error resolving flagged complaint.' });
  }
});

// GET /api/complaints/live-train/:trainNumber - fetch live train telemetry position from Python verification agent / RailRadar API
router.get('/live-train/:trainNumber', async (req, res) => {
  try {
    const { trainNumber } = req.params;
    const timestamp = req.query.timestamp || new Date().toISOString();
    
    console.log(`🚂 [BACKEND LIVE TRAIN API] Fetching live position for train ${trainNumber} at ${timestamp}...`);
    
    // Call Python Verification Agent tool endpoint
    const pyRes = await fetch(`${ML_SERVICE_URL}/verify-evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: '',
        trainNumber,
        coach: 'B1',
        timestamp
      })
    });
    
    if (pyRes.ok) {
      const data = await pyRes.json();
      return res.json({
        ok: true,
        train_number: trainNumber,
        query_timestamp: timestamp,
        train_position: data.train_position || null,
        raw_verification: data
      });
    } else {
      return res.status(pyRes.status).json({ message: 'Live train telemetry API returned non-OK status' });
    }
  } catch (err) {
    console.error('Error fetching live train telemetry:', err.message);
    res.status(500).json({ message: 'Failed to fetch live train data.', error: err.message });
  }
});

module.exports = router;
