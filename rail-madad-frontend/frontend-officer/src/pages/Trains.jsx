import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Train, Users, Plus, RefreshCw, ChevronDown, ChevronUp,
  Clock, MapPin, AlertTriangle, CheckCircle2, X, Search, Loader2,
  UserPlus, PhoneCall, CreditCard, Armchair, UserCheck, UserCircle2
} from 'lucide-react';
import { getAllTrains, addPassengerToTrain, refreshTrainTelemetry, searchUsers } from '../api/officerClient';

// ─── Status Badge ──────────────────────────────────────────────────────────
function DelayBadge({ minutes }) {
  if (minutes === 0) return (
    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" /> On Time
    </span>
  );
  const color = minutes <= 10 ? 'amber' : 'red';
  return (
    <span className={`inline-flex items-center gap-1 bg-${color}-50 text-${color}-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-${color}-200`}>
      <AlertTriangle className="w-3 h-3" /> +{minutes} min
    </span>
  );
}

// ─── Add Passenger Modal ───────────────────────────────────────────────────
function AddPassengerModal({ train, onClose, onSuccess }) {
  // User search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const searchTimeout = useRef(null);

  // Journey-specific form fields
  const [pnr, setPnr] = useState('');
  const [coach, setCoach] = useState('');
  const [berth, setBerth] = useState('');

  // Manual override mode (if user not found in DB)
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Debounced search
  useEffect(() => {
    if (manualMode) return;
    clearTimeout(searchTimeout.current);
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchUsers(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [searchQuery, manualMode]);

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = manualMode
        ? { passengerName: manualName, passengerPhone: manualPhone, passengerEmail: manualEmail, pnr, coach, berth }
        : { passengerName: selectedUser.name, passengerPhone: selectedUser.phone, passengerEmail: selectedUser.email, pnr, coach, berth };
      await addPassengerToTrain(train.trainNumber, payload);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to add passenger');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = pnr && coach && berth && (
    manualMode ? (manualName && manualPhone) : !!selectedUser
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <UserPlus className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">Assign Passenger</p>
              <p className="text-[11px] text-slate-400 font-medium">{train.trainName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* ── Step 1: Select Passenger ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wide">
                1. Select Passenger
              </p>
              <button
                type="button"
                onClick={() => { setManualMode(m => !m); setSelectedUser(null); setSearchQuery(''); setSearchResults([]); }}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                {manualMode ? '← Search registered users' : 'Not in system? Enter manually'}
              </button>
            </div>

            {manualMode ? (
              /* Manual entry fields */
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[11px] text-slate-500 font-semibold">Manual passenger entry (not a registered user)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Full Name *</label>
                    <input value={manualName} onChange={e => setManualName(e.target.value)} required
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-primary transition" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Phone *</label>
                    <input value={manualPhone} onChange={e => setManualPhone(e.target.value)} required type="tel"
                      placeholder="9876543210"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-primary transition" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Email</label>
                    <input value={manualEmail} onChange={e => setManualEmail(e.target.value)} type="email"
                      placeholder="email@example.com"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-primary transition" />
                  </div>
                </div>
              </div>
            ) : selectedUser ? (
              /* Selected user chip */
              <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">{selectedUser.name}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{selectedUser.phone} · {selectedUser.email}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedUser(null)}
                  className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-500 hover:text-emerald-700 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Search box */
              <div className="relative">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  {searching && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, phone or email…"
                    className="w-full pl-9 pr-9 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                  />
                </div>

                {/* Dropdown results */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden max-h-56 overflow-y-auto">
                    {searchResults.map(u => (
                      <button
                        key={u._id || u.email}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition border-b border-slate-50 last:border-0 text-left"
                      >
                        <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <UserCircle2 className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">{u.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{u.phone} · {u.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg z-30 px-4 py-4 text-center">
                    <p className="text-xs text-slate-500 font-semibold">No registered users found</p>
                    <button type="button" onClick={() => setManualMode(true)}
                      className="mt-2 text-xs text-primary font-bold hover:underline">
                      Enter manually instead →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Step 2: Journey Details ── */}
          <div>
            <p className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">
              2. Journey Details
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">PNR Number *</label>
                <div className="relative">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={pnr} onChange={e => setPnr(e.target.value)} required
                    placeholder="e.g. 8452167893"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-primary transition font-mono" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Coach *</label>
                <input value={coach} onChange={e => setCoach(e.target.value)} required
                  placeholder="e.g. B4"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-primary transition text-center font-bold" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Berth / Seat *</label>
                <div className="relative">
                  <Armchair className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={berth} onChange={e => setBerth(e.target.value)} required
                    placeholder="e.g. 32 — Lower"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-primary transition" />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700 font-semibold">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving || !canSubmit}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {saving ? 'Assigning…' : 'Assign to Train'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── Train Card ────────────────────────────────────────────────────────────
function TrainCard({ train, onAddPassenger, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const filteredPassengers = (train.passengers || []).filter(p =>
    !search ||
    p.passengerName?.toLowerCase().includes(search.toLowerCase()) ||
    p.passengerPhone?.includes(search) ||
    p.pnr?.includes(search) ||
    p.coach?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Train Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer group"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
            <Train className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">{train.trainName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-400 font-medium">
                {train.origin} → {train.destination}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1.5 justify-end mb-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-600 max-w-[180px] truncate">{train.currentStation}</span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <DelayBadge minutes={train.delayMinutes || 0} />
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> {train.passengers?.length || 0} passengers
              </span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onAddPassenger(train); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-[11px] font-bold hover:bg-primary/90 transition"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
          <div className="text-slate-400 group-hover:text-slate-600 transition">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Passenger List */}
      {expanded && (
        <div className="border-t border-slate-100">
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, phone, PNR, coach..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-primary transition bg-slate-50"
              />
            </div>
          </div>

          {/* Passenger Table */}
          {filteredPassengers.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-semibold">
                {search ? 'No passengers match your search' : 'No passengers added to this train yet'}
              </p>
              {!search && (
                <button
                  onClick={() => onAddPassenger(train)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-[11px] font-bold hover:bg-primary/90 transition"
                >
                  <Plus className="w-3 h-3" /> Add First Passenger
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Passenger', 'Phone', 'PNR', 'Coach', 'Berth', 'Added'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPassengers.map((p, idx) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{p.passengerName}</p>
                        {p.passengerEmail && <p className="text-[10px] text-slate-400">{p.passengerEmail}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <PhoneCall className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-slate-700">{p.passengerPhone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                          <span className="font-mono font-semibold text-slate-700">{p.pnr}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-bold">
                          {p.coach}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Armchair className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-slate-700">{p.berth}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[10px]">
                        {p.addedAt ? new Date(p.addedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Trains Page ──────────────────────────────────────────────────────
export default function Trains() {
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(null); // train object
  const [globalSearch, setGlobalSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getAllTrains();
      setTrains(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading trains:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 2 hours (same cadence as backend telemetry)
    const timer = setInterval(load, 2 * 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  const handleRefreshTelemetry = async () => {
    setRefreshing(true);
    try {
      await refreshTrainTelemetry();
      await load();
    } catch (err) {
      console.error('Telemetry refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddSuccess = async () => {
    setAddModal(null);
    await load();
  };

  const filteredTrains = trains.filter(t =>
    !globalSearch ||
    t.trainName?.toLowerCase().includes(globalSearch.toLowerCase()) ||
    t.trainNumber?.includes(globalSearch) ||
    t.origin?.toLowerCase().includes(globalSearch.toLowerCase()) ||
    t.destination?.toLowerCase().includes(globalSearch.toLowerCase())
  );

  const totalPassengers = trains.reduce((sum, t) => sum + (t.passengers?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Train className="w-5 h-5 text-primary" />
            Train Management
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Live train roster with passenger manifests. Telemetry refreshes every 2 hours.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastRefresh && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <Clock className="w-3.5 h-3.5" />
              Last updated: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <button
            onClick={handleRefreshTelemetry}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Telemetry'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Trains', value: trains.length, icon: Train },
          { label: 'Total Passengers', value: totalPassengers, icon: Users },
          { label: 'Delayed Trains', value: trains.filter(t => (t.delayMinutes || 0) > 0).length, icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-black text-slate-800">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Global Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          placeholder="Search trains by number, name, origin or destination..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition shadow-sm"
        />
      </div>

      {/* Train Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-semibold text-sm">Loading train manifest...</span>
        </div>
      ) : filteredTrains.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Train className="w-10 h-10 mx-auto text-slate-200 mb-3" />
          <p className="font-bold text-slate-500">No trains found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search query</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrains.map(train => (
            <TrainCard
              key={train.trainNumber}
              train={train}
              onAddPassenger={setAddModal}
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {/* Add Passenger Modal */}
      {addModal && (
        <AddPassengerModal
          train={addModal}
          onClose={() => setAddModal(null)}
          onSuccess={handleAddSuccess}
        />
      )}
    </div>
  );
}
