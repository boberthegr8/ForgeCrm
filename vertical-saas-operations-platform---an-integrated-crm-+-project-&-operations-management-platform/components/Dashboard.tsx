
import React from 'react';
import { Link } from 'react-router-dom';
import { useForgeStore } from '../store';
import { ICONS, CATEGORY_COLORS } from '../constants';

const StatCard = ({ label, value, trend, icon: Icon, color, to }: { label: string, value: string | number, trend?: string, icon: any, color: string, to: string }) => (
  <Link 
    to={to} 
    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer block group"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} transition-transform group-hover:scale-110`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-sm font-medium text-slate-500">{label}</p>
    <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
    <div className="mt-4 flex items-center text-[10px] font-bold text-indigo-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
      View Details <ICONS.ChevronRight className="w-3 h-3 ml-1" />
    </div>
  </Link>
);

export const Dashboard: React.FC = () => {
  const { data } = useForgeStore();

  const totalPipeline = data.quotes
    .filter(q => ['sent', 'revised'].includes(q.status))
    .reduce((sum, q) => sum + q.totalValue, 0);

  const activeProjects = data.projects.filter(p => p.status === 'on track' || p.status === 'at risk').length;
  const overdueTasksCount = data.projects.reduce((sum, p) => {
    return sum + p.phases.reduce((pSum, ph) => {
      return pSum + ph.tasks.filter(t => !t.completed && new Date(t.dueDate) < new Date()).length;
    }, 0);
  }, 0);

  const pendingDailyTasks = data.dailyTasks.filter(t => !t.completed);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Sales Pipeline" 
          value={`$${(totalPipeline / 1000).toFixed(1)}k`} 
          trend="+12.5%" 
          icon={ICONS.FileText} 
          color="bg-indigo-600" 
          to="/quotes"
        />
        <StatCard 
          label="Active Projects" 
          value={activeProjects} 
          icon={ICONS.Briefcase} 
          color="bg-blue-600" 
          to="/projects"
        />
        <StatCard 
          label="To-do list" 
          value={pendingDailyTasks.length} 
          trend={pendingDailyTasks.length > 5 ? 'High' : 'Low'} 
          icon={ICONS.CheckSquare} 
          color="bg-emerald-600" 
          to="/checklist"
        />
        <StatCard 
          label="Critical Items" 
          value={overdueTasksCount} 
          trend="-2" 
          icon={ICONS.AlertTriangle} 
          color="bg-rose-600" 
          to="/projects"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Quotes */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Pipeline Pulse</h3>
            <Link to="/quotes" className="text-sm text-indigo-600 font-semibold hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {data.quotes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic">No active quotes in pipeline</div>
            ) : (
              data.quotes.slice(0, 5).map(q => {
                const customer = data.customers.find(c => c.id === q.customerId);
                return (
                  <Link 
                    to="/quotes" 
                    key={q.id} 
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{customer?.lastName || 'Unknown'} - {q.scopeSummary.substring(0, 30)}...</span>
                      <span className="text-xs text-slate-400">{q.dateCreated} • {q.status.toUpperCase()}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-indigo-600">${q.totalValue.toLocaleString()}</span>
                      <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${q.probability}%` }}></div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Daily Checklist Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Operational To-Do</h3>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{pendingDailyTasks.length} Pending</span>
          </div>
          <Link to="/checklist" className="block p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
            {pendingDailyTasks.length === 0 ? (
              <div className="text-center py-12">
                <ICONS.CheckCircle className="w-10 h-10 text-emerald-100 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">You're all caught up!</p>
              </div>
            ) : (
              pendingDailyTasks.slice(0, 6).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                  <div className={`w-1.5 h-6 rounded-full ${CATEGORY_COLORS[task.category] || 'bg-slate-300'}`}></div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{task.title}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black">{task.category}</p>
                  </div>
                </div>
              ))
            )}
            {pendingDailyTasks.length > 6 && (
              <p className="text-center text-xs text-slate-400 pt-2 font-bold">+ {pendingDailyTasks.length - 6} MORE TASKS</p>
            )}
            <div className="pt-2 text-center">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Open To-do list</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
