import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { createCache } from '../src/lib/cache';

// Lightweight tests for memory adapter TTL and basic API

describe('Cache - memory adapter', () => {
	it('set/get/delete and keys_count work', () => {
		const c = createCache('memory', { ttlSeconds: 300, maxEntries: 10 });
		c.set('k1', 'v1');
		assert.equal(c.get('k1'), 'v1');
		assert.equal(c.keys_count(), 1);
		c.delete('k1');
		assert.equal(c.get('k1'), undefined);
		assert.equal(c.keys_count(), 0);
	});

	it('honors TTL', async () => {
		const c = createCache('memory', { ttlSeconds: 1, maxEntries: 10 });
		c.set('t1', 'x');
		assert.equal(c.get('t1'), 'x');
		// wait slightly longer than 1s
		await new Promise((r) => setTimeout(r, 1200));
		assert.equal(c.get('t1'), undefined);
	});
});
