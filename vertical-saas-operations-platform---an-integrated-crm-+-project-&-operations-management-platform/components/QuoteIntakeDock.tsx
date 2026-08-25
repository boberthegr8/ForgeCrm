import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  extractPdfText,
  findBestLocalCustomerMatch,
  findExistingQuote,
  importQuoteDraftLocally,
  parseQuoteText,
  QuoteIntakeDraft
} from '../quoteIntake';
import {
  commitQuoteToForgeCore,
  CoreQuotePreview,
  previewQuoteAgainstForgeCore,
  signInToForgeCore,
  signUpForForgeCore
} from '../forgeCore';

export const QuoteIntakeDock: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<QuoteIntakeDraft | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [corePreview, setCorePreview] = useState<CoreQuotePreview | null>(null);
  const [corePreviewBusy, setCorePreviewBusy] = useState(false);
  const [corePreviewError, setCorePreviewError] = useState('');
  const [customerDecision, setCustomerDecision] = useState<'suggested' | 'new'>('new');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const localMatch = useMemo(() => draft ? findBestLocalCustomerMatch(draft) : undefined, [draft]);
  const localExisting = useMemo(() => draft?.quoteNumber ? findExistingQuote(draft.quoteNumber) : undefined, [draft?.quoteNumber]);

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types || []).includes('Files')) setDragActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setDragActive(true);
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      setDragActive(false);
      void analyzeFile(event.dataTransfer.files[0]);
    };
    const onDragEnd = () => setDragActive(false);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragleave', onDragEnd);
    window.addEventListener('dragend', onDragEnd);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragleave', onDragEnd);
      window.removeEventListener('dragend', onDragEnd);
    };
  }, []);

  useEffect(() => {
    if (!draft) return;
    const timer = window.setTimeout(() => void refreshCorePreview(draft), 350);
    return () => window.clearTimeout(timer);
  }, [draft?.quoteNumber, draft?.customerNumber, draft?.customerName, draft?.phone, draft?.address]);

  const refreshCorePreview = async (nextDraft: QuoteIntakeDraft) => {
    setCorePreviewBusy(true);
    setCorePreviewError('');
    try {
      const preview = await previewQuoteAgainstForgeCore(nextDraft);
      setCorePreview(preview);
      if (preview.customerMatch && preview.customerMatch.score >= 70) setCustomerDecision('suggested');
      else setCustomerDecision('new');
    } catch (err: any) {
      setCorePreview(null);
      setCorePreviewError(err?.message || 'Forge Core preview is unavailable.');
    } finally {
      setCorePreviewBusy(false);
    }
  };

  const analyzeFile = async (file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Forge Quote Intake currently accepts PDF quotes only.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const rawText = await extractPdfText(file);
      if (!rawText.trim()) throw new Error('No selectable text was found in this PDF. Image-only drawings/quotes will be handed to Forge Reader later.');
      const parsed = parseQuoteText(rawText, file.name);
      setSourceFile(file);
      setDraft(parsed);
      await refreshCorePreview(parsed);
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
  };

  const validateDraft = () => {
    if (!draft) return 'No quote is loaded.';
    if (!draft.quoteNumber.trim()) return 'Confirm or enter the quote number before importing.';
    if (!draft.customerName.trim() && !draft.customerNumber.trim()) return 'Confirm either the customer name or customer/account number before importing.';
    if (!(draft.subtotal > 0)) return 'Confirm the pre-tax Item Total / Subtotal before importing.';
    return '';
  };

  const confirmImport = async () => {
    const validation = validateDraft();
    if (validation) {
      setError(validation);
      return;
    }
    if (!draft || !sourceFile) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (corePreview?.mode === 'ready' && corePreview.context?.organizationId) {
        const coreResult = await commitQuoteToForgeCore(draft, sourceFile, {
          customerIdOverride: customerDecision === 'suggested' ? corePreview.customerMatch?.id : undefined,
          forceCreateCustomer: customerDecision === 'new'
        });
        // Transitional dual-write: Core is authoritative, local state keeps the current CRM UI usable until Phase 2 migration finishes.
        try {
          importQuoteDraftLocally(draft, customerDecision === 'suggested' && localMatch?.score && localMatch.score >= 70 ? localMatch.customer.id : undefined);
        } catch (localError) {
          console.warn('Forge Core import succeeded but legacy local mirror failed', localError);
        }
        setNotice(`Saved to Forge Core as revision ${coreResult.revisionNumber}. Original PDF is stored privately.`);
        window.location.hash = '#/quotes';
        window.setTimeout(() => window.location.reload(), 550);
        return;
      }

      const localResult = importQuoteDraftLocally(draft, customerDecision === 'suggested' && localMatch?.score && localMatch.score >= 70 ? localMatch.customer.id : undefined);
      setNotice(localResult.createdRevision ? 'Saved as a new local quote revision. Sign into Forge Core to store the original PDF centrally.' : 'Saved to the existing CRM browser data. Sign into Forge Core to make it shared.');
      window.location.hash = '#/quotes';
      window.setTimeout(() => window.location.reload(), 650);
    } catch (err: any) {
      setError(err?.message || 'Forge read the quote but could not save it.');
    } finally {
      setBusy(false);
    }
  };

  const authenticate = async (mode: 'signin' | 'signup') => {
    if (!authEmail.trim() || authPassword.length < 6) {
      setError('Enter your email and a password of at least 6 characters.');
      return;
    }
    setAuthBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signin') {
        await signInToForgeCore(authEmail, authPassword);
        setNotice('Signed into Forge Core. Checking your organization access…');
      } else {
        await signUpForForgeCore(authEmail, authPassword);
        setNotice('Forge Core account created. If email confirmation is enabled, confirm the email before signing in. Your organization membership is assigned separately.');
      }
      if (draft) await refreshCorePreview(draft);
    } catch (err: any) {
      setError(err?.message || 'Forge Core authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const close = () => {
    setDraft(null);
    setSourceFile(null);
    setCorePreview(null);
    setError('');
    setNotice('');
    setCorePreviewError('');
  };

  return (
    <>
      {dragActive && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/70 backdrop-blur-sm pointer-events-none">
          <div className="forge-card-raised px-12 py-10 text-center border-2 border-dashed" style={{ borderColor: 'var(--forge-accent)' }}>
            <div className="text-5xl forge-accent mb-3">↧</div>
            <div className="text-xl font-black">Drop quote into Forge</div>
            <div className="text-sm forge-secondary mt-2">PDF → match customer → detect revision → private Core storage</div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="fixed z-[80] right-6 bottom-6 forge-button-primary rounded-xl shadow-2xl px-5 py-3.5 text-sm flex items-center gap-3 transition-transform hover:-translate-y-0.5"
      >
        <span className="text-xl leading-none">＋</span>
        Import Quote PDF
      </button>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => void analyzeFile(event.target.files?.[0])} />

      {busy && !draft && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="forge-card-raised p-8 text-center max-w-sm w-full">
            <div className="w-12 h-12 rounded-full border-4 border-neutral-700 animate-spin mx-auto" style={{ borderTopColor: 'var(--forge-accent)' }} />
            <div className="font-black mt-5 text-lg">Reading quote…</div>
            <div className="text-sm forge-secondary mt-2">Extracting customer, quote number, project and pre-tax subtotal.</div>
          </div>
        </div>
      )}

      {(draft || error) && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="forge-card-raised w-full max-w-4xl my-6 overflow-hidden forge-enter">
            <div className="px-7 py-5 flex items-start justify-between gap-6 border-b" style={{ borderColor: 'var(--forge-border)', background: 'var(--forge-sidebar)' }}>
              <div>
                <div className="text-[10px] uppercase tracking-[.22em] font-black forge-accent">Forge Quote Intake</div>
                <h2 className="text-2xl font-black mt-1">Review before import</h2>
                <div className="text-sm forge-secondary mt-1">Forge extracts first. You confirm. Core records the final decision.</div>
              </div>
              <button type="button" onClick={close} className="forge-secondary hover:text-white text-2xl">×</button>
            </div>

            <div className="p-7 space-y-5 max-h-[78vh] overflow-y-auto">
              {error && <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
              {notice && <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/35 px-4 py-3 text-sm font-semibold text-emerald-300">{notice}</div>}

              {draft && (
                <>
                  <CoreStatus preview={corePreview} busy={corePreviewBusy} error={corePreviewError} />

                  {(corePreview?.mode === 'signed-out' || corePreview?.mode === 'unassigned') && (
                    <div className="forge-card p-4">
                      <div className="font-black">Forge Core sign-in</div>
                      <div className="text-xs forge-secondary mt-1">
                        {corePreview.mode === 'unassigned'
                          ? 'Your account is signed in but has not been assigned to a Forge organization yet.'
                          : 'Sign in to store this PDF and quote in the shared Forge Core database. Local import remains available during migration.'}
                      </div>
                      {corePreview.mode === 'signed-out' && (
                        <div className="grid md:grid-cols-[1fr_1fr_auto_auto] gap-3 mt-4">
                          <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" className="forge-input rounded-lg px-3 py-2.5 text-sm" />
                          <input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" type="password" className="forge-input rounded-lg px-3 py-2.5 text-sm" />
                          <button disabled={authBusy} onClick={() => void authenticate('signin')} className="forge-button-primary rounded-lg px-4 py-2.5 text-sm disabled:opacity-50">Sign in</button>
                          <button disabled={authBusy} onClick={() => void authenticate('signup')} className="forge-button-secondary rounded-lg px-4 py-2.5 text-sm disabled:opacity-50">Create account</button>
                        </div>
                      )}
                    </div>
                  )}

                  {draft.warnings.length > 0 && (
                    <div className="rounded-xl border border-amber-900/60 bg-amber-950/25 px-4 py-3 text-sm text-amber-200">
                      <div className="font-black mb-1">Needs review</div>
                      {draft.warnings.map(warning => <div key={warning}>• {warning}</div>)}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Quote Number" value={draft.quoteNumber} onChange={value => update('quoteNumber', value)} />
                    <Field label="Quote Date" value={draft.quoteDate} type="date" onChange={value => update('quoteDate', value)} />
                    <Field label="Customer / Account #" value={draft.customerNumber} onChange={value => update('customerNumber', value)} />
                    <Field label="Customer / Company" value={draft.customerName} onChange={value => update('customerName', value)} />
                    <Field label="Phone" value={draft.phone} onChange={value => update('phone', value)} />
                    <Field label="Project / Job" value={draft.projectName} onChange={value => update('projectName', value)} />
                  </div>
                  <Field label="Address" value={draft.address} onChange={value => update('address', value)} />

                  <label className="block">
                    <span className="block text-xs font-black uppercase tracking-wider forge-secondary mb-1.5">Quoted Subtotal — before HST</span>
                    <div className="relative">
                      <span className="absolute left-4 top-3 forge-secondary font-bold">$</span>
                      <input type="number" step="0.01" min="0" value={draft.subtotal || ''} onChange={event => update('subtotal', Number(event.target.value))} className="forge-input w-full pl-8 pr-4 py-3 rounded-xl font-black text-lg" />
                    </div>
                  </label>

                  <CustomerDecision
                    corePreview={corePreview}
                    localMatch={localMatch}
                    decision={customerDecision}
                    onDecision={setCustomerDecision}
                  />

                  <RevisionDecision corePreview={corePreview} localExisting={localExisting} />

                  <div className="forge-card p-4 text-sm forge-secondary">
                    <div className="font-black text-white">What Forge will record</div>
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                      <div>✓ Original PDF in private Core storage</div>
                      <div>✓ Customer match/create decision</div>
                      <div>✓ Project match/create</div>
                      <div>✓ Quote + immutable revision</div>
                      <div>✓ Customer/project activity</div>
                      <div>✓ 7-day follow-up on new quotes</div>
                    </div>
                    <div className="mt-3 text-xs forge-muted">During Phase 2, successful Core imports are also mirrored into browser storage so the existing CRM screens continue to work while we move reads to Core.</div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-3 pt-2">
                    <button type="button" onClick={close} className="forge-button-secondary px-5 py-3 rounded-xl font-bold">Cancel</button>
                    <button type="button" disabled={busy} onClick={() => void confirmImport()} className="forge-button-primary px-6 py-3 rounded-xl disabled:opacity-50">
                      {busy ? 'Saving…' : corePreview?.mode === 'ready' ? (corePreview.existingQuote ? `Save Revision ${corePreview.existingQuote.currentRevision + 1} to Core` : 'Import Quote to Forge Core') : (localExisting ? 'Save Local Revision' : 'Import Locally')}
                    </button>
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
    <span className="block text-xs font-black uppercase tracking-wider forge-secondary mb-1.5">{label}</span>
    <input type={type} value={value} onChange={event => onChange(event.target.value)} className="forge-input w-full px-4 py-3 rounded-xl font-semibold" />
  </label>
);

const CoreStatus: React.FC<{ preview: CoreQuotePreview | null; busy: boolean; error: string }> = ({ preview, busy, error }) => {
  if (busy) return <div className="forge-card px-4 py-3 text-sm forge-secondary">Checking Forge Core matching and revision history…</div>;
  if (error) return <div className="rounded-xl border border-amber-900/60 bg-amber-950/25 px-4 py-3 text-sm text-amber-200">Core preview unavailable: {error}</div>;
  if (!preview) return null;
  if (preview.mode === 'ready') {
    return (
      <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/25 px-4 py-3 text-sm">
        <div className="font-black text-emerald-300">Forge Core connected</div>
        <div className="forge-secondary mt-1">{preview.context?.organizationName}{preview.context?.locationName ? ` • ${preview.context.locationName}` : ''} • {preview.context?.role}</div>
      </div>
    );
  }
  if (preview.mode === 'unassigned') return <div className="rounded-xl border border-amber-900/60 bg-amber-950/25 px-4 py-3 text-sm text-amber-200">Forge Core account signed in, but no active organization membership exists yet.</div>;
  return <div className="forge-card px-4 py-3 text-sm forge-secondary">Forge Core is available but not signed in.</div>;
};

const CustomerDecision: React.FC<{
  corePreview: CoreQuotePreview | null;
  localMatch: any;
  decision: 'suggested' | 'new';
  onDecision: (decision: 'suggested' | 'new') => void;
}> = ({ corePreview, localMatch, decision, onDecision }) => {
  const match = corePreview?.mode === 'ready' ? corePreview.customerMatch : localMatch ? {
    id: localMatch.customer.id,
    displayName: localMatch.customer.company || `${localMatch.customer.firstName || ''} ${localMatch.customer.lastName || ''}`.trim(),
    score: localMatch.score,
    reasons: localMatch.reasons
  } : undefined;
  if (!match) return <div className="forge-card p-4 text-sm forge-secondary"><div className="font-black text-white">Customer matching</div><div className="mt-1">No credible existing match found. Forge will create a new customer after confirmation.</div></div>;
  return (
    <div className="forge-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-black">Customer match suggestion</div>
          <div className="text-sm mt-1"><span className="forge-accent font-black">{match.score}%</span> — {match.displayName}</div>
          <div className="text-xs forge-secondary mt-1">{match.reasons.join(' • ') || 'name similarity'}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onDecision('suggested')} className={`px-3 py-2 rounded-lg text-xs font-black ${decision === 'suggested' ? 'forge-button-primary' : 'forge-button-secondary'}`}>Use match</button>
          <button type="button" onClick={() => onDecision('new')} className={`px-3 py-2 rounded-lg text-xs font-black ${decision === 'new' ? 'forge-button-primary' : 'forge-button-secondary'}`}>Create new</button>
        </div>
      </div>
    </div>
  );
};

const RevisionDecision: React.FC<{ corePreview: CoreQuotePreview | null; localExisting: any }> = ({ corePreview, localExisting }) => {
  const existing = corePreview?.mode === 'ready' ? corePreview.existingQuote : localExisting ? {
    quoteNumber: localExisting.quoteNumber,
    currentRevision: Math.max(0, Number(localExisting.version || 1) - 1),
    subtotal: localExisting.totalValue
  } : undefined;
  if (!existing) return <div className="forge-card p-4 text-sm forge-secondary"><span className="font-black text-white">New quote:</span> no quote with this number exists in the current system of record.</div>;
  return (
    <div className="rounded-xl border border-amber-900/60 bg-amber-950/25 p-4 text-sm text-amber-100">
      <div className="font-black">Quote {existing.quoteNumber} already exists.</div>
      <div className="mt-1">Forge will preserve the existing record and add <strong>revision {existing.currentRevision + 1}</strong> rather than creating a duplicate quote.</div>
    </div>
  );
};
