const STORAGE_KEY = 'forge_crm_data_v2';
const BRIDGE_PROTOCOL = 'forge-suite-bridge';
const BRIDGE_VERSION = 1;

const TRUSTED_SCOPE_ORIGINS = [
  'https://forge-scope.vercel.app',
  'https://forge-scope-boberts-projects-baa7bcf5.vercel.app',
];

const DEFAULT_PHASE_NAMES = [
  'Intake', 'Design', 'Estimating', 'Contract Signed',
  'Pre-Construction', 'Ordering', 'Execution', 'Completion'
];

function isTrustedScopeOrigin(origin: string) {
  if (TRUSTED_SCOPE_ORIGINS.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:'
      && url.hostname.startsWith('forge-scope-')
      && url.hostname.endsWith('-boberts-projects-baa7bcf5.vercel.app');
  } catch {
    return false;
  }
}

function normalize(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(limited|ltd\.?|incorporated|inc\.?|corporation|corp\.?|company|co\.?)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function looksLikeCompany(name: string) {
  return /\b(construction|contracting|contractor|builders?|building|developments?|homes?|lumber|roofing|renovations?|carpentry|farms?|farm|group|inc\.?|ltd\.?|limited|corp\.?|company|co\.?|enterprises?)\b/i.test(name);
}

function splitCustomerName(name: string) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { firstName: '', lastName: '', company: 'Unassigned' };
  if (looksLikeCompany(trimmed)) return { firstName: '', lastName: '', company: trimmed };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
    company: ''
  };
}

function fieldValue(scope: any, key: string) {
  return String(scope?.fields?.[key]?.value || '').trim();
}

function findCustomer(data: any, customerName: string) {
  const needle = normalize(customerName);
  if (!needle) return null;
  return (data.customers || []).find((customer: any) => {
    const fullName = normalize(`${customer.firstName || ''} ${customer.lastName || ''}`);
    const company = normalize(customer.company || '');
    return needle === fullName || needle === company;
  }) || null;
}

function ensureCustomer(data: any, scope: any) {
  const customerName = fieldValue(scope, 'customer') || 'Unassigned';
  const existing = findCustomer(data, customerName);
  const projectAddress = fieldValue(scope, 'projectAddress');

  if (existing) {
    if (!existing.address && projectAddress) existing.address = projectAddress;
    existing.tags = Array.from(new Set([...(existing.tags || []), 'Forge Scope']));
    if (existing.status === 'dormant') existing.status = 'lead';
    return existing;
  }

  const parsed = splitCustomerName(customerName);
  const customer = {
    id: makeId('cust'),
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    company: parsed.company,
    emails: [],
    phones: [],
    address: projectAddress,
    lastContactDate: new Date().toISOString().slice(0, 10),
    lastContactNotes: 'Created from Forge Scope.',
    childrenNames: [],
    spouseName: '',
    importantDates: [],
    tags: ['Forge Scope'],
    status: 'lead',
    notes: '',
    activityLog: []
  };
  data.customers = [...(data.customers || []), customer];
  return customer;
}

function makePhases(projectId: string) {
  return DEFAULT_PHASE_NAMES.map((name, index) => ({
    id: `${projectId}_phase_${index}`,
    projectId,
    name,
    startDate: '',
    targetEndDate: '',
    completed: false,
    tasks: []
  }));
}

function upsertScopeAndProject(data: any, scope: any, customer: any) {
  data.scopes = Array.isArray(data.scopes) ? data.scopes : [];
  data.projects = Array.isArray(data.projects) ? data.projects : [];

  const projectName = fieldValue(scope, 'projectName') || `${fieldValue(scope, 'customer') || 'Customer'} - ${scope.type || 'Scope'}`;
  const projectAddress = fieldValue(scope, 'projectAddress');
  const quoteDue = fieldValue(scope, 'quoteDue');
  const existingScope = data.scopes.find((record: any) => record.id === scope.id);
  let project = existingScope
    ? data.projects.find((p: any) => p.id === existingScope.projectId)
    : null;

  if (!project) {
    project = data.projects.find((p: any) =>
      p.customerId === customer.id && normalize(p.projectName || '') === normalize(projectName)
    ) || null;
  }

  if (!project) {
    const projectId = makeId('proj');
    project = {
      id: projectId,
      customerId: customer.id,
      quoteId: '',
      scopeId: scope.id,
      projectName,
      projectAddress,
      startDate: new Date().toISOString().slice(0, 10),
      targetCompletionDate: quoteDue,
      currentPhase: 'Intake',
      status: 'on track',
      phases: makePhases(projectId)
    };
    data.projects.push(project);
  } else {
    project.customerId = customer.id;
    project.scopeId = scope.id;
    project.projectName = projectName;
    if (projectAddress) project.projectAddress = projectAddress;
    if (quoteDue && !project.targetCompletionDate) project.targetCompletionDate = quoteDue;
  }

  const scopeRecord = {
    id: scope.id,
    version: BRIDGE_VERSION,
    sourceApp: 'forge-scope',
    customerId: customer.id,
    projectId: project.id,
    projectType: scope.type || '',
    projectName,
    projectAddress,
    salesperson: fieldValue(scope, 'salesperson'),
    estimator: fieldValue(scope, 'estimator'),
    quoteDue,
    scopeRequested: fieldValue(scope, 'scopeRequested'),
    scopeExcluded: fieldValue(scope, 'scopeExcluded'),
    fields: scope.fields || {},
    openings: scope.openings || [],
    mode: scope.mode || 'manual',
    createdAt: scope.createdAt || new Date().toISOString(),
    updatedAt: scope.updatedAt || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  };

  const scopeIndex = data.scopes.findIndex((record: any) => record.id === scope.id);
  if (scopeIndex >= 0) data.scopes[scopeIndex] = scopeRecord;
  else data.scopes.push(scopeRecord);

  return { project, scopeRecord };
}

function importScope(scope: any) {
  if (!scope || typeof scope !== 'object' || !scope.id) {
    throw new Error('Forge Scope payload is missing a scope id.');
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('FORGE_CRM_NOT_READY');

  const data = JSON.parse(raw);
  const customer = ensureCustomer(data, scope);
  const { project } = upsertScopeAndProject(data, scope, customer);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  return {
    customer: customer.company || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
    project: project.projectName,
    projectId: project.id,
    scopeId: scope.id
  };
}

function processScopeMessage(message: any, attempt = 0) {
  try {
    const result = importScope(message.scope);
    sessionStorage.setItem(
      'forge_suite_bridge_result',
      `Forge Scope imported into CRM.\n\nCustomer: ${result.customer}\nProject: ${result.project}`
    );
    window.location.hash = '/projects';
    window.location.reload();
  } catch (error: any) {
    if (error?.message === 'FORGE_CRM_NOT_READY' && attempt < 20) {
      setTimeout(() => processScopeMessage(message, attempt + 1), 150);
      return;
    }
    const detail = error?.message === 'FORGE_CRM_NOT_READY'
      ? 'Forge CRM could not initialize its local data store.'
      : (error?.message || 'Unknown error');
    window.alert(`Forge Scope could not be imported: ${detail}`);
  }
}

export function installForgeSuiteBridge() {
  const previousResult = sessionStorage.getItem('forge_suite_bridge_result');
  if (previousResult) {
    sessionStorage.removeItem('forge_suite_bridge_result');
    setTimeout(() => window.alert(previousResult), 300);
  }

  window.addEventListener('message', (event) => {
    if (!isTrustedScopeOrigin(event.origin)) return;
    const message = event.data;
    if (!message || message.protocol !== BRIDGE_PROTOCOL || message.version !== BRIDGE_VERSION) return;
    if (message.action !== 'scope.upsert') return;
    processScopeMessage(message);
  });

  if (window.opener && !window.opener.closed) {
    setTimeout(() => {
      window.opener?.postMessage(
        { protocol: BRIDGE_PROTOCOL, version: BRIDGE_VERSION, action: 'crm.ready' },
        '*'
      );
    }, 500);
  }
}
