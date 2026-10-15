import React, { useState } from 'react';
import { UserCheck, EyeOff, Radio } from 'lucide-react';
import { staffClient } from '../api/staffClient';

export default function AvailabilityToggle({ currentStatus, onStatusChange }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const statuses = [
    { name: 'Available', color: 'bg-success-green', text: 'text-success-green', bg: 'bg-green-50 border-green-200', icon: Radio },
    { name: 'Busy', color: 'bg-warning-yellow', text: 'text-warning-yellow', bg: 'bg-amber-50 border-amber-200', icon: UserCheck },
    { name: 'Offline', color: 'bg-danger-red', text: 'text-muted-text', bg: 'bg-slate-100 border-slate-200', icon: EyeOff },
  ];

  const activeStatus = statuses.find(s => s.name === currentStatus) || statuses[0];

  const handleStatusSelect = async (newStatus) => {
    setLoading(true);
    setDropdownOpen(false);
    try {
      const updatedStaff = await staffClient.updateStaffStatus(newStatus);
      if (onStatusChange) {
        onStatusChange(updatedStaff.status);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative select-none">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={loading}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer ${
          activeStatus.bg
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${activeStatus.color} animate-pulse`} />
        <span className="font-bold text-slate-800">{currentStatus}</span>
      </button>

      {dropdownOpen && (
        <>
          {/* Overlay to close dropdown */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-40 bg-white border border-app-border rounded-xl shadow-lg z-50 py-1.5 animate-fade-in">
            <div className="px-3 py-1 text-[10px] font-bold text-muted-text uppercase tracking-wider">
              Set Availability
            </div>
            {statuses.map((status) => {
              const Icon = status.icon;
              return (
                <button
                  key={status.name}
                  onClick={() => handleStatusSelect(status.name)}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center space-x-2 hover:bg-slate-50 transition ${
                    currentStatus === status.name ? 'bg-slate-50 text-rail-blue' : 'text-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${status.color}`} />
                  <span className="flex-1">{status.name}</span>
                  {currentStatus === status.name && (
                    <span className="w-1.5 h-1.5 bg-rail-blue rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
