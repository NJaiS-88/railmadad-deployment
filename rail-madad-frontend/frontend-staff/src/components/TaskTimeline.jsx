import React from 'react';
import { CheckCircle2, Clock, PlayCircle, ShieldAlert, CheckSquare } from 'lucide-react';

export default function TaskTimeline({ task }) {
  const steps = [
    {
      label: 'Assigned',
      time: task.createdTime ? new Date(task.createdTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
      completed: !!task.createdTime,
      active: task.status === 'Assigned',
      icon: Clock,
      color: 'text-slate-400 bg-slate-100',
      activeColor: 'text-slate-700 bg-slate-200 border-slate-400',
      doneColor: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
      label: 'Accepted',
      time: task.acceptedTime ? new Date(task.acceptedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
      completed: !!task.acceptedTime,
      active: task.status === 'Accepted',
      icon: CheckCircle2,
      color: 'text-slate-300 bg-slate-50',
      activeColor: 'text-rail-blue bg-blue-50 border-rail-blue',
      doneColor: 'text-rail-blue bg-blue-50 border-blue-200'
    },
    {
      label: 'In Progress',
      time: task.inProgressTime ? new Date(task.inProgressTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
      completed: !!task.inProgressTime,
      active: task.status === 'In Progress',
      icon: PlayCircle,
      color: 'text-slate-300 bg-slate-50',
      activeColor: 'text-action-orange bg-orange-50 border-action-orange',
      doneColor: 'text-action-orange bg-orange-50 border-orange-200'
    },
    {
      label: 'Resolved',
      time: task.resolvedTime ? new Date(task.resolvedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
      completed: !!task.resolvedTime,
      active: task.status === 'Resolved',
      icon: CheckSquare,
      color: 'text-slate-300 bg-slate-50',
      activeColor: 'text-success-green bg-green-50 border-success-green',
      doneColor: 'text-success-green bg-green-50 border-green-200'
    }
  ];

  // If rejected, show alternate status details
  if (task.status === 'Rejected') {
    return (
      <div className="bg-red-50 border border-red-150 rounded-2xl p-4 flex items-start space-x-3 select-none">
        <ShieldAlert className="w-5 h-5 text-danger-red mt-0.5 shrink-0" />
        <div>
          <h4 className="text-xs font-bold text-danger-red uppercase tracking-wider">Task Rejected</h4>
          <p className="text-xs text-slate-700 font-semibold mt-1">Reason: {task.rejectReason || 'Not specified'}</p>
          <span className="text-[10px] text-slate-400 block mt-1 font-semibold">
            {task.rejectedTime ? new Date(task.rejectedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="select-none py-2 px-1">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Task Lifecycle</h4>
      <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          let nodeClass = step.color;
          let textClass = 'text-slate-400 font-medium';
          
          if (step.active) {
            nodeClass = `${step.activeColor} border-2 scale-110`;
            textClass = 'text-slate-800 font-bold';
          } else if (step.completed) {
            nodeClass = `${step.doneColor} border`;
            textClass = 'text-slate-700 font-semibold';
          }

          return (
            <div key={idx} className="relative group">
              {/* Custom timeline bubble icon */}
              <span className={`absolute -left-[37px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-all ${nodeClass}`}>
                <Icon className="w-4 h-4" />
              </span>
              
              {/* Text metadata */}
              <div className="flex items-center justify-between">
                <span className={`text-xs ${textClass}`}>{step.label}</span>
                {step.time && (
                  <span className="text-[10px] text-muted-text font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                    {step.time}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
