import type { QuoteIntakeDraft } from './quoteIntake';

export const FORGE_CORE_CONFIG = {
  url: 'https://uyqanhwurngoupmvzxrh.supabase.co',
  publishableKey: 'sb_publishable_SquKrj848EoO9NHZknVkSA_k8CKD7WQ',
  supabaseJsUrl: 'https://esm.sh/@supabase/supabase-js@2.112.4',
  documentBucket: 'forge-documents',
  defaultLocationCode: 'JK-MAIN'
} as const;

type SupabaseClientLike = any;
let clientPromise: Promise<SupabaseClientLike> | null = null;

export interface ForgeCoreContext {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
  locationId?: string;
  locationName?: string;
  locationCode?: string;
}

export interface CoreCustomerMatch {
  id: string;
  displayName: string;
  score: number;
  reasons: string[];
}

export interface CoreQuotePreview {
  mode: 'ready' | 'signed-out' | 'unassigned';
  context?: ForgeCoreContext;
  customerMatch?: CoreCustomerMatch;
  existingQuote?: {
    id: string;
    quoteNumber: string;
    currentRevision: number;
    subtotal: number | null;
  };
}

export interface CoreQuoteCommitOptions {
  customerIdOverride?: string;
  forceCreateCustomer?: boolean;
}

export interface CoreQuoteCommitResult {
  organizationId: string;
  customerId: string;
  projectId?: string;
  quoteId: string;
  revisionNumber: number;
  documentId: string;
  createdCustomer: boolean;
  createdProject: boolean;
  createdQuote: boolean;
  reusedDocument: boolean;
}

export async function getForgeCoreClient(): Promise<SupabaseClientLike> {
  if (!clientPromise) {
    clientPromise = import(/* @vite-ignore */ FORGE_CORE_CONFIG.supabaseJsUrl).then((module: any) => {
      if (!module?.createClient) throw new Error('Forge Core client could not be loaded.');
      return module.createClient(FORGE_CORE_CONFIG.url, FORGE_CORE_CONFIG.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        global: {
          headers: { 'x-forge-module': 'crm' }
        }
      });
    });
  }
  return clientPromise;
}

export async function signInToForgeCore(email: string, password: string) {
  const client = await getForgeCoreClient();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signUpForForgeCore(email: string, password: string) {
  const client = await getForgeCoreClient();
  const { data, error } = await client.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signOutOfForgeCore() {
  const client = await getForgeCoreClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getForgeCoreContext(): Promise<ForgeCoreContext | null> {
  const client = await getForgeCoreClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData?.session;
  if (!session?.user?.id) return null;

  const { data: memberships, error: membershipError } = await client
    .from('organization_memberships')
    .select('organization_id, role, status')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .limit(10);
  if (membershipError) throw membershipError;
  if (!memberships?.length) {
    return {
      userId: session.user.id,
      email: session.user.email || '',
      organizationId: '',
      organizationName: '',
      organizationSlug: '',
      role: 'unassigned'
    };
  }

  const membership = memberships[0];
  const { data: organization, error: organizationError } = await client
    .from('organizations')
    .select('id, name, slug')
    .eq('id', membership.organization_id)
    .single();
  if (organizationError) throw organizationError;

  const { data: locations, error: locationsError } = await client
    .from('locations')
    .select('id, name, code')
    .eq('organization_id', membership.organization_id)
    .eq('status', 'active')
    .order('name');
  if (locationsError) throw locationsError;

  const preferred = (locations || []).find((location: any) => location.code === FORGE_CORE_CONFIG.defaultLocationCode) || locations?.[0];
  return {
    userId: session.user.id,
    email: session.user.email || '',
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    role: membership.role,
    locationId: preferred?.id,
    locationName: preferred?.name,
    locationCode: preferred?.code
  };
}

const clean = (value = '') => value.replace(/\s+/g, ' ').trim();
const normalize = (value = '') => value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const digits = (value = '') => value.replace(/\D/g, '');

function addressText(address: any) {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return address.formatted || address.street || address.address || '';
}

function scoreCustomer(draft: QuoteIntakeDraft, customer: any): CoreCustomerMatch {
  let score = 0;
  const reasons: string[] = [];
  const incomingAccount = clean(draft.customerNumber);
  const storedAccount = clean(customer?.metadata?.external_customer_number || '');
  if (incomingAccount && storedAccount && incomingAccount === storedAccount) {
    score += 100;
    reasons.push('same customer/account number');
  }

  const incomingPhone = digits(draft.phone);
  const storedPhone = digits(customer.phone || '');
  if (incomingPhone.length >= 10 && incomingPhone === storedPhone) {
    score += 55;
    reasons.push('same phone');
  }

  const incomingName = normalize(draft.customerName);
  const storedName = normalize(customer.display_name || '');
  if (incomingName && storedName && incomingName === storedName) {
    score += 45;
    reasons.push('same normalized customer name');
  } else if (incomingName && storedName && (incomingName.includes(storedName) || storedName.includes(incomingName))) {
    score += 28;
    reasons.push('similar customer name');
  }

  const incomingAddress = normalize(draft.address);
  const storedAddress = normalize(addressText(customer.address));
  if (incomingAddress && storedAddress && incomingAddress === storedAddress) {
    score += 30;
    reasons.push('same address');
  }

  return { id: customer.id, displayName: customer.display_name, score: Math.min(score, 100), reasons };
}

async function getBestCustomerMatch(client: SupabaseClientLike, context: ForgeCoreContext, draft: QuoteIntakeDraft) {
  const { data, error } = await client
    .from('customers')
    .select('id, display_name, phone, address, metadata')
    .eq('organization_id', context.organizationId)
    .limit(2500);
  if (error) throw error;
  const matches = (data || [])
    .map((customer: any) => scoreCustomer(draft, customer))
    .filter((match: CoreCustomerMatch) => match.score > 0)
    .sort((a: CoreCustomerMatch, b: CoreCustomerMatch) => b.score - a.score);
  return matches[0];
}

export async function previewQuoteAgainstForgeCore(draft: QuoteIntakeDraft): Promise<CoreQuotePreview> {
  const context = await getForgeCoreContext();
  if (!context) return { mode: 'signed-out' };
  if (!context.organizationId) return { mode: 'unassigned', context };

  const client = await getForgeCoreClient();
  const [customerMatch, quoteResult] = await Promise.all([
    getBestCustomerMatch(client, context, draft),
    draft.quoteNumber
      ? client.from('quotes').select('id, quote_number, current_revision, subtotal').eq('organization_id', context.organizationId).eq('quote_number', clean(draft.quoteNumber)).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if (quoteResult.error) throw quoteResult.error;
  return {
    mode: 'ready',
    context,
    customerMatch,
    existingQuote: quoteResult.data ? {
      id: quoteResult.data.id,
      quoteNumber: quoteResult.data.quote_number,
      currentRevision: quoteResult.data.current_revision || 0,
      subtotal: quoteResult.data.subtotal
    } : undefined
  };
}

async function sha256File(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
}

function safeSegment(value: string) {
  return clean(value || 'unknown').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

async function ensureDocument(client: SupabaseClientLike, context: ForgeCoreContext, draft: QuoteIntakeDraft, file: File) {
  const sha256 = await sha256File(file);
  const { data: existingDocument, error: documentLookupError } = await client
    .from('documents')
    .select('id, storage_bucket, storage_path')
    .eq('organization_id', context.organizationId)
    .eq('sha256', sha256)
    .maybeSingle();
  if (documentLookupError) throw documentLookupError;
  if (existingDocument) return { document: existingDocument, reused: true };

  const quoteFolder = safeSegment(draft.quoteNumber || 'unassigned');
  const fileName = `${crypto.randomUUID()}-${safeSegment(file.name)}`;
  const storagePath = `${context.organizationId}/quotes/${quoteFolder}/${fileName}`;
  const { error: uploadError } = await client.storage
    .from(FORGE_CORE_CONFIG.documentBucket)
    .upload(storagePath, file, { contentType: file.type || 'application/pdf', upsert: false });
  if (uploadError) throw uploadError;

  const { data: document, error: insertError } = await client
    .from('documents')
    .insert({
      organization_id: context.organizationId,
      location_id: context.locationId || null,
      document_type: 'quote',
      title: draft.quoteNumber ? `Quote ${draft.quoteNumber}` : file.name,
      original_filename: file.name,
      storage_bucket: FORGE_CORE_CONFIG.documentBucket,
      storage_path: storagePath,
      mime_type: file.type || 'application/pdf',
      file_size_bytes: file.size,
      sha256,
      status: 'uploaded',
      source: 'forge-crm-quote-intake',
      metadata: { quote_number: draft.quoteNumber, extraction: 'browser-pdf-text-v1' },
      created_by: context.userId
    })
    .select('id, storage_bucket, storage_path')
    .single();
  if (insertError) {
    await client.storage.from(FORGE_CORE_CONFIG.documentBucket).remove([storagePath]);
    throw insertError;
  }
  return { document, reused: false };
}

async function resolveCustomer(client: SupabaseClientLike, context: ForgeCoreContext, draft: QuoteIntakeDraft, options: CoreQuoteCommitOptions) {
  if (options.customerIdOverride) {
    const { data, error } = await client.from('customers').select('id').eq('organization_id', context.organizationId).eq('id', options.customerIdOverride).single();
    if (error) throw error;
    return { customerId: data.id, created: false };
  }

  const best = await getBestCustomerMatch(client, context, draft);
  if (!options.forceCreateCustomer && best && best.score >= 70) return { customerId: best.id, created: false };

  const displayName = clean(draft.customerName) || `Customer ${clean(draft.customerNumber)}`;
  const { data, error } = await client
    .from('customers')
    .insert({
      organization_id: context.organizationId,
      location_id: context.locationId || null,
      display_name: displayName,
      phone: clean(draft.phone) || null,
      address: draft.address ? { formatted: clean(draft.address) } : {},
      source: 'forge-crm-quote-intake',
      metadata: draft.customerNumber ? { external_customer_number: clean(draft.customerNumber) } : {},
      created_by: context.userId
    })
    .select('id')
    .single();
  if (error) throw error;
  return { customerId: data.id, created: true };
}

async function resolveProject(client: SupabaseClientLike, context: ForgeCoreContext, draft: QuoteIntakeDraft, customerId: string) {
  const projectName = clean(draft.projectName);
  if (!projectName) return { projectId: undefined, created: false };
  const { data: existing, error: lookupError } = await client
    .from('projects')
    .select('id')
    .eq('organization_id', context.organizationId)
    .eq('customer_id', customerId)
    .ilike('name', projectName)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { projectId: existing.id, created: false };

  const { data, error } = await client
    .from('projects')
    .insert({
      organization_id: context.organizationId,
      location_id: context.locationId || null,
      customer_id: customerId,
      name: projectName,
      status: 'quoted',
      address: draft.address ? { formatted: clean(draft.address) } : {},
      source: 'forge-crm-quote-intake',
      created_by: context.userId
    })
    .select('id')
    .single();
  if (error) throw error;
  return { projectId: data.id, created: true };
}

export async function commitQuoteToForgeCore(draft: QuoteIntakeDraft, file: File, options: CoreQuoteCommitOptions = {}): Promise<CoreQuoteCommitResult> {
  const context = await getForgeCoreContext();
  if (!context) throw new Error('Sign in to Forge Core before importing this quote.');
  if (!context.organizationId) throw new Error('Your Forge Core account exists but is not assigned to an organization yet.');

  const client = await getForgeCoreClient();
  const documentResult = await ensureDocument(client, context, draft, file);
  const customerResult = await resolveCustomer(client, context, draft, options);
  const projectResult = await resolveProject(client, context, draft, customerResult.customerId);

  await client.from('documents').update({
    customer_id: customerResult.customerId,
    project_id: projectResult.projectId || null
  }).eq('id', documentResult.document.id).eq('organization_id', context.organizationId);

  const { data: existingQuote, error: quoteLookupError } = await client
    .from('quotes')
    .select('id, current_revision')
    .eq('organization_id', context.organizationId)
    .eq('quote_number', clean(draft.quoteNumber))
    .maybeSingle();
  if (quoteLookupError) throw quoteLookupError;

  let quoteId: string;
  let revisionNumber = 0;
  let createdQuote = false;
  if (existingQuote) {
    quoteId = existingQuote.id;
    revisionNumber = Number(existingQuote.current_revision || 0) + 1;
    const { error: updateQuoteError } = await client.from('quotes').update({
      customer_id: customerResult.customerId,
      project_id: projectResult.projectId || null,
      location_id: context.locationId || null,
      current_revision: revisionNumber,
      title: clean(draft.projectName) || `Quote ${clean(draft.quoteNumber)}`,
      subtotal: draft.subtotal,
      total: draft.subtotal,
      quote_date: draft.quoteDate || null,
      source_document_id: documentResult.document.id,
      source: 'forge-crm-quote-intake',
      updated_at: new Date().toISOString()
    }).eq('id', quoteId).eq('organization_id', context.organizationId);
    if (updateQuoteError) throw updateQuoteError;
  } else {
    const { data: quote, error: insertQuoteError } = await client.from('quotes').insert({
      organization_id: context.organizationId,
      location_id: context.locationId || null,
      customer_id: customerResult.customerId,
      project_id: projectResult.projectId || null,
      quote_number: clean(draft.quoteNumber),
      status: 'sent',
      current_revision: 0,
      title: clean(draft.projectName) || `Quote ${clean(draft.quoteNumber)}`,
      currency: 'CAD',
      subtotal: draft.subtotal,
      total: draft.subtotal,
      quote_date: draft.quoteDate || null,
      source_document_id: documentResult.document.id,
      source: 'forge-crm-quote-intake',
      metadata: { original_filename: draft.fileName },
      created_by: context.userId
    }).select('id').single();
    if (insertQuoteError) throw insertQuoteError;
    quoteId = quote.id;
    createdQuote = true;
  }

  const { error: revisionError } = await client.from('quote_revisions').insert({
    organization_id: context.organizationId,
    quote_id: quoteId,
    revision_number: revisionNumber,
    document_id: documentResult.document.id,
    subtotal: draft.subtotal,
    total: draft.subtotal,
    description: clean(draft.projectName) || null,
    raw_items: [],
    metadata: { original_filename: draft.fileName },
    created_by: context.userId
  });
  if (revisionError) throw revisionError;

  const activityTitle = createdQuote ? `Quote ${draft.quoteNumber} imported` : `Quote ${draft.quoteNumber} revision ${revisionNumber} imported`;
  const { error: activityError } = await client.from('activities').insert({
    organization_id: context.organizationId,
    location_id: context.locationId || null,
    customer_id: customerResult.customerId,
    project_id: projectResult.projectId || null,
    quote_id: quoteId,
    activity_type: createdQuote ? 'quote_imported' : 'quote_revised',
    title: activityTitle,
    body: `${clean(draft.projectName) || 'No project name'} — $${draft.subtotal.toFixed(2)} before tax`,
    metadata: { source: 'desktop-pdf' },
    created_by: context.userId
  });
  if (activityError) console.warn('Forge Core activity write failed', activityError);

  if (createdQuote) {
    const due = new Date(`${draft.quoteDate || new Date().toISOString().slice(0, 10)}T12:00:00`);
    due.setDate(due.getDate() + 7);
    const { error: taskError } = await client.from('tasks').insert({
      organization_id: context.organizationId,
      location_id: context.locationId || null,
      customer_id: customerResult.customerId,
      project_id: projectResult.projectId || null,
      assigned_to: context.userId,
      title: `Follow up — ${clean(draft.customerName || draft.customerNumber)} — ${draft.quoteNumber}`,
      status: 'open',
      priority: 'normal',
      due_at: due.toISOString(),
      metadata: { quote_id: quoteId, source: 'quote-intake' },
      created_by: context.userId
    });
    if (taskError) console.warn('Forge Core follow-up task write failed', taskError);
  }

  await client.from('events').insert({
    organization_id: context.organizationId,
    location_id: context.locationId || null,
    entity_type: 'quote',
    entity_id: quoteId,
    action: createdQuote ? 'created_from_pdf' : 'revision_added_from_pdf',
    payload: { revision_number: revisionNumber, document_id: documentResult.document.id },
    source: 'forge-crm-quote-intake',
    actor_user_id: context.userId
  });

  return {
    organizationId: context.organizationId,
    customerId: customerResult.customerId,
    projectId: projectResult.projectId,
    quoteId,
    revisionNumber,
    documentId: documentResult.document.id,
    createdCustomer: customerResult.created,
    createdProject: projectResult.created,
    createdQuote,
    reusedDocument: documentResult.reused
  };
}
