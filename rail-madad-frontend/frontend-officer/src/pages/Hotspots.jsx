import React, { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, Zap, Wrench, Clock3 } from 'lucide-react';
import { getHotspots } from '../api/officerClient';

function HotspotCard({ hotspot }) {
  const getRiskColor = (score) => {
    if (score >= 75) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'High Risk' };
    if (score >= 50) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Medium Risk' };
    return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', label: 'Low Risk' };
  };

  const getPriorityColor = (priority) => {
    if (priority === 'High') return 'bg-red-100 text-red-700';
    if (priority === 'Medium') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const colors = getRiskColor(hotspot.riskScore);

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden hover:shadow-md transition-shadow`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Train {hotspot.train} • Coach {hotspot.coach}
            </h3>
            <p className={`text-xs font-medium mt-1 ${colors.text}`}>{colors.label}</p>
          </div>
          <div className={`text-lg font-black ${colors.text}`}>
            {Math.round(hotspot.riskScore)}%
          </div>
        </div>

        <div className="space-y-2 mb-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Total Complaints</span>
            <span className="font-bold text-slate-900">{hotspot.totalComplaints}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Main Issue</span>
            <span className="font-medium text-slate-900">{hotspot.predictedNextIssue}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Last Report</span>
            <span className="font-medium text-slate-900">{hotspot.lastReportedAgo}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Maintenance Priority</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${getPriorityColor(hotspot.maintenancePriority)}`}>
              {hotspot.maintenancePriority}
            </span>
          </div>
        </div>

        {hotspot.issues && hotspot.issues.length > 0 && (
          <div className="pt-3 border-t border-current border-opacity-10">
            <p className="text-xs font-bold text-slate-600 mb-2">Recent Issues</p>
            <div className="space-y-1">
              {hotspot.issues.map((issue, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{issue.category}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    issue.severity === 'High' 
                      ? 'bg-red-100 text-red-700'
                      : issue.severity === 'Medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {issue.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Hotspots() {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHotspots();
  }, []);

  const loadHotspots = async () => {
    try {
      setLoading(true);
      const data = await getHotspots();
      setHotspots(data);
    } catch (err) {
      console.error('Failed to load hotspots:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-black text-slate-900">Hotspots & Predictions</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Train/coach locations with recurring issues — prioritize maintenance here</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Clock3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading hotspots...</p>
        </div>
      ) : hotspots.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-900">No hotspots detected</p>
          <p className="text-xs text-slate-500 mt-1">
            When trains or coaches accumulate 2+ complaints, they'll appear here
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-blue-900">Maintenance Alert</p>
              <p className="text-xs text-blue-700 mt-0.5">
                These hotspots indicate recurring issues that need preventive maintenance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotspots.map(hotspot => (
              <HotspotCard key={`${hotspot.train}-${hotspot.coach}`} hotspot={hotspot} />
            ))}
          </div>

          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Maintenance Recommendations
            </h3>
            <div className="space-y-3">
              {hotspots
                .filter(h => h.maintenancePriority === 'High')
                .slice(0, 3)
                .map((hotspot, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <Zap className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">
                        Train {hotspot.train}, Coach {hotspot.coach}
                      </p>
                      <p className="text-slate-600 mt-1">
                        {hotspot.totalComplaints} complaints for {hotspot.predictedNextIssue} — schedule immediate inspection
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
