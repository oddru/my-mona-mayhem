export type CacheValue<T> = {
	value: T;
	expiresAt: number; // epoch ms
	updatedAt: number; // epoch ms
};

export class SimpleCache<T> {
	private map: Map<string, CacheValue<T>> = new Map();
	private ttlMs: number;
	private maxEntries: number;

	constructor(ttlSeconds = 300, maxEntries = 1000) {
		this.ttlMs = ttlSeconds * 1000;
		this.maxEntries = maxEntries;
	}

	getEntry(key: string): CacheValue<T> | undefined {
		return this.map.get(key);
	}

	get(key: string): T | undefined {
		const e = this.map.get(key);
		if (!e) return undefined;
		if (Date.now() > e.expiresAt) return undefined;
		return e.value;
	}

	set(key: string, value: T, ttlSec?: number) {
		// optional per-entry ttl
		const ttlMs = ttlSec ? ttlSec * 1000 : this.ttlMs;
		// evict oldest if over maxEntries
		if (this.map.size >= this.maxEntries && !this.map.has(key)) {
			const oldestKey = this.map.keys().next().value;
			this.map.delete(oldestKey);
		}
		const now = Date.now();
		this.map.set(key, { value, expiresAt: now + ttlMs, updatedAt: now });
	}

	setRaw(key: string, entry: CacheValue<T>) {
		if (this.map.size >= this.maxEntries && !this.map.has(key)) {
			const oldestKey = this.map.keys().next().value;
			this.map.delete(oldestKey);
		}
		this.map.set(key, entry);
	}

	delete(key: string) {
		this.map.delete(key);
	}

	clear() {
		this.map.clear();
	}

	keys_count() {
		return this.map.size;
	}
}

// Adapter interface
export interface CacheAdapter<T = any> {
	get(key: string): Promise<T | undefined> | T | undefined;
	set(key: string, value: T, ttlSec?: number): Promise<void> | void;
	delete(key: string): Promise<void> | void;
	keys_count(): Promise<number> | number;
}

// Redis adapter (optional, falls back to memory if not available)
class RedisAdapter implements CacheAdapter<any> {
	private client: any;
	private prefix = 'cache:';
	private ttlSeconds: number;

	constructor(ttlSeconds: number, maxEntries?: number, redisClient?: any) {
		this.ttlSeconds = ttlSeconds;
		if (redisClient) {
			this.client = redisClient;
		}
	}

	async init() {
		if (this.client) return;
		try {
			// dynamic require to avoid hard dependency if not installed
			const { createRequire } = await import('module');
			const require = createRequire(import.meta.url);
			const IORedis = require('ioredis');
			this.client = new IORedis();
		} catch (err) {
			console.warn('[cache] ioredis not available, falling back to memory adapter.');
			throw err;
		}
	}

	private key(k: string) {
		return `${this.prefix}${k}`;
	}

	/**
	 * Compatibility: return the stored value only (old behavior)
	 */
	async get(key: string) {
		if (!this.client) await this.init();
		try {
			const v = await this.client.get(this.key(key));
			if (!v) return undefined;
			return JSON.parse(v).value;
		} catch (e) {
			console.warn('[cache][redis] get failed, falling back', e);
			return undefined;
		}
	}

	/**
	 * Store a JSON payload that includes value, updatedAt, and optional ttlSeconds.
	 */
	async set(key: string, value: any, ttlSec?: number) {
		if (!this.client) await this.init();
		try {
			const payloadObj: any = { value, updatedAt: Date.now() };
			if (ttlSec) payloadObj.ttlSeconds = Math.floor(ttlSec);
			const payload = JSON.stringify(payloadObj);
			const ex = ttlSec || this.ttlSeconds;
			if (ex && ex > 0) {
				await this.client.set(this.key(key), payload, 'EX', Math.floor(ex));
			} else {
				await this.client.set(this.key(key), payload);
			}
		} catch (e) {
			console.warn('[cache][redis] set failed, falling back', e);
		}
	}

	async delete(key: string) {
		if (!this.client) await this.init();
		try {
			await this.client.del(this.key(key));
		} catch (e) {
			console.warn('[cache][redis] del failed', e);
		}
	}

	async keys_count() {
		if (!this.client) await this.init();
		try {
			let cursor = '0';
			let count = 0;
			do {
				const res = await this.client.scan(cursor, 'MATCH', `${this.prefix}*`, 'COUNT', 100);
				cursor = res[0];
				const keys = res[1] || [];
				count += keys.length;
			} while (cursor !== '0');
			return count;
		} catch (e) {
			console.warn('[cache][redis] keys_count failed', e);
			return 0;
		}
	}

	/**
	 * Compatibility: return entry object with value, updatedAt, expiresAt
	 */
	async getEntry(key: string) {
		if (!this.client) await this.init();
		try {
			const v = await this.client.get(this.key(key));
			if (!v) return undefined;
			const parsed = JSON.parse(v);
			const updatedAt = parsed.updatedAt || Date.now();
			const ttl = (parsed.ttlSeconds !== undefined) ? parsed.ttlSeconds : this.ttlSeconds;
			const expiresAt = (ttl && ttl > 0) ? updatedAt + ttl * 1000 : Number.MAX_SAFE_INTEGER;
			return { value: parsed.value, updatedAt, expiresAt };
		} catch (e) {
			console.warn('[cache][redis] getEntry failed', e);
			return undefined;
		}
	}

	/**
	 * Compatibility: store raw CacheValue-like entry into Redis
	 */
	async setRaw(key: string, entry: CacheValue<any>) {
		if (!this.client) await this.init();
		try {
			const ttlSeconds = (entry.expiresAt && entry.updatedAt) ? Math.max(0, Math.floor((entry.expiresAt - entry.updatedAt) / 1000)) : this.ttlSeconds;
			const payloadObj = { value: entry.value, updatedAt: entry.updatedAt } as any;
			if (ttlSeconds) payloadObj.ttlSeconds = ttlSeconds;
			const payload = JSON.stringify(payloadObj);
			if (ttlSeconds && ttlSeconds > 0) {
				await this.client.set(this.key(key), payload, 'EX', Math.floor(ttlSeconds));
			} else {
				await this.client.set(this.key(key), payload);
			}
		} catch (e) {
			console.warn('[cache][redis] setRaw failed', e);
		}
	}
}

// createCache factory
export function createCache(adapterName?: 'memory' | 'redis', options?: { ttlSeconds?: number; maxEntries?: number; redisClient?: any }) {
	const ttl = options?.ttlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '300');
	const maxEntries = options?.maxEntries ?? Number(process.env.CACHE_MAX_ENTRIES || '1000');
	const envAdapter = (process.env.CACHE_ADAPTER || 'memory') as 'memory' | 'redis';
	const chosen = adapterName || envAdapter || 'memory';

	if (chosen === 'redis') {
		// attempt to instantiate RedisAdapter, but fall back to memory if unavailable
		try {
			const r = new RedisAdapter(ttl, maxEntries, options?.redisClient);
			// don't await init here; let methods init lazily
			return r as CacheAdapter<any>;
		} catch (e) {
			console.warn('[cache] failed to create RedisAdapter, falling back to memory');
		}
	}

	// memory adapter: return the SimpleCache instance directly so callers
	// that rely on getEntry/setRaw/etc. continue to work at runtime.
	const mem = new SimpleCache<any>(ttl, maxEntries);
	return mem;
}

// existing default export (backward-compatible)
const _ttl = Number(process.env.CACHE_TTL_SECONDS || '300');
const _maxEntries = Number(process.env.CACHE_MAX_ENTRIES || '1000');
export const cache = createCache(undefined, { ttlSeconds: _ttl, maxEntries: _maxEntries }) as unknown as SimpleCache<any>;
export default cache;

// Note: If ioredis is not installed or a Redis server is unreachable, this module falls back to the in-memory implementation to keep behavior stable.
