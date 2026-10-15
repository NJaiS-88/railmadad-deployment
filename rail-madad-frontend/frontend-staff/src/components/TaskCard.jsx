import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Sparkles, 
  Zap, 
  HeartPulse, 
  Coffee, 
  MapPin, 
  Clock, 
  Train, 
  ChevronRight,
  HelpCircle
} from 'lucide-react';

const categoryIcons = {
  Sanitation: Sparkles,
  Electrical: Zap,
  Security: Shield,
  Medical: HeartPulse,
  Catering: Coffee
};

const categoryColors = {
  Sanitation: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Electrical: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Security: 'bg-red-50 text-red-700 border-red-200',
  Medical: 'bg-rose-50 text-rose-700 border-rose-200',
  Catering: 'bg-amber-50 text-amber-700 border-amber-200'
};

export default function TaskCard({ task }) {
  const Icon = categoryIcons[task.category] || HelpCircle;
  const catColor = categoryColors[task.category] || 'bg-slate-50 text-slate-700 border-slate-200';

  // Severity styles
  const getSeverityStyle = (sev) => {
    switch (sev ? sev.toLowerCase() : '') {
      case 'critical':
        return 'bg-danger-red/10 text-danger-red border-danger-red/20 font-bold animate-pulse';
      case 'high':
        return 'bg-action-orange/10 text-action-orange border-action-orange/20';
      case 'medium':
        return 'bg-warning-yellow/10 text-warning-yellow border-warning-yellow/20';
      case 'low':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Status styles
  const getStatusStyle = (status) => {
    switch (status ? status.toLowerCase() : '') {
      case 'resolved':
        return 'bg-success-green/10 text-success-green border-success-green/20';
      case 'in progress':
        return 'bg-indigo-50 text-indigo-600 border-indigo-150';
      case 'accepted':
        return 'bg-rail-blue/10 text-rail-blue border-rail-blue/20';
      case 'assigned':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white border border-app-border rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-200 animate-fade-in group select-none">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${catColor} flex items-center space-x-1`}>
            <Icon className="w-3 h-3 mr-0.5 inline" />
            <span>{task.category}</span>
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getSeverityStyle(task.severity)}`}>
            {task.severity}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusStyle(task.status)}`}>
          {task.status}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-rail-blue transition mb-2">
        {task.title}
      </h3>

      {/* Train and Carriage details */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs text-slate-600 font-medium">
        <div className="flex items-center space-x-1.5">
          <Train className="w-3.5 h-3.5 text-rail-blue" />
          <span className="font-bold text-slate-700">{task.trainNumber}</span>
          <span className="text-[10px] text-slate-400">|</span>
          <span className="truncate max-w-[120px]">{task.trainName}</span>
        </div>
        <div className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
          Coach {task.coach}
        </div>
      </div>

      {/* Time and Distance Row */}
      <div className="flex items-center justify-between text-[11px] text-muted-text font-semibold mb-4">
        <div className="flex items-center space-x-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{task.timeAssigned || 'Just now'}</span>
        </div>
        <div className="flex items-center space-x-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>{task.distance || 'On-board'}</span>
        </div>
      </div>

      {/* Action Button */}
      <Link
        to={`/tasks/${task.id}`}
        className="w-full flex items-center justify-center space-x-1 bg-slate-50 hover:bg-rail-blue hover:text-white border border-slate-200 hover:border-rail-blue text-slate-700 py-2 rounded-xl text-xs font-bold transition duration-150 active:scale-[0.98] cursor-pointer"
      >
        <span>View Details</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
