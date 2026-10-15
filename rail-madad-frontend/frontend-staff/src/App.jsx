import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import AppHeader from "./components/AppHeader";
import BottomNav from "./components/BottomNav";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import TaskDetails from "./pages/TaskDetails";
import ResolveTask from "./pages/ResolveTask";
import Activity from "./pages/Activity";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import { staffClient } from "./api/staffClient";

// Protected layout wrapper
function ProtectedLayout({ staff, setStaff }) {
  if (!staff) {
    return <Navigate to="/login" replace />;
  }

  if (staff.approvalStatus && staff.approvalStatus !== "approved") {
    staffClient.logoutStaff();
    setStaff(null);
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text select-none">
      {/* Top Header */}
      <AppHeader />

      {/* Main Scrollable View Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-4">
        <Outlet context={{ staff, setStaff }} />
      </main>

      {/* Bottom Sticky Tab Navigation */}
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if staff is logged in on mount
    const active = staffClient.getCurrentStaff();
    if (active && active.approvalStatus !== "approved") {
      staffClient.logoutStaff();
      setStaff(null);
    } else {
      setStaff(active);
      // Refresh live profile (rating, tasks completed, feedback) from backend
      if (active) {
        staffClient
          .getProfile()
          .then((profile) => setStaff(profile))
          .catch(() => {});
      }
    }
    setLoading(false);
  }, []);

  // Real complaint assignments are provided by the backend only; no simulated task injection.

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-rail-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || undefined;

  return (
    <Router basename={basename}>
      {/* Desktop mockup presenting the mobile viewport */}
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-0 md:p-6 font-sans">
        {/* Device frame container */}
        <div className="w-full h-screen md:h-[840px] md:w-[390px] md:max-h-[850px] bg-slate-900 md:mobile-frame-container overflow-hidden flex flex-col relative">
          {/* iOS Status Bar Mock (for premium detail) */}
          <div className="bg-primary-navy text-white text-[11px] px-6 py-1.5 flex items-center justify-between font-semibold tracking-tight shrink-0 select-none md:flex hidden">
            <span>9:41</span>
            <div className="flex items-center space-x-1.5">
              {/* Battery Indicator */}
              <div className="w-5 h-2.5 border border-white/50 rounded-sm p-0.5 flex items-center">
                <div className="w-full h-full bg-white rounded-2xs"></div>
              </div>
            </div>
          </div>

          {/* Router Content Container */}
          <div className="flex-1 overflow-hidden h-full relative">
            <Routes>
              {/* Public Authentication Pages */}
              <Route
                path="/login"
                element={
                  staff ? (
                    <Navigate to="/" replace />
                  ) : (
                    <Login onLoginSuccess={setStaff} />
                  )
                }
              />
              <Route
                path="/register"
                element={
                  staff ? (
                    <Navigate to="/" replace />
                  ) : (
                    <Register onRegisterSuccess={setStaff} />
                  )
                }
              />

              {/* Protected Staff Pages */}
              <Route
                element={<ProtectedLayout staff={staff} setStaff={setStaff} />}
              >
                <Route index element={<Home />} />
                <Route path="/tasks/:id" element={<TaskDetails />} />
                <Route path="/tasks/:id/resolve" element={<ResolveTask />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/notifications" element={<Notifications />} />
              </Route>

              {/* Catch-all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}
