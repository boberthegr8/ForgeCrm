import React from 'react';
import { Link } from 'react-router-dom';
import { useForgeStore } from '../store';
import { ICONS, CATEGORY_COLORS } from '../constants';

const StatCard = ({ label, value, detail, icon: Icon, to, accent = false }: { label: string; value: string | number; detail: string; icon: any; to: string; accent?: boolean }) => (
  <Link to={to} className="forge-card group block p-5 transition-all hover:-translate-y-0.5 hover:border-neutral-600">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[10px] uppercase tracking-[.16em] font-black forge-secondary">{label}</div>
        <div className="text-3xl font-black text-white mt-2 tracking-tight">{value}</div>
      </div>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: accent ? 'var(--forge-accent-soft)' : 'var(--forge-surface-raised)', border: '1px solid var(--forge-border)' }}>
        <Icon className="w-5 h-5" style={{ color: accent ? 'var(--forge-accent)' : 'var(--forge-text-secondary)' }} />
      </div>
    </div>
    <div className="mt-4 text-xs forge-muted flex items-center justify-between gap-3">
      <span>{detail}</span>
      <ICONS.ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity forge-accent" />
    </div>
  </Link>
);

export const Dashboard: React.FC = () => {
  const { data } = useForgeStore();
  const openQuotes = data.quotes.filter(quote => ['sent', 'revised', 'draft'].includes(quote.status));
  const totalQuoted = data.quotes.reduce((sum, quote) => sum + Number(quote.totalValue || 0), 0);
  const totalPipeline = data.quotes.filter(quote => ['sent', 'revised'].includes(quote.status)).reduce((sum, quote) => sum + Number(quote.totalValue || 0), 0);
  const pendingDailyTasks = data.dailyTasks.filter(task => !task.completed);
  const activeProjects = data.projects.filter(project => project.status === 'on track' || project.status === 'at risk').length;
  const recentQuotes = [...data.quotes].sort((a, b) => String(b.dateCreated).localeCompare(String(a.dateCreated))).slice(0, 6);

  return (
    <div className="space-y-6 forge-enter">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[.22em] font-black forge-accent">Forge CRM</div>
          <h1 className="text-3xl font-black text-white tracking-tight mt-1">Sales & Operations</h1>
          <p className="forge-secondary text-sm mt-1">Current browser data remains intact while Forge Core becomes the shared system of record.</p>
        </div>
        <div className="forge-card px-4 py-3 text-xs forge-secondary flex items-center gap-3">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--forge-accent)' }} />
          Core migration branch active
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Contacts" value={data.customers.length} detail="Total in current CRM" icon={ICONS.Users} to="/crm" accent />
        <StatCard label="Open Quotes" value={openQuotes.length} detail="Draft / sent / revised" icon={ICONS.FileText} to="/quotes" />
        <StatCard label="Total Quoted" value={`$${Math.round(totalQuoted).toLocaleString()}`} detail="All quote history" icon={ICONS.FileText} to="/quotes" />
        <StatCard label="Pipeline" value={`$${Math.round(totalPipeline).toLocaleString()}`} detail="Active quoted value" icon={ICONS.Briefcase} to="/quotes" accent />
        <StatCard label="Open Tasks" value={pendingDailyTasks.length} detail={`${activeProjects} active projects`} icon={ICONS.CheckSquare} to="/checklist" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_.85fr] gap-5">
        <section className="forge-card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--forge-border-soft)' }}>
            <div>
              <h2 className="font-black text-white">Recent Quotes</h2>
              <p className="text-xs forge-muted mt-0.5">Newest quote activity in the current CRM dataset</p>
            </div>
            <Link to="/quotes" className="text-xs font-black forge-accent hover:underline">View all</Link>
          </div>
          <div>
            {recentQuotes.length === 0 ? (
              <div className="p-10 text-center forge-muted text-sm">No quote history yet.</div>
            ) : recentQuotes.map(quote => {
              const customer = data.customers.find(item => item.id === quote.customerId);
              const customerName = customer?.company || `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Unknown customer';
              return (
                <Link key={quote.id} to="/quotes" className="grid grid-cols-[1fr_auto] gap-5 px-5 py-4 border-b last:border-b-0 transition-colors hover:bg-white/[.025]" style={{ borderColor: 'var(--forge-border-soft)' }}>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white truncate">{customerName}</div>
                    <div className="text-xs forge-secondary truncate mt-0.5">{quote.quoteNumber} • {quote.scopeSummary || 'No project description'}</div>
                    <div className="text-[10px] forge-muted mt-1 uppercase tracking-wider">{quote.dateCreated} • {String(quote.status).toUpperCase()} • Rev {quote.version || 1}</div>
                  </div>
                  <div className="text-right self-center">
                    <div className="text-base font-black text-white">${Number(quote.totalValue || 0).toLocaleString()}</div>
                    <div className="text-[10px] forge-accent font-black uppercase tracking-wider mt-1">{quote.probability ?? 0}% probability</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="forge-card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--forge-border-soft)' }}>
            <div>
              <h2 className="font-black text-white">To-do List</h2>
              <p className="text-xs forge-muted mt-0.5">Items that need action</p>
            </div>
            <span className="text-[10px] font-black px-2 py-1 rounded-full" style={{ color: 'var(--forge-accent)', background: 'var(--forge-accent-soft)' }}>{pendingDailyTasks.length} OPEN</span>
          </div>
          <Link to="/checklist" className="block p-4 space-y-2">
            {pendingDailyTasks.length === 0 ? (
              <div className="text-center py-12">
                <ICONS.CheckCircle className="w-9 h-9 mx-auto mb-2" style={{ color: 'var(--forge-success)' }} />
                <p className="forge-secondary text-sm">All caught up.</p>
              </div>
            ) : pendingDailyTasks.slice(0, 7).map(task => (
              <div key={task.id} className="forge-card flex items-center gap-3 p-3 hover:bg-white/[.025] transition-colors">
                <div className={`w-1.5 h-7 rounded-full ${CATEGORY_COLORS[task.category] || 'bg-neutral-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{task.title}</div>
                  <div className="text-[10px] forge-muted uppercase tracking-wider mt-0.5">{task.category} • {task.dueDate}</div>
                </div>
              </div>
            ))}
            {pendingDailyTasks.length > 7 && <div className="text-center text-xs forge-muted pt-2">+ {pendingDailyTasks.length - 7} more</div>}
          </Link>
        </section>
      </div>
    </div>
  );
};
