import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Customer, Quote, Project, Task, QuoteStatus, DailyTask,
  AppUser, DeliveryRequest, Delivery, RequestStatus, UserRole
} from './types';
import { DEFAULT_PHASE_NAMES } from './constants';
import { mergeQuoteBackfill } from './quoteBackfill';
import { getForgeCoreClient } from './forgeCore';
import {
  loadForgeCoreSnapshot,
  createCustomerInForgeCore,
  updateCustomerInForgeCore,
  createQuoteInForgeCore,
  updateQuoteInForgeCore,
  reviseQuoteInForgeCore,
  convertQuoteToProjectInForgeCore,
  createTaskInForgeCore,
  updateTaskInForgeCore,
  deleteTaskFromForgeCore
} from './forgeCoreData';

const STORAGE_KEY = 'forge_crm_data_v2';
const PRE_CORE_BACKUP_KEY = 'forge_crm_data_v2_pre_core_backup';

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

export interface CoreStoreState {
  mode: 'loading' | 'core' | 'local' | 'error';
  organizationName?: string;
  locationName?: string;
  lastLoadedAt?: string;
  counts?: { customers: number; quotes: number; revisions: number; projects: number; tasks: number };
  error?: string;
}

const LEGACY_USERS: AppUser[] = [
  { id: 'u1', name: 'Admin User', email: 'admin@forge.com', role: 'ADMIN', isActive: true },
  { id: 'u2', name: 'Sam Sales', email: 'sam@forge.com', role: 'SALES', isActive: true },
  { id: 'u3', name: 'Dave Dispatch', email: 'dave@forge.com', role: 'DISPATCH', isActive: true },
  { id: 'u4', name: 'Yanni Yard', email: 'yanni@forge.com', role: 'YARD', isActive: true }
];

const INITIAL_DATA: AppData = {
  customers: [],
  quotes: [],
  projects: [],
  dailyTasks: [],
  users: LEGACY_USERS,
  deliveryRequests: [],
  deliveries: [],
  currentUser: LEGACY_USERS[1]
};

const newId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function initialBrowserData(): AppData {
  const saved = localStorage.getItem(STORAGE_KEY);
  try {
    return mergeQuoteBackfill(saved ? JSON.parse(saved) : INITIAL_DATA) as AppData;
  } catch {
    return mergeQuoteBackfill(INITIAL_DATA) as AppData;
  }
}

function useForgeStoreState() {
  const [data, setData] = useState<AppData>(initialBrowserData);
  const [coreState, setCoreState] = useState<CoreStoreState>({ mode: 'loading' });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const refreshCore = useCallback(async () => {
    try {
      const snapshot = await loadForgeCoreSnapshot();
      if (!snapshot) {
        setCoreState({ mode: 'local' });
        return false;
      }

      const currentRaw = localStorage.getItem(STORAGE_KEY);
      if (currentRaw && !localStorage.getItem(PRE_CORE_BACKUP_KEY)) {
        localStorage.setItem(PRE_CORE_BACKUP_KEY, currentRaw);
      }

      setData(previous => ({
        ...previous,
        customers: snapshot.customers as Customer[],
        quotes: snapshot.quotes as Quote[],
        projects: snapshot.projects as Project[],
        dailyTasks: snapshot.dailyTasks as DailyTask[]
      }));
      setCoreState({
        mode: 'core',
        organizationName: snapshot.context.organizationName,
        locationName: snapshot.context.locationName,
        lastLoadedAt: new Date().toISOString(),
        counts: snapshot.counts
      });
      return true;
    } catch (error: any) {
      console.error('Forge Core direct read failed; retaining browser fallback.', error);
      setCoreState(previous => ({
        ...previous,
        mode: 'error',
        error: error?.message || 'Forge Core could not be loaded.'
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let refreshTimer: number | undefined;

    const safeRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { if (!disposed) void refreshCore(); }, 80);
    };

    void refreshCore();
    void getForgeCoreClient().then(client => {
      if (disposed) return;
      const auth = client.auth.onAuthStateChange(() => {
        window.setTimeout(safeRefresh, 0);
      });
      unsubscribe = () => auth?.data?.subscription?.unsubscribe?.();
    }).catch(error => console.warn('Forge Core auth listener unavailable', error));

    const onCoreChanged = () => safeRefresh();
    window.addEventListener('forge-core-changed', onCoreChanged);
    return () => {
      disposed = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      unsubscribe?.();
      window.removeEventListener('forge-core-changed', onCoreChanged);
    };
  }, [refreshCore]);

  const queueCoreWrite = useCallback((operation: Promise<any> | null | undefined) => {
    if (coreState.mode !== 'core' || !operation) return;
    void operation.catch((error: any) => {
      console.error('Forge Core write failed; optimistic browser state retained.', error);
      setCoreState(previous => ({ ...previous, mode: 'error', error: error?.message || 'A Forge Core write failed.' }));
    });
  }, [coreState.mode]);

  const switchUser = (role: UserRole) => {
    const user = data.users.find(user => user.role === role) || data.users[0];
    setData(previous => ({ ...previous, currentUser: user }));
  };

  const createDeliveryRequest = (request: Omit<DeliveryRequest, 'id' | 'createdAt' | 'status' | 'createdByUserId'>) => {
    const newRequest: DeliveryRequest = {
      ...request,
      id: newId(),
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      createdByUserId: data.currentUser.id
    };
    setData(previous => ({ ...previous, deliveryRequests: [...previous.deliveryRequests, newRequest] }));
    return newRequest;
  };

  const createDirectDelivery = (delivery: Omit<Delivery, 'id' | 'updatedAt' | 'createdByUserId' | 'stopSequence'>) => {
    const newDelivery: Delivery = {
      ...delivery,
      id: newId(),
      stopSequence: 1,
      createdByUserId: data.currentUser.id,
      updatedAt: new Date().toISOString()
    };
    setData(previous => ({ ...previous, deliveries: [...previous.deliveries, newDelivery] }));
    return newDelivery;
  };

  const processRequest = (requestId: string, action: 'APPROVE' | 'DECLINE', deliveryData?: Partial<Delivery>) => {
    setData(previous => {
      const requests: DeliveryRequest[] = previous.deliveryRequests.map(request =>
        request.id === requestId
          ? { ...request, status: (action === 'APPROVE' ? 'CONVERTED' : 'DECLINED') as RequestStatus }
          : request
      );
      const deliveries = [...previous.deliveries];
      if (action === 'APPROVE') {
        const request = previous.deliveryRequests.find(item => item.id === requestId);
        if (request) {
          deliveries.push({
            id: newId(),
            requestId: request.id,
            projectId: request.projectId,
            customerId: request.customerId,
            scheduledDate: deliveryData?.scheduledDate || request.requestedDate,
            scheduledWindow: deliveryData?.scheduledWindow || request.requestedWindow,
            status: 'CONFIRMED',
            loadType: deliveryData?.loadType || 'FLATBED',
            stopSequence: 1,
            dispatchNotes: deliveryData?.dispatchNotes || request.notes,
            yardNotes: '',
            createdByUserId: previous.currentUser.id,
            updatedAt: new Date().toISOString()
          });
        }
      }
      return { ...previous, deliveryRequests: requests, deliveries };
    });
  };

  const updateDelivery = (id: string, updates: Partial<Delivery>) => {
    setData(previous => ({
      ...previous,
      deliveries: previous.deliveries.map(delivery =>
        delivery.id === id ? { ...delivery, ...updates, updatedAt: new Date().toISOString() } : delivery
      )
    }));
  };

  const addCustomer = (customer: Omit<Customer, 'id' | 'activityLog'>) => {
    const newCustomer: Customer = { ...customer, id: newId(), activityLog: [] };
    setData(previous => ({ ...previous, customers: [...previous.customers, newCustomer] }));
    queueCoreWrite(createCustomerInForgeCore(newCustomer));
    return newCustomer;
  };

  const updateCustomer = (customer: Customer) => {
    setData(previous => ({ ...previous, customers: previous.customers.map(item => item.id === customer.id ? customer : item) }));
    queueCoreWrite(updateCustomerInForgeCore(customer));
  };

  const addQuote = (quote: any) => {
    const newQuote: Quote = {
      ...quote,
      id: newId(),
      quoteNumber: quote.quoteNumber || `Q-${Math.floor(Math.random() * 90000) + 10000}`,
      version: 1,
      dateCreated: quote.dateCreated || new Date().toISOString().split('T')[0]
    };
    setData(previous => ({ ...previous, quotes: [...previous.quotes, newQuote] }));
    queueCoreWrite(createQuoteInForgeCore(newQuote));
    return newQuote;
  };

  const updateQuote = (quote: Quote) => {
    setData(previous => ({ ...previous, quotes: previous.quotes.map(item => item.id === quote.id ? quote : item) }));
    queueCoreWrite(updateQuoteInForgeCore(quote));
  };

  const updateQuoteStatus = (quoteId: string, status: QuoteStatus, poNumber?: string) => {
    const current = data.quotes.find(quote => quote.id === quoteId);
    if (!current) return;
    const next = { ...current, status, poNumber: poNumber || current.poNumber };
    setData(previous => ({ ...previous, quotes: previous.quotes.map(quote => quote.id === quoteId ? next : quote) }));
    queueCoreWrite(updateQuoteInForgeCore(next));
  };

  const reviseQuote = (quoteId: string) => {
    setData(previous => ({
      ...previous,
      quotes: previous.quotes.map(quote => quote.id === quoteId ? { ...quote, status: 'revised', version: quote.version + 1 } : quote)
    }));
    queueCoreWrite(reviseQuoteInForgeCore(quoteId));
  };

  const convertQuoteToProject = (quoteId: string, logistics: any) => {
    const quote = data.quotes.find(item => item.id === quoteId);
    if (!quote) return;
    const customer = data.customers.find(item => item.id === quote.customerId);
    const projectId = newId();
    const projectName = `${customer?.lastName || customer?.company || 'Client'} - ${quote.scopeSummary.substring(0, 30)}`;
    const newProject: Project = {
      id: projectId,
      customerId: quote.customerId,
      quoteId: quote.id,
      projectName,
      startDate: new Date().toISOString().split('T')[0],
      targetCompletionDate: logistics.shipDate || '',
      currentPhase: DEFAULT_PHASE_NAMES[0],
      status: 'on track',
      trussDeliveryDate: logistics.trussDeliveryDate,
      floorSystemDeliveryDate: logistics.floorSystemDeliveryDate,
      shipDate: logistics.shipDate,
      phases: DEFAULT_PHASE_NAMES.map(name => ({
        id: newId(),
        projectId,
        name,
        startDate: '',
        targetEndDate: '',
        completed: false,
        tasks: []
      }))
    };
    setData(previous => ({
      ...previous,
      projects: [...previous.projects, newProject],
      quotes: previous.quotes.map(item => item.id === quoteId ? { ...item, status: 'approved' } : item),
      customers: previous.customers.map(item => item.id === quote.customerId ? { ...item, status: 'active' } : item)
    }));
    queueCoreWrite(convertQuoteToProjectInForgeCore(quoteId, projectId, projectName, logistics));
    return newProject;
  };

  const updateTask = (projectId: string, phaseId: string, taskId: string, updates: Partial<Task>) => {
    setData(previous => ({
      ...previous,
      projects: previous.projects.map(project => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          phases: project.phases.map(phase => {
            if (phase.id !== phaseId) return phase;
            return { ...phase, tasks: phase.tasks.map(task => task.id === taskId ? { ...task, ...updates } : task) };
          })
        };
      })
    }));
  };

  const addTask = (projectId: string, phaseId: string, task: Omit<Task, 'id' | 'phaseId'>) => {
    const newTask: Task = { ...task, id: newId(), phaseId };
    setData(previous => ({
      ...previous,
      projects: previous.projects.map(project => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          phases: project.phases.map(phase => phase.id === phaseId ? { ...phase, tasks: [...phase.tasks, newTask] } : phase)
        };
      })
    }));
  };

  const addDailyTask = (task: any) => {
    const newTask: DailyTask = { ...task, id: newId() };
    setData(previous => ({ ...previous, dailyTasks: [...previous.dailyTasks, newTask] }));
    queueCoreWrite(createTaskInForgeCore(newTask));
    return newTask;
  };

  const toggleDailyTask = (taskId: string) => {
    const current = data.dailyTasks.find(task => task.id === taskId);
    if (!current) return;
    const next = { ...current, completed: !current.completed };
    setData(previous => ({ ...previous, dailyTasks: previous.dailyTasks.map(task => task.id === taskId ? next : task) }));
    queueCoreWrite(updateTaskInForgeCore(next));
  };

  const deleteDailyTask = (taskId: string) => {
    setData(previous => ({ ...previous, dailyTasks: previous.dailyTasks.filter(task => task.id !== taskId) }));
    queueCoreWrite(deleteTaskFromForgeCore(taskId));
  };

  return useMemo(() => ({
    data,
    coreState,
    refreshCore,
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
  }), [data, coreState, refreshCore]);
}

const ForgeStoreContext = createContext<ReturnType<typeof useForgeStoreState> | null>(null);

export function ForgeStoreProvider({ children }: { children: React.ReactNode }) {
  const store = useForgeStoreState();
  return React.createElement(ForgeStoreContext.Provider, { value: store }, children);
}

export function useForgeStore() {
  const store = useContext(ForgeStoreContext);
  if (!store) throw new Error('useForgeStore must be used inside ForgeStoreProvider.');
  return store;
}
