import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Camera, FileText, Compass, Phone, HelpCircle, LogIn, User,
  Train, MapPin, Clock, AlertTriangle, CheckCircle2, RefreshCw,
  ArrowRight, Lock, Loader2, ChevronRight, Armchair, CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Fetch active journey for logged-in user
async function fetchActiveJourney(phone, email) {
  const params = new URLSearchParams();
  if (phone) params.append('phone', phone);
  if (email) params.append('email', email);
  const res = await fetch(`${API_BASE}/trains/active-journey?${params}`);
  if (!res.ok) throw new Error('Failed to fetch journey');
  return res.json();
}

// Fetch helpline number from backend env (TWILIO_PHONE_NUMBER), cached once
let cachedHelplineNumber = null;
let helplineFetchPromise = null;

function fetchHelplineNumber() {
  if (!helplineFetchPromise) {
    helplineFetchPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/config/helpline`);
        if (!res.ok) throw new Error('Failed to fetch helpline number');
        const data = await res.json();
        cachedHelplineNumber = data.helplineNumber || '139';
      } catch {
        cachedHelplineNumber = '139';
      }
      return cachedHelplineNumber;
    })();
  }
  return helplineFetchPromise;
}

// ─── Active Journey Banner ──────────────────────────────────────────────────
function ActiveJourneyBanner({ journey, onReportIssue, refreshing, onRefresh }) {
  const delayColor = journey.delayMinutes === 0 ? 'emerald' : journey.delayMinutes <= 10 ? 'amber' : 'red';

  return (
    <div className="mx-6 mt-5 rounded-2xl overflow-hidden border border-blue-200 shadow-sm bg-gradient-to-br from-[#003a8c] to-[#004696]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center">
            <Train className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-black uppercase tracking-wider">Current Journey</p>
            <p className="text-blue-200 text-[10px] font-medium">Live from NTES RailRadar</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-white ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Train Info */}
      <div className="px-4 pb-4 space-y-3">
        <div>
          <p className="text-white font-black text-base leading-tight">{journey.trainName}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-blue-200 text-[11px] font-medium">{journey.origin}</span>
            <ArrowRight className="w-3 h-3 text-blue-300" />
            <span className="text-blue-200 text-[11px] font-medium">{journey.destination}</span>
          </div>
        </div>

        {/* Status Row */}
        <div className="bg-white/10 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-white text-[11px] font-semibold">
              <MapPin className="w-3 h-3 text-blue-300" />
              <span className="truncate max-w-[160px]">{journey.currentStation}</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              delayColor === 'emerald' ? 'bg-emerald-500/30 text-emerald-200' :
              delayColor === 'amber' ? 'bg-amber-500/30 text-amber-200' :
              'bg-red-500/30 text-red-200'
            }`}>
              {journey.delayMinutes === 0 ? '✓ On Time' : `+${journey.delayMinutes} min delay`}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-blue-100 font-semibold">
            <span className="flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-blue-300" />
              PNR: <span className="font-mono text-white">{journey.pnr}</span>
            </span>
            <span className="flex items-center gap-1">
              <Armchair className="w-3 h-3 text-blue-300" />
              {journey.coach} · Berth {journey.berth}
            </span>
          </div>
        </div>

        {/* Report Issue CTA */}
        <button
          onClick={onReportIssue}
          className="w-full py-3 bg-white text-[#004696] rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-blue-50 active:scale-[0.98] transition shadow"
        >
          <Camera className="w-4 h-4" />
          Report Issue on This Train
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── No Journey Banner ───────────────────────────────────────────────────────
function NoJourneyBanner() {
  return (
    <div className="mx-6 mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center flex-shrink-0">
        <Lock className="w-4.5 h-4.5 text-slate-500" />
      </div>
      <div>
        <p className="text-xs font-black text-slate-700">No Active Journey Found</p>
        <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
          You can only report issues for trains you are registered on. Contact station staff or the officer to register your journey.
        </p>
      </div>
    </div>
  );
}

// ─── Main Home Page ──────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [journey, setJourney] = useState(null); // null = loading, false = no journey, object = active
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [helplineNumber, setHelplineNumber] = useState('139');

  useEffect(() => {
    fetchHelplineNumber().then(setHelplineNumber);
  }, []);

  const loadJourney = useCallback(async () => {
    if (!user) { setJourney(false); return; }
    setLoadingJourney(true);
    try {
      const data = await fetchActiveJourney(user.phone, user.email);
      setJourney(data.hasActiveJourney ? data : false);
    } catch {
      setJourney(false);
    } finally {
      setLoadingJourney(false);
    }
  }, [user]);

  useEffect(() => {
    loadJourney();
    // Refresh every 2 hours to sync with backend telemetry
    const timer = setInterval(loadJourney, 2 * 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadJourney]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJourney();
    setRefreshing(false);
  };

  const handleReportIssue = () => {
    if (!journey) return;
    // Pre-fill the report with active journey details
    navigate('/report/step1', {
      state: {
        prefill: {
          trainNumber: journey.trainName,
          coach: journey.coach,
          pnr: journey.pnr,
          berth: journey.berth
        }
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 pb-16 bg-white">
      {/* Top Header with Brand Logo */}
      <div className="px-6 pt-5 flex items-center justify-between border-b border-slate-100 pb-4 bg-slate-50/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-xl p-1.5 shadow-sm border border-slate-150 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="Rail Madad Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-sm font-black text-[#004696] tracking-wider block font-sans">RAIL MADAD</span>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Passenger Portal</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Portal Switcher */}
          <div className="flex items-center space-x-1 mr-1">
            <a 
              href="/officer" 
              className="text-[10px] font-black tracking-wide text-slate-600 hover:text-primary bg-slate-100 hover:bg-blue-50 px-2 py-1 rounded-full transition-colors border border-slate-200 shadow-2xs"
              title="Switch to Railway Officer Command Center"
            >
              👮 Officer
            </a>
            <a 
              href="/staff" 
              className="text-[10px] font-black tracking-wide text-slate-600 hover:text-primary bg-slate-100 hover:bg-blue-50 px-2 py-1 rounded-full transition-colors border border-slate-200 shadow-2xs"
              title="Switch to On-Duty Railway Staff App"
            >
              👷 Staff
            </a>
          </div>

          {user ? (
            <Link to="/profile" className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-primary border border-blue-200 rounded-full text-xs font-bold">
              <User className="w-3.5 h-3.5" />
              <span>{user.name.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link to="/login" className="flex items-center space-x-1.5 px-3 py-1.5 bg-primary text-white rounded-full text-xs font-bold shadow-sm">
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </Link>
          )}
        </div>
      </div>

      {/* Welcome Heading */}
      <div className="px-6 pt-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
          {user ? `Welcome, ${user.name.split(' ')[0]}` : 'How can we help today?'}
        </h1>
        <p className="text-slate-500 text-sm font-medium mt-1 leading-snug">
          Report issues, track status and get assistance.
        </p>
      </div>

      {/* ── Active Journey Section (only for logged-in users) ── */}
      {user && (
        <>
          {loadingJourney ? (
            <div className="mx-6 mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Checking your active journey...</span>
            </div>
          ) : journey ? (
            <ActiveJourneyBanner
              journey={journey}
              onReportIssue={handleReportIssue}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          ) : (
            <NoJourneyBanner />
          )}
        </>
      )}

      {/* Train Banner Graphic (shown when no journey / not logged in) */}
      {!user && (
        <div className="px-6 mt-4">
          <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shadow-sm relative">
            <img
              src="/train_banner.jpg"
              alt="Indian Railways Vande Bharat Train Banner"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Main CTA Report Button — locked if logged in but no active journey */}
      {user && !loadingJourney && !journey && (
        <div className="px-6 mt-5">
          <div className="w-full py-3.5 bg-slate-200 text-slate-400 rounded-xl font-bold text-sm flex items-center justify-center space-x-2.5 cursor-not-allowed">
            <Lock className="w-4.5 h-4.5" />
            <span>No Active Journey — Cannot Report</span>
          </div>
        </div>
      )}

      {!user && (
        <div className="px-6 mt-5">
          <button
            onClick={() => navigate('/login')}
            className="w-full py-4 bg-[#004696] hover:bg-[#003c82] text-white rounded-xl font-bold text-sm shadow active:scale-[0.99] transition flex items-center justify-center space-x-2.5"
          >
            <LogIn className="w-5 h-5 text-white" />
            <span>Login to Report an Issue</span>
          </button>
        </div>
      )}

      {/* 2x2 Quick Actions Card Grid */}
      <div className="px-6 mt-6">
        <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden grid grid-cols-2 divide-x divide-y divide-slate-150">

          {/* Action 1: My Reports */}
          <div
            onClick={() => navigate('/my-reports')}
            className="p-6 flex flex-col items-center text-center space-y-2 hover:bg-slate-50/50 active:bg-slate-100/30 transition cursor-pointer"
          >
            <div className="w-12 h-12 bg-blue-50/70 text-[#004696] rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#004696] tracking-tight">My Reports</span>
          </div>

          {/* Action 2: Track Status */}
          <div
            onClick={() => navigate('/track')}
            className="p-6 flex flex-col items-center text-center space-y-2 hover:bg-slate-50/50 active:bg-slate-100/30 transition cursor-pointer"
          >
            <div className="w-12 h-12 bg-blue-50/70 text-[#004696] rounded-full flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#004696] tracking-tight">Track Status</span>
          </div>

          {/* Action 3: Rail Madad Helpline */}
          <a
            href={`tel:${helplineNumber}`}
            className="p-6 flex flex-col items-center text-center space-y-2 hover:bg-slate-50/50 active:bg-slate-100/30 transition cursor-pointer"
          >
            <div className="w-12 h-12 bg-blue-50/70 text-[#004696] rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#004696] tracking-tight">Rail Madad Helpline</span>
          </a>

          {/* Action 4: FAQs */}
          <div
            onClick={() => alert('Opening Help & Frequently Asked Questions...')}
            className="p-6 flex flex-col items-center text-center space-y-2 hover:bg-slate-50/50 active:bg-slate-100/30 transition cursor-pointer"
          >
            <div className="w-12 h-12 bg-blue-50/70 text-[#004696] rounded-full flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#004696] tracking-tight">FAQs</span>
          </div>

        </div>
      </div>
    </div>
  );
}
