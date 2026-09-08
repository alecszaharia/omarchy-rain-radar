// cavekit-map-rendering.md R5 — the popup's status presentations (T-042).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const panel = readRepoFile('Panel.qml');
const docs = readRepoFile('docs/rendering.md');

const STATUSES = plain(M.STATUS_VALUES);
const look = (status) => plain(M.statusPresentation(status));

test('R5: each of the four statuses has its own presentation', () => {
  const seen = new Map();
  for (const status of STATUSES) {
    const key = JSON.stringify(look(status));
    assert.ok(!seen.has(key), `${status} presents identically to ${seen.get(key)}`);
    seen.set(key, status);
  }
  assert.equal(seen.size, 4);
});

test('R5: the presentations are documented', () => {
  assert.match(docs, /## Popup status presentations/);
  for (const status of STATUSES) {
    const label = look(status).label;
    if (label) assert.ok(docs.includes(label), `${status}'s label must be documented`);
  }
});

test('R5: in stale a stale indicator is visible', () => {
  const stale = look('stale');
  assert.equal(stale.showIndicator, true);
  assert.ok(stale.label.length > 0);
  assert.notEqual(stale.label, look('error').label);
});

test('R5: in error an error indicator is visible and the error text is shown', () => {
  const error = look('error');
  assert.equal(error.showIndicator, true);
  assert.ok(error.label.length > 0);
  assert.equal(error.showErrorText, true, 'the last error text must be reachable');
  // Only the error state surfaces the detail.
  for (const status of ['loading', 'ready', 'stale']) {
    assert.equal(look(status).showErrorText, false, `${status} must not show an error detail`);
  }
});

test('R5: ready shows no indicator, which is itself distinct', () => {
  assert.equal(look('ready').showIndicator, false);
  assert.equal(look('ready').label, '');
});

test('R5: the map stays visible in every status', () => {
  // The map area's visibility must not depend on the status, or a stale or
  // failed refresh would blank the very thing the popup is for.
  const start = panel.indexOf('id: mapArea');
  const region = panel.slice(start, panel.indexOf('// ---- Status (R5)'));
  assert.ok(start > 0 && region.length > 0);
  assert.ok(!/visible:/.test(region), 'nothing in the map area may be conditionally visible');
  assert.ok(!/dataStatus/.test(region), 'the map must not branch on the status');
});

test('R5: the indicator is driven by the presentation, not by ad-hoc branching', () => {
  assert.match(panel, /readonly property var statusPresentation: Model\.statusPresentation\(root\.dataStatus\)/);
  assert.match(panel, /visible: root\.statusPresentation\.showIndicator/);
  assert.match(panel, /text: root\.statusPresentation\.label/);
  assert.match(panel, /visible: root\.statusPresentation\.showErrorText && text !== ""/);
});

test('R5: the error detail comes from the observable status', () => {
  assert.match(panel, /readonly property string dataErrorText: weather \? weather\.statusState\.lastErrorText : ""/);
  assert.match(panel, /text: root\.dataErrorText/);
});

test('R5: an unknown status falls back to a presentation rather than breaking', () => {
  assert.deepEqual(look('nonsense'), look('loading'));
  assert.deepEqual(look(undefined), look('loading'));
});
