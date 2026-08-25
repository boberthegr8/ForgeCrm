import React, { useEffect, useState } from 'react';
import { ForgeCoreContext, getForgeCoreContext, signOutOfForgeCore } from '../forgeCore';
import { sendForgeCoreMagicLink } from '../forgeCoreAuth';
import { useForgeStore } from '../store';

export const CoreAccountControl: React.FC = () => {
  const { coreState, refreshCore } = useForgeStore();
  const [context, setContext] = useState<ForgeCoreContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('rob.flagg1234@gmail.com');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      setContext(await getForgeCoreContext());
    } catch (err: any) {
      setContext(null);
      setError(err?.message || 'Forge Core status could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [coreState.mode]);

  const sendLink = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await sendForgeCoreMagicLink(email);
      setMessage('Sign-in link sent. Open the Forge email on this device and follow the link — no password is required.');
    } catch (err: any) {
      setError(err?.message || 'Forge Core sign-in link could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      await signOutOfForgeCore();
      setContext(null);
      setMessage('Signed out of Forge Core. This browser keeps its local fallback copy.');
      await refreshCore();
    } catch (err: any) {
      setError(err?.message || 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  };

  const connected = Boolean(context?.organizationId) && coreState.mode === 'core';
  const signedIn = Boolean(context);
  const statusLabel = loading || coreState.mode === 'loading'
    ? 'CORE…'
    : connected
      ? 'CORE LIVE'
      : coreState.mode === 'error'
        ? 'CORE ERROR'
        : signedIn
          ? 'CORE UNASSIGNED'
          : 'CORE SIGN IN';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg border transition-colors"
        style={{
          borderColor: connected ? 'rgba(34,197,94,.35)' : 'rgba(255,116,23,.28)',
          color: connected ? 'var(--forge-success)' : 'var(--forge-accent)',
          background: connected ? 'rgba(34,197,94,.08)' : 'var(--forge-accent-soft)'
        }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: connected ? 'var(--forge-success)' : 'var(--forge-accent)' }} />
        {statusLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm grid place-items-center p-4" onMouseDown={event => { if (event.currentTarget === event.target) setOpen(false); }}>
          <div className="forge-card-raised w-full max-w-lg overflow-hidden forge-enter">
            <div className="px-6 py-5 border-b flex items-start justify-between gap-4" style={{ borderColor: 'var(--forge-border-soft)', background: 'var(--forge-sidebar)' }}>
              <div>
                <div className="text-[10px] uppercase tracking-[.2em] forge-accent font-black">Forge Core</div>
                <h2 className="text-xl font-black text-white mt-1">Live suite connection</h2>
                <p className="text-xs forge-secondary mt-1">CRM now reads Core directly. Browser storage is fallback/cache only.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="forge-secondary hover:text-white text-2xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="rounded-xl border border-red-900/60 bg-red-950/35 p-3 text-sm text-red-300">{error}</div>}
              {coreState.error && <div className="rounded-xl border border-red-900/60 bg-red-950/35 p-3 text-sm text-red-300">{coreState.error}</div>}
              {message && <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-300">{message}</div>}

              {connected ? (
                <div className="space-y-4">
                  <div className="forge-card p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-black text-white">{coreState.organizationName || context?.organizationName}</div>
                        <div className="text-xs forge-secondary mt-1">{coreState.locationName || context?.locationName || 'No location'} • {context?.role}</div>
                        <div className="text-xs forge-muted mt-1">{context?.email}</div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(34,197,94,.1)', color: 'var(--forge-success)' }}>Live</span>
                    </div>
                    {coreState.counts && (
                      <div className="grid grid-cols-5 gap-2 mt-4">
                        {Object.entries(coreState.counts).map(([label, value]) => (
                          <div key={label} className="rounded-lg border p-2 text-center" style={{ borderColor: 'var(--forge-border-soft)' }}>
                            <div className="text-base font-black text-white">{value}</div>
                            <div className="text-[8px] uppercase forge-muted">{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" disabled={busy} onClick={() => void refreshCore()} className="forge-button-primary w-full rounded-xl px-4 py-3 text-sm disabled:opacity-50">Refresh Core now</button>
                  <button type="button" disabled={busy} onClick={() => void signOut()} className="forge-button-secondary w-full rounded-xl px-4 py-3 text-xs font-black disabled:opacity-50">Sign out</button>
                  <p className="text-[11px] forge-muted">Customer, quote, revision, project and to-do screens are loaded from Forge Core after sign-in. Existing browser data remains as a recovery copy and is never deleted by this connection.</p>
                </div>
              ) : signedIn ? (
                <div className="rounded-xl border border-amber-900/60 bg-amber-950/25 p-4 text-sm text-amber-200">
                  <div className="font-black">Signed in, but Core is not ready</div>
                  <div className="mt-1 text-xs">This identity must have an active organization membership before business records can load.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border p-3 text-xs forge-secondary" style={{ borderColor: 'var(--forge-border-soft)' }}>
                    Rob is provisioned as the proof-of-concept owner. Forge sends a secure one-time sign-in link; no password is required.
                  </div>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wider font-black forge-secondary">Owner email</span>
                    <input value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void sendLink(); }} type="email" autoComplete="email" className="forge-input w-full mt-1.5 rounded-xl px-4 py-3 text-sm" />
                  </label>
                  <button type="button" disabled={busy || !email.trim()} onClick={() => void sendLink()} className="forge-button-primary w-full rounded-xl px-4 py-3 text-sm disabled:opacity-50">Send passwordless sign-in link</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
