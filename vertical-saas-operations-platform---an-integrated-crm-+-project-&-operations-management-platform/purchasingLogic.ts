// Pure helpers for Purchasing / Delivery boards. No imports so they stay trivially testable.

export interface ReceiptItemLike {
  id: string;
  description?: string;
  unit?: string;
  unitCost?: number;
  quantityOrdered: number;
  quantityReceived: number;
}

export const remainingQty = (item: Pick<ReceiptItemLike, 'quantityOrdered' | 'quantityReceived'>) =>
  Math.max(0, Number(item.quantityOrdered || 0) - Number(item.quantityReceived || 0));

/** Receipt quantities start at ZERO; the user must opt in to receiving anything. */
export const defaultReceiptDraft = (items: ReceiptItemLike[]): Record<string, number> =>
  Object.fromEntries(items.map(item => [item.id, 0]));

/** "Fill remaining" action: every line set to its outstanding quantity. */
export const fillRemainingDraft = (items: ReceiptItemLike[]): Record<string, number> =>
  Object.fromEntries(items.map(item => [item.id, remainingQty(item)]));

/** Keep an entered quantity within 0..remaining; junk becomes 0. */
export const clampReceiptQty = (value: unknown, remaining: number) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, Math.max(0, remaining));
};

export interface ReceiptPreviewLine { id: string; description: string; unit: string; quantity: number; remainingAfter: number; value: number; }
export interface ReceiptPreview { lines: ReceiptPreviewLine[]; lineCount: number; totalValue: number; }

/** What will actually be posted: only lines with quantity > 0, clamped to outstanding. */
export const buildReceiptPreview = (items: ReceiptItemLike[], draft: Record<string, number>): ReceiptPreview => {
  const lines: ReceiptPreviewLine[] = [];
  for (const item of items) {
    const remaining = remainingQty(item);
    const quantity = clampReceiptQty(draft[item.id] ?? 0, remaining);
    if (quantity <= 0) continue;
    lines.push({
      id: item.id,
      description: item.description || 'Item',
      unit: item.unit || 'unit',
      quantity,
      remainingAfter: remaining - quantity,
      value: Math.round(quantity * Number(item.unitCost || 0) * 100) / 100
    });
  }
  return { lines, lineCount: lines.length, totalValue: Math.round(lines.reduce((s, l) => s + l.value, 0) * 100) / 100 };
};

/** 0.13 -> "13%", 0.0875 -> "8.75%". */
export const formatTaxRate = (rate: number) => {
  const pct = Math.round(Number(rate || 0) * 10000) / 100;
  return `${pct}%`;
};

export const taxRateToPercent = (rate: number) => Math.round(Number(rate || 0) * 10000) / 100;
export const percentToTaxRate = (percent: unknown) => {
  const n = Number(percent);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 10000 : 0;
};

export const computePoTotals = (subtotal: number, taxRate: number) => {
  const sub = Math.round(Number(subtotal || 0) * 100) / 100;
  const tax = Math.round(sub * Number(taxRate || 0) * 100) / 100;
  return { subtotal: sub, tax, total: Math.round((sub + tax) * 100) / 100 };
};

/** Latest-request-wins guard: only the most recently begun request may apply its result. */
export const createLatestGuard = () => {
  let latest = 0;
  return {
    begin: () => ++latest,
    isCurrent: (id: number) => id === latest,
    invalidate: () => { latest += 1; }
  };
};

/** Heading/lines may only render for a PO whose lines have actually loaded. */
export const poDetailsReady = (selectedId: string | null | undefined, loadedId: string | null | undefined) =>
  !!selectedId && selectedId === loadedId;

export type ListViewState = 'loading' | 'failed' | 'disconnected' | 'empty' | 'ready';

/** A failed load must never look like "no work", and counts only appear after a successful load. */
export const listViewState = (input: { loading: boolean; loaded: boolean; error?: string; connected: boolean; count: number }): ListViewState => {
  if (input.error) return 'failed';
  if (!input.loaded) return 'loading';
  if (!input.connected) return 'disconnected';
  return input.count > 0 ? 'ready' : 'empty';
};
