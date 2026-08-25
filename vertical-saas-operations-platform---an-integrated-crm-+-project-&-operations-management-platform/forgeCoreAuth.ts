import { DEFAULT_PHASE_NAMES } from './constants';
import { getForgeCoreClient, getForgeCoreContext } from './forgeCore';

const CRM_STORAGE_KEY = 'forge_crm_data_v2';
const CRM_BACKUP_KEY = 'forge_crm_data_v2_pre_core_backup';

const text = (value: any) => String(value ?? '').trim();
const addressText = (address: any) => typeof address === 'string' ? address : text(address?.formatted || address?.street || address?.address);

export async function sendForgeCoreMagicLink(email: string) {
  const cleanEmail = email.trim();
  if (!cleanEmail) throw new Error('Enter your Forge email address.');
  const client = await getForgeCoreClient();
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { data, error } = await client.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo
    }
  });
  if (error) throw error;
  return data;
}

function mapQuoteStatus(status: string) {
  const value = text(status).toLowerCase();
  if (value === 'approved' || value === 'accepted') return 'approved';
  if (value === 'rejected' || value === 'expired') return 'rejected';
  if (value === 'draft') return 'draft';
  if (value === 'revised') return 'revised';
  return 'sent';
}

function probabilityForStatus(status: string) {
  switch (mapQuoteStatus(status)) {
    case 'approved': return 100;
    case 'draft': return 30;
    case 'rejected': return 0;
    case 'revised': return 70;
    default: return 60;
  }
}

function taskCategory(title: string) {
  if (/call/i.test(title)) return 'Call';
  if (/email|send/i.test(title)) return 'Email';
  if (/quote/i.test(title)) return 'Quote';
  if (/take.?off/i.test(title)) return 'Take off';
  if (/design/i.test(title)) return 'Design';
  if (/dispatch/i.test(title)) return 'Dispatching';
  if (/schedule/i.test(title)) return 'Scheduling';
  return 'General';
}

export async function getForgeCoreRecordCounts() {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) return null;
  const client = await getForgeCoreClient();
  const tables = ['customers', 'quotes', 'projects', 'tasks'] as const;
  const entries = await Promise.all(tables.map(async table => {
    const { count, error } = await client.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', context.organizationId);
    if (error) throw error;
    return [table, count || 0] as const;
  }));
  return Object.fromEntries(entries) as Record<(typeof tables)[number], number>;
}

export async function syncForgeCoreToBrowser() {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) throw new Error('Connect to Forge Core before syncing.');
  const client = await getForgeCoreClient();

  const [customerResult, quoteResult, projectResult, taskResult] = await Promise.all([
    client.from('customers').select('*').eq('organization_id', context.organizationId).order('display_name'),
    client.from('quotes').select('*').eq('organization_id', context.organizationId).order('quote_date', { ascending: false }),
    client.from('projects').select('*').eq('organization_id', context.organizationId).order('created_at', { ascending: false }),
    client.from('tasks').select('*').eq('organization_id', context.organizationId).order('created_at', { ascending: false })
  ]);
  for (const result of [customerResult, quoteResult, projectResult, taskResult]) if (result.error) throw result.error;

  const coreCustomers = customerResult.data || [];
  const coreQuotes = quoteResult.data || [];
  const coreProjects = projectResult.data || [];
  const coreTasks = taskResult.data || [];
  const projectsById = new Map(coreProjects.map((project: any) => [project.id, project]));
  const quoteByProject = new Map(coreQuotes.filter((quote: any) => quote.project_id).map((quote: any) => [quote.project_id, quote]));
  const projectCustomerIds = new Set(coreProjects.map((project: any) => project.customer_id).filter(Boolean));
  const quotedCustomerIds = new Set(coreQuotes.map((quote: any) => quote.customer_id).filter(Boolean));

  const customers = coreCustomers.map((customer: any) => {
    const metadata = customer.metadata || {};
    const displayName = text(customer.display_name);
    const firstName = text(metadata.first_name);
    const lastName = text(metadata.last_name);
    const company = text(metadata.company || customer.legal_name);
    const status = projectCustomerIds.has(customer.id) ? 'active' : quotedCustomerIds.has(customer.id) ? 'quoted' : 'lead';
    return {
      id: customer.id,
      firstName,
      lastName: lastName || (!company ? displayName : ''),
      company: company || (firstName || lastName ? '' : displayName),
      emails: customer.email ? [customer.email] : [],
      phones: customer.phone ? [customer.phone] : [],
      address: addressText(customer.address),
      lastContactDate: text(metadata.last_contact_date),
      lastContactNotes: customer.notes || '',
      childrenNames: [],
      spouseName: '',
      importantDates: [],
      tags: ['Forge Core'],
      status,
      notes: customer.notes || '',
      activityLog: [],
      coreSource: customer.source,
      legacySourceIds: metadata.legacy_source_ids || (customer.legacy_source_id ? [`${customer.source}:${customer.legacy_source_id}`] : [])
    };
  });

  const quotes = coreQuotes.map((quote: any) => ({
    id: quote.id,
    quoteNumber: quote.quote_number,
    customerId: quote.customer_id,
    version: Number(quote.current_revision || 0) + 1,
    dateCreated: quote.quote_date || String(quote.created_at || '').slice(0, 10),
    scopeSummary: quote.description || quote.title || `Quote ${quote.quote_number}`,
    lineItems: [],
    totalValue: Number(quote.subtotal ?? quote.total ?? 0),
    margin: 0,
    poNumber: quote.po_number || undefined,
    probability: Number(quote.metadata?.probability ?? probabilityForStatus(quote.status)),
    status: mapQuoteStatus(quote.status),
    coreProjectId: quote.project_id || undefined,
    sourceFileName: quote.metadata?.source_file_name,
    sourceUrl: quote.metadata?.source_url,
    revisionHistory: quote.metadata?.revision_history || []
  }));

  const projects = coreProjects.map((project: any) => {
    const linkedQuote: any = quoteByProject.get(project.id);
    const phases = DEFAULT_PHASE_NAMES.map((name, index) => ({
      id: `${project.id}-core-phase-${index}`,
      projectId: project.id,
      name,
      startDate: '',
      targetEndDate: '',
      completed: false,
      tasks: []
    }));
    return {
      id: project.id,
      customerId: project.customer_id || linkedQuote?.customer_id || '',
      quoteId: linkedQuote?.id || '',
      projectName: project.name,
      startDate: String(project.created_at || '').slice(0, 10),
      targetCompletionDate: '',
      currentPhase: project.metadata?.legacy_stage || DEFAULT_PHASE_NAMES[0],
      status: project.status === 'delayed' ? 'delayed' : project.status === 'at risk' ? 'at risk' : 'on track',
      phases,
      coreMetadata: project.metadata || {}
    };
  });

  const dailyTasks = coreTasks.map((task: any) => ({
    id: task.id,
    title: task.title,
    category: taskCategory(task.title),
    dueDate: task.due_at ? String(task.due_at).slice(0, 10) : '',
    completed: task.status === 'completed',
    priority: task.priority === 'high' ? 'high' : task.priority === 'low' ? 'low' : 'medium',
    coreProjectId: task.project_id || undefined
  }));

  let existing: any = {};
  const raw = localStorage.getItem(CRM_STORAGE_KEY);
  if (raw) {
    try { existing = JSON.parse(raw); } catch { existing = {}; }
    if (!localStorage.getItem(CRM_BACKUP_KEY)) localStorage.setItem(CRM_BACKUP_KEY, raw);
  }

  const next = {
    ...existing,
    customers,
    quotes,
    projects,
    dailyTasks,
    forgeCoreSync: {
      organizationId: context.organizationId,
      userId: context.userId,
      syncedAt: new Date().toISOString(),
      counts: { customers: customers.length, quotes: quotes.length, projects: projects.length, tasks: dailyTasks.length }
    }
  };
  localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(next));
  return next.forgeCoreSync;
}

export function restorePreCoreBrowserBackup() {
  const backup = localStorage.getItem(CRM_BACKUP_KEY);
  if (!backup) throw new Error('No pre-Core browser backup is available on this device.');
  localStorage.setItem(CRM_STORAGE_KEY, backup);
}
