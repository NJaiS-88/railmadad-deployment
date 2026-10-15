import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { ClipboardList, Star, AlertCircle, RefreshCw } from "lucide-react";
import AvailabilityToggle from "../components/AvailabilityToggle";
import TaskCard from "../components/TaskCard";
import { staffClient } from "../api/staffClient";

export default function Home() {
  const { staff, setStaff } = useOutletContext();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const allTasks = await staffClient.getTasks();
      // Only show tasks that are NOT resolved or rejected on the Home dashboard
      const activeTasks = allTasks.filter((t) =>
        ["Assigned", "Accepted", "In Progress"].includes(t.status),
      );
      setTasks(activeTasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    // Listen to background assignments and sync events
    const handleNewTask = () => {
      fetchTasks();
    };

    window.addEventListener("new-task-assigned", handleNewTask);
    window.addEventListener("offline-sync-completed", handleNewTask);
    window.addEventListener("offline-queue-updated", handleNewTask);

    return () => {
      window.removeEventListener("new-task-assigned", handleNewTask);
      window.removeEventListener("offline-sync-completed", handleNewTask);
      window.removeEventListener("offline-queue-updated", handleNewTask);
    };
  }, []);

  const handleStatusChange = (newStatus) => {
    setStaff({ ...staff, status: newStatus });
    fetchTasks();
  };

  return (
    <div className="p-4 space-y-4 animate-fade-in select-none">
      {/* Staff Mini Profile Header */}
      <div className="bg-white border border-app-border rounded-3xl p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src={
              staff?.avatar ||
              "https://api.dicebear.com/7.x/adventurer/svg?seed=Staff"
            }
            alt={staff?.name}
            className="w-12 h-12 rounded-2xl bg-slate-100 object-cover border border-slate-100"
          />
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 leading-snug">
              {staff?.name}
            </h3>
            <p className="text-[10px] text-muted-text font-semibold truncate max-w-[130px]">
              {staff?.role}
            </p>
            <div className="flex items-center space-x-1.5 mt-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 w-max">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>
                {staff?.rating?.toFixed(1) || "5.0"} (
                {staff?.tasksCompleted || 0} resolved)
              </span>
            </div>
          </div>
        </div>

        {/* Status Toggle Dropdown */}
        <AvailabilityToggle
          currentStatus={staff?.status || (staff?.available ? "Available" : "Busy")}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Main active tasks label */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center space-x-1.5">
          <ClipboardList className="w-4 h-4 text-rail-blue" />
          <span>Active Assignments ({tasks.length})</span>
        </h2>

        {/* Quick Sync Button */}
        <button
          onClick={fetchTasks}
          className="p-1 hover:bg-slate-100 text-slate-500 hover:text-rail-blue rounded-lg transition active:scale-95 cursor-pointer"
          title="Refresh assignments"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tasks Queue Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-rail-blue border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-150 flex items-center justify-center text-slate-400 mb-3">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h4 className="font-extrabold text-xs text-slate-800">
            No active assignments
          </h4>
          <p className="text-[10px] text-muted-text font-semibold max-w-[200px] mt-1.5 leading-relaxed">
            Set your status to 'Available' to receive real passenger assignments
            from the system.
          </p>
        </div>
      )}

      {/* Zonal alerts/bulletins */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3 flex items-start space-x-2 text-[10px] text-blue-700 font-semibold select-none leading-relaxed">
        <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold block text-blue-800 uppercase tracking-wider">
            Depot Bulletin
          </span>
          Keep GPS enabled while on duty. Real assignments are routed to
          approved staff based on department and proximity.
        </div>
      </div>
    </div>
  );
}
