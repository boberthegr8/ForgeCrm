import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useForgeStore } from '../store';
import { ICONS } from '../constants';
import { UserRole } from '../types';
import { CoreAccountControl } from './CoreAccountControl';

const SidebarLink = ({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: number }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-all duration-150 border ${
        isActive ? 'forge-nav-active' : 'forge-nav-item border-transparent'
      }`
    }
  >
    <div className="flex items-center gap-3">
      <Icon className="w-[18px] h-[18px]" />
      <span className="font-semibold text-sm">{label}</span>
    </div>
    {badge ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'var(--forge-accent)', color: '#111' }}>{badge}</span> : null}
  </NavLink>
);

const SuiteLink = ({ label, href, active = false, comingSoon = false }: { label: string, href?: string, active?: boolean, comingSoon?: boolean }) => {
  const className = `flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-all duration-150 border ${
    active ? 'forge-nav-active' : comingSoon ? 'border-transparent opacity-40 cursor-not-allowed' : 'forge-nav-item border-transparent'
  }`;
  const content = (
    <>
      <span className="font-semibold text-sm">{label}</span>
      {active ? (
        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--forge-accent)', boxShadow: '0 0 0 4px rgba(255,116,23,.10)' }} />
      ) : comingSoon ? (
        <span className="text-[9px] uppercase tracking-wider forge-muted font-black">Next</span>
      ) : (
        <span className="forge-muted text-xs">↗</span>
      )}
    </>
  );

  if (active || comingSoon || !href) return <div className={className}>{content}</div>;
  return <a href={href} className={className}>{content}</a>;
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { data, switchUser } = useForgeStore();
  const pageTitle = {
    '/': 'Dashboard',
    '/crm': 'Customers',
    '/quotes': 'Quotes',
    '/projects': 'Projects',
    '/purchasing': 'Purchasing',
    '/checklist': 'To-do List',
    '/deliveries': 'Delivery Board'
  }[location.pathname] || 'Forge CRM';

  const pendingRequests = data.deliveryRequests.filter(request => request.status === 'PENDING').length;

  return (
    <div className="forge-shell flex h-screen overflow-hidden">
      <aside className="forge-sidebar w-[270px] flex-shrink-0 flex flex-col h-full z-20">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'var(--forge-accent)', boxShadow: '0 10px 30px rgba(255,116,23,.18)' }}>
              <ICONS.Briefcase className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight text-white leading-tight">FORGE</div>
              <div className="text-[10px] uppercase tracking-[.22em] forge-muted font-black">CRM</div>
            </div>
          </div>

          <button type="button" className="forge-card mt-4 w-full px-3 py-2.5 text-left flex items-center justify-between text-xs font-semibold">
            <span className="truncate">JK Hardware - Main</span>
            <span className="forge-muted">⌄</span>
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-[.18em] forge-muted">Forge Suite</div>
          <SuiteLink label="Home" href="https://forge2-navy.vercel.app" />
          <SuiteLink label="CRM" active />
          <SuiteLink label="Reader" href="https://robquotes.vercel.app" />
          <SuiteLink label="Scope" href="https://forge-scope.vercel.app" />
          <SuiteLink label="Quote / AI Quoter" href="https://lumber-estimator-ai.vercel.app" />
          <SuiteLink label="Manufacturing" href="https://forgemfg.vercel.app" />
          <SuiteLink label="Portal" href="https://forge-portal-pi.vercel.app" />

          <div className="mx-3 my-4 border-t" style={{ borderColor: 'var(--forge-border-soft)' }} />

          <div className="px-3 pt-1 pb-1 text-[10px] font-black uppercase tracking-[.18em] forge-muted">CRM</div>
          <SidebarLink to="/" icon={ICONS.Dashboard} label="Dashboard" />
          <SidebarLink to="/crm" icon={ICONS.Users} label="Contacts" />
          <SidebarLink to="/quotes" icon={ICONS.FileText} label="Quotes" />
          <SidebarLink to="/projects" icon={ICONS.Briefcase} label="Pipeline / Projects" />

          <div className="px-3 pt-5 pb-1 text-[10px] font-black uppercase tracking-[.18em] forge-muted">Commercial</div>
          <SidebarLink to="/purchasing" icon={ICONS.FileText} label="Purchasing / POs" />

          <div className="px-3 pt-5 pb-1 text-[10px] font-black uppercase tracking-[.18em] forge-muted">Operations</div>
          <SidebarLink to="/checklist" icon={ICONS.CheckSquare} label="To-do List" />
          <SidebarLink to="/deliveries" icon={ICONS.Truck} label="Delivery" badge={pendingRequests} />
        </nav>

        <div className="mx-3 mb-3 forge-card p-3">
          <span className="text-[9px] font-black forge-muted uppercase tracking-[.18em] block mb-2">Legacy role simulator</span>
          <select
            value={data.currentUser.role}
            onChange={event => switchUser(event.target.value as UserRole)}
            className="forge-input w-full text-xs font-bold p-2 rounded-lg"
          >
            <option value="ADMIN">Administrator</option>
            <option value="DISPATCH">Dispatch Manager</option>
            <option value="SALES">Sales Agent</option>
            <option value="YARD">Yard Foreman</option>
          </select>
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--forge-border-soft)' }}>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-black" style={{ background: 'var(--forge-accent)' }}>
              {data.currentUser.name[0]}
            </div>
            <div className="flex flex-col overflow-hidden min-w-0">
              <span className="text-sm font-semibold text-white truncate">{data.currentUser.name}</span>
              <span className="text-[10px] font-black forge-muted uppercase tracking-wider">{data.currentUser.role}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="forge-topbar h-[72px] flex items-center justify-between px-7 flex-shrink-0 z-10">
          <div>
            <div className="text-[10px] uppercase tracking-[.2em] forge-muted font-black">Forge CRM</div>
            <h2 className="text-xl font-black text-white leading-tight mt-0.5">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group hidden lg:block">
              <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 forge-muted" />
              <input type="text" placeholder="Search contacts, quotes…" className="forge-input pl-9 pr-4 py-2.5 rounded-xl text-sm w-72 transition-all" />
            </div>
            <CoreAccountControl />
          </div>
        </header>

        <div className="forge-content flex-1 overflow-y-auto p-7">
          <div className="max-w-[1680px] mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};
