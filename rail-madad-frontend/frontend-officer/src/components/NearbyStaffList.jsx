import React, { useEffect, useState } from "react";
import { MapPin, Clock3, Phone, Check } from "lucide-react";
import { getStaffRoster } from "../api/officerClient";
import { findNearbyStaff } from "../utils/nearbyStaff";

export default function NearbyStaffList({
  department,
  seed,
  assignedId,
  onAssign,
  limit = 3,
}) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const roster = await getStaffRoster();
        setStaffList(roster || []);
      } catch (err) {
        console.error("Failed to load staff roster:", err.message);
        setStaffList([]);
      } finally {
        setLoading(false);
      }
    };

    loadStaff();
  }, []);

  const staff = findNearbyStaff({ department, seed, limit, staffList });

  if (loading) {
    return (
      <div className="text-xs text-slate-400 font-medium px-3 py-3 border border-dashed border-slate-200 rounded-lg">
        Loading staff roster…
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="text-xs text-slate-400 font-medium px-3 py-3 border border-dashed border-slate-200 rounded-lg">
        No approved {department} staff found nearby.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/60">
      <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
          Nearest {department} staff on duty
        </span>
      </div>
      <div className="divide-y divide-slate-200">
        {staff.map((s) => {
          const isAssigned = assignedId === s.id;
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {s.name}
                </p>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  {s.role} · Based at{" "}
                  {s.location || s.station || s.depot || "Station HQ"}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {s.distanceKm} km away
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="w-3 h-3" /> ~{s.etaMin} min ETA
                  </span>
                </div>
              </div>
              <button
                onClick={() => onAssign && onAssign(s)}
                disabled={isAssigned}
                className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-colors ${
                  isAssigned
                    ? "bg-slate-900 text-white border-slate-900 cursor-default"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white hover:border-slate-900"
                }`}
              >
                {isAssigned ? (
                  <>
                    <Check className="w-3 h-3" /> Assigned
                  </>
                ) : (
                  <>
                    <Phone className="w-3 h-3" /> Assign
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
