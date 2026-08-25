import React, { useEffect, useState } from 'react';
import {
  ForgeCoreContext,
  getForgeCoreContext,
  signInToForgeCore,
  signOutOfForgeCore,
  signUpForForgeCore
} from '../forgeCore';

export const CoreAccountControl: React.FC = () => {
  const [context, setContext] = useState<ForgeCoreContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  useEffect(() => { void refresh(); }, []);

  const authenticate = async (mode: 'signin' | 'signup') => {
    if (!email.trim() || password.length < 6) {
      setError('Enter an email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'signin') {
        await signInToForgeCore(email, password);
        setMessage('Signed into Forge Core.');
      } else {
        await signUpForForgeCore(email, password);
        setMessage('Account created. If Supabase asks for email confirmation, confirm it and then sign in here.');
      }
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Forge Core authentication failed.');
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
      setMessage('Signed out of Forge Core.');
    } catch (err: any) {
      setError(err?.message || 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  };

  const connected = Boolean(context?.organizationId);
  const signedIn = Boolean(context);
  const statusLabel = loading ? 'CORE…' : connected ? 'CORE CONNECTED' : signedIn ? 'CORE UNASSIGNED' : 'CORE SIGN IN';

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
                <h2 className="text-xl font-black text-white mt-1">Suite account</h2>
                <p className="text-xs forge-secondary mt-1">One identity for CRM, Scope, Reader, Quoter and the rest of Forge.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="forge-secondary hover:text-white text-2xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="rounded-xl border border-red-900/60 bg-red-950/35 p-3 text-sm text-red-300">{error}</div>}
              {message && <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-300">{message}</div>}

              {connected ? (
                <div className="space-y-4">
                  <div className="forge-card p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-black text-white">{context?.organizationName}</div>
                        <div className="text-xs forge-secondary mt-1">{context?.locationName || 'No location selected'} • {context?.role}</div>
                        <div className="text-xs forge-muted mt-1">{context?.email}</div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(34,197,94,.1)', color: 'var(--forge-success)' }}>Connected</span>
                    </div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void signOut()} className="forge-button-secondary w-full rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50">Sign out</button>
                </div>
              ) : signedIn ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-900/60 bg-amber-950/25 p-4 text-sm text-amber-200">
                    <div className="font-black">Account created — organization assignment needed</div>
                    <div className="mt-1 text-xs">Your Forge identity is valid, but it is not attached to a company yet. No Core business data is accessible until an organization membership is assigned.</div>
                    <div className="mt-2 text-xs forge-secondary">Signed in as {context?.email}</div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void signOut()} className="forge-button-secondary w-full rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50">Sign out</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wider font-black forge-secondary">Email</span>
                    <input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" className="forge-input w-full mt-1.5 rounded-xl px-4 py-3 text-sm" placeholder="you@company.com" />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wider font-black forge-secondary">Password</span>
                    <input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" className="forge-input w-full mt-1.5 rounded-xl px-4 py-3 text-sm" placeholder="At least 6 characters" />
                  </label>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button type="button" disabled={busy} onClick={() => void authenticate('signin')} className="forge-button-primary rounded-xl px-4 py-3 text-sm disabled:opacity-50">Sign in</button>
                    <button type="button" disabled={busy} onClick={() => void authenticate('signup')} className="forge-button-secondary rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50">Create account</button>
                  </div>
                </div>
              )}

              <div className="text-[11px] forge-muted border-t pt-4" style={{ borderColor: 'var(--forge-border-soft)' }}>
                Current CRM browser data is not deleted when Core is connected. Migration is conservative and can be rerun safely.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
