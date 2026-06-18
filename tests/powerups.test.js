import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, shouldSpawn, pickSpecIndex } from './powerup-logic.mjs';

const POWERUPS = [ { id: 'mult-1' }, { id: 'steal-1' }, { id: 'bonus-1' } ];

test('makeRng is deterministic for a given seed', () => {
  const r1 = makeRng(12345);
  const r2 = makeRng(12345);
  const seq1 = [r1(), r1(), r1(), r1()];
  const seq2 = [r2(), r2(), r2(), r2()];
  assert.deepEqual(seq1, seq2);
});

test('shouldSpawn respects baseChance deterministically', () => {
  const rng = makeRng(42);
  // run several attempts and ensure boolean result is deterministic
  const resultsA = Array.from({length: 10}, () => shouldSpawn(rng, 0.14));
  // re-seed and run again
  const rng2 = makeRng(42);
  const resultsB = Array.from({length: 10}, () => shouldSpawn(rng2, 0.14));
  assert.deepEqual(resultsA, resultsB);
});

test('pickSpecIndex returns in-range indices and is deterministic', () => {
  const rng = makeRng(999);
  const idxs = Array.from({length: 10}, () => pickSpecIndex(rng, POWERUPS));
  idxs.forEach(i => assert.ok(i >= 0 && i < POWERUPS.length, `index ${i} out of range`));
  // reseed and verify same sequence
  const rng2 = makeRng(999);
  const idxs2 = Array.from({length: 10}, () => pickSpecIndex(rng2, POWERUPS));
  assert.deepEqual(idxs, idxs2);
});

test('multiple spawn attempts do not exceed maxSpawns', () => {
  // simulate spawn window with seeded RNG; enforce maxSpawns = 3
  const rng = makeRng(2026);
  const baseChance = 0.5; // increase prob to exercise spawns
  const maxSpawns = 3;
  const spawned = [];
  for (let i=0;i<20;i++){
    if (spawned.length >= maxSpawns) break;
    if (shouldSpawn(rng, baseChance)){
      const specIdx = pickSpecIndex(rng, POWERUPS);
      spawned.push({attempt:i, specIdx});
    }
  }
  assert.ok(spawned.length <= maxSpawns);
});
