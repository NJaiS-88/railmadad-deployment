import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Trash2, CheckSquare, Inbox, ChevronRight } from 'lucide-react';

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = () => {
    const stored = JSON.parse(localStorage.getItem('staff_notifications') || '[]');
    setNotifications(stored);
  };

  useEffect(() => {
    loadNotifications();

    window.addEventListener('notifications-updated', loadNotifications);
    return () => {
      window.removeEventListener('notifications-updated', loadNotifications);
    };
  }, []);

  const markAsRead = (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, unread: false } : n);
    localStorage.setItem('staff_notifications', JSON.stringify(updated));
    setNotifications(updated);
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const deleteNotification = (id, e) => {
    e.stopPropagation();
    const updated = notifications.filter(n => n.id !== id);
    localStorage.setItem('staff_notifications', JSON.stringify(updated));
    setNotifications(updated);
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, unread: false }));
    localStorage.setItem('staff_notifications', JSON.stringify(updated));
    setNotifications(updated);
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const clearAll = () => {
    localStorage.setItem('staff_notifications', JSON.stringify([]));
    setNotifications([]);
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const handleNotificationClick = (notif) => {
    if (notif.unread) {
      markAsRead(notif.id);
    }
    if (notif.taskId) {
      navigate(`/tasks/${notif.taskId}`);
    }
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="p-4 space-y-4 animate-fade-in select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => navigate(-1)} 
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition active:scale-95 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] text-muted-text font-bold uppercase tracking-wider">Alert Center</span>
            <h2 className="text-sm font-extrabold text-slate-800 leading-none flex items-center space-x-1.5">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-action-orange text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Global actions */}
        {notifications.length > 0 && (
          <div className="flex items-center space-x-1.5">
            <button 
              onClick={markAllRead}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-rail-blue rounded-lg transition active:scale-95 cursor-pointer"
              title="Mark all as read"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
            <button 
              onClick={clearAll}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-danger-red rounded-lg transition active:scale-95 cursor-pointer"
              title="Clear all notifications"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length > 0 ? (
        <div className="space-y-2.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`border rounded-2xl p-3.5 shadow-xs transition duration-150 flex items-start justify-between cursor-pointer group relative overflow-hidden ${
                notif.unread 
                  ? 'bg-white border-rail-blue/30 hover:border-rail-blue/50' 
                  : 'bg-white/80 border-app-border hover:border-slate-300'
              }`}
            >
              {/* Highlight bar for unread notifications */}
              {notif.unread && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rail-blue"></div>
              )}

              <div className="flex items-start space-x-3 pr-2 truncate">
                {/* Notification icon container */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-150 ${
                  notif.unread 
                    ? 'bg-rail-blue/10 text-rail-blue' 
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  <Bell className="w-4 h-4" />
                </div>

                <div className="space-y-0.5 truncate">
                  <div className="flex items-center space-x-2">
                    <h4 className={`text-xs font-bold text-slate-800 leading-snug truncate max-w-[180px] ${notif.unread ? 'font-extrabold' : ''}`}>
                      {notif.title}
                    </h4>
                    {notif.unread && (
                      <span className="w-1.5 h-1.5 rounded-full bg-action-orange animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-text font-medium leading-relaxed break-words whitespace-normal">
                    {notif.message}
                  </p>
                  <span className="text-[9px] text-slate-400 font-semibold block">
                    {notif.time}
                  </span>
                </div>
              </div>

              {/* Actions on the right side of individual item */}
              <div className="flex items-center space-x-1 shrink-0 mt-1">
                <button
                  onClick={(e) => deleteNotification(notif.id, e)}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-danger-red rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {notif.taskId && (
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 animate-pulse">
            <Inbox className="w-6 h-6" />
          </div>
          <h4 className="font-extrabold text-xs text-slate-800">Inbox is empty</h4>
          <p className="text-[10px] text-muted-text font-semibold max-w-[200px] mt-1.5 leading-relaxed">
            You don't have any notifications right now. New task assignments and alerts will be shown here.
          </p>
        </div>
      )}

    </div>
  );
}
