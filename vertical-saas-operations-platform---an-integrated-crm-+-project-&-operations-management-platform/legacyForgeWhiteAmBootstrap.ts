import {
  fetchForgeWhiteAmSnapshot,
  FORGEWHITEAM_MIGRATION_MARKER,
  mergeForgeWhiteAmSnapshot
} from './legacyForgeWhiteAmMigration';

const STORAGE_KEY = 'forge_crm_data_v2';
let started = false;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForCrmState() {
  // The current CRM store writes its initialized/backfilled state in a React effect.
  // Waiting here lets this migration wrap the real current browser data instead of
  // manufacturing a replacement INITIAL_DATA snapshot.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { return JSON.parse(raw); }
      catch { /* let the store get another chance to write valid JSON */ }
    }
    await sleep(250);
  }
  throw new Error('ForgeWhiteAM migration could not find initialized Forge CRM storage.');
}

export function installForgeWhiteAmMigration() {
  if (started) return;
  started = true;

  const marker = localStorage.getItem(FORGEWHITEAM_MIGRATION_MARKER);
  if (marker) return;

  // Run after mount so the normal CRM initialization/backfill owns first write.
  window.setTimeout(async () => {
    try {
      const [base, snapshot] = await Promise.all([
        waitForCrmState(),
        fetchForgeWhiteAmSnapshot()
      ]);

      const merged = mergeForgeWhiteAmSnapshot(base, snapshot);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      localStorage.setItem(FORGEWHITEAM_MIGRATION_MARKER, JSON.stringify({
        completedAt: new Date().toISOString(),
        source: 'forgewhiteam.vercel.app / Supabase forge_state',
        contactsSeen: snapshot.contacts?.length || 0,
        quotesSeen: snapshot.quotes?.length || 0,
        dealsSeen: snapshot.deals?.filter((deal: any) => deal?.quoteId != null).length || 0,
        todosSeen: snapshot.todos?.length || 0
      }));

      // The existing store was initialized before the async import finished. Reload once so
      // React starts from the migrated snapshot. The marker prevents a reload loop.
      window.location.reload();
    } catch (error) {
      console.warn('ForgeWhiteAM one-time migration did not complete:', error);
      // No marker is written on failure; a later page load may safely retry.
    }
  }, 500);
}
