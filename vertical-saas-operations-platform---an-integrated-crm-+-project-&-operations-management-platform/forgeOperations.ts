import { getForgeCoreClient, getForgeCoreContext, type ForgeCoreContext } from './forgeCore';

export type CoreDeliveryStatus = 'planned' | 'confirmed' | 'picked' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';

export interface OperationsProject {
  id: string;
  name: string;
  customerId?: string;
  customerName?: string;
  address?: Record<string, any>;
}

export interface OperationsQuote {
  id: string;
  quoteNumber: string;
  projectId?: string;
  customerId?: string;
}

export interface OperationsPurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  projectId?: string;
  quoteId?: string;
  status: string;
}

export interface CoreDeliveryRecord {
  id: string;
  deliveryNumber?: string;
  direction: 'inbound' | 'outbound';
  status: CoreDeliveryStatus;
  scheduledStart?: string;
  scheduledEnd?: string;
  customerId?: string;
  customerName?: string;
  projectId?: string;
  projectName?: string;
  quoteId?: string;
  quoteNumber?: string;
  purchaseOrderId?: string;
  poNumber?: string;
  vendorName?: string;
  address: Record<string, any>;
  notes?: string;
  truck?: string;
  driver?: string;
  loadType?: string;
  stopSequence: number;
  createdAt: string;
}

export interface OperationsWorkspace {
  context: ForgeCoreContext | null;
  projects: OperationsProject[];
  quotes: OperationsQuote[];
  purchaseOrders: OperationsPurchaseOrder[];
  deliveries: CoreDeliveryRecord[];
}

export async function loadOperationsWorkspace(): Promise<OperationsWorkspace> {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) return { context, projects: [], quotes: [], purchaseOrders: [], deliveries: [] };
  const client = await getForgeCoreClient();

  const [customersResult, projectsResult, quotesResult, vendorsResult, poResult, deliveriesResult] = await Promise.all([
    client.from('customers').select('id,display_name').eq('organization_id', context.organizationId),
    client.from('projects').select('id,name,customer_id,address').eq('organization_id', context.organizationId).order('name'),
    client.from('quotes').select('id,quote_number,project_id,customer_id').eq('organization_id', context.organizationId).order('created_at', { ascending: false }).limit(500),
    client.from('vendors').select('id,name').eq('organization_id', context.organizationId),
    client.from('purchase_orders').select('id,po_number,vendor_id,project_id,quote_id,status').eq('organization_id', context.organizationId).order('created_at', { ascending: false }).limit(500),
    client.from('deliveries')
      .select('id,delivery_number,direction,status,scheduled_start,scheduled_end,customer_id,project_id,quote_id,purchase_order_id,address,notes,truck,driver,load_type,stop_sequence,created_at')
      .eq('organization_id', context.organizationId)
      .order('scheduled_start', { ascending: true, nullsFirst: false })
      .limit(1000)
  ]);

  for (const result of [customersResult, projectsResult, quotesResult, vendorsResult, poResult, deliveriesResult]) {
    if (result.error) throw result.error;
  }

  const customerMap = new Map<string, string>((customersResult.data || []).map((row: any) => [String(row.id), String(row.display_name || '')]));
  const projectMap = new Map<string, any>((projectsResult.data || []).map((row: any) => [String(row.id), row]));
  const quoteMap = new Map<string, any>((quotesResult.data || []).map((row: any) => [String(row.id), row]));
  const vendorMap = new Map<string, string>((vendorsResult.data || []).map((row: any) => [String(row.id), String(row.name || '')]));
  const poMap = new Map<string, any>((poResult.data || []).map((row: any) => [String(row.id), row]));

  const projects: OperationsProject[] = (projectsResult.data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    customerId: row.customer_id || undefined,
    customerName: row.customer_id ? customerMap.get(String(row.customer_id)) || undefined : undefined,
    address: row.address || {}
  }));

  const quotes: OperationsQuote[] = (quotesResult.data || []).map((row: any) => ({
    id: row.id,
    quoteNumber: row.quote_number,
    projectId: row.project_id || undefined,
    customerId: row.customer_id || undefined
  }));

  const purchaseOrders: OperationsPurchaseOrder[] = (poResult.data || []).map((row: any) => ({
    id: row.id,
    poNumber: row.po_number,
    vendorName: vendorMap.get(String(row.vendor_id)) || 'Vendor',
    projectId: row.project_id || undefined,
    quoteId: row.quote_id || undefined,
    status: row.status
  }));

  const deliveries: CoreDeliveryRecord[] = (deliveriesResult.data || []).map((row: any) => {
    const project = row.project_id ? projectMap.get(String(row.project_id)) : undefined;
    const quote = row.quote_id ? quoteMap.get(String(row.quote_id)) : undefined;
    const po = row.purchase_order_id ? poMap.get(String(row.purchase_order_id)) : undefined;
    const customerId = row.customer_id || project?.customer_id || quote?.customer_id || undefined;
    return {
      id: row.id,
      deliveryNumber: row.delivery_number || undefined,
      direction: row.direction === 'inbound' ? 'inbound' : 'outbound',
      status: row.status as CoreDeliveryStatus,
      scheduledStart: row.scheduled_start || undefined,
      scheduledEnd: row.scheduled_end || undefined,
      customerId,
      customerName: customerId ? customerMap.get(String(customerId)) || undefined : undefined,
      projectId: row.project_id || undefined,
      projectName: project?.name || undefined,
      quoteId: row.quote_id || undefined,
      quoteNumber: quote?.quote_number || undefined,
      purchaseOrderId: row.purchase_order_id || undefined,
      poNumber: po?.po_number || undefined,
      vendorName: po ? vendorMap.get(String(po.vendor_id)) || 'Vendor' : undefined,
      address: row.address || {},
      notes: row.notes || undefined,
      truck: row.truck || undefined,
      driver: row.driver || undefined,
      loadType: row.load_type || undefined,
      stopSequence: Number(row.stop_sequence || 1),
      createdAt: row.created_at
    };
  });

  return { context, projects, quotes, purchaseOrders, deliveries };
}

export async function createCoreDelivery(input: {
  direction: 'inbound' | 'outbound';
  projectId?: string;
  quoteId?: string;
  purchaseOrderId?: string;
  deliveryNumber?: string;
  scheduledStart: string;
  scheduledEnd?: string;
  address?: Record<string, any>;
  notes?: string;
  truck?: string;
  driver?: string;
  loadType?: string;
  stopSequence?: number;
}) {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) throw new Error('Connect Forge Core first.');
  const client = await getForgeCoreClient();
  const { data: deliveryId, error } = await client.rpc('schedule_delivery_v1', {
    p_organization_id: context.organizationId,
    p_location_id: context.locationId || null,
    p_quote_id: input.quoteId || null,
    p_project_id: input.projectId || null,
    p_purchase_order_id: input.purchaseOrderId || null,
    p_delivery_number: input.deliveryNumber || null,
    p_direction: input.direction,
    p_scheduled_start: input.scheduledStart,
    p_scheduled_end: input.scheduledEnd || null,
    p_address: input.address || {},
    p_notes: input.notes || null
  });
  if (error) throw error;
  if (!deliveryId) throw new Error('Forge Core did not return a delivery ID.');

  if (input.truck || input.driver || input.loadType || input.stopSequence) {
    await updateCoreDelivery(String(deliveryId), {
      status: 'planned',
      truck: input.truck,
      driver: input.driver,
      loadType: input.loadType,
      stopSequence: input.stopSequence
    });
  }
  return String(deliveryId);
}

export async function updateCoreDelivery(deliveryId: string, input: {
  status?: CoreDeliveryStatus;
  scheduledStart?: string;
  scheduledEnd?: string;
  truck?: string;
  driver?: string;
  loadType?: string;
  stopSequence?: number;
  notes?: string;
}) {
  const client = await getForgeCoreClient();
  const { data, error } = await client.rpc('update_delivery_operations_v1', {
    p_delivery_id: deliveryId,
    p_status: input.status || null,
    p_scheduled_start: input.scheduledStart || null,
    p_scheduled_end: input.scheduledEnd || null,
    p_truck: input.truck ?? null,
    p_driver: input.driver ?? null,
    p_load_type: input.loadType ?? null,
    p_stop_sequence: input.stopSequence ?? null,
    p_notes: input.notes ?? null
  });
  if (error) throw error;
  return String(data || deliveryId);
}

export function coreAddressText(address?: Record<string, any>) {
  if (!address) return '';
  return address.formatted || address.address || address.street || [address.street1, address.city, address.province, address.postal_code].filter(Boolean).join(', ') || '';
}
