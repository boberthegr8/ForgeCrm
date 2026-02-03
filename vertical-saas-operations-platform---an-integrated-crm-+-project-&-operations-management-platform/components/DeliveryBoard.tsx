
import React, { useState, useMemo } from 'react';
import { useForgeStore } from '../store';
import { ICONS, LOAD_TYPE_COLORS } from '../constants';
import { Delivery, DeliveryRequest, DeliveryStatus, LoadType, DeliveryWindow, Project } from '../types';

type BoardView = 'MONTH' | 'WEEK' | 'DAY' | 'REQUESTS';

export const DeliveryBoard: React.FC = () => {
  const { data, createDeliveryRequest, processRequest, updateDelivery } = useForgeStore();
  const [view, setView] = useState<BoardView>('DAY');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const user = data.currentUser;
  const isDispatch = user.role === 'DISPATCH' || user.role === 'ADMIN';
  const isYard = user.role === 'YARD' || user.role === 'ADMIN';

  // Derived Data
  const pendingRequests = data.deliveryRequests.filter(r => r.status === 'PENDING');
  
  const getDeliveriesForDate = (date: string) => {
    return data.deliveries
      .filter(d => d.scheduledDate === date)
      .sort((a, b) => (a.scheduledWindow.localeCompare(b.scheduledWindow) || a.stopSequence - b.stopSequence));
  };

  const currentDayDeliveries = useMemo(() => getDeliveriesForDate(selectedDate), [data.deliveries, selectedDate]);

  // Week View Logic
  const weekDays = useMemo(() => {
    const current = new Date(selectedDate);
    const startOfWeek = new Date(current.setDate(current.getDate() - current.getDay() + 1)); // Monday
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [selectedDate]);

  // Month View Logic (Simple Heatmap)
  const monthDays = useMemo(() => {
    const current = new Date(selectedDate);
    const startOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }).map((_, i) => {
      const d = new Date(startOfMonth);
      d.setDate(startOfMonth.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [selectedDate]);

  const handleApprove = (req: DeliveryRequest) => {
    processRequest(req.id, 'APPROVE', { scheduledDate: req.requestedDate, scheduledWindow: req.requestedWindow });
  };

  const handleUpdateStatus = (delId: string, status: DeliveryStatus) => {
    updateDelivery(delId, { status });
  };

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['REQUESTS', 'DAY', 'WEEK', 'MONTH'] as BoardView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                view === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v === 'REQUESTS' ? `Inbox (${pendingRequests.length})` : v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {view !== 'REQUESTS' && (
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 md:w-48 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          )}
          {user.role === 'SALES' || user.role === 'ADMIN' ? (
            <button 
              onClick={() => setIsRequestModalOpen(true)}
              className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg shadow-indigo-100 whitespace-nowrap"
            >
              <ICONS.Plus className="w-4 h-4" />
              New Request
            </button>
          ) : null}
        </div>
      </div>

      {/* Content Area */}
      <div className="animate-slide-up">
        {view === 'REQUESTS' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">Pending Logistics Inbox</h3>
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-indigo-50">Sales Pipeline</span>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                     <tr>
                        <th className="px-6 py-4">Job / Site</th>
                        <th className="px-6 py-4">Requested Date</th>
                        <th className="px-6 py-4">Notes</th>
                        <th className="px-6 py-4 text-right">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {pendingRequests.length === 0 ? (
                        <tr><td colSpan={4} className="p-20 text-center text-slate-400 italic">No pending requests for review.</td></tr>
                     ) : (
                        pendingRequests.map(req => {
                           const project = data.projects.find(p => p.id === req.projectId);
                           return (
                              <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-6 py-4">
                                    <span className="font-bold text-slate-900 block">{project?.projectName || 'Deleted Project'}</span>
                                    <span className="text-xs text-slate-400 font-medium">{req.requestedWindow} Window</span>
                                 </td>
                                 <td className="px-6 py-4">
                                    <span className="text-sm font-black text-slate-700">{req.requestedDate}</span>
                                 </td>
                                 <td className="px-6 py-4">
                                    <p className="text-xs text-slate-500 max-w-sm truncate">{req.notes}</p>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    {isDispatch ? (
                                      <div className="flex gap-2 justify-end">
                                        <button onClick={() => handleApprove(req)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700">Dispatch</button>
                                        <button onClick={() => processRequest(req.id, 'DECLINE')} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-200">Decline</button>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-300 italic">Awaiting Manager</span>
                                    )}
                                 </td>
                              </tr>
                           );
                        })
                     )}
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {view === 'DAY' && (
          <div className="space-y-4">
             {currentDayDeliveries.length === 0 ? (
                <div className="bg-white rounded-3xl p-24 text-center border border-slate-100">
                   <ICONS.Truck className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                   <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest">No Deliveries Today</h3>
                </div>
             ) : (
                currentDayDeliveries.map(del => {
                   const project = data.projects.find(p => p.id === del.projectId);
                   return (
                      <div key={del.id} className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-wrap md:flex-nowrap items-center gap-6 shadow-sm hover:shadow-md transition-all">
                         <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-black">{del.stopSequence}</div>
                         <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-2">
                               <h4 className="font-bold text-slate-900">{project?.projectName}</h4>
                               <span className={`text-[9px] font-black text-white px-2 py-0.5 rounded ${LOAD_TYPE_COLORS[del.loadType]}`}>{del.loadType}</span>
                            </div>
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">{del.scheduledWindow} Window</span>
                         </div>
                         <div className="w-48">
                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Status</label>
                            <select 
                               disabled={!isYard && !isDispatch}
                               value={del.status}
                               onChange={(e) => handleUpdateStatus(del.id, e.target.value as DeliveryStatus)}
                               className="w-full bg-slate-50 border-none rounded-lg text-xs font-bold p-2 outline-none"
                            >
                               {['CONFIRMED', 'PICKED', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                         </div>
                         <div className="flex items-center gap-4 border-l border-slate-100 pl-6">
                            <div className="text-right">
                               <p className="text-xs font-bold text-slate-800">{del.truck || 'No Truck'}</p>
                               <p className="text-[10px] text-slate-400 uppercase font-bold">{del.driver || 'No Driver'}</p>
                            </div>
                            <button onClick={() => setEditingDelivery(del)} className="p-2 text-slate-300 hover:text-indigo-600"><ICONS.Search className="w-5 h-5" /></button>
                         </div>
                      </div>
                   );
                })
             )}
          </div>
        )}

        {view === 'WEEK' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
             {weekDays.map(day => {
                const dayDels = getDeliveriesForDate(day);
                const isSelected = day === selectedDate;
                return (
                  <div key={day} className={`flex-shrink-0 w-72 bg-white rounded-3xl border ${isSelected ? 'border-indigo-500 shadow-xl' : 'border-slate-100'} p-5 flex flex-col gap-4 min-h-[500px]`}>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(day).toLocaleDateString(undefined, { weekday: 'long' })}</span>
                        <span className="text-lg font-black text-slate-900">{new Date(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-md">{dayDels.length} Items</span>
                    </div>
                    <div className="space-y-3">
                      {dayDels.length === 0 ? (
                        <p className="text-center text-slate-300 text-xs py-10 italic">Empty Schedule</p>
                      ) : (
                        dayDels.map(d => (
                          <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 relative group cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setEditingDelivery(d)}>
                             <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${LOAD_TYPE_COLORS[d.loadType]}`}></div>
                             <p className="text-xs font-black text-slate-800 truncate mb-1">{data.projects.find(p => p.id === d.projectId)?.projectName}</p>
                             <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-slate-400">{d.scheduledWindow}</span>
                                <span className="text-[9px] font-black text-slate-600 uppercase">{d.status}</span>
                             </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
             })}
          </div>
        )}

        {view === 'MONTH' && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 grid grid-cols-7 gap-4">
             {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(h => <div key={h} className="text-center text-[10px] font-black text-slate-400 tracking-[0.2em] mb-4">{h}</div>)}
             {monthDays.map(day => {
                const dayDels = getDeliveriesForDate(day);
                return (
                   <div 
                      key={day} 
                      onClick={() => { setSelectedDate(day); setView('DAY'); }}
                      className={`aspect-square rounded-2xl border border-slate-50 p-3 flex flex-col gap-1 cursor-pointer transition-all hover:border-indigo-300 hover:shadow-md ${day === selectedDate ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50/50'}`}
                    >
                      <span className="text-xs font-black text-slate-400">{new Date(day).getDate()}</span>
                      <div className="flex flex-wrap gap-1 mt-auto">
                         {dayDels.slice(0, 3).map(d => (
                            <div key={d.id} className={`w-2 h-2 rounded-full ${LOAD_TYPE_COLORS[d.loadType]}`}></div>
                         ))}
                         {dayDels.length > 3 && <span className="text-[8px] font-black text-slate-400">+{dayDels.length - 3}</span>}
                      </div>
                   </div>
                );
             })}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {editingDelivery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
           <div className="bg-white h-full w-full max-w-md shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                 <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Dispatch File</h3>
                    <p className="text-xs text-slate-500 font-medium">Logistics manifest details</p>
                 </div>
                 <button onClick={() => setEditingDelivery(null)} className="text-slate-400 hover:text-slate-600"><ICONS.Archive className="w-6 h-6 rotate-45" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Truck Assignment</label>
                    <div className="grid grid-cols-2 gap-4">
                       <input 
                          readOnly={!isDispatch}
                          placeholder="Truck #"
                          value={editingDelivery.truck || ''}
                          onChange={(e) => updateDelivery(editingDelivery.id, { truck: e.target.value })}
                          className="bg-slate-50 p-4 rounded-2xl border-none font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                       />
                       <input 
                          readOnly={!isDispatch}
                          placeholder="Driver Name"
                          value={editingDelivery.driver || ''}
                          onChange={(e) => updateDelivery(editingDelivery.id, { driver: e.target.value })}
                          className="bg-slate-50 p-4 rounded-2xl border-none font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                       />
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Protocol</label>
                    <textarea 
                       readOnly={!isDispatch}
                       value={editingDelivery.dispatchNotes}
                       onChange={(e) => updateDelivery(editingDelivery.id, { dispatchNotes: e.target.value })}
                       className="w-full bg-slate-50 p-5 rounded-2xl border-none text-sm h-32 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                       placeholder="Instructions for the road..."
                    />
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Yard / Load Notes</label>
                    <textarea 
                       readOnly={!isYard}
                       value={editingDelivery.yardNotes}
                       onChange={(e) => updateDelivery(editingDelivery.id, { yardNotes: e.target.value })}
                       className="w-full bg-indigo-50/50 p-5 rounded-2xl border-none text-sm h-32 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                       placeholder="Placement on trailer, bundled with..."
                    />
                 </div>
              </div>
              <div className="p-8 border-t border-slate-100 flex flex-col gap-2">
                 <button onClick={() => setEditingDelivery(null)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl">Complete Review</button>
              </div>
           </div>
        </div>
      )}

      {/* Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
              <div className="p-8 border-b border-slate-50 bg-indigo-600 text-white">
                 <h3 className="text-xl font-black">Post Delivery Request</h3>
                 <p className="text-xs text-indigo-100 font-medium">Notify Dispatch of upcoming logistics needs</p>
              </div>
              <form 
                 onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createDeliveryRequest({
                       projectId: fd.get('projectId') as string,
                       customerId: data.projects.find(p => p.id === fd.get('projectId'))?.customerId || '',
                       requestedDate: fd.get('date') as string,
                       requestedWindow: fd.get('window') as DeliveryWindow,
                       notes: fd.get('notes') as string
                    });
                    setIsRequestModalOpen(false);
                 }}
                 className="p-8 space-y-5"
              >
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project</label>
                    <select name="projectId" required className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm font-bold outline-none">
                       {data.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                       <input name="date" type="date" required className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm outline-none" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Window</label>
                       <select name="window" className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm outline-none">
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                          <option value="ANYTIME">ANYTIME</option>
                       </select>
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logistics Notes</label>
                    <textarea name="notes" className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm h-24 outline-none resize-none" placeholder="Site contact, difficult entry, crane needed?" />
                 </div>
                 <div className="pt-4 flex flex-col gap-2">
                    <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Submit to Dispatch</button>
                    <button type="button" onClick={() => setIsRequestModalOpen(false)} className="w-full text-slate-400 font-bold py-2">Close</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};
