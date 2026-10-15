import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, SlidersHorizontal, CheckCircle2, XCircle, Search, ChevronRight, Calendar, Star } from 'lucide-react';
import { staffClient } from '../api/staffClient';

export default function Activity() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Resolved' | 'Rejected'
  const [categoryFilter, setCategoryFilter] = useState('All');

  const fetchHistory = async () => {
    try {
      const allTasks = await staffClient.getTasks();
      // Only show resolved or rejected tasks in the activity log
      const historyTasks = allTasks.filter(t => ['Resolved', 'Rejected'].includes(t.status));
      setTasks(historyTasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const categories = ["All", "Sanitation", "Electrical", "Security", "Medical", "Catering"];

  // Filter tasks based on filters and search
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = 
      t.id.toLowerCase().includes(search.toLowerCase()) || 
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.trainNumber.includes(search);
      
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const resolvedCount = tasks.filter(t => t.status === 'Resolved').length;
  const rejectedCount = tasks.filter(t => t.status === 'Rejected').length;

  return (
    <div className="p-4 space-y-4 animate-fade-in select-none">
      
      {/* Page Title */}
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
          <History className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] text-muted-text font-bold uppercase tracking-wider">Historical Logs</span>
          <h2 className="text-sm font-extrabold text-slate-800 leading-none">Task Activity</h2>
        </div>
      </div>

      {/* Statistics dashboard */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center space-x-2.5">
          <CheckCircle2 className="w-8 h-8 text-success-green shrink-0" />
          <div>
            <span className="text-[10px] text-success-green font-bold uppercase block leading-none">Resolved</span>
            <span className="text-base font-extrabold text-slate-800 leading-none mt-1 inline-block">{resolvedCount}</span>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center space-x-2.5">
          <XCircle className="w-8 h-8 text-danger-red shrink-0" />
          <div>
            <span className="text-[10px] text-danger-red font-bold uppercase block leading-none">Rejected</span>
            <span className="text-base font-extrabold text-slate-800 leading-none mt-1 inline-block">{rejectedCount}</span>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm space-y-3">
        
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search task ID, title, train..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-rail-blue rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none"
          />
        </div>

        {/* Category horizontal scroll */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold border shrink-0 transition active:scale-95 cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-rail-blue border-rail-blue text-white shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status toggles */}
        <div className="flex bg-slate-100 rounded-xl p-1 text-[10px] font-bold text-slate-700">
          {["All", "Resolved", "Rejected"].map((status, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`flex-1 py-1 rounded-lg text-center transition cursor-pointer ${
                statusFilter === status ? 'bg-white shadow text-rail-blue font-extrabold' : 'hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

      </div>

      {/* Activity Logs Queue */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-rail-blue border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="bg-white border border-app-border hover:border-slate-300 rounded-2xl p-3 shadow-xs hover:shadow-sm transition duration-150 flex items-center justify-between group"
            >
              <div className="space-y-1 pr-2 truncate">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {task.id}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'Resolved' ? 'bg-success-green' : 'bg-danger-red'}`} />
                  <span className="text-[9px] text-muted-text font-bold uppercase tracking-wider">{task.category}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 truncate max-w-[200px] leading-tight">
                  {task.title}
                </h4>
                <div className="flex items-center space-x-1 text-[9px] text-slate-400 font-semibold">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {new Date(task.resolvedTime || task.rejectedTime || task.createdTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                  <span>•</span>
                  <span>Train {task.trainNumber}</span>
                  {task.status === 'Resolved' && task.passengerFeedback && (
                    <span className="inline-flex items-center space-x-0.5 text-amber-600 font-extrabold">
                      <span>•</span>
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      <span>{task.passengerFeedback.rating || '—'}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <span className={`text-[10px] font-bold ${task.status === 'Resolved' ? 'text-success-green' : 'text-danger-red'}`}>
                  {task.status}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-xs font-semibold text-muted-text select-none">
          No matches found in history logs.
        </div>
      )}

    </div>
  );
}
