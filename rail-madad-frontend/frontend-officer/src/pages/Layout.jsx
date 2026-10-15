import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, HelpCircle, ShieldAlert, Layers, Users2, BarChart3, 
  FileText, LogOut, Menu, Train, Users, Flame
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Review Queue', path: '/review', icon: HelpCircle },
    { name: 'Flagged', path: '/flagged', icon: ShieldAlert },
    { name: 'Duplicates', path: '/clusters', icon: Layers },
    { name: 'Multi-Department', path: '/multi-department', icon: Users2 },
    { name: 'Staff Approvals', path: '/staff-approval', icon: Users },
    { name: 'Hotspots', path: '/hotspots', icon: Flame },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Train Management', path: '/trains', icon: Train },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 z-20 border-r border-slate-800">
        {/* Sidebar Header / Logo */}
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/20">
          <div className="p-1.5 bg-white rounded-xl flex items-center justify-center w-10 h-10 overflow-hidden shadow-sm">
            <img src="/logo.png" alt="Rail Madad Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-sm font-black text-white tracking-widest block font-sans">RAIL MADAD</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Officer Dashboard</span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center space-x-3.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary text-white' 
                    : 'hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-accent' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/10">
          <button 
            onClick={() => {
              if (confirm('Logout of dashboard?')) {
                navigate('/');
              }
            }}
            className="w-full flex items-center space-x-3.5 px-4 py-3 hover:bg-slate-800 hover:text-white transition-colors rounded-xl text-xs font-bold text-slate-400"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex justify-between items-center flex-shrink-0 relative z-10">
          <div className="flex items-center space-x-4">
            <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 lg:hidden">
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-slate-800 font-extrabold text-sm uppercase tracking-wider hidden md:block">
              Triage · Verify · Route · Resolve
            </div>
          </div>

          {/* User profile dropdown info */}
          <div className="flex items-center space-x-4 border-l border-slate-150 pl-4 py-1">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-extrabold text-slate-800">Officer A. Verma</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Sr. Divisional Ops Manager</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center justify-center font-bold text-xs">
              AV
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
