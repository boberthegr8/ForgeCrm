import React, { useEffect, useMemo, useState } from 'react';
import { useForgeStore } from '../store';
import { ICONS } from '../constants';
import {
  coreAddressText,
  createCoreDelivery,
  loadOperationsWorkspace,
  updateCoreDelivery,
  type CoreDeliveryRecord,
  type CoreDeliveryStatus,
  type OperationsWorkspace
} from '../forgeOperations';

type BoardView = 'DAY' | 'WEEK' | 'MONTH' | 'REQUESTS';
const STATUS: CoreDeliveryStatus[] = ['planned', 'confirmed', 'picked', 'loaded', 'in_transit', 'delivered', 'cancelled'];
const LOAD_TYPES = ['Lumber', 'Roof / Truss', 'EWP', 'Siding', 'Drywall', 'Hardware', 'Vendor Inbound', 'Other'];

const dayKey = (value?: string) => value ? new Date(value).toISOString().slice(0, 10) : '';
const timeText = (value?: string) => value ? new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'Unscheduled';
const dateText = (value: string) => new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
const statusLabel = (value: string) => value.replace(/_/g, ' ').toUpperCase();

export const DeliveryBoard: React.FC = () => {
  const { data } = useForgeStore();
  const [workspace, setWorkspace] = useState<OperationsWorkspace>({ context: null, projects: [], quotes: [], purchaseOrders: [], deliveries: [] });
  const [view, setView] = useState<BoardView>('DAY');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<CoreDeliveryRecord | null>(null);

  const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [projectId, setProjectId] = useState('');
  const [quoteId, setQuoteId] = useState('');
  const [poId, setPoId] = useState('');
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [scheduledStart, setScheduledStart] = useState(`${selectedDate}T08:00`);
  const [address, setAddress] = useState('');
  const [truck, setTruck] = useState('');
  const [driver, setDriver] = useState('');
  const [loadType, setLoadType] = useState('Lumber');
  const [notes, setNotes] = useState('');

  const refresh = async () => {
    setLoading(true); setError('');
    try { setWorkspace(await loadOperationsWorkspace()); }
    catch (err: any) { setError(err?.message || 'Could not load Forge Operations.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (!showNew) setScheduledStart(`${selectedDate}T08:00`); }, [selectedDate, showNew]);

  const pendingLegacyRequests = useMemo(() => data.deliveryRequests.filter(request => request.status === 'PENDING'), [data.deliveryRequests]);
  const deliveriesForDate = (date: string) => workspace.deliveries
    .filter(delivery => dayKey(delivery.scheduledStart) === date)
    .sort((a, b) => (a.scheduledStart || '').localeCompare(b.scheduledStart || '') || a.stopSequence - b.stopSequence);
  const dayDeliveries = useMemo(() => deliveriesForDate(selectedDate), [workspace.deliveries, selectedDate]);

  const weekDays = useMemo(() => {
    const date = new Date(`${selectedDate}T12:00:00`);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const next = new Date(date);
      next.setDate(date.getDate() + i);
      return next.toISOString().slice(0, 10);
    });
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const date = new Date(`${selectedDate}T12:00:00`);
    const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index + 1).toISOString().slice(0, 10));
  }, [selectedDate]);

  const metrics = useMemo(() => ({
    today: deliveriesForDate(new Date().toISOString().slice(0, 10)).length,
    inbound: workspace.deliveries.filter(item => item.direction === 'inbound' && !['delivered', 'cancelled'].includes(item.status)).length,
    outbound: workspace.deliveries.filter(item => item.direction === 'outbound' && !['delivered', 'cancelled'].includes(item.status)).length,
    inTransit: workspace.deliveries.filter(item => item.status === 'in_transit').length
  }), [workspace.deliveries]);

  const resetNew = () => {
    setProjectId(''); setQuoteId(''); setPoId(''); setDeliveryNumber(''); setAddress(''); setTruck(''); setDriver(''); setLoadType('Lumber'); setNotes('');
    setScheduledStart(`${selectedDate}T08:00`);
  };

  const createDelivery = async () => {
    if (!scheduledStart || (direction === 'outbound' && !projectId && !quoteId) || (direction === 'inbound' && !poId)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await createCoreDelivery({
        direction,
        projectId: direction === 'outbound' ? projectId || undefined : undefined,
        quoteId: direction === 'outbound' ? quoteId || undefined : undefined,
        purchaseOrderId: direction === 'inbound' ? poId || undefined : undefined,
        deliveryNumber: deliveryNumber || undefined,
        scheduledStart: new Date(scheduledStart).toISOString(),
        address: address.trim() ? { formatted: address.trim() } : {},
        truck: truck || undefined,
        driver: driver || undefined,
        loadType: direction === 'inbound' ? 'Vendor Inbound' : loadType,
        notes: notes || undefined
      });
      setMessage('Delivery scheduled in Forge Core.');
      setShowNew(false); resetNew();
      await refresh();
    } catch (err: any) { setError(err?.message || 'Could not schedule delivery.'); }
    finally { setBusy(false); }
  };

  const updateDelivery = async (delivery: CoreDeliveryRecord, patch: Partial<CoreDeliveryRecord>) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await updateCoreDelivery(delivery.id, {
        status: patch.status,
        scheduledStart: patch.scheduledStart,
        scheduledEnd: patch.scheduledEnd,
        truck: patch.truck,
        driver: patch.driver,
        loadType: patch.loadType,
        stopSequence: patch.stopSequence,
        notes: patch.notes
      });
      setMessage(`${delivery.deliveryNumber || 'Delivery'} updated in Forge Core.`);
      await refresh();
      setEditing(current => current?.id === delivery.id ? null : current);
    } catch (err: any) { setError(err?.message || 'Could not update delivery.'); }
    finally { setBusy(false); }
  };

  const DeliveryCard = ({ delivery }: { delivery: CoreDeliveryRecord }) => (
    <div className="forge-card p-4 flex flex-col xl:flex-row xl:items-center gap-4">
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-black flex-shrink-0" style={{ background: 'var(--forge-accent)' }}>{delivery.stopSequence}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <strong className="text-white">{delivery.projectName || delivery.vendorName || delivery.customerName || delivery.poNumber || 'Unassigned delivery'}</strong>
          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${delivery.direction === 'inbound' ? 'bg-sky-500/15 text-sky-300' : 'bg-orange-500/15 text-orange-300'}`}>{delivery.direction}</span>
          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-white/5 forge-secondary">{delivery.loadType || 'Unclassified'}</span>
        </div>
        <div className="forge-muted text-xs mt-1">{timeText(delivery.scheduledStart)} • {delivery.deliveryNumber || 'No delivery #'}{delivery.poNumber ? ` • ${delivery.poNumber}` : ''}{delivery.quoteNumber ? ` • ${delivery.quoteNumber}` : ''}</div>
        {coreAddressText(delivery.address) && <div className="forge-secondary text-xs mt-1 truncate">{coreAddressText(delivery.address)}</div>}
      </div>
      <div className="grid sm:grid-cols-3 gap-2 xl:w-[520px]">
        <select disabled={busy} value={delivery.status} onChange={event => void updateDelivery(delivery, { status: event.target.value as CoreDeliveryStatus })} className="forge-input p-2.5 rounded-lg text-xs font-bold">
          {STATUS.map(status => <option value={status} key={status}>{statusLabel(status)}</option>)}
        </select>
        <div className="forge-card px-3 py-2"><div className="text-[9px] uppercase forge-muted font-black">Truck</div><div className="text-xs text-white font-bold mt-1">{delivery.truck || 'Unassigned'}</div></div>
        <div className="forge-card px-3 py-2"><div className="text-[9px] uppercase forge-muted font-black">Driver</div><div className="text-xs text-white font-bold mt-1">{delivery.driver || 'Unassigned'}</div></div>
      </div>
      <button onClick={() => setEditing(delivery)} className="forge-button-secondary px-3 py-2 rounded-lg text-xs font-bold">Edit</button>
    </div>
  );

  if (!workspace.context?.organizationId && !loading) return <div className="forge-card p-8 max-w-2xl"><h2 className="text-xl font-black text-white">Connect Forge Core</h2><p className="forge-secondary mt-2">Delivery Operations now runs from Forge Core. Use CORE SIGN IN above, then return here.</p></div>;

  return <div className="space-y-6">
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div><div className="text-[10px] uppercase tracking-[.2em] forge-muted font-black">Forge Operations</div><h1 className="text-2xl font-black text-white mt-1">Delivery & Dispatch</h1><p className="forge-secondary text-sm mt-1">PO inbound + project outbound deliveries in one Core schedule.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => void refresh()} disabled={loading || busy} className="forge-button-secondary px-4 py-2.5 rounded-lg text-sm font-bold">{loading ? 'Loading…' : 'Refresh Core'}</button><button onClick={() => setShowNew(true)} className="px-4 py-2.5 rounded-lg text-sm font-black text-black flex items-center gap-2" style={{ background: 'var(--forge-accent)' }}><ICONS.Plus className="w-4 h-4" /> Schedule Delivery</button></div>
    </div>

    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm">{error}</div>}
    {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">{message}</div>}

    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[['Today', metrics.today], ['Open inbound', metrics.inbound], ['Open outbound', metrics.outbound], ['In transit', metrics.inTransit]].map(([label, value]) => <div className="forge-card p-4" key={String(label)}><div className="text-[10px] uppercase tracking-wider forge-muted font-black">{label}</div><div className="text-2xl font-black text-white mt-2">{value}</div></div>)}
    </div>

    <div className="forge-card p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1">{(['DAY','WEEK','MONTH','REQUESTS'] as BoardView[]).map(item => <button key={item} onClick={() => setView(item)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider ${view === item ? 'forge-nav-active' : 'forge-nav-item'}`}>{item === 'REQUESTS' ? `Legacy Requests (${pendingLegacyRequests.length})` : item}</button>)}</div>
      {view !== 'REQUESTS' && <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} className="forge-input p-2.5 rounded-lg text-sm font-bold" />}
    </div>

    {view === 'DAY' && <div className="space-y-3">{dayDeliveries.length ? dayDeliveries.map(delivery => <DeliveryCard key={delivery.id} delivery={delivery} />) : <div className="forge-card p-16 text-center"><ICONS.Truck className="w-12 h-12 forge-muted mx-auto" /><h3 className="text-lg font-black text-white mt-4">No Core deliveries on {dateText(selectedDate)}</h3><p className="forge-muted text-sm mt-2">Schedule an outbound project load or inbound vendor delivery.</p></div>}</div>}

    {view === 'WEEK' && <div className="grid md:grid-cols-2 xl:grid-cols-7 gap-3">{weekDays.map(day => <div className="forge-card p-3 min-h-64" key={day}><button onClick={() => { setSelectedDate(day); setView('DAY'); }} className="w-full text-left"><div className="text-[10px] uppercase forge-muted font-black">{dateText(day)}</div><div className="text-xl font-black text-white mt-1">{deliveriesForDate(day).length}</div></button><div className="space-y-2 mt-4">{deliveriesForDate(day).slice(0, 6).map(item => <button key={item.id} onClick={() => setEditing(item)} className="w-full text-left border rounded-lg p-2" style={{ borderColor: 'var(--forge-border-soft)' }}><div className="text-xs font-bold text-white truncate">{item.projectName || item.vendorName || item.poNumber || 'Delivery'}</div><div className="text-[9px] forge-muted mt-1">{timeText(item.scheduledStart)} • {statusLabel(item.status)}</div></button>)}</div></div>)}</div>}

    {view === 'MONTH' && <div className="forge-card p-5"><div className="grid grid-cols-7 gap-2">{monthDays.map(day => { const items = deliveriesForDate(day); return <button key={day} onClick={() => { setSelectedDate(day); setView('DAY'); }} className="aspect-square rounded-xl border p-2 text-left hover:border-orange-500/40 transition" style={{ borderColor: day === selectedDate ? 'var(--forge-accent)' : 'var(--forge-border-soft)' }}><div className="text-xs forge-muted font-black">{new Date(`${day}T12:00:00`).getDate()}</div><div className="text-lg text-white font-black mt-1">{items.length || ''}</div><div className="flex gap-1 flex-wrap mt-auto">{items.slice(0,4).map(item => <span key={item.id} className={`w-2 h-2 rounded-full ${item.direction === 'inbound' ? 'bg-sky-400' : 'bg-orange-400'}`} />)}</div></button>; })}</div></div>}

    {view === 'REQUESTS' && <section className="forge-card p-5"><div className="flex items-center justify-between gap-4"><div><div className="text-[10px] uppercase tracking-wider forge-muted font-black">Compatibility inbox</div><h2 className="text-lg font-black text-white mt-1">Legacy browser delivery requests</h2></div><span className="forge-muted text-xs">Read-only during Core cutover</span></div><p className="forge-secondary text-sm mt-2">These requests remain in the existing browser CRM store and have not been deleted. Schedule the corresponding job in Core above when it is ready for dispatch.</p><div className="space-y-2 mt-5">{pendingLegacyRequests.map(request => { const project = data.projects.find(project => project.id === request.projectId); return <div key={request.id} className="border rounded-xl p-4 flex justify-between gap-4" style={{ borderColor: 'var(--forge-border-soft)' }}><div><strong className="text-white">{project?.projectName || 'Legacy project'}</strong><div className="forge-muted text-xs mt-1">{request.requestedDate} • {request.requestedWindow}</div>{request.notes && <div className="forge-secondary text-xs mt-2">{request.notes}</div>}</div><span className="text-[9px] font-black uppercase text-amber-300">Legacy pending</span></div>; })}{!pendingLegacyRequests.length && <div className="forge-muted text-sm py-8 text-center">No pending legacy requests.</div>}</div></section>}

    {showNew && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"><div className="forge-card w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto"><div className="flex items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-wider forge-muted font-black">New Core delivery</div><h2 className="text-xl font-black text-white mt-1">Schedule inbound / outbound</h2></div><button onClick={() => setShowNew(false)} className="forge-button-secondary px-3 py-2 rounded-lg">Close</button></div><div className="grid md:grid-cols-2 gap-3 mt-5">
      <label><span className="text-[10px] uppercase forge-muted font-black">Direction</span><select value={direction} onChange={event => { const next = event.target.value as 'inbound'|'outbound'; setDirection(next); setProjectId(''); setQuoteId(''); setPoId(''); }} className="forge-input w-full mt-1 p-2.5 rounded-lg"><option value="outbound">Outbound — jobsite</option><option value="inbound">Inbound — vendor</option></select></label>
      {direction === 'inbound' ? <label><span className="text-[10px] uppercase forge-muted font-black">Purchase order</span><select value={poId} onChange={event => setPoId(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg"><option value="">Select PO…</option>{workspace.purchaseOrders.filter(po => po.status !== 'cancelled').map(po => <option key={po.id} value={po.id}>{po.poNumber} — {po.vendorName}</option>)}</select></label> : <label><span className="text-[10px] uppercase forge-muted font-black">Project</span><select value={projectId} onChange={event => setProjectId(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg"><option value="">Select project…</option>{workspace.projects.map(project => <option key={project.id} value={project.id}>{project.name}{project.customerName ? ` — ${project.customerName}` : ''}</option>)}</select></label>}
      {direction === 'outbound' && <label><span className="text-[10px] uppercase forge-muted font-black">Quote (optional)</span><select value={quoteId} onChange={event => setQuoteId(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg"><option value="">No quote link</option>{workspace.quotes.filter(quote => !projectId || quote.projectId === projectId).map(quote => <option key={quote.id} value={quote.id}>{quote.quoteNumber}</option>)}</select></label>}
      <label><span className="text-[10px] uppercase forge-muted font-black">Delivery #</span><input value={deliveryNumber} onChange={event => setDeliveryNumber(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg" placeholder="DEL-2026-001" /></label>
      <label><span className="text-[10px] uppercase forge-muted font-black">Scheduled start</span><input type="datetime-local" value={scheduledStart} onChange={event => setScheduledStart(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg" /></label>
      <label><span className="text-[10px] uppercase forge-muted font-black">Load type</span><select value={loadType} onChange={event => setLoadType(event.target.value)} disabled={direction === 'inbound'} className="forge-input w-full mt-1 p-2.5 rounded-lg">{LOAD_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      <label><span className="text-[10px] uppercase forge-muted font-black">Truck</span><input value={truck} onChange={event => setTruck(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg" placeholder="Truck / unit" /></label>
      <label><span className="text-[10px] uppercase forge-muted font-black">Driver</span><input value={driver} onChange={event => setDriver(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg" placeholder="Driver" /></label>
      <label className="md:col-span-2"><span className="text-[10px] uppercase forge-muted font-black">Address override</span><input value={address} onChange={event => setAddress(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg" placeholder="Leave blank to use project/site or J&K location" /></label>
      <label className="md:col-span-2"><span className="text-[10px] uppercase forge-muted font-black">Notes</span><textarea value={notes} onChange={event => setNotes(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg min-h-20" /></label>
    </div><div className="flex justify-end gap-2 mt-5"><button onClick={() => setShowNew(false)} className="forge-button-secondary px-4 py-2.5 rounded-lg font-bold">Cancel</button><button onClick={() => void createDelivery()} disabled={busy || !scheduledStart || (direction === 'inbound' ? !poId : (!projectId && !quoteId))} className="px-5 py-2.5 rounded-lg font-black text-black disabled:opacity-40" style={{ background: 'var(--forge-accent)' }}>{busy ? 'Saving…' : 'Schedule in Core'}</button></div></div></div>}

    {editing && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"><EditDelivery delivery={editing} busy={busy} onClose={() => setEditing(null)} onSave={patch => void updateDelivery(editing, patch)} /></div>}
  </div>;
};

const EditDelivery: React.FC<{ delivery: CoreDeliveryRecord; busy: boolean; onClose: () => void; onSave: (patch: Partial<CoreDeliveryRecord>) => void }> = ({ delivery, busy, onClose, onSave }) => {
  const [status, setStatus] = useState<CoreDeliveryStatus>(delivery.status);
  const [start, setStart] = useState(delivery.scheduledStart ? new Date(delivery.scheduledStart).toISOString().slice(0,16) : '');
  const [truck, setTruck] = useState(delivery.truck || '');
  const [driver, setDriver] = useState(delivery.driver || '');
  const [loadType, setLoadType] = useState(delivery.loadType || 'Other');
  const [stop, setStop] = useState(delivery.stopSequence || 1);
  const [notes, setNotes] = useState(delivery.notes || '');
  return <div className="forge-card w-full max-w-2xl p-6"><div className="flex justify-between gap-4"><div><div className="text-[10px] uppercase forge-muted font-black">Dispatch edit</div><h2 className="text-xl font-black text-white mt-1">{delivery.deliveryNumber || delivery.projectName || delivery.poNumber || 'Delivery'}</h2></div><button onClick={onClose} className="forge-button-secondary px-3 py-2 rounded-lg">Close</button></div><div className="grid md:grid-cols-2 gap-3 mt-5">
    <label><span className="text-[10px] uppercase forge-muted font-black">Status</span><select value={status} onChange={event => setStatus(event.target.value as CoreDeliveryStatus)} className="forge-input w-full mt-1 p-2.5 rounded-lg">{STATUS.map(item => <option value={item} key={item}>{statusLabel(item)}</option>)}</select></label>
    <label><span className="text-[10px] uppercase forge-muted font-black">Scheduled start</span><input type="datetime-local" value={start} onChange={event => setStart(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg" /></label>
    <label><span className="text-[10px] uppercase forge-muted font-black">Truck</span><input value={truck} onChange={event => setTruck(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg" /></label>
    <label><span className="text-[10px] uppercase forge-muted font-black">Driver</span><input value={driver} onChange={event => setDriver(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg" /></label>
    <label><span className="text-[10px] uppercase forge-muted font-black">Load type</span><input value={loadType} onChange={event => setLoadType(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg" /></label>
    <label><span className="text-[10px] uppercase forge-muted font-black">Stop sequence</span><input type="number" min="1" value={stop} onChange={event => setStop(Number(event.target.value))} className="forge-input w-full mt-1 p-2.5 rounded-lg" /></label>
    <label className="md:col-span-2"><span className="text-[10px] uppercase forge-muted font-black">Notes</span><textarea value={notes} onChange={event => setNotes(event.target.value)} className="forge-input w-full mt-1 p-2.5 rounded-lg min-h-20" /></label>
  </div><div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="forge-button-secondary px-4 py-2.5 rounded-lg font-bold">Cancel</button><button disabled={busy} onClick={() => onSave({ status, scheduledStart: start ? new Date(start).toISOString() : undefined, truck, driver, loadType, stopSequence: stop, notes })} className="px-5 py-2.5 rounded-lg font-black text-black disabled:opacity-40" style={{ background: 'var(--forge-accent)' }}>{busy ? 'Saving…' : 'Save to Core'}</button></div></div>;
};
