import React from 'react';
import { NavLink } from 'react-router-dom';
import { ClipboardList, History, User } from 'lucide-react';

export default function BottomNav() {
  return (
    <nav className="border-t border-app-border bg-white py-2 px-6 flex items-center justify-around shadow-lg rounded-b-[28px] md:rounded-b-none z-40 select-none">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `flex flex-col items-center space-y-1 transition text-xs font-semibold py-1 px-3 rounded-xl ${
            isActive
              ? 'text-rail-blue scale-105'
              : 'text-muted-text hover:text-primary-navy active:scale-95'
          }`
        }
      >
        <ClipboardList className="w-6 h-6" />
        <span>Tasks</span>
      </NavLink>

      <NavLink
        to="/activity"
        className={({ isActive }) =>
          `flex flex-col items-center space-y-1 transition text-xs font-semibold py-1 px-3 rounded-xl ${
            isActive
              ? 'text-rail-blue scale-105'
              : 'text-muted-text hover:text-primary-navy active:scale-95'
          }`
        }
      >
        <History className="w-6 h-6" />
        <span>Activity</span>
      </NavLink>

      <NavLink
        to="/profile"
        className={({ isActive }) =>
          `flex flex-col items-center space-y-1 transition text-xs font-semibold py-1 px-3 rounded-xl ${
            isActive
              ? 'text-rail-blue scale-105'
              : 'text-muted-text hover:text-primary-navy active:scale-95'
          }`
        }
      >
        <User className="w-6 h-6" />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
}
