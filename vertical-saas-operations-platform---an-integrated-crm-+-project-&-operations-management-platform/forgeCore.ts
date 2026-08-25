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

interface PreparedDocument {
  sha256: string;
  existingDocumentId?: string;
  storagePath?: string;
  uploaded: boolean;
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
        global: { headers: { 'x-forge-module': 'crm' } }
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

  return (data || [])
    .map((customer: any) => scoreCustomer(draft, customer))
    .filter((match: CoreCustomerMatch) => match.score > 0)
    .sort((a: CoreCustomerMatch, b: CoreCustomerMatch) => b.score - a.score)[0];
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

async function prepareDocumentUpload(client: SupabaseClientLike, context: ForgeCoreContext, draft: QuoteIntakeDraft, file: File): Promise<PreparedDocument> {
  const sha256 = await sha256File(file);
  const { data: existingDocument, error: lookupError } = await client
    .from('documents')
    .select('id')
    .eq('organization_id', context.organizationId)
    .eq('sha256', sha256)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existingDocument) return { sha256, existingDocumentId: existingDocument.id, uploaded: false };

  const quoteFolder = safeSegment(draft.quoteNumber || 'unassigned');
  const storagePath = `${context.organizationId}/quotes/${quoteFolder}/${crypto.randomUUID()}-${safeSegment(file.name)}`;
  const { error: uploadError } = await client.storage
    .from(FORGE_CORE_CONFIG.documentBucket)
    .upload(storagePath, file, { contentType: file.type || 'application/pdf', upsert: false });
  if (uploadError) throw uploadError;

  return { sha256, storagePath, uploaded: true };
}

async function removeUploadedFile(client: SupabaseClientLike, prepared: PreparedDocument) {
  if (!prepared.uploaded || !prepared.storagePath) return;
  const { error } = await client.storage.from(FORGE_CORE_CONFIG.documentBucket).remove([prepared.storagePath]);
  if (error) console.warn('Forge could not clean up an uncommitted PDF upload', error);
}

export async function commitQuoteToForgeCore(draft: QuoteIntakeDraft, file: File, options: CoreQuoteCommitOptions = {}): Promise<CoreQuoteCommitResult> {
  const context = await getForgeCoreContext();
  if (!context) throw new Error('Sign in to Forge Core before importing this quote.');
  if (!context.organizationId) throw new Error('Your Forge Core account exists but is not assigned to an organization yet.');
  if (context.role === 'viewer') throw new Error('Your Forge Core role is read-only.');

  const client = await getForgeCoreClient();
  const prepared = await prepareDocumentUpload(client, context, draft, file);

  let customerId = options.customerIdOverride;
  if (!customerId && !options.forceCreateCustomer) {
    const best = await getBestCustomerMatch(client, context, draft);
    if (best?.score >= 70) customerId = best.id;
  }

  const customerData = {
    display_name: clean(draft.customerName) || (draft.customerNumber ? `Customer ${clean(draft.customerNumber)}` : ''),
    phone: clean(draft.phone) || null,
    external_customer_number: clean(draft.customerNumber) || null,
    address: draft.address ? { formatted: clean(draft.address) } : {}
  };

  try {
    const { data, error } = await client.rpc('commit_quote_intake_v1', {
      p_organization_id: context.organizationId,
      p_location_id: context.locationId || null,
      p_quote_number: clean(draft.quoteNumber),
      p_quote_date: draft.quoteDate || null,
      p_subtotal: draft.subtotal,
      p_original_filename: file.name,
      p_existing_document_id: prepared.existingDocumentId || null,
      p_storage_bucket: FORGE_CORE_CONFIG.documentBucket,
      p_storage_path: prepared.storagePath || null,
      p_mime_type: file.type || 'application/pdf',
      p_file_size_bytes: file.size,
      p_sha256: prepared.sha256,
      p_customer_id: customerId || null,
      p_customer_data: customerData,
      p_project_name: clean(draft.projectName) || null,
      p_project_address: draft.address ? { formatted: clean(draft.address) } : {}
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.quote_id || !row?.document_id) throw new Error('Forge Core did not return a completed quote transaction.');

    if (prepared.uploaded && row.reused_document) await removeUploadedFile(client, prepared);

    return {
      organizationId: row.organization_id,
      customerId: row.customer_id,
      projectId: row.project_id || undefined,
      quoteId: row.quote_id,
      revisionNumber: Number(row.revision_number || 0),
      documentId: row.document_id,
      createdCustomer: Boolean(row.created_customer),
      createdProject: Boolean(row.created_project),
      createdQuote: Boolean(row.created_quote),
      reusedDocument: Boolean(row.reused_document)
    };
  } catch (error) {
    await removeUploadedFile(client, prepared);
    throw error;
  }
}
