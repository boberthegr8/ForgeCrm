import { getForgeCoreClient, getForgeCoreContext, type ForgeCoreContext } from './forgeCore';

export interface PurchasingQuote {
  id: string;
  quoteNumber: string;
  title: string;
  status: string;
  currentRevision: number;
  projectId?: string;
  projectName?: string;
  customerId?: string;
  customerName?: string;
  subtotal: number;
}

export interface PurchasingVendor {
  id: string;
  name: string;
  accountNumber?: string;
  status: string;
}

export interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  status: string;
  vendorId: string;
  vendorName: string;
  quoteId?: string;
  quoteNumber?: string;
  projectId?: string;
  projectName?: string;
  expectedDate?: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  itemCount: number;
  receivedCount: number;
}

export interface PurchasingWorkspace {
  context: ForgeCoreContext | null;
  quotes: PurchasingQuote[];
  vendors: PurchasingVendor[];
  purchaseOrders: PurchaseOrderSummary[];
}

export interface PurchasingQuoteLine {
  id: string;
  lineNumber?: number;
  sku?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitCost: number;
  unitSell: number;
  lineTotal: number;
  takeoffItemId?: string;
}

export interface PurchaseOrderItemDetail {
  id: string;
  quoteItemId?: string;
  takeoffItemId?: string;
  sku?: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
  unit?: string;
  unitCost: number;
  lineTotal: number;
}

export async function loadPurchasingWorkspace(): Promise<PurchasingWorkspace> {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) return { context, quotes: [], vendors: [], purchaseOrders: [] };
  const client = await getForgeCoreClient();

  const [quotesResult, projectsResult, customersResult, vendorsResult, poResult, poItemsResult] = await Promise.all([
    client.from('quotes')
      .select('id,quote_number,title,description,status,current_revision,project_id,customer_id,subtotal,created_at')
      .eq('organization_id', context.organizationId)
      .order('created_at', { ascending: false })
      .limit(250),
    client.from('projects').select('id,name,customer_id').eq('organization_id', context.organizationId),
    client.from('customers').select('id,display_name').eq('organization_id', context.organizationId),
    client.from('vendors').select('id,name,account_number,status').eq('organization_id', context.organizationId).order('name'),
    client.from('purchase_orders')
      .select('id,po_number,status,vendor_id,quote_id,project_id,expected_date,subtotal,tax,total,created_at')
      .eq('organization_id', context.organizationId)
      .order('created_at', { ascending: false })
      .limit(250),
    client.from('purchase_order_items')
      .select('id,purchase_order_id,quantity_ordered,quantity_received')
      .eq('organization_id', context.organizationId)
  ]);

  for (const result of [quotesResult, projectsResult, customersResult, vendorsResult, poResult, poItemsResult]) {
    if (result.error) throw result.error;
  }

  const projectMap = new Map<string, any>((projectsResult.data || []).map((row: any) => [String(row.id), row]));
  const customerMap = new Map<string, string>((customersResult.data || []).map((row: any) => [String(row.id), String(row.display_name || '')]));
  const vendorMap = new Map<string, string>((vendorsResult.data || []).map((row: any) => [String(row.id), String(row.name || '')]));
  const quoteMap = new Map<string, string>((quotesResult.data || []).map((row: any) => [String(row.id), String(row.quote_number || '')]));
  const itemsByPo = new Map<string, any[]>();
  for (const item of poItemsResult.data || []) {
    const list = itemsByPo.get(String(item.purchase_order_id)) || [];
    list.push(item);
    itemsByPo.set(String(item.purchase_order_id), list);
  }

  const quotes: PurchasingQuote[] = (quotesResult.data || []).map((row: any) => {
    const project = row.project_id ? projectMap.get(String(row.project_id)) : undefined;
    const customerId = row.customer_id || project?.customer_id || undefined;
    return {
      id: row.id,
      quoteNumber: row.quote_number,
      title: row.title || row.description || `Quote ${row.quote_number}`,
      status: row.status,
      currentRevision: Number(row.current_revision || 0),
      projectId: row.project_id || undefined,
      projectName: project?.name || undefined,
      customerId,
      customerName: customerId ? customerMap.get(String(customerId)) || undefined : undefined,
      subtotal: Number(row.subtotal || 0)
    };
  });

  const purchaseOrders: PurchaseOrderSummary[] = (poResult.data || []).map((row: any) => {
    const items = itemsByPo.get(String(row.id)) || [];
    return {
      id: row.id,
      poNumber: row.po_number,
      status: row.status,
      vendorId: row.vendor_id,
      vendorName: vendorMap.get(String(row.vendor_id)) || 'Vendor',
      quoteId: row.quote_id || undefined,
      quoteNumber: row.quote_id ? quoteMap.get(String(row.quote_id)) || undefined : undefined,
      projectId: row.project_id || undefined,
      projectName: row.project_id ? projectMap.get(String(row.project_id))?.name || undefined : undefined,
      expectedDate: row.expected_date || undefined,
      subtotal: Number(row.subtotal || 0),
      tax: Number(row.tax || 0),
      total: Number(row.total || 0),
      createdAt: row.created_at,
      itemCount: items.length,
      receivedCount: items.filter((item: any) => Number(item.quantity_received || 0) >= Number(item.quantity_ordered || 0)).length
    };
  });

  return {
    context,
    quotes,
    vendors: (vendorsResult.data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      accountNumber: row.account_number || undefined,
      status: row.status
    })),
    purchaseOrders
  };
}

export async function loadCurrentQuoteLines(quote: PurchasingQuote): Promise<PurchasingQuoteLine[]> {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) throw new Error('Connect Forge Core first.');
  const client = await getForgeCoreClient();
  const { data: revisions, error: revisionError } = await client
    .from('quote_revisions')
    .select('id,revision_number')
    .eq('organization_id', context.organizationId)
    .eq('quote_id', quote.id)
    .eq('revision_number', quote.currentRevision)
    .limit(1);
  if (revisionError) throw revisionError;
  const revision = revisions?.[0];
  if (!revision) throw new Error('Current quote revision was not found in Forge Core.');

  const { data, error } = await client
    .from('quote_items')
    .select('id,line_number,sku,description,quantity,unit,unit_cost,unit_sell,line_total,metadata')
    .eq('organization_id', context.organizationId)
    .eq('quote_revision_id', revision.id)
    .order('line_number');
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    lineNumber: row.line_number ?? undefined,
    sku: row.sku || undefined,
    description: row.description,
    quantity: Number(row.quantity || 0),
    unit: row.unit || undefined,
    unitCost: Number(row.unit_cost || 0),
    unitSell: Number(row.unit_sell || 0),
    lineTotal: Number(row.line_total || 0),
    takeoffItemId: row.metadata?.takeoff_item_id || undefined
  }));
}

export async function createPurchaseOrder(input: {
  quoteId: string;
  vendorId?: string;
  vendorName?: string;
  poNumber: string;
  expectedDate?: string;
  taxRate: number;
  notes?: string;
  lines: Array<{ quoteItemId: string; quantity: number; unitCost: number }>;
}) {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) throw new Error('Connect Forge Core first.');
  const client = await getForgeCoreClient();
  const { data, error } = await client.rpc('commit_purchase_order_v1', {
    p_organization_id: context.organizationId,
    p_location_id: context.locationId || null,
    p_quote_id: input.quoteId,
    p_vendor_id: input.vendorId || null,
    p_vendor_name: input.vendorName || null,
    p_po_number: input.poNumber,
    p_expected_date: input.expectedDate || null,
    p_tax_rate: input.taxRate,
    p_notes: input.notes || null,
    p_items: input.lines.map(line => ({ quote_item_id: line.quoteItemId, quantity: line.quantity, unit_cost: line.unitCost }))
  });
  if (error) throw error;
  const result = data?.[0];
  if (!result?.purchase_order_id) throw new Error('Forge Core did not return a purchase order ID.');
  return result;
}

export async function loadPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItemDetail[]> {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) throw new Error('Connect Forge Core first.');
  const client = await getForgeCoreClient();
  const { data, error } = await client
    .from('purchase_order_items')
    .select('id,quote_item_id,takeoff_item_id,sku,description,quantity_ordered,quantity_received,unit,unit_cost,line_total')
    .eq('organization_id', context.organizationId)
    .eq('purchase_order_id', purchaseOrderId)
    .order('line_number');
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    quoteItemId: row.quote_item_id || undefined,
    takeoffItemId: row.takeoff_item_id || undefined,
    sku: row.sku || undefined,
    description: row.description,
    quantityOrdered: Number(row.quantity_ordered || 0),
    quantityReceived: Number(row.quantity_received || 0),
    unit: row.unit || undefined,
    unitCost: Number(row.unit_cost || 0),
    lineTotal: Number(row.line_total || 0)
  }));
}

export async function receivePurchaseOrder(input: {
  purchaseOrderId: string;
  packingSlip?: string;
  notes?: string;
  lines: Array<{ purchaseOrderItemId: string; quantityReceived: number }>;
}) {
  const client = await getForgeCoreClient();
  const { data, error } = await client.rpc('receive_purchase_order_v1', {
    p_purchase_order_id: input.purchaseOrderId,
    p_packing_slip: input.packingSlip || null,
    p_notes: input.notes || null,
    p_items: input.lines.map(line => ({ purchase_order_item_id: line.purchaseOrderItemId, quantity_received: line.quantityReceived }))
  });
  if (error) throw error;
  return data?.[0];
}

export async function schedulePurchaseOrderDelivery(input: {
  purchaseOrderId: string;
  deliveryNumber?: string;
  scheduledStart: string;
  scheduledEnd?: string;
  notes?: string;
}) {
  const context = await getForgeCoreContext();
  if (!context?.organizationId) throw new Error('Connect Forge Core first.');
  const client = await getForgeCoreClient();
  const { data, error } = await client.rpc('schedule_delivery_v1', {
    p_organization_id: context.organizationId,
    p_location_id: context.locationId || null,
    p_quote_id: null,
    p_project_id: null,
    p_purchase_order_id: input.purchaseOrderId,
    p_delivery_number: input.deliveryNumber || null,
    p_direction: 'inbound',
    p_scheduled_start: input.scheduledStart,
    p_scheduled_end: input.scheduledEnd || null,
    p_address: {},
    p_notes: input.notes || null
  });
  if (error) throw error;
  return data as string;
}
