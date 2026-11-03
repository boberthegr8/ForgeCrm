import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);

const load = async (name, contents, resolveDir) => {
  const result = await build({
    stdin: { contents, resolveDir, loader: 'tsx' },
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  });
  const compiled = new URL(`.${name}-test-${process.pid}.cjs`, import.meta.url);
  try { writeFileSync(compiled, result.outputFiles[0].text); return require(fileURLToPath(compiled)); }
  finally { unlinkSync(compiled); }
};

const boardSource = readFileSync('components/PurchasingBoard.tsx', 'utf8');
const deliverySource = readFileSync('components/DeliveryBoard.tsx', 'utf8');
const logic = await load('purchasing-logic', readFileSync('purchasingLogic.ts', 'utf8'), process.cwd());
const board = await load('purchasing-board', boardSource, process.cwd() + '/components');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const items = [
  { id: 'a', description: 'Synthetic stud', unit: 'ea', unitCost: 2.5, quantityOrdered: 10, quantityReceived: 4 },
  { id: 'b', description: 'Synthetic plate', unit: 'ea', unitCost: 10, quantityOrdered: 5, quantityReceived: 5 },
  { id: 'c', description: 'Synthetic nail box', unit: 'box', unitCost: 20, quantityOrdered: 3, quantityReceived: 0 },
];

test('O30-02 receipt quantities default to zero, not outstanding', () => {
  assert.deepEqual(logic.defaultReceiptDraft(items), { a: 0, b: 0, c: 0 });
  assert.equal(logic.buildReceiptPreview(items, logic.defaultReceiptDraft(items)).lineCount, 0);
  assert.doesNotMatch(boardSource, /\?\? remaining\}/);
  assert.doesNotMatch(boardSource, /setReceiptDraft\(Object\.fromEntries/);
});

test('O30-02 Fill remaining sets outstanding qty and preview shows what will be received', () => {
  const draft = logic.fillRemainingDraft(items);
  assert.deepEqual(draft, { a: 6, b: 0, c: 3 });
  const preview = logic.buildReceiptPreview(items, draft);
  assert.equal(preview.lineCount, 2);
  assert.deepEqual(preview.lines.map(l => [l.id, l.quantity, l.remainingAfter]), [['a', 6, 0], ['c', 3, 0]]);
  assert.equal(preview.totalValue, 6 * 2.5 + 3 * 20);
  // over-entry is clamped, junk becomes zero
  assert.equal(logic.clampReceiptQty(99, 6), 6);
  assert.equal(logic.clampReceiptQty('abc', 6), 0);
  assert.equal(logic.clampReceiptQty(-2, 6), 0);
  assert.equal(logic.buildReceiptPreview(items, { a: 99 }).lines[0].quantity, 6);
  assert.match(boardSource, /Fill remaining/);
  assert.match(boardSource, /receipt-preview/);
  assert.match(boardSource, /Will receive/);
});

test('O30-03 latest-request guard drops outdated responses', () => {
  const guard = logic.createLatestGuard();
  const first = guard.begin();
  const second = guard.begin();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
  guard.invalidate();
  assert.equal(guard.isCurrent(second), false);
  assert.equal(logic.poDetailsReady('po-2', 'po-1'), false);
  assert.equal(logic.poDetailsReady('po-2', null), false);
  assert.equal(logic.poDetailsReady('po-2', 'po-2'), true);
  assert.equal(logic.poDetailsReady(null, null), false);
});

test('O30-03 board clears stale lines on switch and checks the guard after each await', () => {
  const open = boardSource.slice(boardSource.indexOf('const openPo'), boardSource.indexOf('const receive'));
  assert.match(open, /setLoadedPoId\(null\)/);
  assert.match(open, /setPoItems\(\[\]\)/);
  assert.match(open, /poGuard\.isCurrent\(requestId\)/);
  assert.ok(open.indexOf('await loadPurchaseOrderItems') < open.indexOf('isCurrent(requestId)'));
  assert.match(boardSource, /poDetailsReady\(selectedPo\.id, loadedPoId\)/);
});

test('O30-09 tax is shown as a percentage and totals are previewed', () => {
  assert.equal(logic.formatTaxRate(0.13), '13%');
  assert.equal(logic.formatTaxRate(0.0875), '8.75%');
  assert.equal(logic.formatTaxRate(0), '0%');
  assert.equal(logic.taxRateToPercent(0.13), 13);
  assert.equal(logic.percentToTaxRate('13'), 0.13);
  assert.equal(logic.percentToTaxRate('nope'), 0);
  assert.deepEqual(logic.computePoTotals(100, 0.13), { subtotal: 100, tax: 13, total: 113 });
  assert.deepEqual(logic.computePoTotals(19.99, 0.13), { subtotal: 19.99, tax: 2.6, total: 22.59 });
  assert.match(boardSource, /po-totals/);
  assert.match(boardSource, /Subtotal/);
  assert.match(boardSource, /Total \{money\(poTotals\.total\)\}/);
  assert.doesNotMatch(boardSource, /<span[^>]*>\+ tax<\/span>/);
});

test('O30-10 list states: failed never looks like empty; counts only after success', () => {
  const base = { loading: false, loaded: true, error: '', connected: true, count: 0 };
  assert.equal(logic.listViewState({ ...base, loading: true, loaded: false }), 'loading');
  assert.equal(logic.listViewState({ ...base, loaded: false, error: 'boom' }), 'failed');
  assert.equal(logic.listViewState({ ...base, error: 'boom' }), 'failed');
  assert.equal(logic.listViewState({ ...base, connected: false }), 'disconnected');
  assert.equal(logic.listViewState(base), 'empty');
  assert.equal(logic.listViewState({ ...base, count: 3 }), 'ready');
});

test('O30-10 Purchasing first render is loading: no counts, no "No Core purchase orders yet"', () => {
  const html = renderToStaticMarkup(React.createElement(board.PurchasingBoard));
  assert.match(html, /Loading purchase orders/);
  assert.doesNotMatch(html, /No Core purchase orders yet/);
  assert.doesNotMatch(html, /Connect Forge Core/);
  assert.match(html, /—/);
});

test('O30-10 Purchasing and Delivery surface the real error with Retry', () => {
  for (const src of [boardSource, deliverySource]) {
    assert.match(src, /setLoadError\(err\?\.message/);
    assert.match(src, /viewState === 'failed'/);
    assert.match(src, /role="alert"/);
    assert.match(src, /Retry/);
    assert.match(src, /listViewState\(/);
    assert.match(src, /countsReady \? /);
  }
  assert.match(deliverySource, /Loading deliveries/);
  assert.match(deliverySource, /viewState === 'disconnected'/);
  assert.match(boardSource, /viewState === 'disconnected'/);
  assert.match(boardSource, /viewState === 'empty' && <div[^>]*>No Core purchase orders yet/);
});
