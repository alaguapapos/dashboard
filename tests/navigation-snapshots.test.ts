import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NavigationSnapshots} from '../lib/navigation-snapshots.ts';

test('recent navigation snapshots expire and stay isolated to their provider', () => {
  let now = 1000;
  const cache = new NavigationSnapshots(() => now);
  cache.set('sales:today', {total: 190});
  assert.deepEqual(cache.get('sales:today'), {total: 190});
  assert.equal(new NavigationSnapshots().get('sales:today'), undefined);
  now += 300_000;
  assert.equal(cache.get('sales:today'), undefined);
});

test('refresh replaces a snapshot and sign-out clearing removes every section', () => {
  const cache = new NavigationSnapshots();
  cache.set('inventory', [1]);
  cache.set('inventory', [1, 2]);
  cache.set('personnel', {workers: 5});
  assert.deepEqual(cache.get('inventory'), [1, 2]);
  cache.delete('inventory');
  assert.equal(cache.get('inventory'), undefined);
  cache.clear();
  assert.equal(cache.get('personnel'), undefined);
});
