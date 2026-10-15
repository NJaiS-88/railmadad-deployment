import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { offlineQueue } from '../services/offlineQueue';

export default function AppHeader() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(offlineQueue.isOnline());
  const [offlineCount, setOfflineCount] = useState(offlineQueue.getQueue().length);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleConnectionChange = () => {
      setIsOnline(offlineQueue.isOnline());
      setOfflineCount(offlineQueue.getQueue().length);
    };

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    window.addEventListener('connection-state-change', handleConnectionChange);
    window.addEventListener('offline-queue-updated', handleConnectionChange);

    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
      window.removeEventListener('connection-state-change', handleConnectionChange);
      window.removeEventListener('offline-queue-updated', handleConnectionChange);
    };
  }, []);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    await offlineQueue.syncQueue();
    setSyncing(false);
    setIsOnline(offlineQueue.isOnline());
    setOfflineCount(offlineQueue.getQueue().length);
  };

  return (
    <header className="sticky top-0 z-40 bg-primary-navy text-white px-4 py-3 flex items-center justify-between shadow-md select-none rounded-t-[28px] md:rounded-t-none">
      <div className="flex items-center space-x-3">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-xl p-1.5 shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo.png" alt="Rail Madad Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-sm font-black text-white tracking-wider block font-sans">RAIL MADAD</span>
            <span className="text-[9px] text-slate-300 font-extrabold uppercase tracking-wider block">Field Staff</span>
          </div>
        </Link>
      </div>

      <div className="flex items-center space-x-3">
        {/* Offline sync indicator */}
        {offlineCount > 0 && (
          <button
            onClick={handleSync}
            disabled={!isOnline || syncing}
            className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full font-semibold transition ${
              isOnline 
                ? 'bg-action-orange/20 text-action-orange hover:bg-action-orange/30 cursor-pointer' 
                : 'bg-muted-text/20 text-muted-text cursor-not-allowed'
            }`}
            title={isOnline ? "Sync pending changes" : "Offline: Pending changes will sync when online"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{offlineCount} pending</span>
          </button>
        )}

        {/* Network status pill */}
        <div 
          className={`flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full font-medium transition-all ${
            isOnline 
              ? 'bg-success-green/15 text-success-green border border-success-green/20' 
              : 'bg-danger-red/15 text-danger-red border border-danger-red/20'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden xs:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* Notifications Icon */}
        <Link 
          to="/notifications" 
          className="relative p-1.5 rounded-full hover:bg-slate-800 transition active:scale-95 flex items-center justify-center text-white"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-action-orange rounded-full border border-primary-navy"></span>
        </Link>
      </div>
    </header>
  );
}
