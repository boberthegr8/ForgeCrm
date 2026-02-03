
import { useState, useEffect } from 'react';
import { 
  Customer, Quote, Project, Phase, Task, QuoteStatus, DailyTask, TodoCategory,
  AppUser, DeliveryRequest, Delivery, DeliveryStatus, RequestStatus, UserRole, DeliveryWindow, LoadType
} from './types';
import { DEFAULT_PHASE_NAMES } from './constants';

const STORAGE_KEY = 'forge_crm_data_v2';

interface AppData {
  customers: Customer[];
  quotes: Quote[];
  projects: Project[];
  dailyTasks: DailyTask[];
  users: AppUser[];
  deliveryRequests: DeliveryRequest[];
  deliveries: Delivery[];
  currentUser: AppUser;
}

const INITIAL_DATA: AppData = {
  customers: [
    {
      id: 'c1',
      firstName: 'Michael',
      lastName: 'Scott',
      company: 'Dunder Mifflin',
      emails: ['m.scott@dundermifflin.com'],
      phones: ['570-555-0123'],
      address: '1725 Slough Avenue, Scranton, PA',
      lastContactDate: '2024-05-15',
      lastContactNotes: 'Discussed paper pallets for the new warehouse.',
      childrenNames: [],
      spouseName: 'Holly Scott',
      importantDates: [{ label: 'Anniversary', date: '2011-03-24' }],
      tags: ['Corporate', 'Active'],
      status: 'active',
      notes: 'Loves Dundies. Prefers AM deliveries.',
      activityLog: [{ id: 'a1', date: '2024-05-15', type: 'call', content: 'Followed up on quote.' }]
    },
    {
      id: 'c2',
      firstName: 'Bob',
      lastName: 'Vance',
      company: 'Vance Refrigeration',
      emails: ['bob@vancerefrigeration.com'],
      phones: ['570-555-9999'],
      address: 'Suite 200, Scranton Business Park',
      lastContactDate: '2024-05-18',
      lastContactNotes: 'Inquiry for custom shelving.',
      childrenNames: [],
      spouseName: 'Phyllis Vance',
      importantDates: [],
      tags: ['Industrial'],
      status: 'quoted',
      notes: 'High volume client.',
      activityLog: []
    }
  ],
  quotes: [
    {
      id: 'q1',
      quoteNumber: 'Q-98210',
      customerId: 'c1',
      version: 1,
      dateCreated: '2024-05-10',
      scopeSummary: 'Custom Truss System - Phase 1',
      lineItems: [],
      totalValue: 24500,
      margin: 18,
      probability: 90,
      status: 'approved',
      poNumber: 'PO-SCOTT-01'
    }
  ],
  projects: [
    {
      id: 'p1',
      customerId: 'c1',
      quoteId: 'q1',
      projectName: 'Scott - Custom Truss System',
      startDate: '2024-05-20',
      targetCompletionDate: '2024-07-15',
      currentPhase: 'Intake',
      status: 'on track',
      trussDeliveryDate: '2024-06-10',
      floorSystemDeliveryDate: '2024-06-05',
      shipDate: '2024-07-10',
      phases: DEFAULT_PHASE_NAMES.map((name, i) => ({
        id: `ph-${i}`,
        projectId: 'p1',
        name,
        startDate: '2024-05-20',
        targetEndDate: '2024-07-15',
        completed: i === 0,
        tasks: i === 0 ? [
          { id: 't1', phaseId: 'ph-0', title: 'Verify site measurements', description: 'Ensure the pad is ready for trusses.', dueDate: '2024-05-22', priority: 'high', completed: true },
          { id: 't2', phaseId: 'ph-0', title: 'Collect initial deposit', description: '50% required before production.', dueDate: '2024-05-25', priority: 'medium', completed: false }
        ] : []
      }))
    }
  ],
  dailyTasks: [
    { id: 'd1', title: 'Call Lumber yard re: order #44', category: 'Call', dueDate: '2024-05-21', completed: false, priority: 'high' },
    { id: 'd2', title: 'Email back Bob Vance', category: 'Email', dueDate: '2024-05-21', completed: false, priority: 'medium' }
  ],
  users: [
    { id: 'u1', name: 'Admin User', email: 'admin@forge.com', role: 'ADMIN', isActive: true },
    { id: 'u2', name: 'Sam Sales', email: 'sam@forge.com', role: 'SALES', isActive: true },
    { id: 'u3', name: 'Dave Dispatch', email: 'dave@forge.com', role: 'DISPATCH', isActive: true },
    { id: 'u4', name: 'Yanni Yard', email: 'yanni@forge.com', role: 'YARD', isActive: true },
  ],
  deliveryRequests: [
    {
      id: 'req1',
      projectId: 'p1',
      customerId: 'c1',
      requestedDate: '2024-06-01',
      requestedWindow: 'AM',
      notes: 'Gate code is 1234. Leave near the orange cones.',
      createdByUserId: 'u2',
      createdAt: '2024-05-20T10:00:00Z',
      status: 'PENDING'
    }
  ],
  deliveries: [
    {
      id: 'del1',
      projectId: 'p1',
      customerId: 'c1',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledWindow: 'AM',
      status: 'CONFIRMED',
      loadType: 'BOOM',
      truck: 'UNIT-404',
      driver: 'Bill',
      stopSequence: 1,
      dispatchNotes: 'Check tires before leaving.',
      yardNotes: '',
      createdByUserId: 'u3',
      updatedAt: new Date().toISOString()
    }
  ],
  currentUser: { id: 'u2', name: 'Sam Sales', email: 'sam@forge.com', role: 'SALES', isActive: true }
};

export function useForgeStore() {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const switchUser = (role: UserRole) => {
    const user = data.users.find(u => u.role === role) || data.users[0];
    setData(prev => ({ ...prev, currentUser: user }));
  };

  const createDeliveryRequest = (request: Omit<DeliveryRequest, 'id' | 'createdAt' | 'status' | 'createdByUserId'>) => {
    const newRequest: DeliveryRequest = {
      ...request,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      createdByUserId: data.currentUser.id
    };
    setData(prev => ({ ...prev, deliveryRequests: [...prev.deliveryRequests, newRequest] }));
    return newRequest;
  };

  const createDirectDelivery = (delivery: Omit<Delivery, 'id' | 'updatedAt' | 'createdByUserId' | 'stopSequence'>) => {
    const newDelivery: Delivery = {
      ...delivery,
      id: Math.random().toString(36).substr(2, 9),
      stopSequence: 1,
      createdByUserId: data.currentUser.id,
      updatedAt: new Date().toISOString()
    };
    setData(prev => ({ ...prev, deliveries: [...prev.deliveries, newDelivery] }));
    return newDelivery;
  };

  const processRequest = (requestId: string, action: 'APPROVE' | 'DECLINE', deliveryData?: Partial<Delivery>) => {
    setData(prev => {
      const requests: DeliveryRequest[] = prev.deliveryRequests.map(r => 
        r.id === requestId ? { ...r, status: (action === 'APPROVE' ? 'CONVERTED' : 'DECLINED') as RequestStatus } : r
      );
      
      const deliveries = [...prev.deliveries];
      if (action === 'APPROVE') {
        const req = prev.deliveryRequests.find(r => r.id === requestId);
        if (req) {
          deliveries.push({
            id: Math.random().toString(36).substr(2, 9),
            requestId: req.id,
            projectId: req.projectId,
            customerId: req.customerId,
            scheduledDate: deliveryData?.scheduledDate || req.requestedDate,
            scheduledWindow: deliveryData?.scheduledWindow || req.requestedWindow,
            status: 'CONFIRMED',
            loadType: deliveryData?.loadType || 'FLATBED',
            stopSequence: 1,
            dispatchNotes: deliveryData?.dispatchNotes || req.notes,
            yardNotes: '',
            createdByUserId: prev.currentUser.id,
            updatedAt: new Date().toISOString()
          });
        }
      }
      return { ...prev, deliveryRequests: requests, deliveries };
    });
  };

  const updateDelivery = (id: string, updates: Partial<Delivery>) => {
    setData(prev => ({
      ...prev,
      deliveries: prev.deliveries.map(d => 
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
      )
    }));
  };

  const addCustomer = (customer: Omit<Customer, 'id' | 'activityLog'>) => {
    const newCustomer: Customer = { ...customer, id: Math.random().toString(36).substr(2, 9), activityLog: [] };
    setData(prev => ({ ...prev, customers: [...prev.customers, newCustomer] }));
    return newCustomer;
  };

  const updateCustomer = (customer: Customer) => {
    setData(prev => ({ ...prev, customers: prev.customers.map(c => c.id === customer.id ? customer : c) }));
  };

  const addQuote = (quote: any) => {
    const newQuote: Quote = { ...quote, id: Math.random().toString(36).substr(2, 9), quoteNumber: `Q-${Math.floor(Math.random() * 90000) + 10000}`, version: 1, dateCreated: new Date().toISOString().split('T')[0] };
    setData(prev => ({ ...prev, quotes: [...prev.quotes, newQuote] }));
    return newQuote;
  };

  const updateQuote = (quote: Quote) => {
    setData(prev => ({ ...prev, quotes: prev.quotes.map(q => q.id === quote.id ? quote : q) }));
  };

  const updateQuoteStatus = (quoteId: string, status: QuoteStatus, poNumber?: string) => {
    setData(prev => ({ ...prev, quotes: prev.quotes.map(q => q.id === quoteId ? { ...q, status, poNumber: poNumber || q.poNumber } : q) }));
  };

  const reviseQuote = (quoteId: string) => {
    setData(prev => ({
      ...prev,
      quotes: prev.quotes.map(q => q.id === quoteId ? { ...q, status: 'revised', version: q.version + 1 } : q)
    }));
  };

  const convertQuoteToProject = (quoteId: string, logistics: any) => {
    const quote = data.quotes.find(q => q.id === quoteId);
    if (!quote) return;
    const customer = data.customers.find(c => c.id === quote.customerId);
    const projectId = Math.random().toString(36).substr(2, 9);
    const newProject: Project = {
      id: projectId,
      customerId: quote.customerId,
      quoteId: quote.id,
      projectName: `${customer?.lastName || 'Client'} - ${quote.scopeSummary.substring(0, 30)}`,
      startDate: new Date().toISOString().split('T')[0],
      targetCompletionDate: logistics.shipDate || '',
      currentPhase: DEFAULT_PHASE_NAMES[0],
      status: 'on track',
      trussDeliveryDate: logistics.trussDeliveryDate,
      floorSystemDeliveryDate: logistics.floorSystemDeliveryDate,
      shipDate: logistics.shipDate,
      phases: DEFAULT_PHASE_NAMES.map((name, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        projectId,
        name,
        startDate: '',
        targetEndDate: '',
        completed: false,
        tasks: []
      }))
    };
    setData(prev => ({ ...prev, projects: [...prev.projects, newProject], customers: prev.customers.map(c => c.id === quote.customerId ? { ...c, status: 'active' } : c) }));
  };

  const updateTask = (projectId: string, phaseId: string, taskId: string, updates: Partial<Task>) => {
    setData(prev => ({
      ...prev,
      projects: prev.projects.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          phases: p.phases.map(ph => {
            if (ph.id !== phaseId) return ph;
            return { ...ph, tasks: ph.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) };
          })
        };
      })
    }));
  };

  const addTask = (projectId: string, phaseId: string, task: Omit<Task, 'id' | 'phaseId'>) => {
    const newTask: Task = { ...task, id: Math.random().toString(36).substr(2, 9), phaseId };
    setData(prev => ({
      ...prev,
      projects: prev.projects.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          phases: p.phases.map(ph => {
            if (ph.id !== phaseId) return ph;
            return { ...ph, tasks: [...ph.tasks, newTask] };
          })
        };
      })
    }));
  };

  const addDailyTask = (task: any) => {
    setData(prev => ({ ...prev, dailyTasks: [...prev.dailyTasks, { ...task, id: Math.random().toString(36).substr(2, 9) }] }));
  };

  const toggleDailyTask = (taskId: string) => {
    setData(prev => ({ ...prev, dailyTasks: prev.dailyTasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t) }));
  };

  const deleteDailyTask = (taskId: string) => {
    setData(prev => ({ ...prev, dailyTasks: prev.dailyTasks.filter(t => t.id !== taskId) }));
  };

  return {
    data,
    switchUser,
    createDeliveryRequest,
    createDirectDelivery,
    processRequest,
    updateDelivery,
    addCustomer,
    updateCustomer,
    addQuote,
    updateQuote,
    updateQuoteStatus,
    reviseQuote,
    convertQuoteToProject,
    updateTask,
    addTask,
    addDailyTask,
    toggleDailyTask,
    deleteDailyTask
  };
}
