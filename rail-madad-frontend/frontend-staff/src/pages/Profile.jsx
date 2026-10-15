import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
  User, 
  Briefcase, 
  MapPin, 
  ShieldAlert, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Database,
  Star,
  RefreshCw,
  Trash2,
  MessageSquare,
  MessageSquareText
} from 'lucide-react';
import { staffClient } from '../api/staffClient';
import { offlineQueue } from '../services/offlineQueue';

export default function Profile() {
  const { staff, setStaff } = useOutletContext();
  const navigate = useNavigate();
  const [offlineMode, setOfflineMode] = useState(offlineQueue.getSimulatedOffline());
  const [offlineCount, setOfflineCount] = useState(offlineQueue.getQueue().length);
  const [syncing, setSyncing] = useState(false);
  const [feedbacks, setFeedbacks] = useState(staff?.feedbacks || []);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Refresh live performance data (rating, tasks, feedback) from backend
  useEffect(() => {
    if (!staff) return;
    setLoadingFeedback(true);
    staffClient
      .getProfile()
      .then((profile) => {
        setStaff(profile);
        setFeedbacks(profile.feedbacks || []);
      })
      .catch(() => {})
      .finally(() => setLoadingFeedback(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleQueueChange = () => {
      setOfflineCount(offlineQueue.getQueue().length);
    };

    window.addEventListener('offline-queue-updated', handleQueueChange);
    return () => {
      window.removeEventListener('offline-queue-updated', handleQueueChange);
    };
  }, []);

  const handleOfflineToggle = (e) => {
    const checked = e.target.checked;
    setOfflineMode(checked);
    offlineQueue.setSimulatedOffline(checked);
  };

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    const result = await offlineQueue.syncQueue();
    setSyncing(false);
    setOfflineCount(offlineQueue.getQueue().length);
    
    // Refresh parent state or alert user
    alert(`Sync completed! Synced: ${result.syncedCount || 0}, Failed: ${result.failedCount || 0}`);
  };

  const handleClearQueue = () => {
    if (window.confirm("Are you sure you want to discard all pending offline changes?")) {
      localStorage.removeItem('offline_actions_queue');
      window.dispatchEvent(new Event('offline-queue-updated'));
      setOfflineCount(0);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      staffClient.logoutStaff();
      setStaff(null);
      navigate('/login');
    }
  };

  return (
    <div className="p-4 space-y-4 animate-fade-in select-none">
      
      {/* Page Title */}
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
          <User className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] text-muted-text font-bold uppercase tracking-wider">Account Control</span>
          <h2 className="text-sm font-extrabold text-slate-800 leading-none">Staff Profile</h2>
        </div>
      </div>

      {/* Hero Profile Card */}
      <div className="bg-white border border-app-border rounded-3xl p-5 shadow-sm text-center flex flex-col items-center">
        <div className="relative">
          <img 
            src={staff?.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Staff'} 
            alt={staff?.name}
            className="w-20 h-20 rounded-3xl bg-slate-50 border border-slate-200 shadow object-cover"
          />
          <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
            (staff?.status || (staff?.available ? 'Available' : 'Busy')) === 'Available' ? 'bg-success-green' : (staff?.status || 'Busy') === 'Busy' ? 'bg-warning-yellow' : 'bg-danger-red'
          }`} />
        </div>

        <h3 className="font-extrabold text-slate-800 text-base mt-3 leading-snug">{staff?.name}</h3>
        <p className="text-xs text-muted-text font-semibold">{staff?.role}</p>

        <div className="flex items-center justify-center space-x-4 mt-4 w-full border-t border-slate-100 pt-4 text-xs font-semibold text-slate-700">
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Rating</span>
            <div className="flex items-center space-x-1 mt-1 text-amber-600">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span className="font-extrabold">{staff?.rating?.toFixed(1) || '5.0'}</span>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
              {staff?.feedbackCount || 0} passenger rating{(staff?.feedbackCount || 0) === 1 ? '' : 's'}
            </span>
          </div>
          
          <div className="w-px h-8 bg-slate-100" />

          <div className="flex-1 flex flex-col items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Resolved</span>
            <span className="font-extrabold text-slate-800 mt-1">{staff?.tasksCompleted || 0} tasks</span>
          </div>
        </div>
      </div>

      {/* Passenger Feedback Received */}
      <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
          <MessageSquareText className="w-4 h-4 text-amber-600" />
          <span>Passenger Feedback</span>
          {feedbacks.length > 0 && (
            <span className="ml-auto bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold">
              {feedbacks.length}
            </span>
          )}
        </h4>

        {loadingFeedback ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-6 h-6 border-2 border-rail-blue border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : feedbacks.length > 0 ? (
          <div className="space-y-2.5 max-h-64 overflow-y-auto no-scrollbar pr-0.5">
            {feedbacks.map((fb) => (
              <div key={fb.complaintId} className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{fb.complaintId}</span>
                  <span className="flex items-center space-x-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3 h-3 ${star <= Math.round(fb.rating || 0) ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                      />
                    ))}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold">
                  Train {fb.trainNumber} · Coach {fb.coach} · {fb.category}
                </p>
                {fb.comment && (
                  <p className="flex items-start space-x-1.5 text-[11px] font-semibold text-slate-700 italic bg-white/80 p-2 rounded-xl border border-amber-100">
                    <MessageSquare className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                    <span>"{fb.comment}"</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-[10px] font-semibold text-muted-text">
            No passenger feedback yet. Ratings appear here once passengers rate your resolved tasks.
          </div>
        )}
      </div>

      {/* Deployment & Beat metadata */}
      <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deployment Beat</h4>
        
        <div className="space-y-2.5 text-xs font-semibold text-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-500">
              <Briefcase className="w-4 h-4" />
              <span>Zone Administration</span>
            </div>
            <span className="font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {staff?.zone || 'NR'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-500">
              <MapPin className="w-4 h-4" />
              <span>Assigned Depot</span>
            </div>
            <span className="font-extrabold text-slate-800 truncate max-w-[160px]">
              {staff?.depot || 'New Delhi Depot'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-500">
              <Database className="w-4 h-4" />
              <span>Zonal ID Card</span>
            </div>
            <span className="font-bold text-slate-500">
              {staff?.idCardNumber || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Connection & Simulation Settings */}
      <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm space-y-3.5">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Simulation Sandbox</h4>

        {/* Offline Toggle Switch */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {offlineMode ? (
              <WifiOff className="w-4 h-4 text-danger-red animate-pulse" />
            ) : (
              <Wifi className="w-4 h-4 text-success-green" />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800">Simulate Offline Mode</span>
              <span className="text-[9px] text-muted-text leading-none mt-0.5">Disconnect network mock</span>
            </div>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={offlineMode} 
              onChange={handleOfflineToggle}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rail-blue"></div>
          </label>
        </div>

        {/* Offline cache controls */}
        {offlineCount > 0 && (
          <div className="border-t border-slate-100 pt-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">Pending Actions:</span>
              <span className="font-extrabold text-action-orange bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                {offlineCount} changes in queue
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleClearQueue}
                className="flex items-center justify-center space-x-1 border border-slate-200 hover:bg-red-50 text-danger-red py-2 rounded-xl text-[10px] uppercase font-bold transition active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>
              
              <button
                onClick={handleSyncNow}
                disabled={offlineMode || syncing}
                className="flex items-center justify-center space-x-1 bg-rail-blue hover:bg-blue-700 disabled:bg-slate-300 text-white py-2 rounded-xl text-[10px] uppercase font-bold transition active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Out */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
      >
        <LogOut className="w-4 h-4 text-red-500" />
        <span>Log Out Account</span>
      </button>

    </div>
  );
}
