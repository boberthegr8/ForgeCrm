import { DEFAULT_PHASE_NAMES } from './constants';
import { getForgeCoreClient, getForgeCoreContext, ForgeCoreContext } from './forgeCore';

const text = (value: any) => String(value ?? '').trim();
const addressText = (address: any) => typeof address === 'string' ? address : text(address?.formatted || address?.street || address?.address);

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

function corePriority(priority: string) {
  if (priority === 'high') return 'high';
  if (priority === 'low') return 'low';
  return 'normal';
}

function crmPriority(priority: string) {
  if (priority === 'high') return 'high';
  if (priority === 'low') return 'low';
  return 'medium';
}

function mapProjectPhases(project: any) {
  const metadata = project.metadata || {};
  const rawStage = text(metadata.legacy_stage || metadata.current_phase);
  const currentPhase = DEFAULT_PHASE_NAMES.includes(rawStage) ? rawStage : rawStage.toLowerCase() === 'site visit' ? 'Pre-Construction' : rawStage ? 'Contract Signed' : DEFAULT_PHASE_NAMES[0];
  const currentIndex = Math.max(0, DEFAULT_PHASE_NAMES.indexOf(currentPhase));

  const phases = DEFAULT_PHASE_NAMES.map((name, index) => ({
    id: `${project.id}-core-phase-${index}`,
    projectId: project.id,
    name,
    startDate: '',
    targetEndDate: '',
    completed: index < currentIndex,
    tasks: [] as any[]
  }));

  const phaseByName = new Map(phases.map(phase => [phase.name, phase]));
  const contractPhase = phaseByName.get('Contract Signed');
  const activePhase = phaseByName.get(currentPhase) || phases[0];
  const executionPhase = phaseByName.get('Execution');

  for (const [index, item] of (Array.isArray(metadata.legacy_timeline) ? metadata.legacy_timeline : []).entries()) {
    contractPhase?.tasks.push({
      id: `${project.id}-timeline-${item?.id ?? index}`,
      phaseId: contractPhase.id,
      title: text(item?.name || 'Legacy milestone'),
      description: 'Imported from legacy workflow timeline.',
      dueDate: text(item?.date),
      priority: 'medium',
      completed: Boolean(item?.done)
    });
  }

  for (const [index, item] of (Array.isArray(metadata.legacy_todos) ? metadata.legacy_todos : []).entries()) {
    activePhase.tasks.push({
      id: `${project.id}-todo-${item?.id ?? index}`,
      phaseId: activePhase.id,
      title: text(item?.text || 'Legacy follow-up'),
      description: 'Imported from legacy workflow.',
      dueDate: '',
      priority: crmPriority(text(item?.priority).toLowerCase()),
      completed: Boolean(item?.done)
    });
  }

  for (const [index, step] of (Array.isArray(metadata.legacy_steps) ? metadata.legacy_steps : []).entries()) {
    executionPhase?.tasks.push({
      id: `${project.id}-step-${index}`,
      phaseId: executionPhase.id,
      title: text(step),
      description: 'Imported from legacy next steps.',
      dueDate: '',
      priority: 'medium',
      completed: false
    });
  }

  return { phases, currentPhase };
}

export interface ForgeCoreSnapshot {
  context: ForgeCoreContext;
  customers: any[];
  quotes: any[];
  projects: any[];
  dailyTasks: any[];
  counts: {
    customers: number;
    quotes: number;
    revisions: number;
    projects: number;
    tasks: number;
  };
}

export async function loadForgeCoreSnapshot(): Promise<ForgeCoreSnapshot | null> {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) return null;
  const client = await getForgeCoreClient();

  const [customerResult, quoteResult, revisionResult, projectResult, taskResult] = await Promise.all([
    client.from('customers').select('*').eq('organization_id', context.organizationId).order('display_name'),
    client.from('quotes').select('*').eq('organization_id', context.organizationId).order('quote_date', { ascending: false }),
    client.from('quote_revisions').select('*').eq('organization_id', context.organizationId).order('revision_number'),
    client.from('projects').select('*').eq('organization_id', context.organizationId).order('created_at', { ascending: false }),
    client.from('tasks').select('*').eq('organization_id', context.organizationId).order('created_at', { ascending: false })
  ]);
  for (const result of [customerResult, quoteResult, revisionResult, projectResult, taskResult]) if (result.error) throw result.error;

  const coreCustomers = customerResult.data || [];
  const coreQuotes = quoteResult.data || [];
  const coreRevisions = revisionResult.data || [];
  const coreProjects = projectResult.data || [];
  const coreTasks = taskResult.data || [];
  const projectCustomerIds = new Set(coreProjects.map((project: any) => project.customer_id).filter(Boolean));
  const quotedCustomerIds = new Set(coreQuotes.map((quote: any) => quote.customer_id).filter(Boolean));
  const quoteByProject = new Map(coreQuotes.filter((quote: any) => quote.project_id).map((quote: any) => [quote.project_id, quote]));
  const revisionsByQuote = new Map<string, any[]>();
  for (const revision of coreRevisions) {
    const list = revisionsByQuote.get(revision.quote_id) || [];
    list.push(revision);
    revisionsByQuote.set(revision.quote_id, list);
  }

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
      externalCustomerNumber: metadata.external_customer_number,
      legacySourceIds: metadata.legacy_source_ids || (customer.legacy_source_id ? [`${customer.source}:${customer.legacy_source_id}`] : [])
    };
  });

  const quotes = coreQuotes.map((quote: any) => {
    const revisions = revisionsByQuote.get(quote.id) || [];
    return {
      id: quote.id,
      quoteNumber: quote.quote_number,
      customerId: quote.customer_id,
      version: Number(quote.current_revision || 0) + 1,
      dateCreated: quote.quote_date || String(quote.created_at || '').slice(0, 10),
      scopeSummary: quote.description || quote.title || `Quote ${quote.quote_number}`,
      lineItems: [],
      totalValue: Number(quote.subtotal ?? quote.total ?? 0),
      margin: Number(quote.metadata?.margin ?? 0),
      poNumber: quote.po_number || undefined,
      probability: Number(quote.metadata?.probability ?? probabilityForStatus(quote.status)),
      status: mapQuoteStatus(quote.status),
      coreProjectId: quote.project_id || undefined,
      sourceFileName: quote.metadata?.source_file_name,
      sourceUrl: quote.metadata?.source_url,
      revisionHistory: revisions.map((revision: any) => ({
        revisionNumber: revision.revision_number,
        subtotal: Number(revision.subtotal ?? revision.total ?? 0),
        description: revision.description || '',
        createdAt: revision.created_at,
        metadata: revision.metadata || {}
      }))
    };
  });

  const projects = coreProjects.map((project: any) => {
    const linkedQuote: any = quoteByProject.get(project.id);
    const mapped = mapProjectPhases(project);
    return {
      id: project.id,
      customerId: project.customer_id || linkedQuote?.customer_id || '',
      quoteId: linkedQuote?.id || '',
      projectName: project.name,
      startDate: String(project.created_at || '').slice(0, 10),
      targetCompletionDate: text(project.metadata?.target_completion_date),
      currentPhase: mapped.currentPhase,
      status: project.status === 'delayed' ? 'delayed' : project.status === 'at risk' ? 'at risk' : 'on track',
      phases: mapped.phases,
      trussDeliveryDate: project.metadata?.truss_delivery_date || project.metadata?.legacy_truss?.date || undefined,
      floorSystemDeliveryDate: project.metadata?.floor_system_delivery_date || undefined,
      shipDate: project.metadata?.ship_date || undefined,
      coreMetadata: project.metadata || {}
    };
  });

  const dailyTasks = coreTasks.map((task: any) => ({
    id: task.id,
    title: task.title,
    category: task.metadata?.category || taskCategory(task.title),
    dueDate: task.due_at ? String(task.due_at).slice(0, 10) : '',
    completed: task.status === 'completed',
    priority: crmPriority(task.priority),
    coreProjectId: task.project_id || undefined
  }));

  return {
    context,
    customers,
    quotes,
    projects,
    dailyTasks,
    counts: {
      customers: customers.length,
      quotes: quotes.length,
      revisions: coreRevisions.length,
      projects: projects.length,
      tasks: dailyTasks.length
    }
  };
}

async function requireCore() {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) return null;
  const client = await getForgeCoreClient();
  return { context, client };
}

export async function createCustomerInForgeCore(customer: any) {
  const core = await requireCore();
  if (!core) return null;
  const displayName = text(customer.company) || text(`${customer.firstName || ''} ${customer.lastName || ''}`) || 'Unnamed customer';
  const { data, error } = await core.client.from('customers').insert({
    id: customer.id,
    organization_id: core.context.organizationId,
    location_id: core.context.locationId || null,
    display_name: displayName,
    legal_name: text(customer.company) || null,
    email: customer.emails?.[0] || null,
    phone: customer.phones?.[0] || null,
    address: customer.address ? { formatted: customer.address } : {},
    notes: customer.notes || customer.lastContactNotes || null,
    source: 'forge-crm',
    metadata: {
      first_name: customer.firstName || '',
      last_name: customer.lastName || '',
      company: customer.company || '',
      last_contact_date: customer.lastContactDate || '',
      tags: customer.tags || []
    },
    created_by: core.context.userId
  }).select('id').single();
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('forge-core-changed', { detail: { entity: 'customer', id: data.id } }));
  return data;
}

export async function updateCustomerInForgeCore(customer: any) {
  const core = await requireCore();
  if (!core) return null;
  const displayName = text(customer.company) || text(`${customer.firstName || ''} ${customer.lastName || ''}`) || 'Unnamed customer';
  const { error } = await core.client.from('customers').update({
    display_name: displayName,
    legal_name: text(customer.company) || null,
    email: customer.emails?.[0] || null,
    phone: customer.phones?.[0] || null,
    address: customer.address ? { formatted: customer.address } : {},
    notes: customer.notes || customer.lastContactNotes || null,
    metadata: {
      first_name: customer.firstName || '',
      last_name: customer.lastName || '',
      company: customer.company || '',
      last_contact_date: customer.lastContactDate || '',
      tags: customer.tags || [],
      legacy_source_ids: customer.legacySourceIds || []
    }
  }).eq('id', customer.id).eq('organization_id', core.context.organizationId);
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('forge-core-changed', { detail: { entity: 'customer', id: customer.id } }));
  return true;
}

export async function createTaskInForgeCore(task: any) {
  const core = await requireCore();
  if (!core) return null;
  const { data, error } = await core.client.from('tasks').insert({
    id: task.id,
    organization_id: core.context.organizationId,
    location_id: core.context.locationId || null,
    assigned_to: core.context.userId,
    title: task.title,
    status: task.completed ? 'completed' : 'open',
    priority: corePriority(task.priority),
    due_at: task.dueDate || null,
    completed_at: task.completed ? new Date().toISOString() : null,
    metadata: { category: task.category || 'General' },
    source: 'forge-crm',
    created_by: core.context.userId
  }).select('id').single();
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('forge-core-changed', { detail: { entity: 'task', id: data.id } }));
  return data;
}

export async function updateTaskInForgeCore(task: any) {
  const core = await requireCore();
  if (!core) return null;
  const { error } = await core.client.from('tasks').update({
    title: task.title,
    status: task.completed ? 'completed' : 'open',
    priority: corePriority(task.priority),
    due_at: task.dueDate || null,
    completed_at: task.completed ? new Date().toISOString() : null,
    metadata: { category: task.category || 'General' }
  }).eq('id', task.id).eq('organization_id', core.context.organizationId);
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('forge-core-changed', { detail: { entity: 'task', id: task.id } }));
  return true;
}

export async function deleteTaskFromForgeCore(taskId: string) {
  const core = await requireCore();
  if (!core) return null;
  const { error } = await core.client.from('tasks').delete().eq('id', taskId).eq('organization_id', core.context.organizationId);
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('forge-core-changed', { detail: { entity: 'task', id: taskId } }));
  return true;
}

export async function updateQuoteInForgeCore(quote: any) {
  const core = await requireCore();
  if (!core) return null;
  const { error } = await core.client.from('quotes').update({
    customer_id: quote.customerId || null,
    status: quote.status,
    title: quote.scopeSummary || `Quote ${quote.quoteNumber}`,
    description: quote.scopeSummary || null,
    subtotal: Number(quote.totalValue || 0),
    total: Number(quote.totalValue || 0),
    po_number: quote.poNumber || null,
    quote_date: quote.dateCreated || null,
    metadata: {
      probability: Number(quote.probability || 0),
      margin: Number(quote.margin || 0),
      source_file_name: quote.sourceFileName,
      source_url: quote.sourceUrl
    }
  }).eq('id', quote.id).eq('organization_id', core.context.organizationId);
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('forge-core-changed', { detail: { entity: 'quote', id: quote.id } }));
  return true;
}

export async function createQuoteInForgeCore(quote: any) {
  const core = await requireCore();
  if (!core) return null;
  const { data, error } = await core.client.rpc('create_crm_quote_v1', {
    p_quote_id: quote.id,
    p_organization_id: core.context.organizationId,
    p_location_id: core.context.locationId || null,
    p_customer_id: quote.customerId || null,
    p_quote_number: quote.quoteNumber,
    p_status: quote.status || 'draft',
    p_description: quote.scopeSummary || '',
    p_subtotal: Number(quote.totalValue || 0),
    p_po_number: quote.poNumber || null,
    p_quote_date: quote.dateCreated || null,
    p_probability: Number(quote.probability || 0),
    p_margin: Number(quote.margin || 0)
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('forge-core-changed', { detail: { entity: 'quote', id: quote.id } }));
  return data;
}

export async function reviseQuoteInForgeCore(quoteId: string) {
  const core = await requireCore();
  if (!core) return null;
  const { data, error } = await core.client.rpc('revise_crm_quote_v1', { p_quote_id: quoteId });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('forge-core-changed', { detail: { entity: 'quote', id: quoteId } }));
  return data;
}

export async function convertQuoteToProjectInForgeCore(quoteId: string, projectId: string, projectName: string, logistics: any) {
  const core = await requireCore();
  if (!core) return null;
  const { data, error } = await core.client.rpc('convert_crm_quote_to_project_v1', {
    p_quote_id: quoteId,
    p_project_id: projectId,
    p_project_name: projectName,
    p_metadata: {
      current_phase: DEFAULT_PHASE_NAMES[0],
      target_completion_date: logistics?.shipDate || '',
      truss_delivery_date: logistics?.trussDeliveryDate || null,
      floor_system_delivery_date: logistics?.floorSystemDeliveryDate || null,
      ship_date: logistics?.shipDate || null
    }
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('forge-core-changed', { detail: { entity: 'project', id: projectId } }));
  return data;
}
