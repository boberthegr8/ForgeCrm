import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

// Exercise real components/store with synthetic local data; no remote calls.
const result = await build({
  stdin: { contents: `export { default as App } from './App'; export { Dashboard } from './components/Dashboard'; export { Layout } from './components/Layout'; export { ForgeStoreProvider, useForgeStore } from './store';`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
});
const require = createRequire(import.meta.url);
const compiled = new URL(`.todo-test-${process.pid}.cjs`, import.meta.url);
const mod = { exports: {} };
try {
  writeFileSync(compiled, result.outputFiles[0].text);
  mod.exports = require(fileURLToPath(compiled));
} finally { unlinkSync(compiled); }
const { Dashboard, Layout, ForgeStoreProvider, useForgeStore } = mod.exports;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const fixture = {
  customers: [], quotes: [], projects: [], dailyTasks: [{ id: 'historical-test', title: 'Historical test task', completed: false, category: 'General' }],
  users: [], deliveryRequests: [], deliveries: [], currentUser: { id: 'test', name: 'Test User', role: 'ADMIN' },
};
globalThis.window = {
  location: { hash: '#/checklist', href: 'http://localhost/#/checklist', origin: 'http://localhost' },
  history: { state: { idx: 0 }, replaceState() {} },
  document: { querySelector: () => null },
};
globalThis.document = { defaultView: globalThis.window };
globalThis.localStorage = { getItem: () => JSON.stringify(fixture) };
const render = component => renderToStaticMarkup(React.createElement(ForgeStoreProvider, null, React.createElement(MemoryRouter, null, component)));

test('dashboard has no standalone task widget, count or entry link', () => {
  const html = render(React.createElement(Dashboard));
  assert.doesNotMatch(html, /Open Tasks|To-do List|Historical test task|checklist/);
  assert.match(html, /Recent Quotes/);
});
test('navigation links to dedicated Todo, not the CRM checklist', () => {
  const html = render(React.createElement(Layout));
  assert.match(html, /href="https:\/\/todo\.forgehub\.dev"/);
  assert.doesNotMatch(html, /href="\/checklist"|To-do List/);
});
test('legacy checklist opens an explanatory link, never a task editor', () => {
  const html = renderToStaticMarkup(React.createElement(mod.exports.App));
  assert.equal(html.includes('Standalone CRM Todo has been retired.'), true);
  assert.equal(html.includes('Open dedicated Todo'), true);
  assert.equal(html.includes('Historical test task'), false);
  assert.equal(html.includes('Add Task'), false);
});
test('store retains historical records and project actions but removes standalone writes', () => {
  let store;
  function Probe() { store = useForgeStore(); return null; }
  render(React.createElement(Probe));
  assert.deepEqual(store.data.dailyTasks, fixture.dailyTasks);
  assert.equal(typeof store.addTask, 'function');
  assert.equal(typeof store.updateTask, 'function');
  for (const name of ['addDailyTask', 'toggleDailyTask', 'deleteDailyTask']) {
    assert.equal(name in store, false, `${name} must be removed`);
  }
});
test('active Core snapshot and API no longer read, count or mutate standalone tasks', () => {
  const core = readFileSync('forgeCoreData.ts', 'utf8');
  assert.equal(core.includes("from('tasks')"), false);
  assert.equal(core.includes('dailyTasks'), false);
  const store = readFileSync('store.ts', 'utf8');
  assert.equal(store.includes('dailyTasks: snapshot.'), false);
  const account = readFileSync('components/CoreAccountControl.tsx', 'utf8');
  assert.equal(account.includes('to-do screens'), false);
});
