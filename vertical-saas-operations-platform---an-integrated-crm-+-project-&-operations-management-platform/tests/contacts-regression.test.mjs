import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const source = readFileSync('components/CustomerCRM.tsx', 'utf8');
const result = await build({
  stdin: { contents: source, resolveDir: process.cwd() + '/components', loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
});
const require = createRequire(import.meta.url);
const compiled = new URL(`.contacts-test-${process.pid}.cjs`, import.meta.url);
let c;
try { writeFileSync(compiled, result.outputFiles[0].text); c = require(fileURLToPath(compiled)); }
finally { unlinkSync(compiled); }
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const synthetic = {
  id: 'fx1', firstName: 'Test', lastName: 'Person', company: 'Example Builders',
  emails: ['test.person@example.invalid'], phones: ['905-555-0100'], address: '12 Fixture Lane, Sampleton',
  spouseName: '', childrenNames: [], lastContactDate: '', lastContactNotes: '', importantDates: [], tags: [], status: 'lead', notes: '', activityLog: [],
};
const render = (customer, extra = {}) => renderToStaticMarkup(React.createElement(c.CustomerProfile, { customer, onBack() {}, ...extra }));

test('N01-06 new contact leaves Last Contact unset and shows Not contacted', () => {
  const rec = c.buildNewCustomer({ firstName: 'A', lastName: 'B', company: 'C', email: '', phone: '', address: '', spouseName: '', children: '', notes: '', status: 'lead' });
  assert.equal(rec.lastContactDate, '');
  assert.notEqual(rec.lastContactNotes, 'Account created.');
  assert.equal(c.lastContactLabel(''), 'Not contacted');
  assert.equal(c.lastContactLabel(undefined), 'Not contacted');
  assert.equal(c.lastContactLabel('2026-08-24'), '2026-08-24');
  assert.match(render(synthetic), /Not contacted/);
  assert.doesNotMatch(source, /lastContactDate:\s*new Date/);
});

test('N01-07 email and phone are real mailto:/tel: links only when data exists', () => {
  const html = render(synthetic);
  assert.match(html, /href="mailto:test\.person@example\.invalid"/);
  assert.match(html, /Email Test Person/);
  assert.match(html, /href="tel:9055550100"/);
  assert.match(html, /905-555-0100/);
  const none = render({ ...synthetic, emails: [''], phones: [''] });
  assert.doesNotMatch(none, /mailto:/);
  assert.doesNotMatch(none, /tel:/);
  assert.match(none, /No email/);
  assert.match(none, /No phone/);
});

test('N01-08 search matches name, company, email, phone digits and address', () => {
  const m = q => c.customerMatchesSearch(synthetic, q);
  assert.ok(m('person'));
  assert.ok(m('example builders'));
  assert.ok(m('EXAMPLE.INVALID'));
  assert.ok(m('905-555-0100'));
  assert.ok(m('9055550100'));
  assert.ok(m('(905) 555 0100'));
  assert.ok(m('fixture lane'));
  assert.ok(m(''));
  assert.ok(!m('zzz-nothing'));
  assert.ok(!m('555-9999'));
  assert.ok(!c.customerMatchesSearch({ ...synthetic, phones: [''] }, '-'), 'punctuation-only query must not match everything via empty digits');
});

test('N01-08 no-match state has a message and a Clear search control', () => {
  assert.match(source, /No contacts match/);
  assert.match(source, /Clear search/);
});

test('N01-09 profile has a Back to results action and mobile-only list/profile switching', () => {
  const html = render(synthetic);
  assert.match(html, /Back to results/);
  assert.match(html, /lg:hidden/);
  assert.match(source, /selectedCustomer \? 'hidden lg:block'/);
  assert.match(source, /scrollTop/);
});
