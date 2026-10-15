import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Home as HomeIcon, FileText, Compass, User } from 'lucide-react';

import Home from './pages/Home';
import ReportFlow from './pages/ReportFlow';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { MyReports, Track, Profile } from './pages/Placeholders';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-xs text-slate-400 font-semibold">Authenticating...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function BottomNavigation() {
  const location = useLocation();
  
  // Hide bottom nav on report, login, and signup routes
  const isFormStep = location.pathname.startsWith('/report') || location.pathname === '/login' || location.pathname === '/signup';

  return (
    <nav className={`absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-150 px-6 flex justify-between items-center z-30 transition-transform duration-300 ${
      isFormStep ? 'translate-y-16 pointer-events-none' : 'translate-y-0'
    }`}>
      <Link to="/" className={`relative h-full flex flex-col items-center justify-center space-y-1 w-16 text-xs font-bold transition-colors ${
        location.pathname === '/' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
      }`}>
        {location.pathname === '/' && <span className="absolute top-0 left-2 right-2 h-[3px] bg-[#004696] rounded-b-md"></span>}
        <HomeIcon className="w-5 h-5" />
        <span className="text-[10px] font-extrabold font-sans">Home</span>
      </Link>

      <Link to="/my-reports" className={`relative h-full flex flex-col items-center justify-center space-y-1 w-20 text-xs font-bold transition-colors ${
        location.pathname === '/my-reports' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
      }`}>
        {location.pathname === '/my-reports' && <span className="absolute top-0 left-2 right-2 h-[3px] bg-[#004696] rounded-b-md"></span>}
        <FileText className="w-5 h-5" />
        <span className="text-[10px] font-extrabold font-sans">My Reports</span>
      </Link>

      <Link to="/track" className={`relative h-full flex flex-col items-center justify-center space-y-1 w-16 text-xs font-bold transition-colors ${
        location.pathname === '/track' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
      }`}>
        {location.pathname === '/track' && <span className="absolute top-0 left-2 right-2 h-[3px] bg-[#004696] rounded-b-md"></span>}
        <Compass className="w-5 h-5" />
        <span className="text-[10px] font-extrabold font-sans">Track</span>
      </Link>

      <Link to="/profile" className={`relative h-full flex flex-col items-center justify-center space-y-1 w-16 text-xs font-bold transition-colors ${
        location.pathname === '/profile' ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
      }`}>
        {location.pathname === '/profile' && <span className="absolute top-0 left-2 right-2 h-[3px] bg-[#004696] rounded-b-md"></span>}
        <User className="w-5 h-5" />
        <span className="text-[10px] font-extrabold font-sans">Profile</span>
      </Link>
    </nav>
  );
}

function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-[410px] h-screen sm:h-[840px] bg-slate-50 sm:rounded-[2.5rem] shadow-2xl relative flex flex-col overflow-hidden sm:border-[8px] sm:border-slate-800">
        
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-40">
          <div className="w-10 h-1 bg-slate-700 mx-auto mt-1 rounded-full"></div>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 relative pb-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route 
              path="/report/step1" 
              element={
                <ProtectedRoute>
                  <ReportFlow />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/my-reports" 
              element={
                <ProtectedRoute>
                  <MyReports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/track" 
              element={
                <ProtectedRoute>
                  <Track />
                </ProtectedRoute>
              } 
            />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <BottomNavigation />
      </div>
    </div>
  );
}

const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || undefined;

export default function App() {
  return (
    <Router basename={basename}>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </Router>
  );
}

