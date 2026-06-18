import test from 'node:test';
import assert from 'node:assert/strict';

import esbuild from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'url';
import { rmSync, mkdirSync, existsSync } from 'fs';

const ORIGINAL_FETCH = global.fetch;
let GET; // will be set after bundling

function makeMockResponse({ ok = true, status = 200, jsonBody = {}, headers = {} } = {}) {
  return {
    ok,
    status,
    headers: {
      get: (k) => headers[k] || null,
    },
    json: async () => jsonBody,
  };
}

// build the handler into a single ESM file before tests
test.before(async () => {
  const outdir = 'tests/.build';
  if (existsSync(outdir)) rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });

  await esbuild.build({
    entryPoints: ['src/pages/api/contributions/[username].ts'],
    bundle: true,
    outfile: `${outdir}/handler.mjs`,
    platform: 'node',
    format: 'esm',
    target: ['node18'],
  });

  const mod = await import(pathToFileURL(`${outdir}/handler.mjs`).href);
  GET = mod.GET || mod.default?.GET || mod.default || mod;
});

test.afterEach(() => {
  // restore fetch
  global.fetch = ORIGINAL_FETCH;
});

test.after(() => {
  // cleanup build artifacts
  try {
    rmSync('tests/.build', { recursive: true, force: true });
  } catch (e) {
    // ignore
  }
});

test('200 upstream returns JSON and X-Cache miss', async () => {
  const sample = { contributions: [{ date: '2026-06-01', count: 3 }] };
  global.fetch = async () => makeMockResponse({ ok: true, status: 200, jsonBody: sample });

  const res = await GET({ params: { username: 'alice' } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, sample);
  assert.equal(res.headers.get('X-Cache'), 'miss');
});

test('404 upstream returns 404 and message', async () => {
  global.fetch = async () => makeMockResponse({ ok: false, status: 404 });

  const res = await GET({ params: { username: 'notfound' } });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, 'User not found');
});

test('429 upstream returns Retry-After header and 429', async () => {
  global.fetch = async () => makeMockResponse({ ok: false, status: 429, headers: { 'Retry-After': '10' } });

  const res = await GET({ params: { username: 'ratelimited' } });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('Retry-After'), '10');
  const body = await res.json();
  assert.equal(body.error, 'Rate limited upstream');
});

test('network error results in 502', async () => {
  global.fetch = async () => { throw new Error('network fail'); };

  const res = await GET({ params: { username: 'network' } });
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error, 'Upstream fetch failed');
});

test('cached response returned on second request (X-Cache: hit)', async () => {
  const sample = { contributions: [{ date: '2026-06-02', count: 5 }] };
  // first fetch returns sample
  global.fetch = async () => makeMockResponse({ ok: true, status: 200, jsonBody: sample });

  const first = await GET({ params: { username: 'cacheuser' } });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('X-Cache'), 'miss');
  const firstBody = await first.json();
  assert.deepEqual(firstBody, sample);

  // now replace fetch with one that would fail if called — cached response should be used
  global.fetch = async () => { throw new Error('should not be called'); };

  const second = await GET({ params: { username: 'cacheuser' } });
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('X-Cache'), 'hit');
  const secondBody = await second.json();
  assert.deepEqual(secondBody, sample);
});
