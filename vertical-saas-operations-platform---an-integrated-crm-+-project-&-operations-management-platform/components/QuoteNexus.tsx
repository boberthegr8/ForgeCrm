
import React, { useState, useRef } from 'react';
import { useForgeStore } from '../store';
import { ICONS } from '../constants';
import { Quote, QuoteStatus } from '../types';

export const QuoteNexus: React.FC = () => {
  const { data, updateQuoteStatus, convertQuoteToProject, addQuote, updateQuote, reviseQuote } = useForgeStore();
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | 'all'>('all');
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [approvingQuote, setApprovingQuote] = useState<Quote | null>(null);
  const [commencingQuote, setCommencingQuote] = useState<Quote | null>(null);
  const [poNumber, setPoNumber] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Commence build dates
  const [trussDate, setTrussDate] = useState('');
  const [floorDate, setFloorDate] = useState('');
  const [shipDate, setShipDate] = useState('');

  const filteredQuotes = data.quotes.filter(q => filterStatus === 'all' || q.status === filterStatus);

  const handleOpenApprove = (quote: Quote) => {
    setApprovingQuote(quote);
    setPoNumber('');
  };

  const handleConfirmApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (approvingQuote) {
      updateQuoteStatus(approvingQuote.id, 'approved', poNumber);
      setApprovingQuote(null);
    }
  };

  const handleRevise = (id: string) => {
    reviseQuote(id);
  };

  const handleOpenCommence = (quote: Quote) => {
    setCommencingQuote(quote);
    setTrussDate('');
    setFloorDate('');
    setShipDate('');
  };

  const handleConfirmCommence = (e: React.FormEvent) => {
    e.preventDefault();
    if (commencingQuote) {
      convertQuoteToProject(commencingQuote.id, {
        trussDeliveryDate: trussDate,
        floorSystemDeliveryDate: floorDate,
        shipDate: shipDate
      });
      setCommencingQuote(null);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingQuote) {
      updateQuote(editingQuote);
      setEditingQuote(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingQuote) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF document.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingQuote({
        ...editingQuote,
        pdfAttachment: {
          name: file.name,
          data: reader.result as string
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    if (editingQuote) {
      setEditingQuote({
        ...editingQuote,
        pdfAttachment: undefined
      });
    }
  };

  const openPdf = (pdfData: string) => {
    const newTab = window.open();
    if (newTab) {
      newTab.document.write(`<iframe src="${pdfData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  const createDummyQuote = () => {
    if (data.customers.length === 0) return alert('Create a customer first!');
    addQuote({
      customerId: data.customers[0].id,
      scopeSummary: "New Project Quote",
      lineItems: [],
      totalValue: 5000,
      margin: 20,
      probability: 60,
      status: 'sent'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {['all', 'draft', 'sent', 'revised', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                filterStatus === status 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <button 
          onClick={createDummyQuote}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-semibold transition-colors shadow-lg shadow-indigo-100"
        >
          <ICONS.Plus className="w-5 h-5" />
          New Quote
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredQuotes.map(quote => {
          const customer = data.customers.find(c => c.id === quote.customerId);
          return (
            <div key={quote.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all flex flex-col group relative overflow-hidden">
              {/* Margin Badge */}
              <div className="absolute -right-8 top-4 rotate-45 bg-emerald-500 text-white text-[10px] font-black py-1 w-32 text-center shadow-sm">
                {quote.margin}% MARGIN
              </div>

              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4 pr-12">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${
                    quote.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    quote.status === 'sent' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                    'bg-slate-50 text-slate-600 border-slate-100'
                  }`}>
                    {quote.status}
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-bold block">{quote.quoteNumber}</span>
                    <span className="text-[10px] text-slate-300 font-medium">Ver {quote.version}</span>
                  </div>
                </div>
                
                <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight group-hover:text-indigo-600 transition-colors">
                  {quote.scopeSummary}
                </h4>
                <p className="text-sm text-slate-500 font-medium mb-1">{customer?.firstName} {customer?.lastName}</p>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-tighter mb-4">{customer?.company}</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {quote.poNumber && (
                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 w-fit">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">PO:</span>
                      <span className="text-xs font-bold text-indigo-700">{quote.poNumber}</span>
                    </div>
                  )}
                  {quote.pdfAttachment && (
                    <button 
                      onClick={() => openPdf(quote.pdfAttachment!.data)}
                      className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 w-fit hover:bg-rose-100 transition-colors"
                    >
                      <ICONS.FileText className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">View PDF</span>
                    </button>
                  )}
                </div>

                <div className="flex justify-between items-end mt-auto pt-6 border-t border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Est. Value</span>
                    <span className="text-2xl font-black text-slate-900">${quote.totalValue.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Confidence</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${quote.probability}%` }}></div>
                      </div>
                      <span className="text-xs font-bold text-slate-700">{quote.probability}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 border-t border-slate-100 grid grid-cols-2 gap-2">
                {quote.status !== 'approved' && (
                  <button 
                    onClick={() => handleOpenApprove(quote)}
                    className="col-span-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm mb-1"
                  >
                    Approve with PO
                  </button>
                )}
                {quote.status === 'approved' && (
                  <button 
                    onClick={() => handleOpenCommence(quote)}
                    className="col-span-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-sm mb-1"
                  >
                    <ICONS.CheckCircle className="w-4 h-4" />
                    Commence Build
                  </button>
                )}
                <button 
                  onClick={() => handleRevise(quote.id)}
                  className="py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Revise
                </button>
                <button 
                  onClick={() => setEditingQuote(quote)}
                  className="py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Edit Modal */}
      {editingQuote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Modify Quote</h3>
              <button onClick={() => setEditingQuote(null)} className="text-slate-400 hover:text-slate-600"><ICONS.Archive className="w-6 h-6 rotate-45" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-8 space-y-5 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quote Number</label>
                  <input 
                    type="text" 
                    value={editingQuote.quoteNumber} 
                    onChange={e => setEditingQuote({...editingQuote, quoteNumber: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Creation Date</label>
                  <input 
                    type="date" 
                    value={editingQuote.dateCreated} 
                    onChange={e => setEditingQuote({...editingQuote, dateCreated: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Builder / Customer</label>
                <select 
                  value={editingQuote.customerId}
                  onChange={e => setEditingQuote({...editingQuote, customerId: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {data.customers.map(c => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.company})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scope / Description</label>
                <input 
                  type="text" 
                  value={editingQuote.scopeSummary} 
                  onChange={e => setEditingQuote({...editingQuote, scopeSummary: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* PDF Upload Section */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Documentation (PDF)</label>
                {editingQuote.pdfAttachment ? (
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <ICONS.FileText className="w-5 h-5 text-rose-500" />
                      <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{editingQuote.pdfAttachment.name}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={removeAttachment}
                      className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 p-8 rounded-2xl flex flex-col items-center justify-center hover:border-indigo-300 hover:bg-slate-50/50 transition-all cursor-pointer group"
                  >
                    <ICONS.FileText className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 transition-colors mb-2" />
                    <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">Click to upload official PDF quote</span>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="application/pdf"
                      className="hidden" 
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Value ($)</label>
                  <input 
                    type="number" 
                    value={editingQuote.totalValue} 
                    onChange={e => setEditingQuote({...editingQuote, totalValue: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-indigo-600 text-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Margin (%)</label>
                  <input 
                    type="number" 
                    value={editingQuote.margin} 
                    onChange={e => setEditingQuote({...editingQuote, margin: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">Commit Changes</button>
                <button type="button" onClick={() => setEditingQuote(null)} className="px-8 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all">Dismiss</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvingQuote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ICONS.CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Approve Quote</h3>
              <p className="text-slate-500">Please provide a Purchase Order number to finalize this contract.</p>
            </div>
            <form onSubmit={handleConfirmApprove} className="p-8 pt-0 space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">PO Number</label>
                <input 
                  required
                  autoFocus
                  type="text" 
                  value={poNumber} 
                  onChange={e => setPoNumber(e.target.value)}
                  placeholder="e.g. PO-88291"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-lg"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100">
                  Approve Contract
                </button>
                <button type="button" onClick={() => setApprovingQuote(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commence Build (Logistics) Modal */}
      {commencingQuote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                <ICONS.Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 leading-tight">Commence Build</h3>
              <p className="text-slate-500 text-sm mt-1 font-medium">Set key logistics milestones to generate the project timeline and to-do list.</p>
            </div>
            <form onSubmit={handleConfirmCommence} className="p-8 space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Truss Delivery Date</label>
                <input 
                  type="date" 
                  value={trussDate} 
                  onChange={e => setTrussDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Floor System Delivery Date</label>
                <input 
                  type="date" 
                  value={floorDate} 
                  onChange={e => setFloorDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Target Ship Date</label>
                <input 
                  type="date" 
                  value={shipDate} 
                  onChange={e => setShipDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-600"
                />
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200">
                  Generate Project & Tasks
                </button>
                <button type="button" onClick={() => setCommencingQuote(null)} className="w-full text-slate-500 py-3 font-bold hover:text-slate-800 transition-all">
                  Back
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
