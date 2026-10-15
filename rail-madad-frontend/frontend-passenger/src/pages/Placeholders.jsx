import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  FileText, Compass, User, Search, MapPin, Shield, CheckCircle2, ChevronRight, LogOut, LogIn,
  Camera, Mic, Video, Sparkles, Code, Copy, Check, HelpCircle, XCircle
} from 'lucide-react';
import StatusPill from '../components/StatusPill';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import LeafletMap from '../components/LeafletMap';

export function MyReports() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchMyComplaints();
  }, [user]);

  const fetchMyComplaints = async () => {
    setLoading(true);
    try {
      if (user) {
        const res = await axiosClient.get('/complaints/my');
        setComplaints(res.data);
      } else {
        const res = await axiosClient.get('/complaints/all');
        setComplaints(res.data);
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 pb-16">
      <div className="bg-primary text-white px-6 py-5 rounded-b-2xl shadow-md flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">My Reports</h1>
          <p className="text-xs text-blue-200 mt-0.5">Real-time complaint history persisted in DB</p>
        </div>
        <div className="w-10 h-10 bg-white rounded-xl p-1.5 shadow-inner flex items-center justify-center overflow-hidden">
          <img src="/logo.png" alt="Rail Madad Logo" className="w-full h-full object-contain" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-10 text-xs font-semibold text-slate-400">Loading complaints...</div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 p-6 space-y-3 shadow-sm">
            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">No reports submitted yet</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Your submitted complaints will be stored in database and tracked in real-time.
            </p>
          </div>
        ) : (
          complaints.map((complaint) => {
            const complaintId = complaint.complaintId || complaint._id;
            return (
              <div 
                key={complaintId} 
                onClick={() => navigate('/track', { state: { complaintId } })}
                className="bg-white border-y border-r border-slate-150 border-l-4 border-l-[#004696] p-4 rounded-r-2xl rounded-l-md shadow-sm space-y-3 transition hover:shadow-md cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{complaintId}</span>
                    <h3 className="font-extrabold text-sm text-slate-800">{complaint.category || 'General Issue'}</h3>
                  </div>
                  <StatusPill status={complaint.status} />
                </div>

                {complaint.media?.image && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={complaint.media.image} alt="Complaint evidence" className="w-full h-28 object-cover" />
                  </div>
                )}

                <p className="text-xs text-slate-600 font-medium line-clamp-2">{complaint.description}</p>

                <div className="flex justify-between items-center pt-2 border-t border-slate-150 text-[11px] text-slate-400 font-semibold">
                  <span>Train: {complaint.trainNumber} (Coach {complaint.coach})</span>
                  <span>PNR: {complaint.pnr}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Ensure the displayed timeline mirrors the complaint's CURRENT state — officer
// verify/accept, auto or manual department assignment, and rejection all
// reflect here even if the stored timeline placeholders are stale.
const buildDisplayTimeline = (c) => {
  if (!c) return [];
  const timeline = Array.isArray(c.timeline) ? c.timeline.map((s) => ({ ...s })) : [];
  const status = String(c.status || 'Submitted');
  const fmt = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const upsert = (label, completed, time) => {
    const existing = timeline.find((t) => t.status === label);
    if (existing) {
      if (completed && !existing.completed) existing.completed = true;
      if ((!existing.time || existing.time === '--') && time) existing.time = time;
      return existing;
    }
    const step = { status: label, time: completed ? time || '--' : '--', completed: !!completed };
    timeline.push(step);
    return step;
  };

  const verified = ['Verified', 'Routed to Department', 'Resolved'].includes(status);
  upsert('Verified', verified, verified ? (c.timeline?.find((t) => t.status === 'Verified')?.time || fmt(c.verifiedAt)) : '');

  const assigned = !!c.staffAssignment?.staff_id && ['Routed to Department', 'Resolved'].includes(status);
  upsert('Routed to Department', assigned, assigned
    ? fmt(c.staffAssignment?.assigned_at || c.staffAssignment?.accepted_at || c.staffAssignment?.resolved_at)
    : '');

  if (status === 'Rejected') {
    upsert('Rejected', true, c.timeline?.find((t) => t.status === 'Rejected')?.time || '--');
  }

  return timeline;
};

export function Track() {
  const locationState = useLocation();
  const [searchId, setSearchId] = useState('');
  const [foundComplaint, setFoundComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [followUpAnswers, setFollowUpAnswers] = useState([]);
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState('');
  const [followUpError, setFollowUpError] = useState('');

  useEffect(() => {
    if (locationState.state && locationState.state.complaintId) {
      const id = locationState.state.complaintId;
      setSearchId(id);
      fetchComplaintDetails(id);
    }
  }, [locationState]);

  useEffect(() => {
    const questions = foundComplaint?.followUp?.questions || [];
    if (questions.length > 0) {
      setFollowUpAnswers((prev) => {
        const next = [...prev];
        while (next.length < questions.length) next.push('');
        return next.slice(0, questions.length);
      });
    }
  }, [foundComplaint?.followUp?.questions]);

  const fetchComplaintDetails = async (idToSearch) => {
    if (!idToSearch) return;
    setLoading(true);
    setError('');
    setFoundComplaint(null);
    try {
      const res = await axiosClient.get(`/complaints/track/${idToSearch.trim()}`);
      setFoundComplaint(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'No complaint found matching this ID or PNR.');
    } finally {
      setLoading(false);
    }
  };

  // Silent live refresh — keeps the track status in sync when an officer
  // verifies, assigns a department, or rejects the complaint.
  const refreshComplaintDetails = async (idToRefresh) => {
    if (!idToRefresh) return;
    try {
      const res = await axiosClient.get(`/complaints/track/${idToRefresh.trim()}`);
      setFoundComplaint(res.data);
    } catch {
      // keep previous data if the refresh fails
    }
  };

  useEffect(() => {
    if (!foundComplaint || !foundComplaint.complaintId) return;
    const timer = setInterval(() => {
      refreshComplaintDetails(foundComplaint.complaintId);
    }, 30000);
    return () => clearInterval(timer);
  }, [foundComplaint?.complaintId]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchComplaintDetails(searchId);
  };

  const submitFeedback = async () => {
    if (!foundComplaint || !foundComplaint.complaintId || feedbackRating === 0) return;
    try {
      setFeedbackError('');
      await axiosClient.post(`/complaints/feedback/${foundComplaint.complaintId}`, {
        rating: feedbackRating,
        comment: feedbackComment
      });
      setFeedbackSubmitted(true);
    } catch (err) {
      setFeedbackError(err.response?.data?.message || 'Unable to submit feedback');
    }
  };

  const submitFollowUpAnswers = async () => {
    if (!foundComplaint || !foundComplaint.complaintId) return;
    if (followUpAnswers.some((a) => !a || !a.trim())) {
      setFollowUpError('Please answer all the questions.');
      return;
    }
    setFollowUpSubmitting(true);
    setFollowUpError('');
    setFollowUpMessage('');
    try {
      const res = await axiosClient.post(`/complaints/${foundComplaint.complaintId}/followup-answers`, {
        answers: followUpAnswers
      });
      setFollowUpMessage(res.data.message || 'Answers submitted.');
      if (res.data.verified) {
        setFollowUpAnswers([]);
      } else if (res.data.requiresMoreAnswers) {
        const nextQuestions = res.data.questions || [];
        setFollowUpAnswers(nextQuestions.map(() => ''));
      }
      fetchComplaintDetails(foundComplaint.complaintId);
    } catch (err) {
      setFollowUpError(err.response?.data?.message || 'Unable to submit answers. Please try again.');
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 pb-16">
      <div className="bg-primary text-white px-6 py-5 rounded-b-2xl shadow-md flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Track Status</h1>
          <p className="text-xs text-blue-200 mt-0.5">Search and track persistent complaint status from database</p>
        </div>
        <div className="w-10 h-10 bg-white rounded-xl p-1.5 shadow-inner flex items-center justify-center overflow-hidden">
          <img src="/logo.png" alt="Rail Madad Logo" className="w-full h-full object-contain" />
        </div>
      </div>

      <div className="p-5 space-y-6">
        <form onSubmit={handleSearch} className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="w-4.5 h-4.5 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Enter Complaint ID (e.g. RMDA...) or PNR"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-xs font-semibold"
            />
          </div>
          <button 
            type="submit"
            className="px-5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold text-xs transition"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl text-center">
            {error}
          </div>
        )}

        {foundComplaint ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{foundComplaint.complaintId || foundComplaint._id}</span>
                <h3 className="font-bold text-sm text-slate-800">{foundComplaint.category}</h3>
              </div>
              <StatusPill status={foundComplaint.status} />
            </div>

            {foundComplaint.status === 'Resolved' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-green-800 uppercase tracking-wide">Feedback</p>
                  <span className="text-[10px] font-bold text-green-700">Resolved</span>
                </div>

                {feedbackSubmitted ? (
                  <p className="text-xs text-green-700 font-bold">Thank you for your feedback.</p>
                ) : (
                  <>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className={`text-xl ${star <= feedbackRating ? 'text-yellow-400' : 'text-slate-300'}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="How was the resolution?"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-700"
                      rows="3"
                    />

                    {feedbackError && (
                      <p className="text-[10px] text-red-600 font-semibold">{feedbackError}</p>
                    )}

                    <button
                      type="button"
                      onClick={submitFeedback}
                      disabled={feedbackRating === 0}
                      className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                      Submit Feedback
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Rejected Banner */}
            {foundComplaint.status === 'Rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start space-x-2 text-red-900">
                <XCircle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-red-800">Complaint Rejected</p>
                  <p className="text-[11px] text-red-700 leading-snug break-words">
                    {foundComplaint.rejectionReason || 'This complaint was rejected after review.'}
                  </p>
                </div>
              </div>
            )}

            {/* Manual Officer Review Notification Banner — only for genuinely flagged complaints */}
            {(foundComplaint.evidenceVerification?.human_review_required || foundComplaint.llmAnalysis?.requires_manual_officer_review || foundComplaint.classification?.manual_review_required) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start space-x-2 text-amber-900">
                <Shield className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-amber-800">Held for Manual Officer Review</p>
                  <p className="text-[11px] text-amber-700 leading-snug">
                    {foundComplaint.evidenceVerification?.reasons?.[0] || 
                     'This complaint requires manual verification by a railway officer before department dispatch.'}
                  </p>
                </div>
              </div>
            )}

            {/* Follow-up clarification — additional details requested from passenger */}
            {foundComplaint.followUp?.status === 'awaiting_response' && foundComplaint.followUp?.questions?.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-3 w-full min-w-0 overflow-hidden">
                <div className="flex items-start space-x-2 min-w-0">
                  <HelpCircle className="w-4 h-4 text-indigo-700 mt-0.5 shrink-0" />
                  <div className="text-xs space-y-0.5 min-w-0">
                    <p className="font-bold text-indigo-900">Additional Details Needed</p>
                    <p className="text-[11px] text-indigo-700 leading-snug break-words">
                      Please answer the questions below so we can verify and route your complaint — no officer review needed.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 min-w-0">
                  {foundComplaint.followUp.questions.map((question, idx) => (
                    <div key={idx} className="bg-white rounded-lg border border-indigo-100 p-2.5 space-y-1.5 min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 break-words">Q{idx + 1}. {question}</p>
                      <textarea
                        value={followUpAnswers[idx] || ''}
                        onChange={(e) => {
                          const next = [...followUpAnswers];
                          next[idx] = e.target.value;
                          setFollowUpAnswers(next);
                        }}
                        placeholder="Type your answer..."
                        rows="2"
                        className="w-full min-w-0 box-border border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 resize-none break-words"
                      />
                    </div>
                  ))}
                </div>

                {followUpError && (
                  <p className="text-[10px] text-red-600 font-semibold">{followUpError}</p>
                )}
                {followUpMessage && (
                  <p className="text-[10px] text-green-700 font-bold">{followUpMessage}</p>
                )}

                <button
                  type="button"
                  onClick={submitFollowUpAnswers}
                  disabled={followUpSubmitting}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50 transition"
                >
                  {followUpSubmitting ? 'Submitting...' : 'Submit Answers'}
                </button>
              </div>
            )}

            {(() => {
              const mediaImage = foundComplaint.media?.image || foundComplaint.image || null;
              const isVerified = String(foundComplaint.status || '').toLowerCase() === 'verified';

              return mediaImage ? (
                <div className={`rounded-2xl border p-3 space-y-2 ${isVerified ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Complaint Image</span>
                    {isVerified ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-extrabold border border-green-200">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold border border-blue-200">
                        Submitted
                      </span>
                    )}
                  </div>
                  <img src={mediaImage} alt="Complaint evidence" className="w-full h-52 object-cover rounded-xl border border-slate-200" />
                </div>
              ) : null;
            })()}

            {/* Live Leaflet Map showing complaint location */}
            {foundComplaint.location && (
              <div className="space-y-1.5">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>Complaint Geolocation Map</span>
                </div>
                <LeafletMap 
                  lat={foundComplaint.location.lat} 
                  lng={foundComplaint.location.lng} 
                  address={foundComplaint.location.address} 
                />
              </div>
            )}

            <div className="border-t border-b border-slate-50 py-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Passenger Name</span>
                <span className="font-bold text-slate-700">{foundComplaint.passengerName || 'Passenger'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Train Number</span>
                <span className="font-bold text-slate-700">{foundComplaint.trainNumber}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Coach</span>
                <span className="font-bold text-slate-700">{foundComplaint.coach}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">PNR</span>
                <span className="font-bold text-slate-700">{foundComplaint.pnr}</span>
              </div>
            </div>

            {/* AI Conversions Section */}
            {foundComplaint.aiConversions && (
              (foundComplaint.aiConversions.imageText || foundComplaint.aiConversions.audioText || foundComplaint.aiConversions.videoText)
            ) && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">AI Media Analysis</span>
                </div>

                {foundComplaint.aiConversions.imageText && (
                  <div className="bg-white rounded-xl p-3 border border-blue-100 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <Camera className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Image → Text (OpenRouter AI Vision)</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-line">{foundComplaint.aiConversions.imageText}</p>
                  </div>
                )}

                {foundComplaint.aiConversions.audioText && (
                  <div className="bg-white rounded-xl p-3 border border-blue-100 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <Mic className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Audio → Text (Whisper ASR)</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-line">{foundComplaint.aiConversions.audioText}</p>
                  </div>
                )}

                {foundComplaint.aiConversions.videoText && (
                  <div className="bg-white rounded-xl p-3 border border-blue-100 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <Video className="w-3.5 h-3.5 text-purple-600" />
                      <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Video → Text (Multimodal BLIP + Whisper)</span>
                    </div>
                    <div className="text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-line bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {foundComplaint.aiConversions.videoText}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Clean Responsive LLM Analysis Card Display */}
            {foundComplaint.llmAnalysis && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-50 text-primary rounded-lg">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">AI Complaint Triage Analysis</h3>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${
                      String(foundComplaint.llmAnalysis.urgency || '').toLowerCase().includes('critical') || String(foundComplaint.llmAnalysis.urgency || '').toLowerCase().includes('high')
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : String(foundComplaint.llmAnalysis.urgency || '').toLowerCase().includes('low')
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {foundComplaint.llmAnalysis.urgency || 'Medium'}
                    </span>
                  </div>
                </div>

                {showRawJson ? (
                  /* Raw JSON Code Viewer Tab */
                  <div className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-200 font-mono text-[11px]">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Raw LLM JSON Response
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(foundComplaint.llmAnalysis, null, 2));
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold flex items-center space-x-1 transition border border-slate-200"
                      >
                        {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                      </button>
                    </div>
                    <pre className="text-slate-800 overflow-x-auto leading-relaxed max-h-96 whitespace-pre-wrap">
                      {JSON.stringify(foundComplaint.llmAnalysis, null, 2)}
                    </pre>
                  </div>
                ) : (
                  /* Key-Value Pairs Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* 1. input coherence */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 md:col-span-2">
                      <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Input Coherence (are_texts_related)</span>
                      <p className="text-slate-800 font-semibold leading-relaxed">
                        {foundComplaint.llmAnalysis.are_texts_related || 'All input modalities describe a consistent issue.'}
                      </p>
                    </div>

                    {/* 2. missing info status */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 md:col-span-2">
                      <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Missing Details (missing_info)</span>
                      <p className={`font-semibold leading-relaxed ${
                        String(foundComplaint.llmAnalysis.missing_info || '').toLowerCase().includes('none') || String(foundComplaint.llmAnalysis.missing_info || '').toLowerCase().includes('complete')
                          ? 'text-green-700'
                          : 'text-amber-700'
                      }`}>
                        {foundComplaint.llmAnalysis.missing_info || 'None - All mandatory details provided'}
                      </p>
                    </div>

                    {/* 3. is_sufficient status */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 md:col-span-2">
                      <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Context Sufficiency (is_sufficient)</span>
                      <p className={`font-semibold leading-relaxed ${
                        foundComplaint.llmAnalysis.is_sufficient !== false ? 'text-green-700' : 'text-indigo-700 font-bold'
                      }`}>
                        {foundComplaint.llmAnalysis.is_sufficient !== false ? '✅ Sufficient Context Provided' : '⚠️ Additional details requested from passenger'}
                      </p>
                    </div>

                    {/* 4. decision reasoning */}
                    {foundComplaint.llmAnalysis.decision_reasoning && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 md:col-span-2">
                        <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">AI Decision Reasoning</span>
                        <p className="text-slate-700 font-medium leading-relaxed">
                          {foundComplaint.llmAnalysis.decision_reasoning}
                        </p>
                      </div>
                    )}

                    {/* 5. keywords */}
                    {Array.isArray(foundComplaint.llmAnalysis.keywords) && foundComplaint.llmAnalysis.keywords.length > 0 && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 md:col-span-2">
                        <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Extracted Keywords</span>
                        <div className="flex flex-wrap gap-1.5">
                          {foundComplaint.llmAnalysis.keywords.map((kw, i) => (
                            <span key={i} className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-700 shadow-2xs">
                              #{kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 6. summary breakdown */}
                    {foundComplaint.llmAnalysis.summary && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 md:col-span-2">
                        <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Structured Summary</span>
                        {typeof foundComplaint.llmAnalysis.summary === 'string' ? (
                          <p className="text-slate-700 font-medium leading-relaxed">{foundComplaint.llmAnalysis.summary}</p>
                        ) : (
                          <div className="space-y-1.5">
                            {Object.entries(foundComplaint.llmAnalysis.summary).map(([k, v], idx) => (
                              <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                                <span className="font-bold text-primary mr-1">{k}:</span>
                                <span className="text-slate-700 font-medium">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 7. action steps */}
                    {Array.isArray(foundComplaint.llmAnalysis.action_steps) && foundComplaint.llmAnalysis.action_steps.length > 0 && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 md:col-span-2">
                        <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Recommended Action Steps</span>
                        <ul className="space-y-1 pl-1">
                          {foundComplaint.llmAnalysis.action_steps.map((step, i) => (
                            <li key={i} className="flex items-start space-x-2 text-slate-700 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Detailed Evidence Verification Agent Output Display */}
            {foundComplaint.evidenceVerification && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Verification Agent Technical Audit</h3>
                     
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${
                    foundComplaint.evidenceVerification.verification_status === 'VERIFIED'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {foundComplaint.evidenceVerification.verification_status || 'VERIFIED'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Risk Level */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 md:col-span-2">
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Suspicion & Risk Score</span>
                    <p className="text-slate-800 font-extrabold text-xs">
                      {foundComplaint.evidenceVerification.risk_level || 'Green (Low)'} (Score: {foundComplaint.evidenceVerification.suspicion_score ?? 0})
                    </p>
                  </div>

                  {/* Geotag & Distance */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 md:col-span-2">
                    <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Location Telemetry Distance</span>
                    <p className="text-slate-800 font-semibold">
                      {foundComplaint.evidenceVerification.distance_km != null 
                        ? `${foundComplaint.evidenceVerification.distance_km.toFixed(2)} km from live train path`
                        : 'No EXIF GPS timestamp mismatch detected'}
                    </p>
                  </div>

                  {/* OCR Coach Match */}
                  {foundComplaint.evidenceVerification.ocr && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 md:col-span-2">
                      <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">OCR Coach Number Cross-Check</span>
                      <p className="text-slate-800 font-semibold">
                        Detected: <span className="font-bold text-primary">{foundComplaint.evidenceVerification.ocr.detected_coach || 'N/A'}</span> (Entered: {foundComplaint.evidenceVerification.entered_coach})
                      </p>
                    </div>
                  )}

                  {/* Verification Reasons & Explanations */}
                  {Array.isArray(foundComplaint.evidenceVerification.reasons) && foundComplaint.evidenceVerification.reasons.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 md:col-span-2">
                      <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Verification Audit Notes</span>
                      <ul className="space-y-1 pl-1">
                        {foundComplaint.evidenceVerification.reasons.map((r, idx) => (
                          <li key={idx} className="flex items-start space-x-2 text-slate-700 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 mt-0.5 flex-shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stepper tracker */}
            <div className="space-y-4 relative pl-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
              {buildDisplayTimeline(foundComplaint).map((step, idx) => (
                <div key={idx} className="relative flex items-start">
                  <div className={`absolute -left-[18px] top-0.5 rounded-full p-0.5 ${
                    step.completed ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-300'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="ml-2">
                    <p className={`text-xs font-bold ${step.completed ? 'text-slate-800' : 'text-slate-400'}`}>{step.status}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{step.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 p-6 space-y-3">
            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">Search Complaint Status</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Enter a valid Complaint ID or PNR above to search database status.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col flex-1 pb-16">
      <div className="bg-primary text-white px-6 py-5 rounded-b-2xl shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
            {user ? user.name?.charAt(0).toUpperCase() : <User className="w-6 h-6 text-white" />}
          </div>
          <div>
            <h1 className="text-base font-bold">{user ? user.name : 'Guest Passenger'}</h1>
            <p className="text-xs text-blue-200 mt-0.5">{user ? user.phone : 'Not logged in'}</p>
          </div>
        </div>
        <div className="w-10 h-10 bg-white rounded-xl p-1.5 shadow-inner flex items-center justify-center overflow-hidden">
          <img src="/logo.png" alt="Rail Madad Logo" className="w-full h-full object-contain" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {user ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Email</span>
              <span className="font-bold text-slate-800">{user.email}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Role</span>
              <span className="font-bold text-primary uppercase">{user.role}</span>
            </div>
            <button
              onClick={logout}
              className="w-full mt-2 py-3 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout Account</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-center space-y-3">
            <p className="text-xs font-bold text-slate-700">Sign in for personalized complaint history and JWT Auth</p>
            <div className="flex space-x-3 pt-1">
              <Link to="/login" className="flex-1 py-3 bg-primary text-white font-bold text-xs rounded-xl text-center shadow-sm">
                Login
              </Link>
              <Link to="/signup" className="flex-1 py-3 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl text-center">
                Register
              </Link>
            </div>
          </div>
        )}

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="p-2.5 bg-blue-50 text-primary rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Verified Protection</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
              Your details are protected under standard digital privacy laws.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

