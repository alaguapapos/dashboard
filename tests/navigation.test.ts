import assert from 'node:assert/strict';
import {test} from 'node:test';
import {dashboardView, dashboardHref, dashboardViews} from '../lib/navigation.ts';

test('dashboard URL restores every section, including accented names', () => {
  for (const view of dashboardViews) {
    const url = new URL(dashboardHref(view), 'https://dashboard.example');
    assert.equal(url.pathname, '/');
    assert.equal(dashboardView(url.searchParams.get('view')), view);
  }
});

test('missing or invalid sections fall back to Resumen', () => {
  for (const value of [null, '', 'Personal', 'ventas', 'https://example.com']) {
    assert.equal(dashboardView(value), 'Resumen');
  }
  assert.equal(dashboardHref('Resumen'), '/');
  assert.equal(dashboardHref('unknown'), '/');
});
