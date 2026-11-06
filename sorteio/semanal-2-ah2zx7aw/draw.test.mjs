import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { drawNext, eligiblePool, pickWeighted } from './draw.js';

const dummy = [
  { handle: 'alfa', entries: 1 },
  { handle: 'beta', entries: 2 },
  { handle: 'gama', entries: 4 },
];
const prizes = ['P1', 'P2', 'P3'];

test('three distinct dummy winners, then stop', () => {
  let state = { winners: [] };
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    state = drawNext(state, dummy, () => 0, prizes);
    assert.equal(state.winners.length, i + 1);
    assert.equal(seen.has(state.winners[i].handle), false);
    seen.add(state.winners[i].handle);
  }
  assert.deepEqual(state.winners.map((w) => w.handle), ['@alfa', '@beta', '@gama']);
  const stopped = drawNext(state, dummy, () => { throw new Error('fourth draw'); }, prizes);
  assert.equal(stopped.winners.length, 3);
  assert.deepEqual(stopped.winners.map((w) => w.handle), ['@alfa', '@beta', '@gama']);
});

test('dummy weights only, official pool is not drawn', () => {
  assert.equal(pickWeighted(dummy, [], () => 0).handle, 'alfa');
  assert.equal(pickWeighted(dummy, [], () => 1).handle, 'beta');
  assert.equal(pickWeighted(dummy, [], () => 3).handle, 'gama');
  assert.equal(pickWeighted(dummy, ['alfa'], () => 0).handle, 'beta');
  const pool = JSON.parse(fs.readFileSync(new URL('./pool.json', import.meta.url), 'utf8'));
  const people = eligiblePool(pool.participants, []);
  assert.equal(pool.participants.length, 73);
  assert.equal(people.length, 73);
  assert.equal(people.reduce((s, p) => s + p.entries, 0), 908);
  assert.equal(people.find((p) => p.handle === 'manuely7408').entries, 77);
  assert.equal(pool.prizes[0], 'Club de Nuit Elite OU Club de Nuit Intense Woman (o ganhador escolhe)');
  assert.equal(pool.prizes[1], 'Le Parfait Pour Homme OU Tag Him Uomo Nero (o ganhador escolhe)');
  assert.equal(pool.prizes[2], 'Odyssey Go Mango + Odyssey Montagne (leva os dois)');
});
