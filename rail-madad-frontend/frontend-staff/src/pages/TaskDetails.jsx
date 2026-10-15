import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  AlertTriangle,
  Play,
  CheckCircle,
  FileCheck,
  XCircle,
  Sparkles,
  WifiOff,
  Star,
  MessageSquare
} from 'lucide-react';
import { staffClient } from '../api/staffClient';
import { offlineQueue } from '../services/offlineQueue';
import TaskTimeline from '../components/TaskTimeline';
import VoicePlayer from '../components/VoicePlayer';

export default function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isOnline, setIsOnline] = useState(offlineQueue.isOnline());
  const [toastMessage, setToastMessage] = useState('');

  const fetchTaskDetails = async () => {
    try {
      const allTasks = await staffClient.getTasks();
      const match = allTasks.find(t => t.id === id);
      setTask(match || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetails();

    const handleConnectionChange = () => {
      setIsOnline(offlineQueue.isOnline());
    };

    const handleQueueChange = () => {
      fetchTaskDetails();
    };

    window.addEventListener('connection-state-change', handleConnectionChange);
    window.addEventListener('offline-queue-updated', handleQueueChange);
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);

    return () => {
      window.removeEventListener('connection-state-change', handleConnectionChange);
      window.removeEventListener('offline-queue-updated', handleQueueChange);
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
    };
  }, [id]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleAccept = async () => {
    try {
      console.log('Accepting task:', id);
      if (offlineQueue.isOnline()) {
        const result = await staffClient.acceptTask(id);
        console.log('Accept response:', result);
        showToast("Task Accepted successfully!");
      } else {
        offlineQueue.enqueue('accept', { taskId: id });
        showToast("Offline: Task Acceptance queued!");
      }
      // Small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchTaskDetails();
    } catch (err) {
      console.error('Accept error:', err);
      showToast(err.message || "Failed to accept task.");
    }
  };

  const handleStartAction = async () => {
    try {
      console.log('Starting action for task:', id);
      if (offlineQueue.isOnline()) {
        const result = await staffClient.startTaskAction(id);
        console.log('Start action response:', result);
        showToast("Task status updated to In Progress!");
      } else {
        offlineQueue.enqueue('start', { taskId: id });
        showToast("Offline: Task Action Start queued!");
      }
      // Small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchTaskDetails();
    } catch (err) {
      console.error('Start action error:', err);
      showToast(err.message || "Failed to start action.");
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason) return;
    try {
      await staffClient.rejectTask(id, rejectReason);
      showToast("Task assignment rejected.");
      setRejecting(false);
      fetchTaskDetails();
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      showToast("Failed to reject assignment.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <div className="w-8 h-8 border-3 border-rail-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 text-center select-none">
        <AlertTriangle className="w-12 h-12 text-danger-red mx-auto mb-4" />
        <h3 className="font-extrabold text-sm text-slate-800">Assignment not found</h3>
        <p className="text-xs text-muted-text mt-1.5">This task may have been re-assigned to another staff member.</p>
        <Link to="/" className="mt-4 inline-block text-rail-blue text-xs font-bold hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in relative select-none">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xl flex items-center space-x-2 animate-bounce">
          {!isOnline && <WifiOff className="w-3.5 h-3.5 text-action-orange" />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Back Header */}
      <div className="flex items-center space-x-2">
        <Link to="/" className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <span className="text-[10px] text-muted-text font-bold uppercase tracking-wider">Complaint Details</span>
          <h2 className="text-sm font-extrabold text-slate-800 leading-none">{task.id}</h2>
        </div>
      </div>

      {/* Primary Card */}
      <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm space-y-3.5">
        
        {/* Category & Status */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-800">{task.category} Complaint</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
            task.severity === 'Critical' ? 'bg-danger-red/15 text-danger-red border-danger-red/20' : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            {task.severity}
          </span>
        </div>

        {/* Title & Desc */}
        <div>
          <h3 className="font-extrabold text-sm text-slate-800 mb-1">{task.title}</h3>
          <p className="text-xs text-slate-600 font-semibold leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
            {task.description}
          </p>
        </div>

        {/* AI Auto tags */}
        {task.aiTags && task.aiTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-rail-blue bg-blue-50 px-2 py-0.5 rounded-full flex items-center border border-blue-100">
              <Sparkles className="w-3 h-3 text-rail-blue mr-1" />
              AI Tags:
            </span>
            {task.aiTags.map((tag, idx) => (
              <span key={idx} className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Train and Passenger Coordinates */}
      <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Target Location & Contact</h4>
        
        <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Train Details</span>
            <span className="font-extrabold text-slate-800">{task.trainNumber}</span>
            <span className="text-[10px] text-slate-600 truncate mt-0.5">{task.trainName}</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Coach & Berth</span>
            <span className="font-extrabold text-slate-800">Coach {task.coach}</span>
            <span className="text-[10px] text-slate-600 mt-0.5">Berth {task.berth || 'N/A'}</span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-2 text-xs font-semibold text-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <User className="w-4 h-4 text-slate-400" />
              <span>Passenger: <span className="font-extrabold text-slate-800">{task.passengerName}</span></span>
            </div>
            <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 border border-slate-200 rounded font-bold">
              PNR {task.pnr}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Phone className="w-4 h-4 text-slate-400" />
            <span>Phone: <a href={`tel:${task.passengerPhone}`} className="text-rail-blue hover:underline font-bold">{task.passengerPhone}</a></span>
          </div>
          <div className="flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span>Position: <span className="text-slate-800 font-bold">{task.distance || 'On-board'}</span></span>
          </div>
        </div>
      </div>

      {/* Voice Evidence */}
      {task.voiceEvidence && (
        <VoicePlayer audioUrl={task.voiceEvidence} />
      )}

      {/* Task Lifecycle Timeline */}
      <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm">
        <TaskTimeline task={task} />
      </div>

      {/* Rejection Modal overlay */}
      {rejecting && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 animate-fade-in" onClick={() => setRejecting(false)} />
          <div className="fixed bottom-0 left-0 right-0 max-h-[80%] bg-white rounded-t-[32px] border-t border-slate-200 p-6 z-50 animate-slide-up flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-sm">Select Rejection Reason</h3>
              <button onClick={() => setRejecting(false)} className="text-xs font-bold text-muted-text">Cancel</button>
            </div>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div className="flex flex-col space-y-2">
                {[
                  "Require special plumbing/electrical tools",
                  "Assigned wrong coach (not in my beat)",
                  "Shift ending / Off duty hours",
                  "Security risk (RPF assistance required)"
                ].map((reason, idx) => (
                  <label key={idx} className="flex items-center space-x-2.5 p-3 border border-slate-100 hover:border-rail-blue rounded-xl bg-slate-50 text-xs font-semibold cursor-pointer">
                    <input 
                      type="radio" 
                      name="rejectReason" 
                      value={reason} 
                      onChange={(e) => setRejectReason(e.target.value)}
                      required
                      className="accent-rail-blue w-4 h-4"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="w-full bg-danger-red hover:bg-red-700 text-white font-bold py-3 rounded-xl text-xs transition active:scale-95 cursor-pointer"
              >
                Confirm Rejection
              </button>
            </form>
          </div>
        </>
      )}

      {/* Bottom Sticky Action Buttons based on task state */}
      {['Assigned', 'Accepted', 'In Progress'].includes(task.status) && (
        <div className="bg-white border border-app-border rounded-3xl p-4 shadow-md flex items-center space-x-3 select-none">
          {task.status === 'Assigned' && (
            <>
              <button
                onClick={() => setRejecting(true)}
                className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-danger-red rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 py-3 bg-rail-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer active:scale-[0.98]"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Accept Task</span>
              </button>
            </>
          )}

          {task.status === 'Accepted' && (
            <button
              onClick={handleStartAction}
              className="flex-1 py-3 bg-action-orange hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Action</span>
            </button>
          )}

          {task.status === 'In Progress' && (
            <Link
              to={`/tasks/${task.id}/resolve`}
              className="flex-1 py-3 bg-success-green hover:bg-green-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-[0.98]"
            >
              <FileCheck className="w-4 h-4" />
              <span>Submit Resolution</span>
            </Link>
          )}

          {(task.status === 'Accepted' || task.status === 'In Progress') && (
            <button
              onClick={() => setRejecting(true)}
              className="py-3 px-4 border border-slate-200 hover:bg-slate-50 text-danger-red rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject</span>
            </button>
          )}
        </div>
      )}

      {/* Show resolution info if resolved */}
      {task.status === 'Resolved' && (
        <div className="bg-green-50/50 border border-green-200 rounded-3xl p-4 space-y-3.5 select-none animate-fade-in">
          <div className="flex items-center space-x-1.5 text-success-green border-b border-green-100 pb-2">
            <CheckCircle className="w-4 h-4" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider">Resolution Details</h4>
          </div>
          <div className="text-xs font-semibold text-slate-700 space-y-2">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Action Taken</span>
              <span className="text-slate-800 font-extrabold">{task.resolutionAction}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Resolution Remarks</span>
              <p className="bg-white/80 p-2.5 rounded-xl border border-green-100/60 mt-1 italic text-slate-600">
                "{task.resolutionRemarks || 'No remarks provided.'}"
              </p>
            </div>
            
            {task.resolutionProof && (
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1.5">Submitted Proof</span>
                <div className="rounded-xl overflow-hidden border border-slate-200 max-w-xs aspect-video">
                  <img src={task.resolutionProof} alt="Proof" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {task.passengerFeedback && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3 mt-1 space-y-2">
                <span className="text-[10px] text-amber-700 font-extrabold uppercase tracking-wider flex items-center space-x-1">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>Passenger Feedback</span>
                </span>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${star <= Math.round(task.passengerFeedback.rating || 0) ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                    />
                  ))}
                  <span className="ml-1 text-xs font-extrabold text-slate-800">
                    {task.passengerFeedback.rating || '—'} / 5
                  </span>
                </div>
                {task.passengerFeedback.comment && (
                  <p className="flex items-start space-x-1.5 text-xs font-semibold text-slate-700 italic bg-white/70 p-2.5 rounded-xl border border-amber-100">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>"{task.passengerFeedback.comment}"</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
