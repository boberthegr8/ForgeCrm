import React, { useRef, useState } from 'react';
import { extractPdfText, findExistingQuote, importQuoteDraft, parseQuoteText, QuoteIntakeDraft } from '../quoteIntake';

export const QuoteIntakeDock: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<QuoteIntakeDraft | null>(null);
  const [existing, setExisting] = useState<any>(null);

  const analyzeFile = async (file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Forge Quote Intake currently accepts PDF quotes only.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const rawText = await extractPdfText(file);
      if (!rawText.trim()) throw new Error('No selectable text was found in this PDF. Scanned/image-only quotes will be handled by Forge Reader/OCR later.');
      const parsed = parseQuoteText(rawText, file.name);
      setDraft(parsed);
      setExisting(parsed.quoteNumber ? findExistingQuote(parsed.quoteNumber) : null);
    } catch (err: any) {
      setError(err?.message || 'Forge could not read that PDF.');
    } finally {
      setBusy(false);
      setDragActive(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const update = (key: keyof QuoteIntakeDraft, value: string | number) => {
    setDraft(current => current ? { ...current, [key]: value } : current);
    if (key === 'quoteNumber') setExisting(String(value).trim() ? findExistingQuote(String(value)) : null);
  };

  const confirmImport = () => {
    if (!draft) return;
    if (!draft.quoteNumber.trim()) {
      setError('Confirm or enter the quote number before importing.');
      return;
    }
    if (!draft.customerName.trim() && !draft.customerNumber.trim()) {
      setError('Confirm either the customer name or customer/account number before importing.');
      return;
    }
    if (!(draft.subtotal > 0)) {
      setError('Confirm the pre-tax Item Total / Subtotal before importing.');
      return;
    }
    try {
      const result = importQuoteDraft(draft);
      setDraft(null);
      setExisting(null);
      setError('');
      window.location.hash = '#/quotes';
      window.setTimeout(() => window.location.reload(), 120);
      console.info('Forge quote intake complete', result);
    } catch (err: any) {
      setError(err?.message || 'The quote was read, but Forge could not save it.');
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[90] pointer-events-none transition ${dragActive ? 'bg-indigo-950/40 backdrop-blur-[2px]' : 'bg-transparent'}`}
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
      />

      <div
        className="fixed inset-0 z-[91] pointer-events-none"
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragActive(true); }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          void analyzeFile(e.dataTransfer.files?.[0]);
        }}
      >
        {dragActive && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="rounded-3xl border-2 border-dashed border-white/80 bg-slate-950/80 px-12 py-10 text-center text-white shadow-2xl">
              <div className="text-4xl mb-3">↧</div>
              <div className="text-xl font-black">Drop quote into Forge</div>
              <div className="text-sm text-slate-300 mt-2">PDF → customer → job → subtotal → quote workflow</div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="fixed z-[80] right-6 bottom-6 rounded-2xl bg-slate-900 hover:bg-indigo-700 text-white shadow-2xl px-5 py-3.5 font-bold text-sm flex items-center gap-3 transition-colors"
      >
        <span className="text-xl leading-none">＋</span>
        Import Quote PDF
      </button>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void analyzeFile(e.target.files?.[0])} />

      {busy && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-sm w-full">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin mx-auto" />
            <div className="font-black text-slate-900 mt-5 text-lg">Reading quote…</div>
            <div className="text-sm text-slate-500 mt-2">Extracting customer, quote number, project and pre-tax subtotal.</div>
          </div>
        </div>
      )}

      {(draft || error) && !busy && (
        <div className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-6 overflow-hidden">
            <div className="px-7 py-5 bg-slate-900 text-white flex items-start justify-between gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-[.22em] text-indigo-300 font-black">Forge Quote Intake</div>
                <h2 className="text-2xl font-black mt-1">Review before import</h2>
                <div className="text-sm text-slate-400 mt-1">Forge extracted these values. Correct anything it got wrong.</div>
              </div>
              <button type="button" onClick={() => { setDraft(null); setExisting(null); setError(''); }} className="text-slate-400 hover:text-white text-2xl">×</button>
            </div>

            <div className="p-7 space-y-5 max-h-[75vh] overflow-y-auto">
              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

              {draft && (
                <>
                  {existing && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <div className="font-black">Quote {draft.quoteNumber} already exists.</div>
                      <div className="mt-1">Forge will update that quote instead of creating a duplicate.</div>
                    </div>
                  )}

                  {draft.warnings.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <div className="font-black mb-1">Needs review</div>
                      {draft.warnings.map(w => <div key={w}>• {w}</div>)}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Quote Number" value={draft.quoteNumber} onChange={(v) => update('quoteNumber', v)} />
                    <Field label="Quote Date" value={draft.quoteDate} type="date" onChange={(v) => update('quoteDate', v)} />
                    <Field label="Customer / Account #" value={draft.customerNumber} onChange={(v) => update('customerNumber', v)} />
                    <Field label="Customer / Company" value={draft.customerName} onChange={(v) => update('customerName', v)} />
                    <Field label="Phone" value={draft.phone} onChange={(v) => update('phone', v)} />
                    <Field label="Project / Job" value={draft.projectName} onChange={(v) => update('projectName', v)} />
                  </div>

                  <Field label="Address" value={draft.address} onChange={(v) => update('address', v)} />

                  <label className="block">
                    <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Quoted Subtotal — before HST</span>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft.subtotal || ''}
                        onChange={(e) => update('subtotal', Number(e.target.value))}
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none font-black text-lg"
                      />
                    </div>
                  </label>

                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                    <div className="font-black text-slate-800">Workflow Forge will create</div>
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                      <div>✓ Match or create customer</div>
                      <div>✓ Customer status → Quoted</div>
                      <div>✓ Create/update quote by quote #</div>
                      <div>✓ Use pre-tax subtotal as quoted value</div>
                      <div>✓ Record import in customer activity</div>
                      <div>✓ Add 7-day quote follow-up task</div>
                    </div>
                    <div className="mt-3 text-xs text-slate-400">The PDF filename is recorded. Permanent PDF file storage will move to Forge Core rather than stuffing large PDFs into browser localStorage.</div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-3 pt-2">
                    <button type="button" onClick={() => { setDraft(null); setExisting(null); setError(''); }} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-slate-600">Cancel</button>
                    <button type="button" onClick={confirmImport} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-100">{existing ? 'Update Existing Quote' : 'Import Quote to CRM'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
  <label className="block">
    <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold" />
  </label>
);
