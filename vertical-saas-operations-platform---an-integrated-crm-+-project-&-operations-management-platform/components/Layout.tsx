
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useForgeStore } from '../store';
import { ICONS } from '../constants';
import { UserRole } from '../types';

const SidebarLink = ({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: number }) => {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive 
            ? 'bg-slate-800 text-white shadow-lg' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`
      }
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        <span className="font-medium">{label}</span>
      </div>
      {badge ? (
        <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>
      ) : null}
    </NavLink>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { data, switchUser } = useForgeStore();
  const pageTitle = {
    '/': 'Executive Dashboard',
    '/crm': 'Customer Relations',
    '/quotes': 'Quotes & Pipeline',
    '/projects': 'Project Delivery',
    '/checklist': 'Operational To-do list',
    '/deliveries': 'Logistics & Delivery Board'
  }[location.pathname] || 'Forge Nexus';

  const pendingRequests = data.deliveryRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex-shrink-0 flex flex-col h-full z-20 shadow-2xl">
        <div className="p-8 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ICONS.Briefcase className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">FORGE</h1>
          </div>
          <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Project Nexus</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          <SidebarLink to="/" icon={ICONS.Dashboard} label="Dashboard" />
          <SidebarLink to="/crm" icon={ICONS.Users} label="CRM" />
          <SidebarLink to="/quotes" icon={ICONS.FileText} label="Quotes" />
          <SidebarLink to="/projects" icon={ICONS.Briefcase} label="Projects" />
          
          <div className="pt-4 pb-2 px-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Operations</span>
          </div>
          <SidebarLink to="/deliveries" icon={ICONS.Truck} label="Delivery Board" badge={pendingRequests} />
          <SidebarLink to="/checklist" icon={ICONS.CheckSquare} label="To-do list" />
        </nav>

        {/* Role Switcher (For Demo purposes) */}
        <div className="p-4 bg-slate-800/50 mx-4 mb-4 rounded-xl">
           <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Simulate Role</span>
           <select 
              value={data.currentUser.role}
              onChange={(e) => switchUser(e.target.value as UserRole)}
              className="w-full bg-slate-900 text-slate-300 text-xs font-bold p-2 rounded-lg border border-slate-700 outline-none"
           >
              <option value="ADMIN">Administrator</option>
              <option value="DISPATCH">Dispatch Manager</option>
              <option value="SALES">Sales Agent</option>
              <option value="YARD">Yard Foreman</option>
           </select>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 text-slate-400">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              data.currentUser.role === 'ADMIN' ? 'bg-indigo-600' :
              data.currentUser.role === 'DISPATCH' ? 'bg-rose-500' :
              data.currentUser.role === 'SALES' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}>
              {data.currentUser.name[0]}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-slate-200 truncate">{data.currentUser.name}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">{data.currentUser.role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-10">
          <h2 className="text-lg font-bold text-slate-800">{pageTitle}</h2>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              <input type="text" placeholder="Universal Search..." className="pl-9 pr-4 py-2 bg-slate-100 rounded-full text-sm border-none focus:ring-2 focus:ring-indigo-500 w-64 transition-all" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
