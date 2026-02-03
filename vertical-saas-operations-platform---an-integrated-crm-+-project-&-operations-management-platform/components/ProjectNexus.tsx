
import React, { useState, useEffect } from 'react';
import { useForgeStore } from '../store';
import { ICONS } from '../constants';
import { Project, Phase, Task, DeliveryWindow, LoadType } from '../types';

export const ProjectNexus: React.FC = () => {
  const { data, updateTask, addTask, createDirectDelivery } = useForgeStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(data.projects[0]?.id || null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

  // Sync selection if data arrives late or is updated
  useEffect(() => {
    if (!selectedProjectId && data.projects.length > 0) {
      setSelectedProjectId(data.projects[0].id);
    }
  }, [data.projects]);

  const selectedProject = data.projects.find(p => p.id === selectedProjectId);
  const customer = selectedProject ? data.customers.find(c => c.id === selectedProject.customerId) : null;
  const quote = selectedProject ? data.quotes.find(q => q.id === selectedProject.quoteId) : null;

  const toggleTask = (phaseId: string, taskId: string, completed: boolean) => {
    if (!selectedProjectId) return;
    updateTask(selectedProjectId, phaseId, taskId, { completed });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on track': return <ICONS.CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'at risk': return <ICONS.AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'delayed': return <ICONS.AlertTriangle className="w-4 h-4 text-rose-500" />;
      default: return null;
    }
  };

  const calculateOverallProgress = (project: Project) => {
    const allTasks = project.phases.flatMap(p => p.tasks);
    if (allTasks.length === 0) {
      const currentIdx = project.phases.findIndex(p => p.name === project.currentPhase);
      return Math.round(((currentIdx + 0.5) / project.phases.length) * 100);
    }
    const completedTasks = allTasks.filter(t => t.completed).length;
    return Math.round((completedTasks / allTasks.length) * 100);
  };

  const handleCreateDelivery = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject) return;

    const fd = new FormData(e.currentTarget);
    createDirectDelivery({
      projectId: selectedProject.id,
      customerId: selectedProject.customerId,
      scheduledDate: fd.get('date') as string,
      scheduledWindow: fd.get('window') as DeliveryWindow,
      status: 'CONFIRMED',
      loadType: fd.get('loadType') as LoadType,
      dispatchNotes: fd.get('description') as string,
      yardNotes: '',
    });

    setIsDeliveryModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Project Selector Tabs */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-shrink-0">
        {data.projects.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProjectId(p.id)}
            className={`flex-shrink-0 px-6 py-4 rounded-2xl border transition-all text-left w-64 ${
              selectedProjectId === p.id 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-200' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${selectedProjectId === p.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {p.status}
              </span>
              {getStatusIcon(p.status)}
            </div>
            <h4 className="font-bold truncate text-sm leading-tight">{p.projectName}</h4>
            <div className="mt-3 w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${calculateOverallProgress(p)}%` }}></div>
            </div>
          </button>
        ))}
      </div>

      {selectedProject ? (
        <div className="flex flex-col gap-8 animate-slide-up">
          
          {/* Project Desktop Header */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 grid grid-cols-1 md:grid-cols-12 gap-8 z-10">
            <div className="md:col-span-5 space-y-4 border-r border-slate-50 pr-8">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Project Hub</span>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">{selectedProject.projectName}</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                    {customer?.firstName[0] || '?'}{customer?.lastName[0] || '?'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Client</span>
                    <span className="text-sm font-bold text-slate-800 leading-none">{customer?.firstName} {customer?.lastName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <ICONS.FileText className="w-5 h-5 text-slate-400" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">PO Reference</span>
                    <span className="text-sm font-bold text-slate-800 leading-none">{quote?.poNumber || 'PENDING'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Logistics Milestone Section */}
            <div className="md:col-span-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                <ICONS.Clock className="w-3 h-3" /> Logistics Milestones
              </span>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Truss</span>
                  <span className="text-xs font-black text-slate-900">{selectedProject.trussDeliveryDate || 'N/A'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Floor</span>
                  <span className="text-xs font-black text-slate-900">{selectedProject.floorSystemDeliveryDate || 'N/A'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Ship</span>
                  <span className="text-xs font-black text-indigo-600">{selectedProject.shipDate || 'N/A'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <ICONS.Calendar className="w-3 h-3 text-slate-300" />
                <span className="text-[10px] font-medium text-slate-500">Target Completion: <span className="font-bold text-slate-800">{selectedProject.targetCompletionDate}</span></span>
              </div>
            </div>

            {/* Production Progress Section */}
            <div className="md:col-span-3 bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-xl">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Build Status</span>
                {getStatusIcon(selectedProject.status)}
              </div>
              <div className="mt-4">
                <span className="text-2xl font-black">{calculateOverallProgress(selectedProject)}%</span>
                <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${calculateOverallProgress(selectedProject)}%` }}></div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 font-medium uppercase tracking-widest truncate">Phase: {selectedProject.currentPhase}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Project Timeline/Phases Sidebar */}
            <div className="lg:col-span-4 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 flex flex-col h-fit">
              <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2">
                <ICONS.Clock className="w-5 h-5 text-indigo-600" />
                Build Roadmap
              </h3>
              <div className="space-y-0 mb-8">
                {selectedProject.phases.map((phase, idx) => {
                  const currentPhaseIdx = selectedProject.phases.findIndex(p => p.name === selectedProject.currentPhase);
                  const isCurrent = selectedProject.currentPhase === phase.name;
                  const isCompleted = phase.completed || idx < currentPhaseIdx;
                  
                  return (
                    <div key={phase.id} className="relative pl-10 pb-10 last:pb-0">
                      {idx < selectedProject.phases.length - 1 && (
                        <div className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${isCompleted ? 'bg-emerald-500' : 'bg-slate-100'}`}></div>
                      )}
                      <div className={`absolute left-0 top-1.5 w-8 h-8 rounded-xl border-2 flex items-center justify-center bg-white z-10 transition-all ${
                        isCompleted ? 'border-emerald-500 bg-emerald-500' : 
                        isCurrent ? 'border-indigo-600 shadow-lg shadow-indigo-100 scale-110' : 
                        'border-slate-100'
                      }`}>
                        {isCompleted ? <ICONS.CheckCircle className="w-5 h-5 text-white" /> : 
                         isCurrent ? <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></div> : null}
                      </div>
                      <div className={`transition-opacity duration-300 ${isCurrent ? 'opacity-100' : 'opacity-60'}`}>
                        <h4 className={`text-base font-bold leading-none ${isCurrent ? 'text-indigo-600' : 'text-slate-800'}`}>{phase.name}</h4>
                        <p className="text-xs text-slate-400 mt-2 font-medium">{phase.startDate || 'TBD'} — {phase.targetEndDate || 'TBD'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* NEW: Create Delivery Button under Roadmap */}
              <button 
                onClick={() => setIsDeliveryModalOpen(true)}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-100 group"
              >
                <ICONS.Truck className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                Schedule Site Delivery
              </button>
            </div>

            {/* Active Phase Tasks */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Focus</span>
                    <h3 className="text-3xl font-black text-slate-900 leading-tight mt-1">{selectedProject.currentPhase}</h3>
                  </div>
                  <button 
                    onClick={() => {
                      const phase = selectedProject.phases.find(ph => ph.name === selectedProject.currentPhase);
                      if (phase) addTask(selectedProject.id, phase.id, { title: 'New Milestone', description: '', dueDate: new Date().toISOString().split('T')[0], priority: 'medium', completed: false });
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100"
                  >
                    <ICONS.Plus className="w-5 h-5" />
                    New Task
                  </button>
                </div>

                <div className="space-y-4">
                  {selectedProject.phases.find(ph => ph.name === selectedProject.currentPhase)?.tasks.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <ICONS.CheckSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-medium">No tasks generated for this stage yet.</p>
                    </div>
                  ) : (
                    selectedProject.phases.find(ph => ph.name === selectedProject.currentPhase)?.tasks.map(task => (
                      <div key={task.id} className="flex items-center gap-5 p-5 rounded-2xl border border-slate-50 bg-white hover:border-indigo-200 hover:shadow-md transition-all group">
                        <button 
                          onClick={() => toggleTask(task.phaseId, task.id, !task.completed)}
                          className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${
                            task.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 group-hover:border-indigo-400 bg-white'
                          }`}
                        >
                          {task.completed && <ICONS.CheckCircle className="w-5 h-5" />}
                        </button>
                        <div className="flex-1">
                          <h5 className={`font-bold text-base ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</h5>
                          {task.description && <p className="text-xs text-slate-500 mt-1 font-medium">{task.description}</p>}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                            task.priority === 'high' ? 'bg-rose-100 text-rose-700' :
                            task.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {task.priority}
                          </span>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <ICONS.Calendar className="w-4 h-4" />
                            <span className="text-xs font-bold whitespace-nowrap">{task.dueDate}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Project Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button className="p-6 bg-slate-900 text-white rounded-[1.5rem] font-bold hover:bg-black transition-all shadow-xl group flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <ICONS.FileText className="w-6 h-6 text-indigo-400" />
                    <span>Log Daily Build Note</span>
                  </div>
                  <ICONS.ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="p-6 bg-white border border-slate-200 text-slate-700 rounded-[1.5rem] font-bold hover:bg-slate-50 transition-all flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <ICONS.Briefcase className="w-6 h-6 text-slate-300" />
                    <span>Phase Configuration</span>
                  </div>
                  <ICONS.Plus className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          {/* New Delivery Creation Modal */}
          {isDeliveryModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
                  <div className="p-8 border-b border-slate-50 bg-slate-900 text-white">
                     <div className="flex items-center gap-3 mb-2">
                        <ICONS.Truck className="w-6 h-6 text-indigo-400" />
                        <h3 className="text-xl font-black">Fast Site Delivery</h3>
                     </div>
                     <p className="text-xs text-slate-400 font-medium">Bypass dispatch workflow. Schedules immediately.</p>
                  </div>
                  <form onSubmit={handleCreateDelivery} className="p-8 space-y-5">
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Project</span>
                        <p className="text-sm font-bold text-slate-800">{selectedProject.projectName}</p>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                           <input 
                              name="date" 
                              type="date" 
                              required 
                              defaultValue={new Date().toISOString().split('T')[0]}
                              className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
                           />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Window</label>
                           <select name="window" className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm font-bold outline-none">
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                              <option value="ANYTIME">ANYTIME</option>
                           </select>
                        </div>
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Load Type</label>
                        <select name="loadType" className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm font-bold outline-none">
                           <option value="BOOM">BOOM (Precision Lift)</option>
                           <option value="FLATBED">FLATBED (Drop & Go)</option>
                           <option value="PICKUP">PICKUP (Rush/Small)</option>
                           <option value="COURIER">COURIER (Documents/Hardware)</option>
                        </select>
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Description</label>
                        <textarea 
                           name="description" 
                           required
                           className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm h-24 outline-none resize-none focus:ring-2 focus:ring-indigo-500" 
                           placeholder="What is being shipped? Truss package #1? Windows for floor 2?" 
                        />
                     </div>

                     <div className="pt-4 flex flex-col gap-2">
                        <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                           Anchor to Master Schedule
                        </button>
                        <button type="button" onClick={() => setIsDeliveryModalOpen(false)} className="w-full text-slate-400 font-bold py-2">
                           Dismiss
                        </button>
                     </div>
                  </form>
               </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-20 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm animate-slide-up">
           <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
             <ICONS.Briefcase className="w-10 h-10 text-slate-200" />
           </div>
           <h3 className="text-2xl font-black text-slate-900">No Projects Found</h3>
           <p className="text-slate-500 max-w-sm mt-3 font-medium">Approved quotes with logistics dates automatically spawn a new project workspace here.</p>
           <button className="mt-8 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:scale-105 transition-all">Go to Quotes</button>
        </div>
      )}
    </div>
  );
};
