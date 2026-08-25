// One-time migration adapter for the legacy ForgeWhiteAM CRM.
//
// The source Supabase publishable key is intentionally public/client-side; it is the same
// publishable key already shipped by the legacy browser app. This adapter is temporary and
// should be removed once Forge Core owns the migrated records permanently.

export const FORGEWHITEAM_MIGRATION_MARKER = 'forge_crm_forgewhiteam_migration_v1';

const LEGACY_URL = 'https://zumamemyvczdmpswirjt.supabase.co';
const LEGACY_PUBLISHABLE_KEY = 'sb_publishable_favqe0R1h3-xnSaoNGi-Iw_R8CVAlV6';
const LEGACY_ORG = 'jk-hardware-001';

const PHASES = [
  'Intake',
  'Design',
  'Estimating',
  'Contract Signed',
  'Pre-Construction',
  'Ordering',
  'Execution',
  'Completion'
];

type LegacySnapshot = {
  contacts?: any[];
  quotes?: any[];
  deals?: any[];
  todos?: any[];
};

const normalize = (value: string = '') => value
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]/g, '');

const normalizeCompany = (value: string = '') => normalize(
  value
    .replace(/\b(incorporated|inc|limited|ltd|corporation|corp|company|co)\b/gi, '')
);

const phoneDigits = (value: string = '') => value.replace(/\D/g, '');
const fullName = (value: any) => [value?.firstName ?? value?.first, value?.lastName ?? value?.last]
  .filter(Boolean)
  .join(' ')
  .trim();

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const isEmail = (value: string = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isCompanyRecord = (contact: any) => {
  if (!contact?.company) return false;
  const person = normalizeCompany(fullName(contact));
  const company = normalizeCompany(contact.company);
  return !person || person === company;
};

const statusRank: Record<string, number> = {
  dormant: 0,
  lead: 1,
  quoted: 2,
  active: 3,
  completed: 4
};

const strongestStatus = (a: string = 'lead', b: string = 'lead') =>
  (statusRank[b] ?? 0) > (statusRank[a] ?? 0) ? b : a;

const mapCustomerStatus = (status: string = '') => {
  const s = status.toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'lead' || s === 'prospect') return 'lead';
  return 'lead';
};

const mapQuoteStatus = (status: string = '') => {
  switch (status.toLowerCase()) {
    case 'accepted': return 'approved';
    case 'draft': return 'draft';
    case 'expired': return 'rejected';
    case 'sent':
    default: return 'sent';
  }
};

const quoteProbability = (status: string = '') => {
  switch (status.toLowerCase()) {
    case 'accepted': return 100;
    case 'sent': return 60;
    case 'draft': return 30;
    case 'expired': return 0;
    default: return 50;
  }
};

const extractQuoteNumber = (quote: any) => {
  const notes = String(quote?.notes || '');
  const items = String(quote?.items || '');
  const noteMatch = notes.match(/\bQ:\s*([0-9]+-[0-9]+)/i);
  if (noteMatch?.[1]) return noteMatch[1];
  const itemMatch = items.match(/quote\s*number\s*[-:]\s*([0-9]+-[0-9]+)/i);
  if (itemMatch?.[1]) return itemMatch[1];
  return `FWAM-${quote?.id}`;
};

const extractPoNumber = (quote: any) => {
  const match = String(quote?.notes || '').match(/\bPO:\s*([^|]+)/i);
  return match?.[1]?.trim() || undefined;
};

const dateFromTimestamp = (ts: any) => {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  try { return new Date(n).toISOString().slice(0, 10); }
  catch { return ''; }
};

const findExistingCustomer = (customers: any[], imported: any) => {
  const email = isEmail(imported?.email) ? String(imported.email).trim().toLowerCase() : '';
  const phone = phoneDigits(imported?.phone || '');
  const personKey = normalize(fullName(imported));
  const companyKey = normalizeCompany(imported?.company || '');

  return customers.find((customer: any) => {
    if (email && (customer.emails || []).some((v: string) => v.toLowerCase() === email)) return true;
    if (phone && (customer.phones || []).some((v: string) => phoneDigits(v) === phone)) return true;

    const existingPersonKey = normalize(fullName(customer));
    if (personKey && existingPersonKey && personKey === existingPersonKey) return true;

    // Company-only matching is intentionally conservative so a named employee/contact does
    // not silently collapse into a generic company account.
    if (companyKey && isCompanyRecord(imported)) {
      return normalizeCompany(customer.company || '') === companyKey;
    }

    return false;
  });
};

const findCustomerForQuote = (customers: any[], quote: any) => {
  const clientKey = normalize(quote?.client || '');
  const companyKey = normalizeCompany(quote?.company || '');
  return customers.find((customer: any) => {
    if (clientKey && normalize(fullName(customer)) === clientKey) return true;
    if (companyKey && normalizeCompany(customer.company || '') === companyKey) return true;
    return false;
  });
};

const buildPhases = (projectId: string, deal: any, currentPhase: string) => {
  const currentIndex = Math.max(0, PHASES.indexOf(currentPhase));
  const phaseMap = new Map<string, any>();

  for (const [index, name] of PHASES.entries()) {
    const phase = {
      id: `${projectId}-phase-${index}`,
      projectId,
      name,
      startDate: '',
      targetEndDate: '',
      completed: index < currentIndex,
      tasks: [] as any[]
    };
    phaseMap.set(name, phase);
  }

  const contractPhase = phaseMap.get('Contract Signed');
  const activePhase = phaseMap.get(currentPhase) || phaseMap.get('Pre-Construction');
  const executionPhase = phaseMap.get('Execution');

  (Array.isArray(deal?.timeline) ? deal.timeline : []).forEach((item: any, index: number) => {
    contractPhase.tasks.push({
      id: `${projectId}-timeline-${item?.id ?? index}`,
      phaseId: contractPhase.id,
      title: String(item?.name || 'Legacy milestone'),
      description: 'Imported from ForgeWhiteAM pipeline timeline.',
      dueDate: String(item?.date || ''),
      priority: 'medium',
      completed: Boolean(item?.done)
    });
  });

  (Array.isArray(deal?.todos) ? deal.todos : []).forEach((item: any, index: number) => {
    const p = String(item?.priority || '').toLowerCase();
    activePhase.tasks.push({
      id: `${projectId}-deal-todo-${item?.id ?? index}`,
      phaseId: activePhase.id,
      title: String(item?.text || 'Legacy follow-up'),
      description: 'Imported from ForgeWhiteAM deal workflow.',
      dueDate: '',
      priority: p === 'high' ? 'high' : p === 'low' ? 'low' : 'medium',
      completed: Boolean(item?.done)
    });
  });

  (Array.isArray(deal?.steps) ? deal.steps : []).forEach((step: any, index: number) => {
    executionPhase.tasks.push({
      id: `${projectId}-step-${index}`,
      phaseId: executionPhase.id,
      title: String(step),
      description: 'Imported from ForgeWhiteAM next steps.',
      dueDate: '',
      priority: 'medium',
      completed: false
    });
  });

  return PHASES.map(name => phaseMap.get(name));
};

export async function fetchForgeWhiteAmSnapshot(): Promise<LegacySnapshot> {
  const endpoint = `${LEGACY_URL}/rest/v1/forge_state?org_id=eq.${encodeURIComponent(LEGACY_ORG)}&select=contacts,quotes,deals,todos`;
  const response = await fetch(endpoint, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      apikey: LEGACY_PUBLISHABLE_KEY,
      Authorization: `Bearer ${LEGACY_PUBLISHABLE_KEY}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`ForgeWhiteAM migration fetch failed (${response.status})`);
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error('ForgeWhiteAM migration source row was not found.');

  return {
    contacts: Array.isArray(row.contacts) ? row.contacts : [],
    quotes: Array.isArray(row.quotes) ? row.quotes : [],
    deals: Array.isArray(row.deals) ? row.deals : [],
    todos: Array.isArray(row.todos) ? row.todos : []
  };
}

export function mergeForgeWhiteAmSnapshot(base: any, snapshot: LegacySnapshot) {
  const next = {
    ...base,
    customers: Array.isArray(base?.customers) ? [...base.customers] : [],
    quotes: Array.isArray(base?.quotes) ? [...base.quotes] : [],
    projects: Array.isArray(base?.projects) ? [...base.projects] : [],
    dailyTasks: Array.isArray(base?.dailyTasks) ? [...base.dailyTasks] : []
  };

  const customerIdMap = new Map<string, string>();

  for (const imported of snapshot.contacts || []) {
    const sourceId = String(imported?.id ?? '');
    if (!sourceId) continue;

    const existing = findExistingCustomer(next.customers, imported);
    const validEmail = isEmail(imported?.email) ? String(imported.email).trim() : '';
    const phone = String(imported?.phone || '').trim();
    const importedStatus = mapCustomerStatus(imported?.status);

    if (existing) {
      customerIdMap.set(sourceId, existing.id);
      existing.emails = uniqueStrings([...(existing.emails || []), validEmail]);
      existing.phones = uniqueStrings([...(existing.phones || []), phone]);
      existing.company = existing.company || imported?.company || '';
      existing.firstName = existing.firstName || imported?.first || '';
      existing.lastName = existing.lastName || imported?.last || '';
      existing.lastContactDate = existing.lastContactDate || imported?.date || '';
      existing.status = strongestStatus(existing.status, importedStatus);
      existing.tags = uniqueStrings([...(existing.tags || []), 'ForgeWhiteAM']);
      existing.legacySourceIds = uniqueStrings([...(existing.legacySourceIds || []), `forgewhiteam:${sourceId}`]);
      continue;
    }

    const newCustomer = {
      id: `fwam-customer-${sourceId}`,
      firstName: String(imported?.first || ''),
      lastName: String(imported?.last || ''),
      company: String(imported?.company || ''),
      emails: validEmail ? [validEmail] : [],
      phones: phone ? [phone] : [],
      address: '',
      lastContactDate: String(imported?.date || dateFromTimestamp(imported?.ts) || ''),
      lastContactNotes: 'Imported from ForgeWhiteAM legacy CRM.',
      childrenNames: [],
      spouseName: '',
      importantDates: [],
      tags: ['ForgeWhiteAM'],
      status: importedStatus,
      notes: 'Legacy CRM contact imported from forgewhiteam.vercel.app.',
      activityLog: [],
      importSource: 'ForgeWhiteAM Supabase',
      legacySourceIds: [`forgewhiteam:${sourceId}`]
    };
    next.customers.push(newCustomer);
    customerIdMap.set(sourceId, newCustomer.id);
  }

  const existingQuoteNumbers = new Map<string, any>();
  next.quotes.forEach((quote: any) => {
    existingQuoteNumbers.set(normalize(quote?.quoteNumber || ''), quote);
  });
  const quoteIdMap = new Map<string, string>();

  for (const imported of snapshot.quotes || []) {
    const sourceId = String(imported?.id ?? '');
    if (!sourceId) continue;

    const quoteNumber = extractQuoteNumber(imported);
    const quoteKey = normalize(quoteNumber);
    const byLegacyId = next.quotes.find((q: any) => q?.sourceSystem === 'ForgeWhiteAM' && String(q?.sourceLegacyId) === sourceId);
    const existing = byLegacyId || existingQuoteNumbers.get(quoteKey);

    let customerId = customerIdMap.get(String(imported?.contactId ?? ''));
    if (!customerId) customerId = findCustomerForQuote(next.customers, imported)?.id;
    if (!customerId) continue;

    const sourceFields = {
      sourceSystem: 'ForgeWhiteAM',
      sourceLegacyId: sourceId,
      sourceContactId: imported?.contactId != null ? String(imported.contactId) : undefined,
      sourceStatus: String(imported?.status || ''),
      expiryDate: String(imported?.expiry || ''),
      sourceNotes: String(imported?.notes || ''),
      sourceItems: String(imported?.items || ''),
      revisionHistory: Array.isArray(imported?.revisions) ? imported.revisions : [],
      sourceTimestamp: imported?.ts != null ? String(imported.ts) : undefined,
      importSource: 'ForgeWhiteAM Supabase migration'
    };

    if (existing) {
      quoteIdMap.set(sourceId, existing.id);
      Object.assign(existing, {
        ...sourceFields,
        poNumber: existing.poNumber || extractPoNumber(imported)
      });
      continue;
    }

    const status = mapQuoteStatus(imported?.status);
    const newQuote = {
      id: `fwam-quote-${sourceId}`,
      quoteNumber,
      customerId,
      version: (Array.isArray(imported?.revisions) ? imported.revisions.length : 0) + 1,
      dateCreated: String(imported?.date || dateFromTimestamp(imported?.ts) || ''),
      scopeSummary: String(imported?.desc || imported?.client || 'Legacy quote'),
      lineItems: [],
      totalValue: Number(imported?.amount || 0),
      margin: 0,
      poNumber: extractPoNumber(imported),
      probability: quoteProbability(imported?.status),
      status,
      ...sourceFields
    };
    next.quotes.push(newQuote);
    existingQuoteNumbers.set(quoteKey, newQuote);
    quoteIdMap.set(sourceId, newQuote.id);

    if (status === 'approved') {
      const customer = next.customers.find((c: any) => c.id === customerId);
      if (customer) customer.status = strongestStatus(customer.status, 'active');
    } else {
      const customer = next.customers.find((c: any) => c.id === customerId);
      if (customer) customer.status = strongestStatus(customer.status, 'quoted');
    }
  }

  // Import only quote-linked pipeline deals. The unlinked Michael Scott demo deal is
  // deliberately excluded because it is not part of the user's real quote workflow.
  for (const deal of snapshot.deals || []) {
    const sourceDealId = String(deal?.id ?? '');
    const sourceQuoteId = String(deal?.quoteId ?? '');
    if (!sourceDealId || !sourceQuoteId) continue;

    const quoteId = quoteIdMap.get(sourceQuoteId);
    if (!quoteId) continue;
    const quote = next.quotes.find((q: any) => q.id === quoteId);
    if (!quote) continue;

    const existingProject = next.projects.find((p: any) =>
      p.quoteId === quoteId || (p.sourceSystem === 'ForgeWhiteAM' && String(p.sourceLegacyDealId) === sourceDealId)
    );
    if (existingProject) {
      existingProject.sourceSystem = existingProject.sourceSystem || 'ForgeWhiteAM';
      existingProject.sourceLegacyDealId = existingProject.sourceLegacyDealId || sourceDealId;
      existingProject.legacyStage = existingProject.legacyStage || String(deal?.stage || '');
      continue;
    }

    const legacyStage = String(deal?.stage || '');
    const currentPhase = legacyStage.toLowerCase() === 'site visit' ? 'Pre-Construction' : 'Contract Signed';
    const projectId = `fwam-project-${sourceDealId}`;
    const project = {
      id: projectId,
      customerId: quote.customerId,
      quoteId,
      projectName: `${deal?.client || 'Customer'} — ${quote.scopeSummary}`,
      startDate: String(deal?.date || dateFromTimestamp(deal?.ts) || ''),
      targetCompletionDate: '',
      currentPhase,
      status: 'on track',
      phases: buildPhases(projectId, deal, currentPhase),
      trussDeliveryDate: deal?.truss?.date || undefined,
      floorSystemDeliveryDate: undefined,
      shipDate: undefined,
      sourceSystem: 'ForgeWhiteAM',
      sourceLegacyDealId: sourceDealId,
      legacyStage,
      legacyTimeline: Array.isArray(deal?.timeline) ? deal.timeline : [],
      legacySteps: Array.isArray(deal?.steps) ? deal.steps : [],
      legacyTruss: deal?.truss || null,
      importSource: 'ForgeWhiteAM Supabase migration'
    };
    next.projects.push(project);

    const customer = next.customers.find((c: any) => c.id === quote.customerId);
    if (customer) customer.status = strongestStatus(customer.status, 'active');
  }

  const existingTaskIds = new Set(next.dailyTasks.map((task: any) => String(task.id)));
  for (const todo of snapshot.todos || []) {
    const sourceId = String(todo?.id ?? '');
    if (!sourceId) continue;
    const id = `fwam-todo-${sourceId}`;
    if (existingTaskIds.has(id)) continue;

    const text = String(todo?.text || 'Legacy CRM follow-up');
    const priority = String(todo?.priority || '').toLowerCase();
    next.dailyTasks.push({
      id,
      title: text,
      category: /call/i.test(text) ? 'Call' : /send|email/i.test(text) ? 'Email' : 'General',
      dueDate: dateFromTimestamp(todo?.ts),
      completed: Boolean(todo?.done),
      priority: priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium',
      sourceSystem: 'ForgeWhiteAM',
      sourceLegacyId: sourceId,
      legacyDealId: todo?.dealId != null ? String(todo.dealId) : undefined,
      legacyDealName: todo?.dealName || undefined
    });
    existingTaskIds.add(id);
  }

  return next;
}
