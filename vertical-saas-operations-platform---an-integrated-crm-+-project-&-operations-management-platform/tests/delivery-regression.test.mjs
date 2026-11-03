import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.env.TZ = 'America/Toronto';
const result = await build({
  stdin: { contents: readFileSync('components/DeliveryBoard.tsx', 'utf8') + '\nexport { dayKey, EditDelivery, monthCells };', resolveDir: process.cwd() + '/components', loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
});
const require = createRequire(import.meta.url);
const compiled = new URL(`.delivery-test-${process.pid}.cjs`, import.meta.url);
let components;
try { writeFileSync(compiled, result.outputFiles[0].text); components = require(fileURLToPath(compiled)); }
finally { unlinkSync(compiled); }
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('delivery grouping uses the local day at evening and midnight across DST', () => {
  for (const [instant, day] of [
    ['2026-01-02T02:00:00Z', '2026-01-01'],
    ['2026-07-02T03:59:00Z', '2026-07-01'],
    ['2026-07-02T04:00:00Z', '2026-07-02'],
    ['2026-11-01T05:30:00Z', '2026-11-01'],
    ['2026-11-01T06:30:00Z', '2026-11-01'],
  ]) assert.equal(components.dayKey(instant), day);
});
test('delivery editor shows local wall time, not the UTC clock', () => {
  const html = renderToStaticMarkup(React.createElement(components.EditDelivery, {
    delivery: { id: 'fixture', status: 'planned', scheduledStart: '2026-01-02T02:00:00Z', stopSequence: 1 },
    busy: false, onClose() {}, onSave() {},
  }));
  assert.match(html, /value="2026-01-01T21:00"/);
  assert.match(html, /America\/Toronto/);
});
test('month cells cover all seven starting weekdays and complete weeks', () => {
  const starts = new Set();
  for (let month = 0; month < 12; month++) {
    const date = new Date(2026, month, 1);
    const cells = components.monthCells(components.dayKey(date.toISOString()));
    const offset = (date.getDay() + 6) % 7;
    starts.add(offset);
    assert.equal(cells.findIndex(Boolean), offset);
    assert.equal(cells.length % 7, 0);
    assert.equal(cells.filter(Boolean).length, new Date(2026, month + 1, 0).getDate());
    assert.ok(cells.slice(0, offset).every(cell => cell === null));
  }
  assert.equal(starts.size, 7);
});
test('edit failure is announced beside retry and preserves the form', () => {
  const html = renderToStaticMarkup(React.createElement(components.EditDelivery, {
    delivery: { id: 'fixture', status: 'planned', notes: 'Keep this draft', stopSequence: 1 },
    error: 'Synthetic save failure', busy: false, onClose() {}, onSave() {},
  }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Synthetic save failure/);
  assert.match(html, /Keep this draft/);
  assert.match(html, /Use Save to Core to retry/);
});
