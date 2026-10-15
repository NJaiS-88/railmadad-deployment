import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Users, Target, CheckCircle, AlertCircle } from 'lucide-react';
import { getDetailedAnalytics } from '../api/officerClient';

const tooltipStyle = {
  fontSize: 12,
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  boxShadow: 'none',
};

function StatBox({ label, value, trend, note }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-2 mt-2">
        <p className="text-2xl font-black text-slate-900">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      {note && <p className="text-xs text-slate-500 font-medium mt-1">{note}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 font-medium mt-0.5 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDetailedAnalytics()
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load analytics:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500">Loading analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Failed to load analytics</p>
      </div>
    );
  }

  const summary = data.summary || {};
  const totalComplaints = summary.totalComplaints || 0;
  const resolved = summary.resolved || 0;
  const flagged = summary.flagged || 0;
  const pending = summary.pending || 0;

  // Calculate resolution rate
  const resolutionRate = totalComplaints > 0 ? Math.round((resolved / totalComplaints) * 100) : 0;

  // Prepare category data for pie chart
  const categoryData = (data.byCategory || []).slice(0, 5);
  const colors = ['#0F172A', '#334155', '#64748B', '#94A3B8', '#CBD5E1'];

  // Prepare status breakdown
  const statusData = [
    { name: 'Resolved', value: resolved, color: '#16A34A' },
    { name: 'Pending', value: pending, color: '#EAB308' },
    { name: 'Flagged', value: flagged, color: '#DC2626' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-black text-slate-900">Analytics Dashboard</h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">System performance, AI accuracy, and staff metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox 
          label="Total Complaints" 
          value={totalComplaints} 
          note="All time"
        />
        <StatBox 
          label="Resolved" 
          value={resolved} 
          note={`${resolutionRate}% resolution rate`}
        />
        <StatBox 
          label="Pending" 
          value={pending} 
          note="Awaiting action"
        />
        <StatBox 
          label="Flagged" 
          value={flagged} 
          note="Suspicious entries"
        />
        <StatBox 
          label="AI Accuracy" 
          value={`${summary.aiAccuracyRate || 0}%`} 
          note="Classification success"
        />
        <StatBox 
          label="Satisfaction" 
          value={`${summary.passengerSatisfactionRate || 0}%`} 
          note={`Avg rating ${summary.averageRating || '—'} / 5 · ${summary.feedbackCount || 0} responses`}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Complaint Status Breakdown */}
        <ChartCard title="Complaint Status Breakdown" subtitle="Current distribution of all complaints">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              <p className="text-sm">No complaint data available</p>
            </div>
          )}
        </ChartCard>

        {/* Complaints by Category */}
        <ChartCard title="Top Complaint Categories" subtitle="Most common issue types">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fontSize: 10, fill: '#94A3B8' }} 
                  axisLine={{ stroke: '#E2E8F0' }} 
                  tickLine={false}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#0F172A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              <p className="text-sm">No category data available</p>
            </div>
          )}
        </ChartCard>

        {/* Resolution Time by Department */}
        <ChartCard title="Complaints by Department" subtitle="Workload distribution">
          {(data.byDepartment || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart 
                data={(data.byDepartment || []).slice(0, 8)} 
                layout="vertical" 
                margin={{ left: 100, right: 20 }}
              >
                <CartesianGrid stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis 
                  type="category" 
                  dataKey="department" 
                  tick={{ fontSize: 10, fill: '#475569' }} 
                  axisLine={false} 
                  tickLine={false}
                  width={95}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#0F172A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              <p className="text-sm">No department data available</p>
            </div>
          )}
        </ChartCard>

        {/* Staff Metrics */}
        <ChartCard title="Staff & Operations Metrics" subtitle="Team performance overview">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Approved Staff</p>
                  <p className="text-xs text-slate-500">Active railway staff</p>
                </div>
              </div>
              <p className="text-lg font-black text-slate-900">{summary.approvedStaff || 0}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Pending Approvals</p>
                  <p className="text-xs text-amber-700">New staff to verify</p>
                </div>
              </div>
              <p className="text-lg font-black text-amber-700">{summary.pendingStaffApprovals || 0}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-bold text-blue-900">Avg Resolution Time</p>
                  <p className="text-xs text-blue-700">Hours to complete</p>
                </div>
              </div>
              <p className="text-lg font-black text-blue-900">{summary.avgResolutionTimeHrs || 0}h</p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Summary Section */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          System Health Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-600 font-medium mb-1">AI Classification Accuracy</p>
            <p className="text-lg font-black text-slate-900">{summary.aiAccuracyRate || 0}%</p>
            <p className="text-xs text-slate-500 mt-1">Officers confident in AI's predictions</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium mb-1">Passenger Satisfaction</p>
            <p className="text-lg font-black text-slate-900">{summary.passengerSatisfactionRate || 0}%</p>
            <p className="text-xs text-slate-500 mt-1">Based on passenger feedback ratings</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium mb-1">Avg Resolution Time</p>
            <p className="text-lg font-black text-slate-900">{summary.avgResolutionTimeHrs || 0} hours</p>
            <p className="text-xs text-slate-500 mt-1">Time from complaint to resolution</p>
          </div>
        </div>
      </div>
    </div>
  );
}
