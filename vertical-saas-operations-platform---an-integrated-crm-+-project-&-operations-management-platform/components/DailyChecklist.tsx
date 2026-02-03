
import React, { useState, useRef, useEffect } from 'react';
import { useForgeStore } from '../store';
import { ICONS, ROLE_TODO_CATEGORIES, CATEGORY_COLORS } from '../constants';
import { TodoCategory, DailyTask } from '../types';

export const DailyChecklist: React.FC = () => {
  const { data, addDailyTask, toggleDailyTask, deleteDailyTask } = useForgeStore();
  
  // Role-based logic
  const userRole = data.currentUser.role;
  const roleCategories = ROLE_TODO_CATEGORIES[userRole] || ROLE_TODO_CATEGORIES['ADMIN'];

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TodoCategory>(roleCategories[0]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset selected category if user switches roles and current category is no longer valid
  useEffect(() => {
    if (!roleCategories.includes(selectedCategory)) {
      setSelectedCategory(roleCategories[0]);
    }
  }, [userRole, roleCategories]);

  const filteredTasks = data.dailyTasks.filter(t => {
    if (activeFilter === 'pending') return !t.completed;
    if (activeFilter === 'completed') return t.completed;
    return true;
  });

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    addDailyTask({
      title: newTaskTitle,
      category: selectedCategory,
      dueDate: new Date().toISOString().split('T')[0],
      completed: false,
      priority: 'medium'
    });
    setNewTaskTitle('');
    // Quick-focus back to input for rapid adding
    inputRef.current?.focus();
  };

  const getTasksByCategory = (category: string) => {
    return filteredTasks.filter(t => t.category === category);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Post to Master List</h3>
            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-tighter">Current Role: {userRole}</span>
        </div>
        <form onSubmit={handleAddTask} className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Action Description</label>
            <input 
              ref={inputRef}
              type="text" 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={`Quick add ${userRole.toLowerCase()} task...`}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-800"
            />
          </div>
          <div className="w-48 space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Workstream</label>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as TodoCategory)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-600 text-sm"
            >
              {roleCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button 
            type="submit"
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 text-sm uppercase tracking-wider"
          >
            <ICONS.Plus className="w-5 h-5" />
            Post
          </button>
        </form>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          {(['pending', 'completed', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                activeFilter === f ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'pending' ? `Pending (${data.dailyTasks.filter(t => !t.completed).length})` : f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {roleCategories.map(cat => {
          const catTasks = getTasksByCategory(cat);
          if (catTasks.length === 0 && activeFilter !== 'all') return null;

          return (
            <div key={cat} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-fit">
              <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-slate-200 ${CATEGORY_COLORS[cat] || 'bg-slate-900'}`}>
                    <span className="text-white text-[10px] font-black uppercase">{cat[0]}</span>
                  </div>
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{cat}</h3>
                </div>
                <span className="text-[10px] font-black text-slate-400 px-3 py-1 bg-white border border-slate-100 rounded-full">
                  {catTasks.length}
                </span>
              </div>
              <div className="p-3 flex-1">
                {catTasks.length === 0 ? (
                  <div className="py-12 text-center text-slate-300 text-xs font-bold uppercase tracking-widest opacity-50 italic">
                    Focus area clear
                  </div>
                ) : (
                  <div className="space-y-2">
                    {catTasks.map(task => (
                      <div 
                        key={task.id} 
                        className={`group flex items-center gap-4 p-4 rounded-2xl transition-all border border-transparent ${
                          task.completed ? 'opacity-40 grayscale bg-slate-50' : 'hover:bg-slate-50 hover:border-slate-100 cursor-pointer'
                        }`}
                        onClick={() => !task.completed && toggleDailyTask(task.id)}
                      >
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDailyTask(task.id);
                          }}
                          className={`flex-shrink-0 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                            task.completed 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : 'border-slate-200 group-hover:border-indigo-500 group-hover:scale-110 bg-white'
                          }`}
                        >
                          {task.completed ? <ICONS.CheckCircle className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-slate-100 group-hover:bg-indigo-500" />}
                        </button>
                        <div className="flex-1">
                          <span className={`text-sm font-bold block ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {task.title}
                          </span>
                          {!task.completed && (
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">Click to resolve</span>
                          )}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDailyTask(task.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all hover:scale-125"
                        >
                          <ICONS.Archive className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
