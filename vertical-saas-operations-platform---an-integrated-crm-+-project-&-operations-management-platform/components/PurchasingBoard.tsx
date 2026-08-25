import React, { useEffect, useMemo, useState } from 'react';
import {
  createPurchaseOrder,
  loadCurrentQuoteLines,
  loadPurchaseOrderItems,
  loadPurchasingWorkspace,
  receivePurchaseOrder,
  schedulePurchaseOrderDelivery,
  type PurchaseOrderItemDetail,
  type PurchaseOrderSummary,
  type PurchasingQuoteLine,
  type PurchasingWorkspace
} from '../forgePurchasing';

const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value || 0));
const dateText = (value?: string) => value ? new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—';

export const PurchasingBoard: React.FC = () => {
  const [workspace, setWorkspace] = useState<PurchasingWorkspace>({ context: null, quotes: [], vendors: [], purchaseOrders: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [quoteId, setQuoteId] = useState('');
  const [quoteLines, setQuoteLines] = useState<PurchasingQuoteLine[]>([]);
  const [lineDrafts, setLineDrafts] = useState<Record<string, { selected: boolean; quantity: number; unitCost: number }>>({});
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [taxRate, setTaxRate] = useState(0.13);
  const [notes, setNotes] = useState('');

  const [selectedPo, setSelectedPo] = useState<PurchaseOrderSummary | null>(null);
  const [poItems, setPoItems] = useState<PurchaseOrderItemDetail[]>([]);
  const [receiptDraft, setReceiptDraft] = useState<Record<string, number>>({});
  const [packingSlip, setPackingSlip] = useState('');
  const [deliveryStart, setDeliveryStart] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try { setWorkspace(await loadPurchasingWorkspace()); }
    catch (err: any) { setError(err?.message || 'Could not load Forge Purchasing.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const quote = workspace.quotes.find(item => item.id === quoteId);
    if (!quote) {
      setQuoteLines([]);
      setLineDrafts({});
      return;
    }
    setBusy(true);
    setError('');
    void loadCurrentQuoteLines(quote).then(lines => {
      setQuoteLines(lines);
      setLineDrafts(Object.fromEntries(lines.map(line => [line.id, { selected: true, quantity: line.quantity, unitCost: line.unitCost }])));
    }).catch((err: any) => setError(err?.message || 'Could not load current quote lines.')).finally(() => setBusy(false));
  }, [quoteId, workspace.quotes]);

  const selectedLines = useMemo(() => quoteLines.filter(line => lineDrafts[line.id]?.selected), [quoteLines, lineDrafts]);
  const poDraftSubtotal = useMemo(() => selectedLines.reduce((sum, line) => {
    const draft = lineDrafts[line.id];
    return sum + Number(draft?.quantity || 0) * Number(draft?.unitCost || 0);
  }, 0), [selectedLines, lineDrafts]);

  const metrics = useMemo(() => ({
    open: workspace.purchaseOrders.filter(po => !['received', 'cancelled'].includes(po.status)).length,
    partial: workspace.purchaseOrders.filter(po => po.status === 'partial').length,
    received: workspace.purchaseOrders.filter(po => po.status === 'received').length,
    committed: workspace.purchaseOrders.reduce((sum, po) => sum + po.total, 0)
  }), [workspace.purchaseOrders]);

  const createPo = async () => {
    if (!quoteId || !poNumber.trim() || (!vendorId && !vendorName.trim()) || !selectedLines.length) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await createPurchaseOrder({
        quoteId,
        vendorId: vendorId || undefined,
        vendorName: vendorId ? undefined : vendorName.trim(),
        poNumber: poNumber.trim(),
        expectedDate: expectedDate || undefined,
        taxRate,
        notes: notes || undefined,
        lines: selectedLines.map(line => ({
          quoteItemId: line.id,
          quantity: Number(lineDrafts[line.id]?.quantity || 0),
          unitCost: Number(lineDrafts[line.id]?.unitCost || 0)
        }))
      });
      setMessage(`PO ${poNumber.trim()} created in Forge Core — ${result.item_count} lines, ${money(Number(result.total || 0))}.`);
      setPoNumber(''); setExpectedDate(''); setNotes(''); setVendorName('');
      await refresh();
    } catch (err: any) { setError(err?.message || 'Could not create purchase order.'); }
    finally { setBusy(false); }
  };

  const openPo = async (po: PurchaseOrderSummary) => {
    setSelectedPo(po); setBusy(true); setError(''); setPackingSlip(''); setDeliveryStart('');
    try {
      const items = await loadPurchaseOrderItems(po.id);
      setPoItems(items);
      setReceiptDraft(Object.fromEntries(items.map(item => [item.id, Math.max(0, item.quantityOrdered - item.quantityReceived)])));
    } catch (err: any) { setError(err?.message || 'Could not load PO lines.'); }
    finally { setBusy(false); }
  };

  const receive = async () => {
    if (!selectedPo) return;
    const lines = poItems.map(item => ({ purchaseOrderItemId: item.id, quantityReceived: Number(receiptDraft[item.id] || 0) })).filter(line => line.quantityReceived > 0);
    if (!lines.length) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await receivePurchaseOrder({ purchaseOrderId: selectedPo.id, packingSlip: packingSlip || undefined, lines });
      setMessage(`Receipt posted to ${selectedPo.poNumber}. PO status: ${result?.status || 'updated'}.`);
      await refresh();
      const fresh = await loadPurchaseOrderItems(selectedPo.id);
      setPoItems(fresh);
      setReceiptDraft(Object.fromEntries(fresh.map(item => [item.id, Math.max(0, item.quantityOrdered - item.quantityReceived)])));
    } catch (err: any) { setError(err?.message || 'Could not receive purchase order.'); }
    finally { setBusy(false); }
  };

  const scheduleInbound = async () => {
    if (!selectedPo || !deliveryStart) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await schedulePurchaseOrderDelivery({
        purchaseOrderId: selectedPo.id,
        deliveryNumber: `IN-${selectedPo.poNumber}`,
        scheduledStart: new Date(deliveryStart).toISOString(),
        notes: `Inbound vendor delivery for ${selectedPo.poNumber}`
      });
      setMessage(`Inbound delivery for ${selectedPo.poNumber} added to Forge Operations.`);
      setDeliveryStart('');
    } catch (err: any) { setError(err?.message || 'Could not schedule inbound delivery.'); }
    finally { setBusy(false); }
  };

  if (!workspace.context?.organizationId && !loading) {
    return <div className="forge-card p-8 max-w-2xl"><h2 className="text-xl font-black text-white">Connect Forge Core</h2><p className="forge-secondary mt-2">Purchasing is Core-native. Use CORE SIGN IN in the Forge header, then return here.</p></div>;
  }

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div><div className="text-[10px] uppercase tracking-[.2em] forge-muted font-black">Forge Purchasing</div><h1 className="text-2xl font-black text-white mt-1">Purchase Orders & Receiving</h1><p className="forge-secondary text-sm mt-1">Quote lines → vendor PO → receipts → inbound Operations.</p></div>
      <button onClick={() => void refresh()} disabled={loading || busy} className="forge-button-secondary px-4 py-2 rounded-lg text-sm font-bold">{loading ? 'Loading…' : 'Refresh Core'}</button>
    </div>

    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm">{error}</div>}
    {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">{message}</div>}

    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[['Open POs', metrics.open], ['Partially received', metrics.partial], ['Received', metrics.received], ['PO value', money(metrics.committed)]].map(([label, value]) => <div key={String(label)} className="forge-card p-4"><div className="text-[10px] uppercase tracking-wider forge-muted font-black">{label}</div><div className="text-2xl font-black text-white mt-2">{value}</div></div>)}
    </div>

    <div className="grid 2xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,.8fr)] gap-6 items-start">
      <section className="forge-card p-5 space-y-5">
        <div><div className="text-[10px] uppercase tracking-[.18em] forge-muted font-black">Create PO</div><h2 className="text-lg font-black text-white mt-1">Order from a priced quote</h2></div>
        <div className="grid md:grid-cols-2 gap-3">
          <label><span className="text-[10px] uppercase tracking-wider forge-muted font-black">Quote</span><select className="forge-input w-full mt-1 p-2.5 rounded-lg" value={quoteId} onChange={e => setQuoteId(e.target.value)}><option value="">Select quote…</option>{workspace.quotes.map(q => <option value={q.id} key={q.id}>{q.quoteNumber} — {q.customerName || q.projectName || q.title}</option>)}</select></label>
          <label><span className="text-[10px] uppercase tracking-wider forge-muted font-black">Existing vendor</span><select className="forge-input w-full mt-1 p-2.5 rounded-lg" value={vendorId} onChange={e => { setVendorId(e.target.value); if (e.target.value) setVendorName(''); }}><option value="">New vendor…</option>{workspace.vendors.map(v => <option value={v.id} key={v.id}>{v.name}</option>)}</select></label>
          {!vendorId && <label><span className="text-[10px] uppercase tracking-wider forge-muted font-black">New vendor name</span><input className="forge-input w-full mt-1 p-2.5 rounded-lg" value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Supplier / vendor" /></label>}
          <label><span className="text-[10px] uppercase tracking-wider forge-muted font-black">PO number</span><input className="forge-input w-full mt-1 p-2.5 rounded-lg" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="PO-2026-001" /></label>
          <label><span className="text-[10px] uppercase tracking-wider forge-muted font-black">Expected date</span><input type="date" className="forge-input w-full mt-1 p-2.5 rounded-lg" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></label>
          <label><span className="text-[10px] uppercase tracking-wider forge-muted font-black">Tax rate</span><input type="number" step="0.01" min="0" max="1" className="forge-input w-full mt-1 p-2.5 rounded-lg" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} /></label>
        </div>
        <label className="block"><span className="text-[10px] uppercase tracking-wider forge-muted font-black">Notes</span><textarea className="forge-input w-full mt-1 p-2.5 rounded-lg min-h-20" value={notes} onChange={e => setNotes(e.target.value)} /></label>

        {quoteLines.length > 0 ? <div className="overflow-x-auto border rounded-xl" style={{ borderColor: 'var(--forge-border-soft)' }}><table className="w-full text-sm"><thead><tr className="forge-muted text-[10px] uppercase tracking-wider text-left"><th className="p-3">Order</th><th className="p-3">Material</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">Extended</th></tr></thead><tbody>{quoteLines.map(line => { const draft = lineDrafts[line.id] || { selected: false, quantity: line.quantity, unitCost: line.unitCost }; return <tr key={line.id} className="border-t" style={{ borderColor: 'var(--forge-border-soft)' }}><td className="p-3"><input type="checkbox" checked={draft.selected} onChange={e => setLineDrafts(old => ({ ...old, [line.id]: { ...draft, selected: e.target.checked } }))} /></td><td className="p-3"><strong className="text-white block">{line.description}</strong><span className="forge-muted text-xs">{line.sku || 'No SKU'} • {line.unit || 'unit'}</span></td><td className="p-3"><input type="number" min="0" step="0.01" className="forge-input w-24 p-2 rounded-lg text-right" value={draft.quantity} onChange={e => setLineDrafts(old => ({ ...old, [line.id]: { ...draft, quantity: Number(e.target.value) } }))} /></td><td className="p-3"><input type="number" min="0" step="0.01" className="forge-input w-28 p-2 rounded-lg text-right" value={draft.unitCost} onChange={e => setLineDrafts(old => ({ ...old, [line.id]: { ...draft, unitCost: Number(e.target.value) } }))} /></td><td className="p-3 text-right font-bold text-white">{money(draft.quantity * draft.unitCost)}</td></tr>; })}</tbody></table></div> : quoteId ? <div className="forge-muted text-sm">This quote has no current Core line items.</div> : null}

        <div className="flex items-center justify-between gap-4 border-t pt-4" style={{ borderColor: 'var(--forge-border-soft)' }}><div><div className="text-[10px] uppercase forge-muted font-black">Draft cost</div><div className="text-xl font-black text-white">{money(poDraftSubtotal)} <span className="text-sm forge-muted font-medium">+ tax</span></div></div><button onClick={() => void createPo()} disabled={busy || !quoteId || !poNumber.trim() || (!vendorId && !vendorName.trim()) || !selectedLines.length} className="px-5 py-3 rounded-xl font-black text-sm text-black disabled:opacity-40" style={{ background: 'var(--forge-accent)' }}>{busy ? 'Working…' : 'Create Purchase Order'}</button></div>
      </section>

      <section className="forge-card p-5 space-y-4">
        <div><div className="text-[10px] uppercase tracking-[.18em] forge-muted font-black">Core history</div><h2 className="text-lg font-black text-white mt-1">Recent purchase orders</h2></div>
        <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">{workspace.purchaseOrders.map(po => <button key={po.id} onClick={() => void openPo(po)} className={`w-full text-left rounded-xl border p-3 transition ${selectedPo?.id === po.id ? 'forge-nav-active' : 'forge-nav-item'}`} style={{ borderColor: 'var(--forge-border-soft)' }}><div className="flex justify-between gap-3"><div><strong className="text-white">{po.poNumber}</strong><div className="forge-secondary text-xs mt-1">{po.vendorName}{po.quoteNumber ? ` • ${po.quoteNumber}` : ''}</div></div><div className="text-right"><div className="text-white font-bold">{money(po.total)}</div><div className="forge-muted text-[10px] uppercase mt-1">{po.status}</div></div></div><div className="forge-muted text-[10px] mt-2">Expected {dateText(po.expectedDate)} • {po.receivedCount}/{po.itemCount} lines complete</div></button>)}{!workspace.purchaseOrders.length && <div className="forge-muted text-sm py-8 text-center">No Core purchase orders yet.</div>}</div>
      </section>
    </div>

    {selectedPo && <section className="forge-card p-5 space-y-5">
      <div className="flex flex-wrap justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[.18em] forge-muted font-black">Receiving & Operations</div><h2 className="text-lg font-black text-white mt-1">{selectedPo.poNumber} — {selectedPo.vendorName}</h2></div><div className="forge-muted text-xs">{selectedPo.status.toUpperCase()} • {money(selectedPo.total)}</div></div>
      <div className="overflow-x-auto border rounded-xl" style={{ borderColor: 'var(--forge-border-soft)' }}><table className="w-full text-sm"><thead><tr className="forge-muted text-[10px] uppercase tracking-wider text-left"><th className="p-3">Material</th><th className="p-3 text-right">Ordered</th><th className="p-3 text-right">Received</th><th className="p-3 text-right">Receive now</th></tr></thead><tbody>{poItems.map(item => { const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived); return <tr key={item.id} className="border-t" style={{ borderColor: 'var(--forge-border-soft)' }}><td className="p-3"><strong className="text-white">{item.description}</strong><div className="forge-muted text-xs">{item.sku || 'No SKU'} • {money(item.unitCost)} / {item.unit || 'unit'}</div></td><td className="p-3 text-right">{item.quantityOrdered}</td><td className="p-3 text-right">{item.quantityReceived}</td><td className="p-3 text-right"><input type="number" min="0" max={remaining} step="0.01" className="forge-input w-28 p-2 rounded-lg text-right" value={receiptDraft[item.id] ?? remaining} disabled={remaining <= 0} onChange={e => setReceiptDraft(old => ({ ...old, [item.id]: Number(e.target.value) }))} /></td></tr>; })}</tbody></table></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--forge-border-soft)' }}><div className="text-[10px] uppercase tracking-wider forge-muted font-black">Post receipt</div><div className="flex gap-2 mt-3"><input className="forge-input flex-1 p-2.5 rounded-lg" value={packingSlip} onChange={e => setPackingSlip(e.target.value)} placeholder="Packing slip / receipt #" /><button onClick={() => void receive()} disabled={busy || !poItems.some(item => Number(receiptDraft[item.id] || 0) > 0)} className="px-4 py-2 rounded-lg font-bold text-sm text-black disabled:opacity-40" style={{ background: 'var(--forge-accent)' }}>Receive</button></div></div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--forge-border-soft)' }}><div className="text-[10px] uppercase tracking-wider forge-muted font-black">Schedule inbound</div><div className="flex gap-2 mt-3"><input type="datetime-local" className="forge-input flex-1 p-2.5 rounded-lg" value={deliveryStart} onChange={e => setDeliveryStart(e.target.value)} /><button onClick={() => void scheduleInbound()} disabled={busy || !deliveryStart} className="forge-button-secondary px-4 py-2 rounded-lg font-bold text-sm">Add to Delivery</button></div></div>
      </div>
    </section>}
  </div>;
};
