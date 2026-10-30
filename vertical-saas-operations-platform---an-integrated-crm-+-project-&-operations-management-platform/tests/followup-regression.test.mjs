import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync, unlinkSync } from 'node:fs';

// Mock only the remote client boundary. No credentials, network or production data.
const result = await build({
  stdin: { contents: `export { loadForgeCoreSnapshot } from './forgeCoreData'; export { importQuoteDraftLocally } from './quoteIntake';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  plugins: [{ name: 'offline-core', setup(build) {
    build.onResolve({ filter: /^\.\/forgeCore$/ }, () => ({ path: 'offline-core', namespace: 'test' }));
    build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const getForgeCoreContext = async () => ({ organizationId: 'test-org' }); export const getForgeCoreClient = async () => globalThis.__testCore;` }));
  } }],
});
const compiled = new URL(`.followup-test-${process.pid}.cjs`, import.meta.url);
let api;
try { writeFileSync(compiled, result.outputFiles[0].text); api = createRequire(import.meta.url)(fileURLToPath(compiled)); }
finally { unlinkSync(compiled); }

test('Core snapshot preserves project milestones/follow-ups without reading standalone tasks', async () => {
  const requested = [];
  const records = {
    customers: [{ id: 'customer-test', display_name: 'Synthetic customer' }],
    quotes: [{ id: 'quote-test', customer_id: 'customer-test', project_id: 'project-test', status: 'sent' }],
    quote_revisions: [],
    projects: [{ id: 'project-test', name: 'Synthetic project', metadata: {
      legacy_timeline: [{ id: 'milestone-test', name: 'Synthetic milestone', done: true }],
      legacy_todos: [{ id: 'followup-test', text: 'Synthetic project follow-up', done: false }],
      legacy_steps: ['Synthetic next step'],
    } }],
  };
  globalThis.__testCore = { from(table) {
    requested.push(table);
    const query = { select() { return query; }, eq() { return query; }, order() { return Promise.resolve({ data: records[table] || [] }); } };
    return query;
  } };
  const snapshot = await api.loadForgeCoreSnapshot();
  assert.deepEqual(requested, ['customers', 'quotes', 'quote_revisions', 'projects']);
  const tasks = snapshot.projects[0].phases.flatMap(phase => phase.tasks);
  assert.deepEqual(tasks.map(task => task.title).sort(), ['Synthetic milestone', 'Synthetic next step', 'Synthetic project follow-up']);
  assert.equal(tasks.find(task => task.title === 'Synthetic milestone').completed, true);
  assert.equal(snapshot.quotes[0].customerId, 'customer-test');
});

test('quote intake preserves history, customer activity and seven-day follow-up across revisions', () => {
  const historical = { id: 'history-test', title: 'Synthetic historical record', completed: true };
  let stored = JSON.stringify({ dailyTasks: [historical], customers: [], quotes: [] });
  globalThis.localStorage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  globalThis.window = { dispatchEvent() {} };
  const draft = { customerName: 'Synthetic Test Customer', customerNumber: 'TEST-ONLY', quoteNumber: 'TEST-Q1', quoteDate: '2026-01-01', fileName: 'synthetic.pdf', projectName: 'Synthetic project', subtotal: 100, phone: '', address: '' };
  const imported = api.importQuoteDraftLocally(draft);
  assert.equal(imported.createdQuote, true);
  let data = JSON.parse(stored);
  assert.deepEqual(data.dailyTasks[0], historical);
  assert.equal(data.dailyTasks[1].dueDate, '2026-01-08');
  assert.equal(data.customers[0].activityLog.length, 1);
  const revised = api.importQuoteDraftLocally(draft);
  assert.equal(revised.createdRevision, true);
  data = JSON.parse(stored);
  assert.equal(data.dailyTasks.length, 2);
  assert.equal(data.quotes[0].version, 2);
  assert.deepEqual(data.dailyTasks[0], historical);
});
