import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Sparkles, AlertCircle, WifiOff } from 'lucide-react';
import { staffClient } from '../api/staffClient';
import { offlineQueue } from '../services/offlineQueue';
import ProofUploader from '../components/ProofUploader';

const actionPresets = {
  Sanitation: [
    "Thoroughly swept & sanitized floor area",
    "Cleared sink / toilet blockage",
    "Water leakage plugged & area dried",
    "Disinfectant / deodorizer sprayed"
  ],
  Electrical: [
    "AC plant reset & blower restarted",
    "Rewired loose socket connection",
    "Flickering lights / bulb replaced",
    "Fuse box checked and re-soldered"
  ],
  Security: [
    "Unauthorized vendor removed from train",
    "Nuisance co-passenger warned",
    "RPF patrol security guard dispatched"
  ],
  Medical: [
    "Administered basic first aid kit",
    "Supplied paracetamol / painkiller drugs",
    "Coordinated emergency station ambulance"
  ],
  Catering: [
    "Stale meal replaced with hot food",
    "Cleaned server hotbox cabinet",
    "Pantry supervisor cautioned"
  ]
};

export default function ResolveTask() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionTaken, setActionTaken] = useState('');
  const [remarks, setRemarks] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(offlineQueue.isOnline());

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const allTasks = await staffClient.getTasks();
        const match = allTasks.find(t => t.id === id);
        if (match) {
          setTask(match);
          // Pre-populate with first preset if category matches
          const presets = actionPresets[match.category] || [];
          if (presets.length > 0) {
            setActionTaken(presets[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTask();

    const handleConnectionChange = () => {
      setIsOnline(offlineQueue.isOnline());
    };
    window.addEventListener('connection-state-change', handleConnectionChange);
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);

    return () => {
      window.removeEventListener('connection-state-change', handleConnectionChange);
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
    };
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!actionTaken) {
      setError('Please select or specify the action taken.');
      return;
    }
    if (!remarks) {
      setError('Please add resolution remarks.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (offlineQueue.isOnline()) {
        await staffClient.submitResolution(id, actionTaken, remarks, proofImage);
      } else {
        // Enqueue offline action
        offlineQueue.enqueue('resolve', {
          taskId: id,
          actionTaken,
          remarks,
          proofImage
        });
      }
      
      // Navigate to homepage on success
      navigate('/');
      
      // Dispatch refresh notification
      window.dispatchEvent(new Event('new-task-assigned'));
    } catch (err) {
      setError('Failed to submit resolution. Please try again.');
    } finally {
      setSubmitting(false);
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
      <div className="p-6 text-center">
        <h3 className="text-sm font-extrabold text-slate-800">Task not found</h3>
        <Link to="/" className="text-xs text-rail-blue font-bold hover:underline mt-2 inline-block">Back Home</Link>
      </div>
    );
  }

  const presets = actionPresets[task.category] || ["Rectified complaint site"];

  return (
    <div className="p-4 space-y-4 animate-fade-in select-none">
      
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Link to={`/tasks/${id}`} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <span className="text-[10px] text-muted-text font-bold uppercase tracking-wider">Submit Resolution</span>
          <h2 className="text-sm font-extrabold text-slate-800 leading-none">{task.id} — Resolve</h2>
        </div>
      </div>

      {/* Connection notification if offline */}
      {!isOnline && (
        <div className="bg-orange-50 border border-orange-200 text-action-orange p-3 rounded-2xl text-[11px] font-semibold flex items-start space-x-2">
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block text-action-orange/90 uppercase tracking-wider">Working Offline</span>
            This resolution will be saved locally and synchronized automatically once internet is restored.
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-danger-red p-3 rounded-xl text-xs font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Taken selector */}
        <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm space-y-3">
          <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Action Taken</label>
          
          <div className="flex flex-col space-y-2">
            {presets.map((preset, idx) => (
              <label 
                key={idx} 
                className={`p-2.5 border rounded-xl text-xs font-semibold cursor-pointer transition flex items-center space-x-2 ${
                  actionTaken === preset 
                    ? 'bg-blue-50 border-rail-blue text-rail-blue' 
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <input 
                  type="radio" 
                  name="actionTakenPreset" 
                  value={preset} 
                  checked={actionTaken === preset}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="accent-rail-blue w-4 h-4 shrink-0"
                />
                <span>{preset}</span>
              </label>
            ))}

            <div className="pt-2">
              <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Custom Action</span>
              <input
                type="text"
                placeholder="Or type custom action taken..."
                value={actionPresets[task.category]?.includes(actionTaken) ? '' : actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Remarks Input */}
        <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm space-y-2">
          <label className="text-xs font-bold text-slate-700 block uppercase tracking-wide">Resolution Remarks</label>
          <textarea
            rows="3"
            placeholder="Describe resolution details for the passengers and administration inspection..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none resize-none"
            required
          />
        </div>

        {/* Proof Uploader */}
        <ProofUploader 
          onImageSelected={setProofImage} 
          currentImage={proofImage} 
        />

        {/* Submit Action */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-success-green hover:bg-green-700 text-white font-bold py-3.5 rounded-2xl text-xs transition shadow active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <CheckSquare className="w-4 h-4" />
              <span>{isOnline ? "Submit Resolution" : "Save Offline Resolution"}</span>
            </>
          )}
        </button>
      </form>

    </div>
  );
}
